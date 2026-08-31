// POST /api/phonepe/callback
//
// PhonePe's server-to-server webhook. This is the authoritative signal that a
// payment succeeded — the browser redirect back to the app proves nothing and is
// trivially forged, so paid time is only ever granted here (and by the status
// endpoint, which re-checks with PhonePe directly).
//
// Register the URL in PhonePe Business -> Developer Settings -> Webhooks, with
// a username and password. PhonePe then signs every call with
// `Authorization: SHA256(username:password)`; the same pair must be set as
// PHONEPE_WEBHOOK_USERNAME / PHONEPE_WEBHOOK_PASSWORD in Vercel.
//
// Always answers 200 once the caller is authenticated. A non-2xx makes PhonePe
// retry, and retrying will not fix an order we cannot resolve — the row is
// recorded and the status endpoint reconciles it later.
import { gymIdFromMerchantOrderId, gymIdFromWaOrderId, verifyWebhookAuth } from '../_lib/phonepe.js';
import { grantPaidOrder, grantWaCredits, markOrderFailed, markWaOrderFailed } from '../_lib/subscription.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!verifyWebhookAuth(req.headers.authorization)) {
    // Deliberately terse: do not tell an unauthenticated caller what was wrong.
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body || {};
  const payload = body.payload || {};

  // Only act on checkout events. Refund webhooks (pg.refund.*) also carry
  // payload.state "COMPLETED"; they name the order in originalMerchantOrderId
  // rather than merchantOrderId, so today they would fall through harmlessly —
  // but that is an accident of field naming, not a decision. Gate on the event
  // so ticking the refund events in the dashboard can never grant a plan.
  const event = String(body.event || '');
  if (event && !event.startsWith('checkout.order.')) {
    return res.status(200).json({ ok: true, ignored: `event=${event}` });
  }

  const merchantOrderId = payload.merchantOrderId;
  if (!merchantOrderId) return res.status(200).json({ ok: true, ignored: 'no merchantOrderId' });

  const isWaOrder = String(merchantOrderId).startsWith('KILOWA-');
  const gymId = isWaOrder
    ? (gymIdFromWaOrderId(merchantOrderId) || payload.metaInfo?.udf1 || null)
    : (gymIdFromMerchantOrderId(merchantOrderId) || payload.metaInfo?.udf1 || null);
  if (!gymId) return res.status(200).json({ ok: true, ignored: 'unresolvable gym' });

  const state = payload.state;

  try {
    if (state === 'COMPLETED') {
      if (isWaOrder) {
        const result = await grantWaCredits({
          gymId,
          merchantOrderId,
          paidAmountPaise: payload.amount,
          phonePeOrderId: payload.orderId,
        });
        return res.status(200).json({ ok: true, ...result });
      }
      const result = await grantPaidOrder({
        gymId,
        merchantOrderId,
        paidAmountPaise: payload.amount,
        phonePeOrderId: payload.orderId,
      });
      return res.status(200).json({ ok: true, ...result });
    }

    if (state === 'FAILED') {
      if (isWaOrder) {
        await markWaOrderFailed(gymId, merchantOrderId, payload.errorCode || 'FAILED');
      } else {
        await markOrderFailed(gymId, merchantOrderId, payload.errorCode || 'FAILED');
      }
      return res.status(200).json({ ok: true, applied: false, reason: 'failed' });
    }

    // PENDING and anything unrecognised: nothing to do yet.
    return res.status(200).json({ ok: true, applied: false, reason: `state=${state}` });
  } catch (e) {
    // Swallow rather than 500, so PhonePe does not retry a request that will
    // fail identically. The order stays PENDING and status polling picks it up.
    console.error('phonepe callback', merchantOrderId, e);
    return res.status(200).json({ ok: true, applied: false, reason: 'error' });
  }
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
