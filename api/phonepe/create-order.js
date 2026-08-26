// POST /api/phonepe/create-order
//
// Starts a PhonePe Standard Checkout for a gym subscription plan and returns the
// hosted checkout URL for the caller to open.
//
// Auth: "Authorization: Bearer <firebase-id-token>". The caller must be a
// superadmin, or an admin of the gym being renewed — staff cannot buy.
//
// Body: { gymId, planId }
// Returns: { merchantOrderId, redirectUrl, amountInr, planName }
//
// The price is read from subscriptionPlans, never from the request. A client
// that could name its own amount could buy a year for one rupee.
import { FieldValue, getDb, verifyIdToken } from '../_lib/firebaseAdmin.js';
import { buildMerchantOrderId, createOrder } from '../_lib/phonepe.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let uid;
  try {
    ({ uid } = await verifyIdToken(req.headers.authorization));
  } catch (e) {
    return res.status(401).json({ error: e.message || 'Unauthorized' });
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body || {};
  const { gymId, planId } = body;
  if (!gymId || !planId) return res.status(400).json({ error: 'gymId and planId are required' });

  const db = getDb();

  // ── Authorize ─────────────────────────────────────────────────────────────
  try {
    const user = (await db.doc(`users/${uid}`).get()).data();
    if (!user) return res.status(403).json({ error: 'No user profile' });
    const gyms = user.gymIds?.length ? user.gymIds : user.gymId ? [user.gymId] : [];
    const isSuper = user.role === 'superadmin';
    if (!isSuper && !(user.role === 'admin' && gyms.includes(gymId))) {
      return res.status(403).json({ error: 'Only a gym admin can buy a subscription' });
    }
  } catch (e) {
    return res.status(500).json({ error: `Authorization check failed: ${e.message}` });
  }

  // ── Plan and gym ──────────────────────────────────────────────────────────
  const [planSnap, gymSnap] = await Promise.all([
    db.doc(`subscriptionPlans/${planId}`).get(),
    db.doc(`gyms/${gymId}`).get(),
  ]);
  if (!planSnap.exists) return res.status(404).json({ error: 'Unknown plan' });
  if (!gymSnap.exists) return res.status(404).json({ error: 'Unknown gym' });

  const plan = planSnap.data();
  const gym = gymSnap.data();
  const amountInr = Number(plan.priceInr);
  const durationDays = Number(plan.durationDays);
  if (!Number.isFinite(amountInr) || amountInr < 1) {
    return res.status(409).json({ error: `Plan "${planId}" has no usable priceInr` });
  }
  if (!Number.isFinite(durationDays) || durationDays < 1) {
    return res.status(409).json({ error: `Plan "${planId}" has no usable durationDays` });
  }

  const merchantOrderId = buildMerchantOrderId(gymId);
  const base = process.env.PUBLIC_BASE_URL || `https://${req.headers.host}`;

  // Write the order BEFORE calling PhonePe. If the call fails we are left with
  // a CREATED row and no payment, which is harmless; the reverse — a payment
  // PhonePe knows about and we do not — would strand the customer's money.
  await db.doc(`gyms/${gymId}/subscriptionOrders/${merchantOrderId}`).set({
    merchantOrderId,
    gymId,
    planId,
    planName: plan.name || planId,
    durationDays,
    amountPaise: Math.round(amountInr * 100),
    amountInr,
    status: 'CREATED',
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  try {
    const { phonePeOrderId, redirectUrl, expireAt } = await createOrder({
      merchantOrderId,
      amountInr,
      message: `Kilos ${plan.name || planId} for ${gym.name || 'your gym'}`,
      // Where PhonePe sends the customer afterwards. This is UI only — arriving
      // here proves nothing about payment, so the page polls /api/phonepe/status.
      redirectUrl: `${base}/subscription/return?orderId=${encodeURIComponent(merchantOrderId)}`,
      metaInfo: { udf1: gymId, udf2: planId },
    });

    await db.doc(`gyms/${gymId}/subscriptionOrders/${merchantOrderId}`).set(
      { status: 'PENDING', phonePeOrderId, expireAt: expireAt || null, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

    return res.status(200).json({ merchantOrderId, redirectUrl, amountInr, planName: plan.name || planId });
  } catch (e) {
    await db.doc(`gyms/${gymId}/subscriptionOrders/${merchantOrderId}`).set(
      { status: 'CREATE_FAILED', failureReason: e.message, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return res.status(502).json({ error: 'Could not start the payment. Please try again.' });
  }
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
