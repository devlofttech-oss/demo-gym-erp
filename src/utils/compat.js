/* Readers that accept either spelling of the values this product stores.
 *
 * Older builds of the Flutter app saved display labels where the web app saves
 * slugs ("Personal Training" vs "personal-training"), and kept a few fields
 * under different names. Mobile now writes the web shape, but records created
 * before that change still carry the old one.
 *
 * Rather than rewrite everybody's data, web reads both. Every comparison on
 * these fields should go through here instead of comparing the raw value, so a
 * record written by any version of either app resolves to the same thing.
 *
 * The Flutter app has matching helpers; keep the two in step. */

const slug = (v) => String(v ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-');

/** Plan type -> gym | personal-training | group-class | day-pass | addon */
export function planType(raw) {
  const s = slug(raw);
  return s === 'add-on' ? 'addon' : s;
}

/** Lead status -> new | contacted | follow-up | interested | won | lost */
export const leadStatus = slug;

/** Lead source -> walk-in | phone | whatsapp | website | referral | other */
export const leadSource = slug;

// Old mobile offered Percent/Fixed against a `commission` amount; web's model
// is salary | commission | both with `commissionPercent`.
const COMMISSION_TYPES = {
  percent: 'commission',
  fixed: 'salary',
  salary: 'salary',
  commission: 'commission',
  both: 'both',
};

export function commissionType(raw) {
  return COMMISSION_TYPES[slug(raw)] ?? 'salary';
}

/** The commission percentage, wherever it was stored. */
export function commissionPercent(staff) {
  const v = staff?.commissionPercent;
  if (v !== undefined && v !== null && v !== '') return v;
  const legacy = staff?.commission;
  return legacy === undefined || legacy === null ? '' : legacy;
}

/** The auth uid linking a staff record to its app login. */
export function staffAuthUid(staff) {
  return staff?.authUid || staff?.uid || null;
}

/** Certifications as the comma-separated string the form expects. */
export function certifications(raw) {
  if (Array.isArray(raw)) return raw.join(', ');
  return raw ?? '';
}

/** Discount recorded against a payment, under either field name. */
export function discountAmount(payment) {
  return payment?.discountAmount ?? payment?.discountAmt ?? null;
}

export function discountPercent(payment) {
  return payment?.discountPercent ?? payment?.discountPct ?? null;
}

/**
 * A stored schedule time as 24-hour "HH:mm".
 * Accepts "09:00" and the "9:00 AM" form older mobile builds wrote.
 * Returns '' when the value cannot be read as a time.
 */
export function time24(raw) {
  const v = String(raw ?? '').trim();
  if (!v) return '';
  if (/^\d{1,2}:\d{2}$/.test(v)) {
    const [h, m] = v.split(':');
    return `${String(Number(h)).padStart(2, '0')}:${m}`;
  }
  const m = v.match(/^(\d{1,2}):(\d{2})\s*([AaPp])\.?[Mm]\.?$/);
  if (!m) return '';
  let h = Number(m[1]) % 12;
  if (m[3].toLowerCase() === 'p') h += 12;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

/**
 * Gym info for receipts and QR cards.
 *
 * It belongs in settings/general under `gymInfo`, but older mobile builds wrote
 * these straight onto the gym document under different keys. Prefer the
 * settings copy and fall back per-key so a gym last edited from the old app
 * still prints a full header.
 */
export function gymInfo(settingsDoc, gymDoc) {
  const info = settingsDoc?.gymInfo ?? {};
  const gym = gymDoc ?? {};
  const pick = (key, legacyKey) => {
    const v = info[key];
    if (typeof v === 'string' && v.trim() !== '') return v;
    const l = gym[legacyKey];
    return typeof l === 'string' ? l : '';
  };
  return {
    name: pick('name', 'name'),
    location: pick('location', 'address'),
    contact: pick('contact', 'phone'),
    email: pick('email', 'email'),
    website: pick('website', 'website'),
    gstNumber: pick('gstNumber', 'gstNumber'),
    openingHours: pick('openingHours', 'workingHours'),
    instagram: pick('instagram', 'instagram'),
    logoUrl: pick('logoUrl', 'logoUrl'),
  };
}
