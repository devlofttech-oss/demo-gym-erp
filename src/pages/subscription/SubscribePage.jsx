import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { getCollection, getDocument } from '../../firebase/db';
import { createSubscriptionOrder } from '../../utils/subscriptionApi';

// Plan picker + PhonePe checkout.
//
// Prices and features come from Firestore (subscriptionPlans and
// appConfig/subscriptionFeatures), so changing either is a data edit, not a
// release — and the app and this page can never disagree about what a plan costs.
// The amount is re-read server-side at checkout regardless; nothing here is
// trusted by the backend.

function daysLeft(planEndDate) {
  if (!planEndDate) return null;
  const end = new Date(planEndDate);
  end.setHours(23, 59, 59, 999);
  return Math.ceil((end - new Date()) / 86_400_000);
}

function fmtDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return String(d); }
}

export default function SubscribePage() {
  const { gymId, gymData, role } = useAuth();
  const [plans, setPlans] = useState([]);
  const [features, setFeatures] = useState([]);
  const [visibleCount, setVisibleCount] = useState(8);
  const [selected, setSelected] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [planDocs, config] = await Promise.all([
          getCollection('subscriptionPlans'),
          getDocument('appConfig', 'subscriptionFeatures'),
        ]);
        const usable = planDocs
          .filter(p => Number(p.priceInr) > 0 && Number(p.durationDays) > 0)
          .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
        setPlans(usable);
        setSelected(usable[0]?.id ?? null);
        setFeatures(config?.features || []);
        if (config?.visibleCount) setVisibleCount(config.visibleCount);
      } catch {
        toast.error('Could not load plans');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const remaining = useMemo(() => daysLeft(gymData?.planEndDate), [gymData?.planEndDate]);
  const shown = expanded ? features : features.slice(0, visibleCount);

  const handlePay = async () => {
    if (!selected) return;
    setPaying(true);
    try {
      const { redirectUrl } = await createSubscriptionOrder({ gymId, planId: selected });
      // Hand off to PhonePe's hosted checkout. It sends the customer back to
      // /subscription/return, which verifies with PhonePe before believing it.
      window.location.href = redirectUrl;
    } catch (e) {
      toast.error(e.message || 'Could not start the payment');
      setPaying(false);
    }
  };

  if (role !== 'admin' && role !== 'superadmin') {
    return (
      <div className="p-8 text-center text-on-surface-variant">
        Only a gym admin can manage the subscription.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin text-2xl mr-2">progress_activity</span>
        Loading plans…
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-on-surface">Choose your plan</h1>
        <p className="text-on-surface-variant text-sm">
          {gymData?.name ? `For ${gymData.name}. ` : ''}
          {remaining == null
            ? 'No active subscription.'
            : remaining > 0
              ? `${remaining} day${remaining === 1 ? '' : 's'} left — renewing adds to the time you have.`
              : 'Your subscription has expired.'}
        </p>
      </header>

      {gymData?.planName && (gymData?.planEndDate || gymData?.planStartDate) && (
        <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-container/30 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-[22px]">workspace_premium</span>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-semibold">Current plan</p>
              <p className="text-lg font-semibold text-on-surface">{gymData.planName}</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            {gymData.planStartDate && (
              <div>
                <p className="text-xs text-on-surface-variant">Started</p>
                <p className="text-on-surface font-medium">{fmtDate(gymData.planStartDate)}</p>
              </div>
            )}
            {gymData.planEndDate && (
              <div>
                <p className="text-xs text-on-surface-variant">{remaining != null && remaining < 0 ? 'Expired on' : 'Ends on'}</p>
                <p className="text-on-surface font-medium">{fmtDate(gymData.planEndDate)}</p>
              </div>
            )}
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              remaining == null ? 'bg-surface-container text-on-surface-variant'
                : remaining < 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            }`}>
              {remaining == null ? '—' : remaining < 0 ? 'Expired' : `${remaining} day${remaining === 1 ? '' : 's'} left`}
            </span>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map(plan => {
          const active = selected === plan.id;
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelected(plan.id)}
              aria-pressed={active}
              className={`relative text-left rounded-xl p-4 border transition-colors ${
                active
                  ? 'border-primary ring-2 ring-primary/30 bg-primary/5'
                  : 'border-outline-variant/40 hover:border-outline-variant'
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-2 left-4 bg-primary text-on-primary text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
                  {plan.badge}
                </span>
              )}
              <p className="text-sm text-on-surface-variant">{plan.name}</p>
              <p className="text-2xl font-semibold text-on-surface mt-1">
                ₹{Number(plan.priceInr).toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-on-surface-variant mt-1">{plan.durationDays} days</p>
              {Number(plan.waCredits) > 0 && (
                <p className="text-xs text-primary font-medium mt-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">chat</span>
                  {Number(plan.waCredits).toLocaleString('en-IN')} free WhatsApp credits
                </p>
              )}
            </button>
          );
        })}
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {shown.map(f => (
          <li
            key={f.label}
            className={`flex items-start gap-2 text-sm ${
              f.highlight ? 'text-on-surface font-medium' : 'text-on-surface-variant'
            }`}
          >
            <span className={`material-symbols-outlined text-[18px] ${f.highlight ? 'text-primary' : 'opacity-60'}`}>
              {f.icon || 'check'}
            </span>
            {f.label}
          </li>
        ))}
      </ul>

      {features.length > visibleCount && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="self-start text-sm text-primary font-medium hover:underline"
        >
          {expanded ? 'View less' : `View more (${features.length - visibleCount})`}
        </button>
      )}

      <button
        type="button"
        onClick={handlePay}
        disabled={paying || !selected}
        className="w-full sm:w-auto self-start px-6 py-3 rounded-lg bg-primary text-on-primary font-semibold disabled:opacity-60 flex items-center gap-2"
      >
        {paying
          ? <><span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> Starting…</>
          : `Pay ₹${Number(plans.find(p => p.id === selected)?.priceInr || 0).toLocaleString('en-IN')} with PhonePe`}
      </button>

      <p className="text-xs text-on-surface-variant">
        Secure UPI, card and netbanking via PhonePe. You'll come back here once the payment finishes.
      </p>
    </div>
  );
}
