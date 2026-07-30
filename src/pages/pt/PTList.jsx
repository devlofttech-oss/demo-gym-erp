import { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  getTenantCollection,
  deleteTenantDocument,
} from '../../firebase/tenantDb';
import PTPackageForm from './PTPackageForm';
import PTSessionForm from './PTSessionForm';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr) {
  if (!timeStr) return '—';
  try {
    const [h, m] = timeStr.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
  } catch {
    return timeStr;
  }
}

function SessionStatusBadge({ status }) {
  const map = {
    Scheduled: 'bg-blue-50 text-blue-700',
    Completed: 'bg-emerald-50 text-emerald-700',
    Cancelled: 'bg-rose-50 text-rose-700',
  };
  const cls = map[status] ?? 'bg-surface-container text-on-surface-variant';
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}

// ─── Stat Cards ──────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 flex flex-col gap-3 shadow-[0_4px_20px_rgba(207,196,255,0.10)]">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-bold text-on-surface leading-tight">{value}</p>
        <p className="text-sm font-medium text-on-surface mt-0.5">{label}</p>
        {sub && <p className="text-xs text-on-surface-variant mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Packages Tab ─────────────────────────────────────────────────────────────

function PackagesTab({ gymId }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPkg, setEditingPkg] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTenantCollection(gymId, 'ptPackages');
      setPackages(data);
    } catch {
      toast.error('Failed to load packages');
    } finally {
      setLoading(false);
    }
  }, [gymId]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  async function handleDelete(pkg) {
    setDeletingId(pkg.id);
    setConfirmDelete(null);
    try {
      await deleteTenantDocument(gymId, 'ptPackages', pkg.id);
      toast.success('Package deleted');
      setPackages((prev) => prev.filter((p) => p.id !== pkg.id));
    } catch {
      toast.error('Failed to delete package');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-on-surface-variant">
          {packages.length} package{packages.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => { setEditingPkg(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg font-medium text-sm hover:bg-primary/90 shadow-sm transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          New Package
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="material-symbols-outlined animate-spin text-2xl text-primary">progress_activity</span>
        </div>
      ) : packages.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl opacity-40">fitness_center</span>
          <p className="text-sm">No PT packages yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 flex flex-col gap-4 shadow-[0_4px_20px_rgba(207,196,255,0.12)] transition-all hover:shadow-[0_8px_30px_rgba(207,196,255,0.2)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-on-surface text-base leading-tight truncate">{pkg.name || '—'}</p>
                  <p className="text-sm text-on-surface-variant mt-0.5">Trainer: {pkg.trainerName || '—'}</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-[18px]">fitness_center</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 bg-surface-container rounded-lg text-xs font-medium text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">repeat</span>
                  {pkg.sessionsIncluded ?? '—'} sessions
                </span>
                <span className="px-2.5 py-1 bg-surface-container rounded-lg text-xs font-medium text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">calendar_month</span>
                  {pkg.durationMonths ?? '—'} Month{pkg.durationMonths !== 1 ? 's' : ''}
                </span>
                <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-lg text-xs font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">currency_rupee</span>
                  {pkg.price !== undefined ? pkg.price.toLocaleString('en-IN') : '—'}
                </span>
              </div>

              {pkg.description && (
                <p className="text-sm text-on-surface-variant leading-relaxed line-clamp-2">{pkg.description}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-outline-variant/20">
                <button
                  onClick={() => { setEditingPkg(pkg); setShowForm(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-primary hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  Edit
                </button>
                <button
                  onClick={() => setConfirmDelete(pkg)}
                  disabled={deletingId === pkg.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                >
                  {deletingId === pkg.id ? (
                    <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  )}
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <PTPackageForm
          package={editingPkg}
          onClose={() => { setShowForm(false); setEditingPkg(null); }}
          onSaved={fetchPackages}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-rose-600 text-[20px]">warning</span>
              </div>
              <div>
                <p className="font-bold text-on-surface">Delete Package?</p>
                <p className="text-sm text-on-surface-variant mt-0.5">
                  "{confirmDelete.name}" will be permanently removed.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-rose-600 text-white hover:bg-rose-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Sessions Tab ─────────────────────────────────────────────────────────────

const SESSION_STATUSES = ['All', 'Scheduled', 'Completed', 'Cancelled'];

function SessionsTab({ gymId }) {
  const [sessions, setSessions] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [deletingId, setDeletingId] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sessionsData, packagesData] = await Promise.all([
        getTenantCollection(gymId, 'ptSessions'),
        getTenantCollection(gymId, 'ptPackages'),
      ]);
      setSessions(sessionsData);
      setPackages(packagesData);
    } catch {
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [gymId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const packageMap = useMemo(() => {
    const m = {};
    packages.forEach((p) => { m[p.id] = p; });
    return m;
  }, [packages]);

  async function handleDelete(session) {
    setDeletingId(session.id);
    try {
      await deleteTenantDocument(gymId, 'ptSessions', session.id);
      toast.success('Session deleted');
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
    } catch {
      toast.error('Failed to delete session');
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = statusFilter === 'All'
    ? sessions
    : sessions.filter((s) => s.status === statusFilter);

  const sorted = [...filtered].sort((a, b) => {
    const da = a.date ?? '';
    const db = b.date ?? '';
    if (da !== db) return db.localeCompare(da);
    return (b.time ?? '').localeCompare(a.time ?? '');
  });

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-1 p-1 bg-surface-container-low rounded-xl">
          {SESSION_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setEditingSession(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg font-medium text-sm hover:bg-primary/90 shadow-sm transition-colors self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          Log Session
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="material-symbols-outlined animate-spin text-2xl text-primary">progress_activity</span>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl opacity-40">calendar_today</span>
          <p className="text-sm">
            {statusFilter === 'All' ? 'No sessions logged yet.' : `No ${statusFilter} sessions.`}
          </p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(207,196,255,0.15)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant/20 bg-surface-container-low/50">
                  <th className="text-left px-4 py-3 font-label-caps text-label-caps text-on-surface-variant uppercase">Date</th>
                  <th className="text-left px-4 py-3 font-label-caps text-label-caps text-on-surface-variant uppercase">Time</th>
                  <th className="text-left px-4 py-3 font-label-caps text-label-caps text-on-surface-variant uppercase">Trainer</th>
                  <th className="text-left px-4 py-3 font-label-caps text-label-caps text-on-surface-variant uppercase">Member</th>
                  <th className="text-left px-4 py-3 font-label-caps text-label-caps text-on-surface-variant uppercase">Package</th>
                  <th className="text-left px-4 py-3 font-label-caps text-label-caps text-on-surface-variant uppercase">Status</th>
                  <th className="text-left px-4 py-3 font-label-caps text-label-caps text-on-surface-variant uppercase">Notes</th>
                  <th className="text-right px-4 py-3 font-label-caps text-label-caps text-on-surface-variant uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {sorted.map((session) => {
                  const pkg = packageMap[session.packageId];
                  return (
                    <tr key={session.id} className="hover:bg-surface-container/40 transition-colors">
                      <td className="px-4 py-3 text-on-surface whitespace-nowrap">{formatDate(session.date)}</td>
                      <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">{formatTime(session.time)}</td>
                      <td className="px-4 py-3 text-on-surface-variant">{session.trainerName || '—'}</td>
                      <td className="px-4 py-3 text-on-surface font-medium">{session.memberName || '—'}</td>
                      <td className="px-4 py-3 text-on-surface-variant">{pkg ? pkg.name : session.packageId ? '—' : 'None'}</td>
                      <td className="px-4 py-3"><SessionStatusBadge status={session.status} /></td>
                      <td className="px-4 py-3 text-on-surface-variant max-w-45 truncate">{session.notes || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => { setEditingSession(session); setShowForm(true); }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-surface-container transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                          </button>
                          <button
                            onClick={() => handleDelete(session)}
                            disabled={deletingId === session.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                          >
                            {deletingId === session.id ? (
                              <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                            ) : (
                              <span className="material-symbols-outlined text-[14px]">delete</span>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <PTSessionForm
          session={editingSession}
          onClose={() => { setShowForm(false); setEditingSession(null); }}
          onSaved={fetchAll}
        />
      )}
    </>
  );
}

// ─── PTList (main page) ───────────────────────────────────────────────────────

export default function PTList() {
  const { gymId } = useAuth();
  const [activeTab, setActiveTab] = useState('packages');
  const [packages, setPackages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!gymId) return;
      setStatsLoading(true);
      try {
        const [pkgsData, sessData] = await Promise.all([
          getTenantCollection(gymId, 'ptPackages'),
          getTenantCollection(gymId, 'ptSessions'),
        ]);
        setPackages(pkgsData);
        setSessions(sessData);
      } catch {
        // Non-critical — stats just won't show
      } finally {
        setStatsLoading(false);
      }
    }
    fetchStats();
  }, [gymId]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const totalPackages = packages.length;

    // Unique members who have at least one session
    const activeClients = new Set(sessions.map((s) => s.memberName).filter(Boolean)).size;

    const sessionsThisMonth = sessions.filter((s) => s.date && s.date.startsWith(monthStr)).length;

    // Revenue = sum of package prices for packages created this month
    const revenueThisMonth = packages
      .filter((p) => p.createdAt && p.createdAt.startsWith(monthStr))
      .reduce((sum, p) => sum + (Number(p.price) || 0), 0);

    return { totalPackages, activeClients, sessionsThisMonth, revenueThisMonth };
  }, [packages, sessions]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 className="font-h1 text-h1 text-on-surface">Personal Training</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Manage PT packages and track individual training sessions.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon="card_membership"
          label="Total Packages"
          value={statsLoading ? '—' : stats.totalPackages}
          color="bg-primary/10 text-primary"
        />
        <StatCard
          icon="groups"
          label="Active Clients"
          value={statsLoading ? '—' : stats.activeClients}
          sub="Unique members with sessions"
          color="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          icon="calendar_month"
          label="Sessions This Month"
          value={statsLoading ? '—' : stats.sessionsThisMonth}
          color="bg-blue-100 text-blue-700"
        />
        <StatCard
          icon="currency_rupee"
          label="Revenue This Month"
          value={statsLoading ? '—' : `₹${stats.revenueThisMonth.toLocaleString('en-IN')}`}
          sub="From new packages"
          color="bg-amber-100 text-amber-700"
        />
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 p-1 bg-surface-container-low rounded-xl w-fit">
        {[
          { key: 'packages', icon: 'card_membership', label: 'PT Packages' },
          { key: 'sessions', icon: 'calendar_month', label: 'PT Sessions' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'packages' ? (
        <PackagesTab gymId={gymId} />
      ) : (
        <SessionsTab gymId={gymId} />
      )}
    </div>
  );
}
