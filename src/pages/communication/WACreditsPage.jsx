import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { createWaCreditsOrder } from '../../utils/subscriptionApi';

export default function WACreditsPage() {
  const { gymId, gymData, role } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const waCredits = typeof gymData?.waCredits === 'number' ? gymData.waCredits : 0;

  useEffect(() => {
    if (!gymId) return;
    (async () => {
      try {
        const q = query(
          collection(db, `gyms/${gymId}/messageLogs`),
          orderBy('createdAt', 'desc'),
          limit(100),
        );
        const snap = await getDocs(q);
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch {
        // ignore — logs are non-critical
      } finally {
        setLoading(false);
      }
    })();
  }, [gymId]);

  const sentCount = logs.filter(l => l.status === 'sent').length;
  const failedCount = logs.filter(l => l.status !== 'sent').length;

  const handleBuy = async () => {
    if (role !== 'admin' && role !== 'superadmin') {
      toast.error('Only a gym admin can buy WhatsApp credits');
      return;
    }
    setPaying(true);
    try {
      const { redirectUrl } = await createWaCreditsOrder({ gymId });
      window.location.href = redirectUrl;
    } catch (e) {
      toast.error(e.message || 'Could not start payment');
      setPaying(false);
    }
  };

  function formatDate(ts) {
    if (!ts) return '—';
    try {
      const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
      return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch { return '—'; }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-on-surface">WhatsApp Credits</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Credits are deducted per message sent. Buy more anytime.
        </p>
      </header>

      {/* Balance + stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-outline-variant/40 p-5 flex flex-col gap-1">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide font-semibold">Balance</p>
          <p className="text-4xl font-bold text-on-surface">{waCredits.toLocaleString('en-IN')}</p>
          <p className="text-xs text-on-surface-variant">credits remaining</p>
        </div>
        <div className="rounded-xl border border-outline-variant/40 p-5 flex flex-col gap-1">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide font-semibold">Sent (last 100)</p>
          <p className="text-4xl font-bold text-green-600">{sentCount}</p>
          <p className="text-xs text-on-surface-variant">messages delivered</p>
        </div>
        <div className="rounded-xl border border-outline-variant/40 p-5 flex flex-col gap-1">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide font-semibold">Failed (last 100)</p>
          <p className="text-4xl font-bold text-red-500">{failedCount}</p>
          <p className="text-xs text-on-surface-variant">not charged</p>
        </div>
      </div>

      {/* Buy credits */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <p className="font-semibold text-on-surface">Buy WhatsApp Credits</p>
          <p className="text-sm text-on-surface-variant">1 000 credits for ₹100 — paid via PhonePe (UPI / card / netbanking)</p>
        </div>
        <button
          type="button"
          onClick={handleBuy}
          disabled={paying || (role !== 'admin' && role !== 'superadmin')}
          className="shrink-0 px-5 py-2.5 rounded-lg bg-primary text-on-primary font-semibold text-sm disabled:opacity-60 flex items-center gap-2"
        >
          {paying
            ? <><span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> Starting…</>
            : <>Pay ₹100</>}
        </button>
      </div>

      {/* Usage log */}
      <section>
        <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wide mb-3">
          Recent Activity
        </h2>
        {loading ? (
          <div className="flex items-center gap-2 text-on-surface-variant text-sm py-6">
            <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
            Loading…
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-on-surface-variant py-6">No messages sent yet.</p>
        ) : (
          <div className="rounded-xl border border-outline-variant/30 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-container text-on-surface-variant text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Member</th>
                  <th className="px-4 py-3 text-left font-semibold">Type</th>
                  <th className="px-4 py-3 text-left font-semibold">To</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-surface-container/50 transition-colors">
                    <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">{formatDate(log.createdAt)}</td>
                    <td className="px-4 py-3 text-on-surface">{log.memberName || log.memberId || '—'}</td>
                    <td className="px-4 py-3 text-on-surface-variant capitalize">{log.type || '—'}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{log.to || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        log.status === 'sent'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {log.status === 'sent' ? 'Sent' : 'Failed'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
