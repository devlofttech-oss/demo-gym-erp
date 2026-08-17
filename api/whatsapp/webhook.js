// GET/POST /api/whatsapp/webhook
// Receives WhatsApp Cloud API webhooks and updates delivery/read status on the
// matching messageLogs doc.
//
//   GET  - Meta's subscription verification handshake (uses WHATSAPP_VERIFY_TOKEN)
//   POST - status callbacks (sent / delivered / read / failed) per wamid
//
// Env vars (Vercel, server-only):
//   WHATSAPP_VERIFY_TOKEN  - any string you choose; must match what you type in
//                            the Meta webhook config "Verify token" field.
//
// NOTE: we intentionally keep this send-only — incoming member *messages*
// (change.value.messages) are ignored for now (no reply inbox). We only apply
// status updates. HMAC signature verification is omitted (the verify-token
// handshake gates the subscription; status updates are low-risk). It can be
// added later with WHATSAPP_APP_SECRET + raw-body verification if needed.
import { getAdmin, getDb } from '../_lib/firebaseAdmin.js';

export default async function handler(req, res) {
  // ── Verification handshake ────────────────────────────────────────────────
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Always ack with 200 so Meta doesn't retry; process best-effort.
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    await processStatuses(body);
  } catch (e) {
    console.error('[whatsapp webhook] processing error:', e?.message || e);
  }
  return res.status(200).json({ received: true });
}

async function processStatuses(body) {
  const db = getDb();
  const admin = getAdmin();
  const FieldValue = admin.firestore.FieldValue;

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const statuses = change.value?.statuses || [];
      for (const s of statuses) {
        const wamid = s.id;
        if (!wamid) continue;

        // Find the log we wrote when sending (matched by wamid across all gyms).
        const snap = await db
          .collectionGroup('messageLogs')
          .where('wamid', '==', wamid)
          .limit(1)
          .get();
        if (snap.empty) continue;

        const ref = snap.docs[0].ref;
        const update = {
          status: s.status || snap.docs[0].data().status,
          statusUpdatedAt: FieldValue.serverTimestamp(),
        };
        if (s.status === 'delivered') update.deliveredAt = FieldValue.serverTimestamp();
        if (s.status === 'read') update.readAt = FieldValue.serverTimestamp();
        if (s.status === 'failed') {
          update.error = s.errors?.[0]?.title || s.errors?.[0]?.message || 'failed';
        }
        await ref.update(update);
      }
    }
  }
}
