import { auth } from '../firebase/config';

// Calls the PhonePe serverless endpoints (api/phonepe/*).
//
// NOTE: like the WhatsApp helper, these only work on the deployed Vercel site
// (or under `vercel dev`). Plain `npm run dev` does not serve /api.

async function post(path, body) {
  const user = auth.currentUser;
  if (!user) throw new Error('You must be signed in');
  const token = await user.getIdToken();

  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  let data;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) throw new Error(data.error || `Request failed (HTTP ${res.status})`);
  return data;
}

/** Starts a checkout. Returns { merchantOrderId, redirectUrl, amountInr, planName }. */
export function createSubscriptionOrder({ gymId, planId }) {
  return post('/api/phonepe/create-order', { gymId, planId });
}

/**
 * Asks PhonePe what happened to an order and applies it if paid.
 * Returns { state: 'PENDING' | 'COMPLETED' | 'FAILED', applied, planEndDate? }.
 *
 * Landing back on the return URL is not proof of payment, so this is what the
 * return page actually trusts.
 */
export function checkSubscriptionOrder({ gymId, merchantOrderId }) {
  return post('/api/phonepe/status', { gymId, merchantOrderId });
}

/** Starts a PhonePe checkout for 1 000 WA credits at ₹100. */
export function createWaCreditsOrder({ gymId }) {
  return post('/api/phonepe/create-wa-order', { gymId });
}

/** Polls the status of a WA credits order and grants credits if paid. */
export function checkWaCreditsOrder({ gymId, merchantOrderId }) {
  return post('/api/phonepe/status', { gymId, merchantOrderId });
}
