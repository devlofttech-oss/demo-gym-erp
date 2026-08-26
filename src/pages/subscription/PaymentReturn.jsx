import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { checkSubscriptionOrder } from '../../utils/subscriptionApi';

// Where PhonePe sends the customer after checkout.
//
// Arriving here proves nothing — the URL is guessable and the redirect happens
// whether the payment succeeded, failed or was abandoned. So this page asks our
// server, which asks PhonePe, and only then reports anything.
//
// It polls because the webhook and this redirect race each other, and because a
// UPI collect request can sit PENDING for a while after the customer is bounced
// back. Backs off rather than hammering, and gives up with a clear message
// instead of spinning forever.

const POLL_DELAYS_MS = [0, 2000, 3000, 5000, 5000, 8000, 8000, 10_000, 10_000];

export default function PaymentReturn() {
  const [params] = useSearchParams();
  const { gymId } = useAuth();
  const merchantOrderId = params.get('orderId');

  const [state, setState] = useState('CHECKING');
  const [planEndDate, setPlanEndDate] = useState(null);
  const [error, setError] = useState('');
  const cancelled = useRef(false);

  useEffect(() => {
    if (!merchantOrderId || !gymId) {
      setState('UNKNOWN');
      return undefined;
    }
    cancelled.current = false;

    (async () => {
      for (const delay of POLL_DELAYS_MS) {
        if (cancelled.current) return;
        if (delay) await new Promise(r => setTimeout(r, delay));
        try {
          const res = await checkSubscriptionOrder({ gymId, merchantOrderId });
          if (cancelled.current) return;
          if (res.state === 'COMPLETED') {
            setPlanEndDate(res.planEndDate || null);
            setState('COMPLETED');
            return;
          }
          if (res.state === 'FAILED') {
            setState('FAILED');
            return;
          }
        } catch (e) {
          if (cancelled.current) return;
          setError(e.message || 'Could not check the payment');
        }
      }
      if (!cancelled.current) setState('PENDING');
    })();

    return () => { cancelled.current = true; };
  }, [gymId, merchantOrderId]);

  const shell = (icon, tone, title, body, action) => (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center flex flex-col items-center gap-3">
        <span className={`material-symbols-outlined text-5xl ${tone}`}>{icon}</span>
        <h1 className="text-xl font-semibold text-on-surface">{title}</h1>
        <p className="text-sm text-on-surface-variant">{body}</p>
        {action}
      </div>
    </div>
  );

  const backToDashboard = (
    <Link to="/" className="mt-2 px-5 py-2.5 rounded-lg bg-primary text-on-primary font-medium text-sm">
      Back to dashboard
    </Link>
  );

  // After a successful payment the in-memory isPlanBlocked flag is still true,
  // so a client-side navigation would bounce straight back here. A full reload
  // re-runs AuthContext against the new planEndDate and clears the block.
  const continueToDashboard = (
    <button
      type="button"
      onClick={() => { window.location.href = '/'; }}
      className="mt-2 px-5 py-2.5 rounded-lg bg-primary text-on-primary font-medium text-sm"
    >
      Continue to dashboard
    </button>
  );

  if (state === 'CHECKING') {
    return shell(
      'progress_activity',
      'text-primary animate-spin',
      'Confirming your payment…',
      error || 'This can take a few seconds. Please do not close this page.',
    );
  }

  if (state === 'COMPLETED') {
    return shell(
      'check_circle',
      'text-green-600',
      'Payment received',
      planEndDate
        ? `Your subscription now runs until ${planEndDate}.`
        : 'Your subscription has been extended.',
      continueToDashboard,
    );
  }

  if (state === 'FAILED') {
    return shell(
      'cancel',
      'text-red-500',
      'Payment did not go through',
      'Nothing has been charged. You can try again from the subscription page.',
      <Link to="/subscription" className="mt-2 px-5 py-2.5 rounded-lg bg-primary text-on-primary font-medium text-sm">
        Try again
      </Link>,
    );
  }

  if (state === 'PENDING') {
    return shell(
      'schedule',
      'text-amber-500',
      'Still processing',
      'PhonePe has not confirmed this payment yet. If money has left your account it will be applied automatically — refresh in a minute, and contact support if it does not.',
      backToDashboard,
    );
  }

  return shell(
    'help',
    'text-on-surface-variant',
    'Nothing to show',
    'This link is missing an order reference. Start again from the subscription page.',
    backToDashboard,
  );
}
