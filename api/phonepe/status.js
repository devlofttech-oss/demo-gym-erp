// POST /api/phonepe/status
//
// Asks PhonePe what actually happened to an order, and grants the plan if it
// succeeded. The app calls this when it returns to the foreground after a
// checkout, and the /subscription/return page polls it.
//
// This exists because the webhook can be late, retried, or lost, and because
// the redirect back from PhonePe carries no proof of anything. Never treat a
// user landing on the return URL as payment — ask PhonePe.
//
// Auth: "Authorization: Bearer <firebase-id-token>", admin of the gym.
// Body: { gymId, merchantOrderId }
// Returns: { state, applied, planEndDate? }
import { getDb, verifyIdToken } from '../_lib/firebaseAdmin.js';
import { getOrderStatus } from '../_lib/phonepe.js';
import { grantPaidOrder, markOrderFailed } from '../_lib/subscription.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let uid;
  try {
    ({ uid } = await verifyIdToken(req.headers.authorization));
  } catch (e) {
    return res.status(401).json({ error: e.message || 'Unauthorized' });
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body || {};
  const { gymId, merchantOrderId } = body;
  if (!gymId || !merchantOrderId) {
    return res.status(400).json({ error: 'gymId and merchantOrderId are required' });
  }

  const db = getDb();
  try {
    const user = (await db.doc(`users/${uid}`).get()).data();
    if (!user) return res.status(403).json({ error: 'No user profile' });
    const gyms = user.gymIds?.length ? user.gymIds : user.gymId ? [user.gymId] : [];
    if (user.role !== 'superadmin' && !gyms.includes(gymId)) {
      return res.status(403).json({ error: 'Not authorized for this gym' });
    }
  } catch (e) {
    return res.status(500).json({ error: `Authorization check failed: ${e.message}` });
  }

  let state;
  let amount;
  try {
    ({ state, amount } = await getOrderStatus(merchantOrderId));
  } catch (e) {
    return res.status(502).json({ error: 'Could not reach PhonePe', detail: e.message });
  }

  if (state === 'COMPLETED') {
    const result = await grantPaidOrder({ gymId, merchantOrderId, paidAmountPaise: amount });
    return res.status(200).json({ state, ...result });
  }

  if (state === 'FAILED') {
    await markOrderFailed(gymId, merchantOrderId, 'FAILED');
    return res.status(200).json({ state, applied: false });
  }

  return res.status(200).json({ state: state || 'PENDING', applied: false });
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
