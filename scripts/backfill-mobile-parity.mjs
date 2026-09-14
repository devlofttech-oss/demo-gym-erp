/**
 * Repairs records the Flutter app wrote before its parity fixes landed.
 *
 *   Dry run, every gym:      FIREBASE_SERVICE_ACCOUNT='<json>' node scripts/backfill-mobile-parity.mjs
 *   Dry run, one gym:        ... node scripts/backfill-mobile-parity.mjs --gym <gymId>
 *   Apply, one gym:          ... node scripts/backfill-mobile-parity.mjs --gym <gymId> --apply
 *   Apply everywhere:        ... node scripts/backfill-mobile-parity.mjs --apply
 *
 * Nothing is written without --apply. Start with a dry run, read the summary,
 * then apply to a single gym before running it across the estate.
 *
 * Why this exists: mobile used to store display labels where web stores slugs
 * ("Personal Training" vs "personal-training"), and a handful of fields under
 * different names. Mobile now writes web's shape and reads either, but WEB
 * still reads strictly — so records written by the old app stay invisible
 * there until they are rewritten. That is what this does.
 *
 * Safe to re-run: every rule is a no-op once a record is already correct, and
 * nothing here overwrites a value that is already in web's vocabulary.
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) {
  console.error('FIREBASE_SERVICE_ACCOUNT is not set.');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const gymFlag = process.argv.indexOf('--gym');
const ONLY_GYM = gymFlag !== -1 ? process.argv[gymFlag + 1] : null;

initializeApp({ credential: cert(JSON.parse(raw)) });
const db = getFirestore();

// ── Vocabularies ────────────────────────────────────────────────────────────
// Keyed by the normalised form so any casing or spacing variant maps home.
const norm = (v) => String(v ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-');

const PLAN_TYPES = {
  'gym': 'gym',
  'personal-training': 'personal-training',
  'group-class': 'group-class',
  'day-pass': 'day-pass',
  'addon': 'addon',
  'add-on': 'addon',
};

const LEAD_STATUSES = ['new', 'contacted', 'follow-up', 'interested', 'won', 'lost'];
const LEAD_SOURCES = ['walk-in', 'phone', 'whatsapp', 'website', 'referral', 'other'];

// Old mobile wrote Percent/Fixed against a `commission` amount. Web's model is
// salary | commission | both with `commissionPercent`.
const COMMISSION_TYPES = {
  'percent': 'commission',
  'fixed': 'salary',
  'salary': 'salary',
  'commission': 'commission',
  'both': 'both',
};

/** "9:00 AM" / "9:00 pm" -> "09:00" / "21:00". Already-24h values pass through. */
function to24h(value) {
  const v = String(value ?? '').trim();
  if (!v) return null;
  if (/^\d{2}:\d{2}$/.test(v)) return null; // already correct
  const m = v.match(/^(\d{1,2}):(\d{2})\s*([AaPp])\.?[Mm]\.?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toLowerCase() === 'p') h += 12;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

const stats = {};
const bump = (key, n = 1) => { stats[key] = (stats[key] || 0) + n; };

const writer = {
  ops: [],
  queue(ref, data, label) {
    this.ops.push({ ref, data });
    bump(label);
  },
  async flush() {
    if (!APPLY || this.ops.length === 0) { this.ops = []; return; }
    for (let i = 0; i < this.ops.length; i += 400) {
      const batch = db.batch();
      for (const op of this.ops.slice(i, i + 400)) batch.set(op.ref, op.data, { merge: true });
      await batch.commit();
    }
    this.ops = [];
  },
};

// ── Per-collection rules ────────────────────────────────────────────────────

async function fixPlans(gymId) {
  const snap = await db.collection(`gyms/${gymId}/plans`).get();
  for (const doc of snap.docs) {
    const type = doc.data().type;
    if (type == null || type === '') continue;
    const slug = PLAN_TYPES[norm(type)];
    if (!slug || slug === type) continue;
    writer.queue(doc.ref, { type: slug }, 'plans.type');
  }
}

async function fixLeads(gymId) {
  const snap = await db.collection(`gyms/${gymId}/leads`).get();
  for (const doc of snap.docs) {
    const d = doc.data();
    const patch = {};
    const status = norm(d.status);
    if (d.status && LEAD_STATUSES.includes(status) && d.status !== status) patch.status = status;
    const source = norm(d.source);
    if (d.source && LEAD_SOURCES.includes(source) && d.source !== source) patch.source = source;
    if (Object.keys(patch).length) writer.queue(doc.ref, patch, 'leads.status/source');
  }
}

async function fixStaff(gymId) {
  const snap = await db.collection(`gyms/${gymId}/staff`).get();
  for (const doc of snap.docs) {
    const d = doc.data();
    const patch = {};

    const mapped = COMMISSION_TYPES[norm(d.commissionType)];
    if (d.commissionType && mapped && d.commissionType !== mapped) patch.commissionType = mapped;

    // `commission` held the percentage under the old model.
    if (d.commissionPercent == null && d.commission != null && d.commission !== '') {
      patch.commissionPercent = Number(d.commission) || 0;
    }

    // Web links the app login through authUid.
    if (!d.authUid && d.uid) patch.authUid = d.uid;

    // Web stamps a qrId at creation; its staff QR card and both scanners
    // prefer it over the document id.
    if (!d.qrId) patch.qrId = `staff_${doc.id}`;

    // Old mobile stored this as an array; web's field is a plain string.
    if (Array.isArray(d.certifications)) patch.certifications = d.certifications.join(', ');

    if (Object.keys(patch).length) writer.queue(doc.ref, patch, 'staff');
  }
}

async function fixPayments(gymId) {
  const snap = await db.collection(`gyms/${gymId}/payments`).get();
  for (const doc of snap.docs) {
    const d = doc.data();
    const patch = {};
    if (d.discountAmount == null && d.discountAmt != null) patch.discountAmount = d.discountAmt;
    if (d.discountPercent == null && d.discountPct != null) patch.discountPercent = d.discountPct;
    if (Object.keys(patch).length) writer.queue(doc.ref, patch, 'payments.discount');
  }
}

async function fixClasses(gymId) {
  const snap = await db.collection(`gyms/${gymId}/classes`).get();
  for (const doc of snap.docs) {
    const schedule = doc.data().schedule;
    if (!Array.isArray(schedule)) continue;
    let touched = false;
    const next = schedule.map((slot) => {
      const start = to24h(slot?.startTime);
      const end = to24h(slot?.endTime);
      if (!start && !end) return slot;
      touched = true;
      return { ...slot, ...(start && { startTime: start }), ...(end && { endTime: end }) };
    });
    if (touched) writer.queue(doc.ref, { schedule: next }, 'classes.schedule');
  }
}

/**
 * Old mobile wrote gym info onto the gym document; web keeps it in
 * settings/general under gymInfo. Copy across only the keys web is missing, so
 * anything already set on web wins.
 */
async function fixSettings(gymId) {
  const gymSnap = await db.doc(`gyms/${gymId}`).get();
  const gym = gymSnap.data() || {};
  const ref = db.doc(`gyms/${gymId}/settings/general`);
  const info = (await ref.get()).data()?.gymInfo || {};

  const mapping = {
    name: gym.name,
    location: gym.address,
    contact: gym.phone,
    email: gym.email,
    openingHours: gym.workingHours,
    gstNumber: gym.gstNumber,
    website: gym.website,
    instagram: gym.instagram,
  };

  const patch = {};
  for (const [key, value] of Object.entries(mapping)) {
    const existing = info[key];
    const hasExisting = typeof existing === 'string' && existing.trim() !== '';
    const hasIncoming = typeof value === 'string' && value.trim() !== '';
    if (!hasExisting && hasIncoming) patch[key] = value;
  }
  if (Object.keys(patch).length) {
    writer.queue(ref, { gymInfo: { ...info, ...patch } }, 'settings.gymInfo');
  }
}

// ── Runner ──────────────────────────────────────────────────────────────────

async function run() {
  const gyms = ONLY_GYM
    ? [ONLY_GYM]
    : (await db.collection('gyms').get()).docs.map((d) => d.id);

  console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} across ${gyms.length} gym(s)\n`);

  for (const gymId of gyms) {
    await fixPlans(gymId);
    await fixLeads(gymId);
    await fixStaff(gymId);
    await fixPayments(gymId);
    await fixClasses(gymId);
    await fixSettings(gymId);
    await writer.flush();
    process.stdout.write('.');
  }

  console.log('\n');
  const rows = Object.entries(stats).sort();
  if (rows.length === 0) {
    console.log('Nothing to change — every record already matches web.');
  } else {
    for (const [label, count] of rows) {
      console.log(`  ${String(count).padStart(5)}  ${label}`);
    }
    console.log(
      APPLY
        ? '\nDone.'
        : '\nNo changes written. Re-run with --apply to commit them.'
    );
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
