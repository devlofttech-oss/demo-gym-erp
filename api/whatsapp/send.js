// POST /api/whatsapp/send
// Authenticated endpoint that sends a pre-approved WhatsApp template to one or
// many members of a gym, and logs each send to Firestore.
//
// Auth: caller sends "Authorization: Bearer <firebase-id-token>". We verify it,
// then confirm the user is a superadmin or an admin/staff of the requested gym.
//
// Body: { gymId, type, memberIds: string[], extra?: { body?, className?, amount? } }
//   type ∈ 'renewal' | 'payment' | 'class' | 'announcement'
//
// Returns: { sent, failed, results: [{ memberId, status, error }] }
import { getAdmin, getDb, verifyIdToken } from '../_lib/firebaseAdmin.js';
import { normalizePhone, sendTemplateMessage } from '../_lib/whatsapp.js';
import { buildTemplate, TEMPLATE_TYPES } from '../_lib/whatsappTemplates.js';

const MAX_RECIPIENTS = 1000; // hard safety cap per request
const CHUNK = 15; // messages sent in parallel per batch

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Auth ────────────────────────────────────────────────────────────────
  let uid;
  try {
    const decoded = await verifyIdToken(req.headers.authorization);
    uid = decoded.uid;
  } catch (e) {
    return res.status(401).json({ error: e.message || 'Unauthorized' });
  }

  // ── Validate body ───────────────────────────────────────────────────────
  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body || {};
  const { gymId, type, memberIds, extra } = body;
  if (!gymId || !type || !Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({ error: 'gymId, type and a non-empty memberIds[] are required' });
  }
  if (!TEMPLATE_TYPES.includes(type)) {
    return res.status(400).json({ error: `Unknown type "${type}"` });
  }
  if (type === 'announcement' && !extra?.body?.trim()) {
    return res.status(400).json({ error: 'Announcement requires a message body' });
  }

  const db = getDb();
  const admin = getAdmin();

  // ── Authorize this user for this gym ─────────────────────────────────────
  try {
    const userSnap = await db.doc(`users/${uid}`).get();
    const user = userSnap.data();
    if (!user) return res.status(403).json({ error: 'No user profile' });
    const gyms = user.gymIds?.length ? user.gymIds : (user.gymId ? [user.gymId] : []);
    const allowed = user.role === 'superadmin' || gyms.includes(gymId);
    if (!allowed) return res.status(403).json({ error: 'Not authorized for this gym' });
  } catch (e) {
    return res.status(500).json({ error: `Authorization check failed: ${e.message}` });
  }

  // ── Load gym (for gym name in templates) ─────────────────────────────────
  let gym = { id: gymId };
  try {
    const gymSnap = await db.doc(`gyms/${gymId}`).get();
    gym = { id: gymId, ...(gymSnap.data() || {}) };
  } catch { /* fall back to id-only gym */ }

  const ids = [...new Set(memberIds)].slice(0, MAX_RECIPIENTS);
  const results = [];

  for (let i = 0; i < ids.length; i += CHUNK) {
    const batch = ids.slice(i, i + CHUNK);
    const settled = await Promise.all(
      batch.map((memberId) => sendToMember({ db, admin, gymId, gym, memberId, type, extra, uid }))
    );
    results.push(...settled);
  }

  const sent = results.filter((r) => r.status === 'sent').length;
  return res.status(200).json({ sent, failed: results.length - sent, results });
}

async function sendToMember({ db, admin, gymId, gym, memberId, type, extra, uid }) {
  try {
    const snap = await db.doc(`gyms/${gymId}/members/${memberId}`).get();
    if (!snap.exists) return { memberId, status: 'failed', error: 'Member not found' };
    const member = { id: memberId, ...snap.data() };

    const to = normalizePhone(member.phone);
    if (!to) return { memberId, status: 'failed', error: 'No valid phone number' };

    const { template, language, category, components } = buildTemplate(type, member, gym, extra);
    const r = await sendTemplateMessage({ to, template, language, components });

    // Log every attempt (sent or failed) for audit + status.
    await db.collection(`gyms/${gymId}/messageLogs`).add({
      to,
      memberId,
      memberName: member.name || '',
      channel: 'WhatsApp',
      type,
      template,
      category,
      status: r.ok ? 'sent' : 'failed',
      wamid: r.ok ? r.wamid : null,
      error: r.ok ? null : r.error,
      sentBy: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { memberId, status: r.ok ? 'sent' : 'failed', error: r.ok ? null : r.error };
  } catch (e) {
    return { memberId, status: 'failed', error: e.message };
  }
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
