/* Membership rules shared across the pages that change a member's state.
 *
 * These live in one place deliberately: the same rule applied from two screens
 * is how the freeze behaviour drifted apart between web and mobile in the first
 * place. The Flutter app mirrors this in mobile-app/lib/services/helpers.dart —
 * change both together. */

/** Adds whole days to a YYYY-MM-DD string, returning the same format. */
export function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Whole days a membership has been paused, measured midnight to midnight.
 * Returns 0 when there is no freeze date or the freeze started today.
 */
export function frozenDays(frozenOn) {
  if (!frozenOn) return 0;
  const from = new Date(frozenOn);
  if (isNaN(from)) return 0;
  from.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today - from) / 86400000);
  return days > 0 ? days : 0;
}

/**
 * The Firestore patch that resumes a frozen membership.
 *
 * Freezing pauses the clock, so expiry moves out by the days the member was
 * actually frozen — a freeze never costs them time on a plan they paid for.
 * Measuring elapsed days rather than the planned resume date means resuming
 * early gives back only the days genuinely lost.
 */
export function unfreezePatch(member) {
  const patch = { status: 'Active', frozenOn: null, resumeDate: null };
  const days = frozenDays(member?.frozenOn);
  if (days > 0 && member?.expiryDate) {
    patch.expiryDate = addDays(member.expiryDate, days);
  }
  return patch;
}
