// PhonePe Payment Gateway — Standard Checkout v2.
//
// Server-only. PHONEPE_CLIENT_SECRET must never reach the browser or the app:
// with it, anyone can mint a valid token and forge a paid order.
//
// Env (Vercel project settings, not VITE_ prefixed):
//   PHONEPE_CLIENT_ID, PHONEPE_CLIENT_SECRET, PHONEPE_CLIENT_VERSION
//   PHONEPE_WEBHOOK_USERNAME, PHONEPE_WEBHOOK_PASSWORD  (set in the PhonePe
//     dashboard under Developer Settings -> Webhooks; used to authenticate
//     callbacks coming *from* PhonePe)
//   PHONEPE_ENV = 'sandbox' to point at UAT; anything else uses production.
import crypto from 'node:crypto';

const SANDBOX = process.env.PHONEPE_ENV === 'sandbox';

const HOSTS = SANDBOX
  ? {
      token: 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token',
      pay: 'https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay',
      status: (id) =>
        `https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/order/${id}/status`,
    }
  : {
      token: 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token',
      pay: 'https://api.phonepe.com/apis/pg/checkout/v2/pay',
      status: (id) => `https://api.phonepe.com/apis/pg/checkout/v2/order/${id}/status`,
    };

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

// ── Auth token ──────────────────────────────────────────────────────────────
// Cached in module scope so a warm serverless instance reuses it. PhonePe
// returns expires_at as epoch *seconds*; we refresh a minute early rather than
// racing the boundary and getting a 401 mid-checkout.
let cachedToken = null; // { value, expiresAtMs }

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAtMs) return cachedToken.value;

  const body = new URLSearchParams({
    client_id: required('PHONEPE_CLIENT_ID'),
    client_version: required('PHONEPE_CLIENT_VERSION'),
    client_secret: required('PHONEPE_CLIENT_SECRET'),
    grant_type: 'client_credentials',
  });

  const res = await fetch(HOSTS.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(`PhonePe auth failed (${res.status}): ${JSON.stringify(json)}`);
  }

  cachedToken = {
    value: json.access_token,
    expiresAtMs: Number(json.expires_at) * 1000 - 60_000,
  };
  return cachedToken.value;
}

async function authedFetch(url, init = {}) {
  const token = await getAccessToken();
  return fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `O-Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
}

// ── Order id ────────────────────────────────────────────────────────────────
// PhonePe allows up to 63 chars, alphanumerics plus `-` and `_`. Firestore auto
// ids are 20 alphanumeric chars, so embedding the gym id keeps the webhook —
// which only ever tells us the merchantOrderId — able to find the gym without a
// collection-group query or a second lookup document.
export function buildMerchantOrderId(gymId) {
  const suffix = crypto.randomBytes(8).toString('hex');
  return `KILOS-${gymId}-${suffix}`;
}

export function gymIdFromMerchantOrderId(merchantOrderId) {
  const m = /^KILOS-([A-Za-z0-9]+)-[0-9a-f]{16}$/.exec(merchantOrderId || '');
  return m ? m[1] : null;
}

export function buildWaOrderId(gymId) {
  const suffix = crypto.randomBytes(8).toString('hex');
  return `KILOWA-${gymId}-${suffix}`;
}

export function gymIdFromWaOrderId(merchantOrderId) {
  const m = /^KILOWA-([A-Za-z0-9]+)-[0-9a-f]{16}$/.exec(merchantOrderId || '');
  return m ? m[1] : null;
}

// ── API calls ───────────────────────────────────────────────────────────────

/**
 * Creates a checkout order. `amountInr` is rupees; PhonePe wants paise.
 * Returns { phonePeOrderId, redirectUrl, expireAt }.
 */
export async function createOrder({ merchantOrderId, amountInr, message, redirectUrl, metaInfo }) {
  const amount = Math.round(Number(amountInr) * 100);
  if (!Number.isFinite(amount) || amount < 100) {
    throw new Error(`Invalid amount: ${amountInr} (minimum is Rs 1)`);
  }

  const res = await authedFetch(HOSTS.pay, {
    method: 'POST',
    body: JSON.stringify({
      merchantOrderId,
      amount,
      expireAfter: 1800, // 30 min; PhonePe accepts 300-3600
      metaInfo,
      paymentFlow: {
        type: 'PG_CHECKOUT',
        message,
        merchantUrls: { redirectUrl },
      },
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.redirectUrl) {
    throw new Error(`PhonePe create-order failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return { phonePeOrderId: json.orderId, redirectUrl: json.redirectUrl, expireAt: json.expireAt };
}

/**
 * Authoritative order state, straight from PhonePe.
 * Returns { state: 'PENDING' | 'COMPLETED' | 'FAILED', amount, raw }.
 */
export async function getOrderStatus(merchantOrderId) {
  const res = await authedFetch(`${HOSTS.status(merchantOrderId)}?details=false`, { method: 'GET' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`PhonePe status failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return { state: json.state, amount: json.amount, raw: json };
}

// ── Webhook authentication ──────────────────────────────────────────────────
// PhonePe signs callbacks with `Authorization: SHA256(username:password)`,
// using the credentials configured in the dashboard. Anything that does not
// match is treated as forged and ignored — this endpoint is what grants paid
// time, so it is the one place worth being strict.
export function verifyWebhookAuth(authHeader) {
  const expected = crypto
    .createHash('sha256')
    .update(`${required('PHONEPE_WEBHOOK_USERNAME')}:${required('PHONEPE_WEBHOOK_PASSWORD')}`)
    .digest('hex');

  const received = String(authHeader || '').replace(/^SHA256\s+/i, '').trim().toLowerCase();
  if (received.length !== expected.length) return false;
  // Constant-time compare so a caller cannot probe the hash byte by byte.
  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}
