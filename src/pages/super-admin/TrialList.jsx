import { useState, useEffect } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '../../firebase/config';
import { getCollection, createDocument, updateDocument, deleteDocument, setDocument } from '../../firebase/db';
import { setTenantDocument } from '../../firebase/tenantDb';
import toast from 'react-hot-toast';

function generatePassword() {
  const upper  = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower  = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  let p = 'Kilos@';
  p += upper[Math.floor(Math.random() * upper.length)];
  p += lower[Math.floor(Math.random() * lower.length)];
  for (let i = 0; i < 3; i++) p += digits[Math.floor(Math.random() * digits.length)];
  return p;
}

const DEFAULT_CATEGORIES = [
  {
    id: 'gym', name: 'Gym',
    plans: [
      { id: 'gym-1', name: 'Monthly',     durationDays: 30,  amount: 0 },
      { id: 'gym-2', name: '3 Months',    durationDays: 90,  amount: 0 },
      { id: 'gym-3', name: '6 Months',    durationDays: 180, amount: 0 },
      { id: 'gym-4', name: 'Annual Pack', durationDays: 365, amount: 0 },
    ],
  },
  {
    id: 'zumba', name: 'Zumba',
    plans: [
      { id: 'zumba-1', name: 'Monthly',  durationDays: 30, amount: 0 },
      { id: 'zumba-2', name: '3 Months', durationDays: 90, amount: 0 },
    ],
  },
  {
    id: 'group_classes', name: 'Group Classes',
    plans: [
      { id: 'grp-1', name: 'Monthly',  durationDays: 30, amount: 0 },
      { id: 'grp-2', name: '3 Months', durationDays: 90, amount: 0 },
    ],
  },
];

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StatCard({ label, value, icon, color }) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-5 flex items-center gap-4 shadow-sm border border-outline-variant/20">
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
  const [requests, setRequests]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [plans, setPlans]         = useState([]);

  // Activate modal state
  const [activating, setActivating]       = useState(null); // the request being activated
  const [activatePlanId, setActivatePlanId]         = useState('');
  const [activateStartDate, setActivateStartDate]   = useState('');
  const [activateEndDate, setActivateEndDate]       = useState('');
  const [activateSaving, setActivateSaving]         = useState(false);

  // Credentials display modal
  const [creds, setCreds] = useState(null); // { gymName, email, password, planName, endDate }
  const [copied, setCopied] = useState('');

  // Delete
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deletingId, setDeletingId]           = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getCollection('trialRequests', [{ field: 'status', op: '==', value: 'pending' }]),
      getCollection('subscriptionPlans', [], { field: 'createdAt', direction: 'asc' }),
    ])
      .then(([reqs, pl]) => {
        setRequests(reqs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
        setPlans(pl);
      })
      .catch(() => toast.error('Failed to load requests'))
      .finally(() => setLoading(false));
  }, []);

  const openActivate = (req) => {
    setActivating(req);
    setActivatePlanId('');
    setActivateStartDate(new Date().toISOString().split('T')[0]);
    setActivateEndDate('');
  };

  const handlePlanChange = (planId) => {
    setActivatePlanId(planId);
    const plan = plans.find(p => p.id === planId);
    if (plan?.durationDays && activateStartDate) {
      const start = new Date(activateStartDate);
      start.setDate(start.getDate() + plan.durationDays);
      setActivateEndDate(start.toISOString().split('T')[0]);
    }
  };

  const handleStartChange = (date) => {
    setActivateStartDate(date);
    const plan = plans.find(p => p.id === activatePlanId);
    if (plan?.durationDays && date) {
      const start = new Date(date);
      start.setDate(start.getDate() + plan.durationDays);
      setActivateEndDate(start.toISOString().split('T')[0]);
    }
  };

  const handleActivate = async () => {
    if (!activateStartDate || !activateEndDate) {
      toast.error('Please set start and end dates'); return;
    }
    setActivateSaving(true);
    const password = generatePassword();
    const req = activating;
    try {
      // Create Firebase Auth user via secondary app
      const appName = 'trial-act-' + Date.now();
      const secondaryApp = initializeApp(firebaseConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);
      let ownerUid;
      try {
        const { user } = await createUserWithEmailAndPassword(secondaryAuth, req.email, password);
        ownerUid = user.uid;
      } finally {
        await deleteApp(secondaryApp);
      }

      const selectedPlan = plans.find(p => p.id === activatePlanId);

      // Create gym doc
      const gymDoc = await createDocument('gyms', {
        name:             req.gymName,
        address:          req.city || '',
        phone:            req.phone || '',
        email:            req.email,
        ownerEmail:       req.email,
        ownerName:        req.ownerName || '',
        ownerPhone:       req.phone || '',
        ownerCity:        req.city || '',
        ownerPassword:    password,
        ownerId:          ownerUid,
        isActive:         true,
        planId:           activatePlanId,
        planName:         selectedPlan?.name || '',
        planStartDate:    activateStartDate,
        planEndDate:      activateEndDate,
        subscriptionPlan: selectedPlan?.name || 'Trial',
      });

      // Create admin user doc
      await setDocument('users', ownerUid, {
        role:  'admin',
        name:  req.ownerName || req.gymName + ' Admin',
        email: req.email,
        gymId: gymDoc.id,
      });

      // Seed default settings
      await setTenantDocument(gymDoc.id, 'settings', 'general', {
        gymInfo: { name: req.gymName, location: req.city || '', contact: req.phone || '' },
        categories: DEFAULT_CATEGORIES,
      });

      // Mark request as activated
      await updateDocument('trialRequests', req.id, { status: 'activated', gymId: gymDoc.id });

      // Remove from list + show credentials
      setRequests(prev => prev.filter(r => r.id !== req.id));
      setActivating(null);
      setCreds({
        gymName:  req.gymName,
        email:    req.email,
        password,
        planName: selectedPlan?.name || '',
        endDate:  activateEndDate,
      });
      toast.success(`${req.gymName} activated!`);
    } catch (err) {
      toast.error(
        err.code === 'auth/email-already-in-use' ? 'This email already has an account' :
        err.message || 'Activation failed'
      );
    } finally {
      setActivateSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteDocument('trialRequests', id);
      setRequests(prev => prev.filter(r => r.id !== id));
      toast.success('Request deleted');
    } catch { toast.error('Failed to delete'); }
    finally { setDeletingId(null); setDeleteConfirmId(null); }
  };

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const filtered = requests.filter(r => {
    const t = search.toLowerCase();
    return !t || r.gymName?.toLowerCase().includes(t) || r.email?.toLowerCase().includes(t) || r.phone?.includes(t) || r.city?.toLowerCase().includes(t);
  });

  const inp = 'w-full px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary text-sm';

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-h1 text-h1 text-on-surface">Trial Requests</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">Pending sign-ups from the registration form. Activate to create gym accounts.</p>
        </div>
        <a href="/register" target="_blank" rel="noreferrer"
          className="bg-primary text-on-primary px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2 text-sm">
          <span className="material-symbols-outlined text-[18px]">open_in_new</span>
          Registration Link
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Pending Requests" value={requests.length} icon="pending_actions" color="bg-indigo-100 text-indigo-600" />
        <StatCard label="Plans Available"  value={plans.length}    icon="loyalty"         color="bg-violet-100 text-violet-600" />
        <StatCard label="Today's Date"     value={new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short' })} icon="calendar_today" color="bg-slate-100 text-slate-600" />
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2.5 max-w-sm shadow-sm">
        <span className="material-symbols-outlined text-on-surface-variant text-[20px]">search</span>
        <input type="text" placeholder="Search by name, email, phone, city…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-on-surface outline-none text-sm placeholder:text-on-surface-variant" />
        {search && (
          <button onClick={() => setSearch('')} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/20 bg-surface-container-low/50">
                {['Gym Name', 'Owner', 'Phone', 'City', 'Email', 'Received', 'Actions'].map(h => (
                  <th key={h} className="p-4 font-semibold text-xs uppercase tracking-wide text-on-surface-variant">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-10 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="p-12 text-center">
                  <div className="flex flex-col items-center gap-3 text-on-surface-variant">
                    <span className="material-symbols-outlined text-5xl opacity-30">inbox</span>
                    <p className="font-medium">{search ? 'No requests match your search' : 'No pending requests'}</p>
                    {!search && (
                      <a href="/register" target="_blank" className="text-primary text-sm font-medium hover:underline">
                        Share registration link
                      </a>
                    )}
                  </div>
                </td></tr>
              ) : filtered.map(req => (
                <tr key={req.id} className="border-b border-outline-variant/10 hover:bg-surface-container/30 transition-colors">
                  <td className="p-4 font-semibold text-on-surface">{req.gymName}</td>
                  <td className="p-4 text-on-surface-variant">{req.ownerName || '—'}</td>
                  <td className="p-4 text-on-surface-variant">{req.phone || '—'}</td>
                  <td className="p-4 text-on-surface-variant">{req.city || '—'}</td>
                  <td className="p-4 text-on-surface-variant">{req.email}</td>
                  <td className="p-4 text-xs text-on-surface-variant">
                    {req.createdAt ? fmtDate(new Date(req.createdAt.seconds * 1000).toISOString().split('T')[0]) : '—'}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openActivate(req)}
                        className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                        <span className="material-symbols-outlined text-[14px]">bolt</span>
                        Activate
                      </button>
                      <button onClick={() => setDeleteConfirmId(req.id)}
                        className="inline-flex items-center gap-1 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors">
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-outline-variant/20 text-xs text-on-surface-variant">
            {filtered.length} pending request{filtered.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* ── Activate Modal ── */}
      {activating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-5">
            <div>
              <h3 className="font-bold text-on-surface text-lg">Activate — {activating.gymName}</h3>
              <p className="text-sm text-on-surface-variant mt-0.5">Assign a plan and set the access dates. Credentials will be generated automatically.</p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-on-surface-variant">Plan</label>
                <select value={activatePlanId} onChange={e => handlePlanChange(e.target.value)} className={inp}>
                  <option value="">— Select a plan —</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.durationDays ? ` (${p.durationDays} days)` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-on-surface-variant">Start Date *</label>
                  <input type="date" value={activateStartDate} onChange={e => handleStartChange(e.target.value)} className={inp} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-on-surface-variant">End Date *</label>
                  <input type="date" value={activateEndDate} onChange={e => setActivateEndDate(e.target.value)} className={inp} />
                </div>
              </div>
            </div>

            <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl text-xs text-primary flex items-start gap-2">
              <span className="material-symbols-outlined text-[15px] mt-0.5">info</span>
              A password will be auto-generated and shown to you after activation. Share it with the gym owner.
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setActivating(null)} disabled={activateSaving}
                className="px-4 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container text-sm font-medium">
                Cancel
              </button>
              <button onClick={handleActivate} disabled={activateSaving || !activateStartDate || !activateEndDate}
                className="px-5 py-2 bg-primary text-on-primary rounded-lg font-semibold text-sm hover:bg-primary/90 flex items-center gap-2 disabled:opacity-60">
                {activateSaving && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
                {activateSaving ? 'Activating…' : 'Activate & Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Credentials Modal ── */}
      {creds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-emerald-600 text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </div>
              <div>
                <h3 className="font-bold text-on-surface">{creds.gymName} is live!</h3>
                <p className="text-xs text-on-surface-variant">Share these credentials with the gym owner.</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 bg-surface-container rounded-xl p-4">
              {[
                { label: 'Login URL', value: window.location.origin + '/login', key: 'url'  },
                { label: 'Email',    value: creds.email,                         key: 'email'},
                { label: 'Password', value: creds.password,                      key: 'pass' },
              ].map(({ label, value, key }) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-0.5">{label}</div>
                    <div className="text-sm font-semibold text-on-surface truncate">{value}</div>
                  </div>
                  <button onClick={() => copy(value, key)}
                    className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors border ${copied === key ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 'bg-surface-container-lowest border-outline-variant/30 text-on-surface-variant hover:text-primary hover:border-primary/30'}`}>
                    <span className="material-symbols-outlined text-[15px]">{copied === key ? 'check' : 'content_copy'}</span>
                  </button>
                </div>
              ))}
              <div className="pt-2 border-t border-outline-variant/20 text-xs text-on-surface-variant flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">loyalty</span>
                {creds.planName || 'Trial'} · valid until <span className="font-semibold text-on-surface">{fmtDate(creds.endDate)}</span>
              </div>
            </div>

            <button onClick={() => setCreds(null)}
              className="w-full py-2.5 bg-primary text-on-primary rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors">
              Done
            </button>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteConfirmId && (() => {
        const req = requests.find(r => r.id === deleteConfirmId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
              <div className="flex items-start gap-3 mb-6">
                <div className="w-11 h-11 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-rose-600 text-[22px]">warning</span>
                </div>
                <div>
                  <h3 className="font-bold text-on-surface">Delete request from "{req?.gymName}"?</h3>
                  <p className="text-sm text-on-surface-variant mt-1">This removes the pending request. The person will need to sign up again.</p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container text-sm">
                  Cancel
                </button>
                <button onClick={() => handleDelete(deleteConfirmId)} disabled={deletingId === deleteConfirmId}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium text-sm shadow-sm flex items-center gap-2 disabled:opacity-70">
                  {deletingId === deleteConfirmId && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
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
