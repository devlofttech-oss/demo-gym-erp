// Daily cron: automated WhatsApp reminders across all gyms.
//
// Triggers:
//   renewal — member expiryDate is exactly 3 days away OR 3 days past, and balanceFees = 0
//   payment — member has balanceFees > 0, not already sent in the last 30 days
//
// Called by Vercel scheduler at 04:00 UTC (09:30 IST) via vercel.json crons.
// Protected by CRON_SECRET env var — Vercel injects "Authorization: Bearer <secret>" automatically.

import { getDb, FieldValue } from '../_lib/firebaseAdmin.js';
import { normalizePhone, sendTemplateMessage } from '../_lib/whatsapp.js';
import { buildTemplate } from '../_lib/whatsappTemplates.js';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = getDb();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const plus3Str  = isoDate(shift(today,  3));
  const minus3Str = isoDate(shift(today, -3));
  const cutoff7   = shift(today,  -7);
  const cutoff30  = shift(today, -30);

  const gymsSnap = await db.collection('gyms').get();

  let totalSent = 0;
  let totalSkipped = 0;

  for (const gymDoc of gymsSnap.docs) {
    const gymId = gymDoc.id;
    const gym   = { id: gymId, ...gymDoc.data() };

    if ((gym.waCredits || 0) <= 0) continue;

    const [membersSnap, logsSnap] = await Promise.all([
      db.collection(`gyms/${gymId}/members`).get(),
      db.collection(`gyms/${gymId}/messageLogs`)
        .where('createdAt', '>=', cutoff30)
        .where('status', '==', 'sent')
        .get(),
    ]);

    // Build dedup index: memberId → { type: latestSentDate }
    const lastSent = {};
    for (const log of logsSnap.docs) {
      const { memberId, type, createdAt } = log.data();
      const ts = createdAt?.toDate?.() ?? null;
      if (!ts) continue;
      if (!lastSent[memberId]) lastSent[memberId] = {};
      if (!lastSent[memberId][type] || ts > lastSent[memberId][type]) {
        lastSent[memberId][type] = ts;
      }
    }

    let gymSent = 0;

    for (const doc of membersSnap.docs) {
      const member  = { id: doc.id, ...doc.data() };
      const phone   = normalizePhone(member.phone);
      if (!phone) continue;

      const balance = Number(member.balanceFees || 0);
      const expiry  = member.expiryDate; // stored as YYYY-MM-DD string

      let type = null;

      // Renewal: plan hits the 3-day window and member owes nothing
      if (balance === 0 && expiry && (expiry === plus3Str || expiry === minus3Str)) {
        const last = lastSent[member.id]?.renewal;
        if (!last || last < cutoff7) type = 'renewal';
      }

      // Payment due: outstanding balance, not reminded in last 30 days
      if (!type && balance > 0) {
        const last = lastSent[member.id]?.payment;
        if (!last || last < cutoff30) type = 'payment';
      }

      if (!type) { totalSkipped++; continue; }

      try {
        const { template, language, category, components } = buildTemplate(type, member, gym);
        const r = await sendTemplateMessage({ to: phone, template, language, components });

        await db.collection(`gyms/${gymId}/messageLogs`).add({
          to:         phone,
          memberId:   member.id,
          memberName: member.name || '',
          channel:    'WhatsApp',
          type,
          template,
          category,
          status:     r.ok ? 'sent' : 'failed',
          wamid:      r.ok ? r.wamid : null,
          error:      r.ok ? null : r.error,
          sentBy:     'cron',
          createdAt:  FieldValue.serverTimestamp(),
        });

        if (r.ok) gymSent++;
        else totalSkipped++;
      } catch (e) {
        console.error(`cron send failed — gym:${gymId} member:${member.id}`, e.message);
        totalSkipped++;
      }
    }

    if (gymSent > 0) {
      await db.doc(`gyms/${gymId}`).update({ waCredits: FieldValue.increment(-gymSent) });
    }
    totalSent += gymSent;
  }

  console.log(`whatsapp-daily: sent=${totalSent} skipped=${totalSkipped}`);
  return res.status(200).json({ sent: totalSent, skipped: totalSkipped });
}

function shift(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isoDate(date) {
  return date.toISOString().split('T')[0];
}
