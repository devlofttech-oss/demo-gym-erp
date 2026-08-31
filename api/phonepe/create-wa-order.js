// POST /api/phonepe/create-wa-order
//
// Starts a PhonePe checkout for 1 000 WhatsApp credits at ₹100.
// On payment success the callback/status endpoints call grantWaCredits().
//
// Auth: "Authorization: Bearer <firebase-id-token>". Caller must be admin of gym.
// Body: { gymId }
// Returns: { merchantOrderId, redirectUrl, amountInr, credits }
import { FieldValue, getDb, verifyIdToken } from '../_lib/firebaseAdmin.js';
import { buildWaOrderId, createOrder } from '../_lib/phonepe.js';

const WA_CREDITS_PER_PACK = 1000;
const WA_PACK_PRICE_INR = 100;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let uid;
  try {
    ({ uid } = await verifyIdToken(req.headers.authorization));
  } catch (e) {
    return res.status(401).json({ error: e.message || 'Unauthorized' });
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body || {};
  const { gymId } = body;
  if (!gymId) return res.status(400).json({ error: 'gymId is required' });

  const db = getDb();

  // ── Authorize: admin of the gym only ─────────────────────────────────────
  try {
    const user = (await db.doc(`users/${uid}`).get()).data();
    if (!user) return res.status(403).json({ error: 'No user profile' });
    const gyms = user.gymIds?.length ? user.gymIds : user.gymId ? [user.gymId] : [];
    const isSuper = user.role === 'superadmin';
    if (!isSuper && !(user.role === 'admin' && gyms.includes(gymId))) {
      return res.status(403).json({ error: 'Only a gym admin can buy WhatsApp credits' });
    }
  } catch (e) {
    return res.status(500).json({ error: `Authorization check failed: ${e.message}` });
  }

  const gymSnap = await db.doc(`gyms/${gymId}`).get();
  if (!gymSnap.exists) return res.status(404).json({ error: 'Unknown gym' });
  const gym = gymSnap.data();

  const merchantOrderId = buildWaOrderId(gymId);
  const base = process.env.PUBLIC_BASE_URL || `https://${req.headers.host}`;

  // Write order BEFORE calling PhonePe (same pattern as ERP plan orders).
  await db.doc(`gyms/${gymId}/waOrders/${merchantOrderId}`).set({
    merchantOrderId,
    gymId,
    credits: WA_CREDITS_PER_PACK,
    amountPaise: WA_PACK_PRICE_INR * 100,
    amountInr: WA_PACK_PRICE_INR,
    status: 'CREATED',
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  try {
    const { phonePeOrderId, redirectUrl, expireAt } = await createOrder({
      merchantOrderId,
      amountInr: WA_PACK_PRICE_INR,
      message: `Kilos WhatsApp credits (${WA_CREDITS_PER_PACK}) for ${gym.name || 'your gym'}`,
      redirectUrl: `${base}/whatsapp-credits/return?orderId=${encodeURIComponent(merchantOrderId)}`,
      metaInfo: { udf1: gymId, udf2: 'wa-credits' },
    });

    await db.doc(`gyms/${gymId}/waOrders/${merchantOrderId}`).set(
      { status: 'PENDING', phonePeOrderId, expireAt: expireAt || null, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

    return res.status(200).json({
      merchantOrderId,
      redirectUrl,
      amountInr: WA_PACK_PRICE_INR,
      credits: WA_CREDITS_PER_PACK,
    });
  } catch (e) {
    await db.doc(`gyms/${gymId}/waOrders/${merchantOrderId}`).set(
      { status: 'CREATE_FAILED', failureReason: e.message, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return res.status(502).json({ error: 'Could not start the payment. Please try again.' });
  }
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
