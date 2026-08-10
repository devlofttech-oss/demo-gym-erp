import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SubscriptionEnded() {
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('kilos_plan_block');
    if (stored) {
      try { setInfo(JSON.parse(stored)); } catch {}
    }
  }, []);

  const handleBack = () => {
    localStorage.removeItem('kilos_plan_block');
    navigate('/login');
  };

  const isExpired = !info || info.reason === 'plan_expired';

  const fmtDate = (d) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-900 flex items-center justify-center p-6 font-['Plus_Jakarta_Sans']">
      <div className="max-w-md w-full flex flex-col items-center gap-7 text-center">

        {/* Icon */}
        <div className="w-28 h-28 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center shadow-inner">
          <span className="material-symbols-outlined text-rose-500 dark:text-rose-400 text-[54px]">
            {isExpired ? 'lock_clock' : 'schedule'}
          </span>
        </div>

        {/* Gym name */}
        {info?.gymName && (
          <div className="flex items-center gap-1.5 text-on-surface-variant text-sm font-medium">
            <span className="material-symbols-outlined text-[16px]">fitness_center</span>
            {info.gymName}
          </div>
        )}

        {/* Heading + message */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">
            {isExpired ? 'Subscription Ended' : 'Not Active Yet'}
          </h1>
          <p className="text-on-surface-variant text-sm leading-relaxed">
            {isExpired
              ? "Your Kilos subscription has ended. All your gym data is safe — contact support to renew your plan and restore access."
              : "Your subscription hasn't started yet. You'll get full access on the plan start date."}
          </p>
          {isExpired && info?.endDate && (
            <p className="text-sm font-semibold text-rose-500 dark:text-rose-400 mt-1">
              Expired on {fmtDate(info.endDate)}
            </p>
          )}
          {!isExpired && info?.startDate && (
            <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 mt-1">
              Starts on {fmtDate(info.startDate)}
            </p>
          )}
        </div>

        {/* Support card */}
        <div className="w-full bg-surface-container dark:bg-slate-800/60 border border-outline-variant/20 rounded-2xl p-5 text-left">
          <p className="text-sm font-bold text-on-surface mb-1">Need to renew?</p>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Contact <span className="font-semibold text-primary">Kilos by Devloft Technologies</span> to
            renew or activate your plan and restore full access immediately.
          </p>
        </div>

        {/* Back button */}
        <button
          onClick={handleBack}
          className="flex items-center gap-2 px-7 py-3 bg-primary hover:bg-primary/90 text-on-primary rounded-xl font-bold transition-colors shadow-sm text-sm"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Login
        </button>

        <p className="text-xs text-on-surface-variant opacity-60">Powered by Kilos · Devloft Technologies</p>
      </div>
    </div>
  );
}
