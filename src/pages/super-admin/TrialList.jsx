import { useState, useEffect } from 'react';
import { getCollection, updateDocument, deleteDocument } from '../../firebase/db';
import { getTenantCollection, deleteTenantDocument } from '../../firebase/tenantDb';
import toast from 'react-hot-toast';

const SUB_COLLECTIONS = [
  'members', 'payments', 'attendance', 'staffAttendance',
  'staff', 'classes', 'equipment', 'supplements', 'expenses', 'settings',
];

function daysLeft(trialEndDate) {
  if (!trialEndDate) return 0;
  return Math.ceil((new Date(trialEndDate) - new Date()) / 86400000);
}

function getStatus(gym) {
  const d = daysLeft(gym.trialEndDate);
  if (d <= 0) return 'expired';
  if (d <= 3) return 'expiring';
  return 'active';
}

function formatPhone(phone) {
  const d = (phone || '').replace(/\D/g, '');
  if (d.length === 10) return '91' + d;
  if (d.startsWith('91') && d.length === 12) return d;
  return d;
}

function waLink(gym) {
  const loginUrl = window.location.origin + '/login';
  const name = gym.ownerName || gym.name || 'there';
  const msg = `Hi ${name}! 🎉\n\nYour *Kilos Gym ERP* 14-day trial is ready!\n\n*Gym:* ${gym.name}\n*Login:* ${loginUrl}\n*Email:* ${gym.ownerEmail}\n*Password:* ${gym.ownerPassword || '(contact us)'}\n\nYour trial is valid until *${gym.trialEndDate}*.\n\nFeel free to reach out anytime for help! 💪`;
  return `https://wa.me/${formatPhone(gym.ownerPhone || gym.phone)}?text=${encodeURIComponent(msg)}`;
}

const STATUS_META = {
  active:   { label: 'Active',          bg: 'bg-emerald-100',  text: 'text-emerald-700',  dot: 'bg-emerald-500'  },
  expiring: { label: 'Expiring Soon',   bg: 'bg-amber-100',    text: 'text-amber-700',    dot: 'bg-amber-500'    },
  expired:  { label: 'Expired',         bg: 'bg-rose-100',     text: 'text-rose-700',     dot: 'bg-rose-500'     },
};

function StatCard({ label, value, icon, color }) {
  return (
    <div className={`bg-surface-container-lowest rounded-2xl p-5 flex items-center gap-4 shadow-sm border border-outline-variant/20`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
        <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      </div>
      <div>
        <div className="text-2xl font-bold text-on-surface">{value}</div>
        <div className="text-xs text-on-surface-variant font-medium">{label}</div>
      </div>
    </div>
  );
}

export default function TrialList() {
  const [trials, setTrials]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [extendingId, setExtendingId] = useState(null);
  const [convertingId, setConvertingId] = useState(null);
  const [deletingId, setDeletingId]   = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const fetchTrials = async () => {
    setLoading(true);
    try {
      const all = await getCollection('gyms');
      setTrials(all.filter(g => g.isTrial === true).sort((a, b) => (b.trialStartDate || '').localeCompare(a.trialStartDate || '')));
    } catch { toast.error('Failed to load trials'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTrials(); }, []);

  const handleExtend = async (gym) => {
    setExtendingId(gym.id);
    try {
      const base = gym.trialEndDate ? new Date(gym.trialEndDate) : new Date();
      base.setDate(base.getDate() + 7);
      const newEnd = base.toISOString().split('T')[0];
      await updateDocument('gyms', gym.id, { trialEndDate: newEnd });
      setTrials(prev => prev.map(g => g.id === gym.id ? { ...g, trialEndDate: newEnd } : g));
      toast.success('Trial extended by 7 days!');
    } catch { toast.error('Failed to extend trial'); }
    finally { setExtendingId(null); }
  };

  const handleConvert = async (gym) => {
    setConvertingId(gym.id);
    try {
      await updateDocument('gyms', gym.id, {
        isTrial: false,
        subscriptionPlan: 'Standard',
        trialEndDate: null,
        trialStartDate: null,
      });
      setTrials(prev => prev.filter(g => g.id !== gym.id));
      toast.success(`${gym.name} converted to paid!`);
    } catch { toast.error('Failed to convert'); }
    finally { setConvertingId(null); }
  };

  const handleDelete = async (gymId) => {
    setDeletingId(gymId);
    try {
      for (const coll of SUB_COLLECTIONS) {
        const docs = await getTenantCollection(gymId, coll).catch(() => []);
        for (const d of docs) await deleteTenantDocument(gymId, coll, d.id).catch(() => {});
      }
      const gymUsers = await getCollection('users', [{ field: 'gymId', op: '==', value: gymId }]).catch(() => []);
      for (const u of gymUsers) await updateDocument('users', u.id, { role: 'deleted', gymId: null }).catch(() => {});
      await deleteDocument('gyms', gymId);
      setTrials(prev => prev.filter(g => g.id !== gymId));
      toast.success('Trial deleted');
    } catch { toast.error('Failed to delete'); }
    finally { setDeletingId(null); setDeleteConfirmId(null); }
  };

  const filtered = trials.filter(g => {
    const t = search.toLowerCase();
    return !t || g.name?.toLowerCase().includes(t) || g.ownerEmail?.toLowerCase().includes(t) || g.ownerPhone?.toLowerCase().includes(t) || g.ownerCity?.toLowerCase().includes(t);
  });

  const active   = trials.filter(g => getStatus(g) === 'active').length;
  const expiring = trials.filter(g => getStatus(g) === 'expiring').length;
  const expired  = trials.filter(g => getStatus(g) === 'expired').length;

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-h1 text-h1 text-on-surface">Trial Gyms</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">Gyms on 14-day free trials from self-registration.</p>
        </div>
        <a
          href="/register"
          target="_blank"
          rel="noreferrer"
          className="bg-primary text-on-primary px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2 text-sm"
        >
          <span className="material-symbols-outlined text-[18px]">open_in_new</span>
          Registration Link
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Active Trials"    value={active}   icon="timer"         color="bg-emerald-100 text-emerald-600" />
        <StatCard label="Expiring (≤3 days)" value={expiring} icon="alarm"       color="bg-amber-100 text-amber-600"    />
        <StatCard label="Expired"          value={expired}  icon="timer_off"     color="bg-rose-100 text-rose-600"      />
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2.5 max-w-sm shadow-sm">
        <span className="material-symbols-outlined text-on-surface-variant text-[20px]">search</span>
        <input
          type="text"
          placeholder="Search by name, email, phone, city…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-on-surface outline-none text-sm placeholder:text-on-surface-variant"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-175">
            <thead>
              <tr className="border-b border-outline-variant/20 bg-surface-container-low/50">
                {['Gym', 'Owner', 'WhatsApp', 'City', 'Trial Period', 'Days Left', 'Status', 'Actions'].map(h => (
                  <th key={h} className="p-4 font-semibold text-xs uppercase tracking-wide text-on-surface-variant">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-10 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="p-12 text-center">
                  <div className="flex flex-col items-center gap-3 text-on-surface-variant">
                    <span className="material-symbols-outlined text-5xl opacity-30">timer</span>
                    <p className="font-medium">{search ? 'No trials match your search' : 'No trial gyms yet'}</p>
                    {!search && (
                      <a href="/register" target="_blank" className="bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
                        View Registration Page
                      </a>
                    )}
                  </div>
                </td></tr>
              ) : filtered.map(gym => {
                const status = getStatus(gym);
                const meta   = STATUS_META[status];
                const days   = daysLeft(gym.trialEndDate);
                const isExtending  = extendingId === gym.id;
                const isConverting = convertingId === gym.id;
                const isDeleting   = deletingId === gym.id;

                return (
                  <tr key={gym.id} className="border-b border-outline-variant/10 hover:bg-surface-container/30 transition-colors">
                    {/* Gym */}
                    <td className="p-4">
                      <div className="font-semibold text-on-surface">{gym.name}</div>
                      <div className="text-xs text-on-surface-variant">{gym.ownerEmail}</div>
                    </td>

                    {/* Owner */}
                    <td className="p-4 text-on-surface-variant text-sm">{gym.ownerName || '—'}</td>

                    {/* WhatsApp */}
                    <td className="p-4 text-on-surface-variant text-sm">{gym.ownerPhone || gym.phone || '—'}</td>

                    {/* City */}
                    <td className="p-4 text-on-surface-variant text-sm">{gym.ownerCity || gym.address || '—'}</td>

                    {/* Trial Period */}
                    <td className="p-4 text-xs text-on-surface-variant">
                      <div>{gym.trialStartDate || '—'}</div>
                      <div className="text-on-surface-variant/60">to {gym.trialEndDate || '—'}</div>
                    </td>

                    {/* Days Left */}
                    <td className="p-4">
                      <span className={`font-bold text-sm ${days <= 0 ? 'text-rose-600' : days <= 3 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {days <= 0 ? 'Expired' : `${days}d`}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.bg} ${meta.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Send Creds via WhatsApp */}
                        <a
                          href={waLink(gym)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">whatsapp</span>
                          Send Creds
                        </a>

                        {/* Extend +7 */}
                        <button
                          onClick={() => handleExtend(gym)}
                          disabled={isExtending}
                          className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-60"
                        >
                          {isExtending
                            ? <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                            : <span className="material-symbols-outlined text-[14px]">add_circle</span>
                          }
                          +7 days
                        </button>

                        {/* Convert to Paid */}
                        <button
                          onClick={() => handleConvert(gym)}
                          disabled={isConverting}
                          className="inline-flex items-center gap-1 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-900/20 dark:text-violet-400 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-60"
                        >
                          {isConverting
                            ? <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                            : <span className="material-symbols-outlined text-[14px]">verified</span>
                          }
                          Convert
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => setDeleteConfirmId(gym.id)}
                          disabled={isDeleting}
                          className="inline-flex items-center gap-1 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-60"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-outline-variant/20 text-xs text-on-surface-variant">
            {filtered.length} of {trials.length} trial{trials.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Delete confirm modal */}
      {deleteConfirmId && (() => {
        const gym = trials.find(g => g.id === deleteConfirmId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
              <div className="flex items-start gap-3 mb-6">
                <div className="w-11 h-11 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-rose-600 text-[22px]">warning</span>
                </div>
                <div>
                  <h3 className="font-bold text-on-surface">Delete "{gym?.name}"?</h3>
                  <p className="text-sm text-on-surface-variant mt-1">
                    This permanently removes the trial gym and all its data. Cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirmId)}
                  disabled={deletingId === deleteConfirmId}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium text-sm shadow-sm flex items-center gap-2 disabled:opacity-70"
                >
                  {deletingId === deleteConfirmId && (
                    <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                  )}
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
