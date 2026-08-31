import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { checkWaCreditsOrder } from '../../utils/subscriptionApi';

const POLL_DELAYS_MS = [0, 2000, 3000, 5000, 5000, 8000, 8000, 10_000, 10_000];

export default function WACreditsReturn() {
  const [params] = useSearchParams();
  const { gymId } = useAuth();
  const merchantOrderId = params.get('orderId');

  const [state, setState] = useState('CHECKING');
  const [credits, setCredits] = useState(null);
  const [error, setError] = useState('');
  const cancelled = useRef(false);

  useEffect(() => {
    if (!merchantOrderId || !gymId) { setState('UNKNOWN'); return undefined; }
    cancelled.current = false;

    (async () => {
      for (const delay of POLL_DELAYS_MS) {
        if (cancelled.current) return;
        if (delay) await new Promise(r => setTimeout(r, delay));
        try {
          const res = await checkWaCreditsOrder({ gymId, merchantOrderId });
          if (cancelled.current) return;
          if (res.state === 'COMPLETED') {
            setCredits(res.credits || 1000);
            setState('COMPLETED');
            return;
          }
          if (res.state === 'FAILED') { setState('FAILED'); return; }
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

  const backToCredits = (
    <Link to="/whatsapp-credits" className="mt-2 px-5 py-2.5 rounded-lg bg-primary text-on-primary font-medium text-sm">
      Back to WhatsApp Credits
    </Link>
  );

  if (state === 'CHECKING') {
    return shell('progress_activity', 'text-primary animate-spin', 'Confirming your payment…',
      error || 'This can take a few seconds. Please do not close this page.');
  }

  if (state === 'COMPLETED') {
    return shell('check_circle', 'text-green-600', 'Credits added!',
      `${(credits || 1000).toLocaleString('en-IN')} WhatsApp credits have been added to your account.`,
      backToCredits);
  }

  if (state === 'FAILED') {
    return shell('cancel', 'text-red-500', 'Payment did not go through',
      'Nothing has been charged. You can try again from the WhatsApp Credits page.',
      backToCredits);
  }

  if (state === 'PENDING') {
    return shell('schedule', 'text-amber-500', 'Still processing',
      'PhonePe has not confirmed this payment yet. If money has left your account, credits will be added automatically — refresh in a minute.',
      backToCredits);
  }

  return shell('help', 'text-on-surface-variant', 'Nothing to show',
    'This link is missing an order reference. Start again from the WhatsApp Credits page.',
    backToCredits);
}
