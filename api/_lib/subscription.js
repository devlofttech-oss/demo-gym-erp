// Granting paid subscription time.
//
// Shared by the PhonePe webhook and the status endpoint, because either can be
// the first to learn a payment succeeded: webhooks are the source of truth but
// can be delayed or retried, and the app polls status when it comes back to the
// foreground. Both call grantPaidOrder(), which is idempotent — whichever
// arrives second is a no-op.
//
// Uses the Admin SDK, which bypasses firestore.rules. That is deliberate:
// gyms/{gymId} is superadmin-write-only precisely so a gym admin cannot extend
// their own plan from the client.
import { FieldValue, getDb } from './firebaseAdmin.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Free WA credits bundled with each plan tier (keyed by minimum durationDays).
const WA_FREE_CREDITS = [
  [365, 1000],
  [180, 500],
  [90, 250],
  [30, 100],
];

function freeWaCreditsForDuration(durationDays) {
  for (const [days, credits] of WA_FREE_CREDITS) {
    if (Number(durationDays) >= days) return credits;
  }
  return 0;
}

/** 'YYYY-MM-DD' — the format planStartDate/planEndDate already use. */
function isoDate(d) {
  return new Date(d).toISOString().slice(0, 10);
}

export function orderRef(gymId, merchantOrderId) {
  return getDb().collection('gyms').doc(gymId).collection('subscriptionOrders').doc(merchantOrderId);
}

/**
 * Marks an order paid and extends the gym's plan, exactly once.
 *
 * @returns {Promise<{applied: boolean, reason?: string, planEndDate?: string}>}
 */
export async function grantPaidOrder({ gymId, merchantOrderId, paidAmountPaise, phonePeOrderId }) {
  const db = getDb();
  const oRef = orderRef(gymId, merchantOrderId);
  const gRef = db.collection('gyms').doc(gymId);

  return db.runTransaction(async (tx) => {
    const [orderSnap, gymSnap] = await Promise.all([tx.get(oRef), tx.get(gRef)]);

    if (!orderSnap.exists) return { applied: false, reason: 'unknown_order' };
    const order = orderSnap.data();

    // Idempotency: a retried webhook, or the app polling status after the
    // webhook already landed, must not buy a second year.
    if (order.status === 'COMPLETED') {
      return { applied: false, reason: 'already_applied', planEndDate: order.grantedPlanEndDate };
    }

    // The amount is fixed server-side at create time; if what PhonePe settled
    // differs, something is wrong and we do not grant time for it.
    if (paidAmountPaise != null && Number(paidAmountPaise) !== Number(order.amountPaise)) {
      tx.update(oRef, {
        status: 'MISMATCH',
        paidAmountPaise: Number(paidAmountPaise),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { applied: false, reason: 'amount_mismatch' };
    }

    if (!gymSnap.exists) return { applied: false, reason: 'unknown_gym' };
    const gym = gymSnap.data();

    // Extend from the later of today and the current expiry, so renewing early
    // adds to the remaining time instead of throwing it away.
    const today = new Date();
    const current = gym.planEndDate ? new Date(gym.planEndDate) : null;
    const base = current && current > today ? current : today;
    const planEndDate = isoDate(base.getTime() + Number(order.durationDays) * DAY_MS);

    // planStartDate only moves when the gym was lapsed — for a renewal it still
    // marks when the current continuous run of service began.
    const wasActive = current && current > today;
    const freeCredits = freeWaCreditsForDuration(order.durationDays);
    const gymUpdate = {
      planId: order.planId,
      planName: order.planName,
      subscriptionPlan: order.planName,
      planEndDate,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (freeCredits > 0) gymUpdate.waCredits = FieldValue.increment(freeCredits);
    if (!wasActive) gymUpdate.planStartDate = isoDate(today);

    tx.update(gRef, gymUpdate);
    tx.update(oRef, {
      status: 'COMPLETED',
      phonePeOrderId: phonePeOrderId || order.phonePeOrderId || null,
      paidAmountPaise: paidAmountPaise != null ? Number(paidAmountPaise) : order.amountPaise,
      grantedPlanEndDate: planEndDate,
      paidAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { applied: true, planEndDate };
  });
}

/** Records a terminal failure without touching the gym's plan. */
export async function markOrderFailed(gymId, merchantOrderId, reason) {
  await orderRef(gymId, merchantOrderId).set(
    { status: 'FAILED', failureReason: reason || null, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}

// ── WhatsApp credits ──────────────────────────────────────────────────────────

export function waOrderRef(gymId, merchantOrderId) {
  return getDb().collection('gyms').doc(gymId).collection('waOrders').doc(merchantOrderId);
}

/**
 * Tops up a gym's waCredits balance after a successful WA credit purchase.
 * Idempotent — a retried webhook or duplicate status poll is a no-op.
 */
export async function grantWaCredits({ gymId, merchantOrderId, paidAmountPaise, phonePeOrderId }) {
  const db = getDb();
  const oRef = waOrderRef(gymId, merchantOrderId);
  const gRef = db.collection('gyms').doc(gymId);

  return db.runTransaction(async (tx) => {
    const [orderSnap, gymSnap] = await Promise.all([tx.get(oRef), tx.get(gRef)]);

    if (!orderSnap.exists) return { applied: false, reason: 'unknown_order' };
    const order = orderSnap.data();

    if (order.status === 'COMPLETED') {
      return { applied: false, reason: 'already_applied', credits: order.grantedCredits };
    }

    if (paidAmountPaise != null && Number(paidAmountPaise) !== Number(order.amountPaise)) {
      tx.update(oRef, {
        status: 'MISMATCH',
        paidAmountPaise: Number(paidAmountPaise),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { applied: false, reason: 'amount_mismatch' };
    }

    if (!gymSnap.exists) return { applied: false, reason: 'unknown_gym' };

    const credits = Number(order.credits) || 1000;
    tx.update(gRef, { waCredits: FieldValue.increment(credits), updatedAt: FieldValue.serverTimestamp() });
    tx.update(oRef, {
      status: 'COMPLETED',
      phonePeOrderId: phonePeOrderId || order.phonePeOrderId || null,
      paidAmountPaise: paidAmountPaise != null ? Number(paidAmountPaise) : order.amountPaise,
      grantedCredits: credits,
      paidAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { applied: true, credits };
  });
}

export async function markWaOrderFailed(gymId, merchantOrderId, reason) {
  await waOrderRef(gymId, merchantOrderId).set(
    { status: 'FAILED', failureReason: reason || null, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}
