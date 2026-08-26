/**
 * Seeds the Kilos subscription catalogue into Firestore.
 *
 *   FIREBASE_SERVICE_ACCOUNT='<service-account-json>' node scripts/seed-subscription-catalogue.mjs
 *
 * Idempotent — documents use fixed ids and are merged, so re-running updates
 * prices in place rather than creating duplicates. Uses the Admin SDK because
 * subscriptionPlans is superadmin-write-only under firestore.rules.
 *
 * The feature list is stored ONCE in appConfig/subscriptionFeatures rather than
 * copied into each plan: all four plans advertise the same features, and four
 * copies would drift the first time marketing copy changes. Both the web app
 * and the Flutter app read it from here, so there is a single source of truth
 * across platforms too.
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) {
  console.error('FIREBASE_SERVICE_ACCOUNT is not set.');
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(raw)) });
const db = getFirestore();

// ── Plans ───────────────────────────────────────────────────────────────────
// priceInr is rupees. durationDays is what extends gyms/{gymId}.planEndDate.
const PLANS = [
  { id: 'annual',      name: 'Annual Package',    durationDays: 365, priceInr: 2599, badge: 'MOST POPULAR', sortOrder: 1 },
  { id: 'half_yearly', name: '6 Month Package',   durationDays: 182, priceInr: 1799, badge: '',             sortOrder: 2 },
  { id: 'quarterly',   name: '3 Month Package',   durationDays: 91,  priceInr: 999,  badge: '',             sortOrder: 3 },
  { id: 'monthly',     name: 'Monthly Package',   durationDays: 30,  priceInr: 399,  badge: '',             sortOrder: 4 },
];

// ── Features ────────────────────────────────────────────────────────────────
// `highlight` marks the three that render emphasised at the top of the card.
// Everything past `visibleCount` sits behind "View more".
// Icon names are Material Symbols, which both the web app and the Flutter app
// already bundle, so one name renders on every platform.
const FEATURES = [
  { icon: 'group',                label: 'Unlimited Members',                             highlight: true  },
  { icon: 'devices',              label: 'Android, iOS & Web cross-platform',             highlight: true  },
  { icon: 'chat',                 label: 'WhatsApp automation (1000 free message credits)', highlight: true },
  { icon: 'qr_code_scanner',      label: 'QR attendance check-in',                        highlight: false },
  { icon: 'badge',                label: 'Unlimited staff logins',                        highlight: false },
  { icon: 'store',                label: 'Multiple branches (up to 3)',                   highlight: false },
  { icon: 'person_add',           label: 'Leads & CRM',                                   highlight: false },
  { icon: 'bar_chart',            label: 'Advanced business reports',                     highlight: false },
  // ── "View more" fold ──
  { icon: 'cloud_done',           label: '100% cloud-based secure access',                highlight: false },
  { icon: 'backup',               label: 'Automatic cloud backups',                       highlight: false },
  { icon: 'event_available',      label: 'Attendance management',                         highlight: false },
  { icon: 'notifications_active', label: 'Expiry & due reminders',                        highlight: false },
  { icon: 'notifications',        label: 'Real-time notifications',                       highlight: false },
  { icon: 'picture_as_pdf',       label: 'PDF invoice generation',                        highlight: false },
  { icon: 'receipt_long',         label: 'Expense tracker',                               highlight: false },
  { icon: 'upload_file',          label: 'Bulk import & export members',                  highlight: false },
  { icon: 'support_agent',        label: '24x7 chat & call support',                      highlight: false },
];

const VISIBLE_COUNT = 8;

// ── Add-ons ─────────────────────────────────────────────────────────────────
// Seeded so the pricing lives with everything else, but NOT purchasable yet —
// biometric is an entitlement per branch and credits are a consumable balance,
// so neither is served by the plan checkout that extends planEndDate.
const ADD_ONS = [
  {
    id: 'biometric_access',
    name: 'Biometric Access',
    description: 'Access control hardware integration, priced per branch.',
    priceInr: 1499,
    unit: 'per branch / year',
    durationDays: 365,
    kind: 'entitlement',
    sortOrder: 1,
  },
  {
    id: 'whatsapp_credits',
    name: 'WhatsApp Credits',
    description: '1000 message credits.',
    priceInr: 100,
    unit: 'per 1000 credits',
    kind: 'consumable',
    creditsPerUnit: 1000,
    sortOrder: 2,
    // Shown as guidance on the top-up screen; the gym still buys any quantity.
    suggestions: [
      { members: 100, priceInr: 100, credits: 700 },
      { members: 150, priceInr: 200, credits: 1400 },
      { members: 200, priceInr: 300, credits: 2100 },
      { members: 250, priceInr: 450, credits: 3200 },
      { members: 300, priceInr: 550, credits: 3900 },
    ],
  },
];

async function main() {
  const stamp = { updatedAt: FieldValue.serverTimestamp() };

  for (const { id, ...plan } of PLANS) {
    await db.collection('subscriptionPlans').doc(id).set({ ...plan, ...stamp }, { merge: true });
    console.log(`plan      ${id.padEnd(14)} Rs ${String(plan.priceInr).padStart(5)}  ${plan.durationDays}d`);
  }

  await db.collection('appConfig').doc('subscriptionFeatures').set(
    { features: FEATURES, visibleCount: VISIBLE_COUNT, ...stamp },
    { merge: true },
  );
  console.log(`features  ${FEATURES.length} total, ${VISIBLE_COUNT} shown before "View more"`);

  for (const { id, ...addOn } of ADD_ONS) {
    await db.collection('subscriptionAddOns').doc(id).set({ ...addOn, ...stamp }, { merge: true });
    console.log(`add-on    ${id.padEnd(14)} Rs ${String(addOn.priceInr).padStart(5)}  ${addOn.unit}`);
  }

  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
