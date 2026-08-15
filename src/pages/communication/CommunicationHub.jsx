import { useState, useEffect, useCallback } from 'react';
import { getTenantCollection, createTenantDocument, updateTenantDocument } from '../../firebase/tenantDb';
import { useAuth } from '../../context/AuthContext';

const ANNOUNCEMENT_TYPES = ['General', 'Promotion', 'Alert', 'Event'];
const AUDIENCE_OPTIONS = ['All Members', 'Active Only', 'Expired Members'];
const FOLLOWUP_TYPES = ['Renewal Reminder', 'Payment Due', 'Birthday', 'Custom'];
const FOLLOWUP_STATUSES = ['Pending', 'Done', 'All'];

const announcementTypeColors = {
  General: 'bg-sky-50 text-sky-700',
  Promotion: 'bg-violet-50 text-violet-700',
  Alert: 'bg-rose-50 text-rose-700',
  Event: 'bg-emerald-50 text-emerald-700',
};

const channelColors = {
  Email: 'bg-sky-50 text-sky-700',
  WhatsApp: 'bg-emerald-50 text-emerald-700',
  'In-App': 'bg-violet-50 text-violet-700',
};

const notifStatusColors = {
  Sent: 'text-emerald-600 bg-emerald-50',
  Failed: 'text-rose-600 bg-rose-50',
  Pending: 'text-amber-600 bg-amber-50',
};

function formatDate(val) {
  if (!val) return '—';
  const d = val?.toDate ? val.toDate() : new Date(val);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(val) {
  if (!val) return '—';
  const d = val?.toDate ? val.toDate() : new Date(val);
  if (isNaN(d)) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function truncate(str, n = 100) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

function isToday(val) {
  if (!val) return false;
  const d = val?.toDate ? val.toDate() : new Date(val);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

function isThisMonth(val) {
  if (!val) return false;
  const d = val?.toDate ? val.toDate() : new Date(val);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

const cardBase =
  'bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.1)] flex flex-col gap-4';

const inputClass =
  'w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary text-sm transition-colors';

const labelClass = 'block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wide';

const primaryBtn =
  'bg-primary text-on-primary px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2 text-sm';

const ghostBtn =
  'px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container transition-colors text-sm';

const filterPill = (active) =>
  `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
    active
      ? 'bg-primary text-on-primary'
      : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
  }`;

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color }) {
  return (
    <div className={cardBase + ' flex-row items-center gap-4'}>
      <div className={`rounded-xl p-3 ${color}`}>
        <span
          className="material-symbols-outlined text-2xl"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {icon}
        </span>
      </div>
      <div>
        <p className="font-label-caps text-label-caps text-on-surface-variant uppercase">{label}</p>
        <p className="font-stat-value text-stat-value text-on-surface leading-none mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-on-surface-variant">
      <span
        className="material-symbols-outlined text-5xl opacity-30"
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        {icon}
      </span>
      <p className="font-body-lg text-body-lg text-center max-w-xs">{message}</p>
    </div>
  );
}

// ─── Announcements Tab ───────────────────────────────────────────────────────

function AnnouncementsTab({ gymId, userName }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    message: '',
    type: 'General',
    target: 'All Members',
    scheduledFor: '',
  });
  const [errors, setErrors] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTenantCollection(gymId, 'announcements', [], { field: 'createdAt', direction: 'desc' });
      setAnnouncements(data);
    } catch {
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  }, [gymId]);

  useEffect(() => { load(); }, [load]);

  function validate() {
    const e = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.message.trim()) e.message = 'Message is required';
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      await createTenantDocument(gymId, 'announcements', {
        title: form.title.trim(),
        message: form.message.trim(),
        type: form.type,
        target: form.target,
        scheduledFor: form.scheduledFor || null,
        sentBy: userName || 'Admin',
        sentAt: null,
        createdAt: new Date(),
      });
      setForm({ title: '', message: '', type: 'General', target: 'All Members', scheduledFor: '' });
      setErrors({});
      setShowForm(false);
      await load();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  function handleChange(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => { const n = { ...e }; delete n[field]; return n; });
  }

  return (
    <div className="flex flex-col gap-stack-gap">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="font-h3 text-h3 text-on-surface">Announcements</p>
        <button className={primaryBtn} onClick={() => setShowForm((v) => !v)}>
          <span className="material-symbols-outlined text-base">
            {showForm ? 'expand_less' : 'add'}
          </span>
          {showForm ? 'Cancel' : 'New Announcement'}
        </button>
      </div>

      {/* Inline Form */}
      {showForm && (
        <div className={cardBase + ' border border-primary/20'}>
          <p className="font-h3 text-h3 text-on-surface text-base font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>campaign</span>
            New Announcement
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelClass}>Title *</label>
              <input
                type="text"
                className={inputClass + (errors.title ? ' border-rose-400' : '')}
                placeholder="e.g. Gym closure on Sunday"
                value={form.title}
                onChange={(e) => handleChange('title', e.target.value)}
              />
              {errors.title && <p className="text-rose-500 text-xs mt-1">{errors.title}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Message *</label>
              <textarea
                rows={4}
                className={inputClass + ' resize-none' + (errors.message ? ' border-rose-400' : '')}
                placeholder="Write your announcement here…"
                value={form.message}
                onChange={(e) => handleChange('message', e.target.value)}
              />
              {errors.message && <p className="text-rose-500 text-xs mt-1">{errors.message}</p>}
            </div>
            <div>
              <label className={labelClass}>Type *</label>
              <select
                className={inputClass}
                value={form.type}
                onChange={(e) => handleChange('type', e.target.value)}
              >
                {ANNOUNCEMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Target Audience *</label>
              <select
                className={inputClass}
                value={form.target}
                onChange={(e) => handleChange('target', e.target.value)}
              >
                {AUDIENCE_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Schedule For (optional)</label>
              <input
                type="datetime-local"
                className={inputClass}
                value={form.scheduledFor}
                onChange={(e) => handleChange('scheduledFor', e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-outline-variant/20">
            <button
              className={primaryBtn}
              onClick={handleSave}
              disabled={saving}
            >
              {saving
                ? <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                : <span className="material-symbols-outlined text-base">send</span>}
              {saving ? 'Saving…' : 'Save Announcement'}
            </button>
            <button className={ghostBtn} onClick={() => { setShowForm(false); setErrors({}); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.08)] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
            <span className="text-sm">Loading announcements…</span>
          </div>
        ) : announcements.length === 0 ? (
          <EmptyState icon="campaign" message="No announcements yet. Create your first announcement above." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-175">
              <thead>
                <tr className="bg-surface-container-low/50 border-b border-outline-variant/20">
                  {['Title', 'Message', 'Type', 'Target', 'Scheduled For', 'Created At', 'Sent By'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {announcements.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-outline-variant/10 hover:bg-surface-container/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-on-surface font-medium whitespace-nowrap max-w-40 truncate">
                      {a.title}
                    </td>
                    <td className="px-4 py-3 text-sm text-on-surface-variant max-w-55">
                      {truncate(a.message, 100)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-md ${announcementTypeColors[a.type] || 'bg-slate-50 text-slate-700'}`}>
                        {a.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-on-surface-variant whitespace-nowrap">{a.target}</td>
                    <td className="px-4 py-3 text-sm text-on-surface-variant whitespace-nowrap">
                      {a.scheduledFor ? formatDateTime(a.scheduledFor) : <span className="text-on-surface-variant/40 italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-on-surface-variant whitespace-nowrap">{formatDateTime(a.createdAt)}</td>
                    <td className="px-4 py-3 text-sm text-on-surface-variant whitespace-nowrap">{a.sentBy || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Follow-up Reminders Tab ─────────────────────────────────────────────────

function FollowupsTab({ gymId }) {
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [markingId, setMarkingId] = useState(null);
  const [form, setForm] = useState({
    memberName: '',
    phone: '',
    type: 'Renewal Reminder',
    dueDate: '',
    notes: '',
  });
  const [errors, setErrors] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTenantCollection(gymId, 'followups', [], { field: 'dueDate', direction: 'asc' });
      setFollowups(data);
    } catch {
      setFollowups([]);
    } finally {
      setLoading(false);
    }
  }, [gymId]);

  useEffect(() => { load(); }, [load]);

  const filtered = followups.filter((f) => {
    if (statusFilter === 'All') return true;
    return f.status === statusFilter;
  });

  function validate() {
    const e = {};
    if (!form.memberName.trim()) e.memberName = 'Member name is required';
    if (!form.phone.trim()) e.phone = 'Phone is required';
    if (!form.dueDate) e.dueDate = 'Due date is required';
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      await createTenantDocument(gymId, 'followups', {
        memberName: form.memberName.trim(),
        phone: form.phone.trim(),
        type: form.type,
        dueDate: form.dueDate,
        notes: form.notes.trim(),
        status: 'Pending',
        createdAt: new Date(),
      });
      setForm({ memberName: '', phone: '', type: 'Renewal Reminder', dueDate: '', notes: '' });
      setErrors({});
      setShowForm(false);
      await load();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  async function markDone(id) {
    setMarkingId(id);
    try {
      await updateTenantDocument(gymId, 'followups', id, { status: 'Done', doneAt: new Date() });
      setFollowups((prev) => prev.map((f) => f.id === id ? { ...f, status: 'Done' } : f));
    } catch {
      // silent
    } finally {
      setMarkingId(null);
    }
  }

  function handleChange(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => { const n = { ...e }; delete n[field]; return n; });
  }

  return (
    <div className="flex flex-col gap-stack-gap">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {FOLLOWUP_STATUSES.map((s) => (
            <button key={s} className={filterPill(statusFilter === s)} onClick={() => setStatusFilter(s)}>
              {s}
            </button>
          ))}
        </div>
        <button className={primaryBtn} onClick={() => setShowForm((v) => !v)}>
          <span className="material-symbols-outlined text-base">{showForm ? 'expand_less' : 'add'}</span>
          {showForm ? 'Cancel' : 'Add Reminder'}
        </button>
      </div>

      {/* Inline Form */}
      {showForm && (
        <div className={cardBase + ' border border-primary/20'}>
          <p className="font-h3 text-h3 text-on-surface text-base font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>notifications</span>
            New Follow-up Reminder
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Member Name *</label>
              <input
                type="text"
                className={inputClass + (errors.memberName ? ' border-rose-400' : '')}
                placeholder="e.g. Rahul Sharma"
                value={form.memberName}
                onChange={(e) => handleChange('memberName', e.target.value)}
              />
              {errors.memberName && <p className="text-rose-500 text-xs mt-1">{errors.memberName}</p>}
            </div>
            <div>
              <label className={labelClass}>Phone *</label>
              <input
                type="tel"
                className={inputClass + (errors.phone ? ' border-rose-400' : '')}
                placeholder="e.g. 9876543210"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
              />
              {errors.phone && <p className="text-rose-500 text-xs mt-1">{errors.phone}</p>}
            </div>
            <div>
              <label className={labelClass}>Type *</label>
              <select
                className={inputClass}
                value={form.type}
                onChange={(e) => handleChange('type', e.target.value)}
              >
                {FOLLOWUP_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Due Date *</label>
              <input
                type="date"
                className={inputClass + (errors.dueDate ? ' border-rose-400' : '')}
                value={form.dueDate}
                onChange={(e) => handleChange('dueDate', e.target.value)}
              />
              {errors.dueDate && <p className="text-rose-500 text-xs mt-1">{errors.dueDate}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Notes</label>
              <textarea
                rows={2}
                className={inputClass + ' resize-none'}
                placeholder="Optional notes…"
                value={form.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-outline-variant/20">
            <button className={primaryBtn} onClick={handleSave} disabled={saving}>
              {saving
                ? <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                : <span className="material-symbols-outlined text-base">save</span>}
              {saving ? 'Saving…' : 'Save Reminder'}
            </button>
            <button className={ghostBtn} onClick={() => { setShowForm(false); setErrors({}); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.08)] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
            <span className="text-sm">Loading reminders…</span>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="notifications" message={`No ${statusFilter !== 'All' ? statusFilter.toLowerCase() + ' ' : ''}follow-up reminders yet.`} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-175">
              <thead>
                <tr className="bg-surface-container-low/50 border-b border-outline-variant/20">
                  {['Member', 'Phone', 'Type', 'Due Date', 'Status', 'Notes', 'Action'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-outline-variant/10 hover:bg-surface-container/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-on-surface font-medium whitespace-nowrap">{f.memberName}</td>
                    <td className="px-4 py-3 text-sm text-on-surface-variant whitespace-nowrap">{f.phone}</td>
                    <td className="px-4 py-3 text-sm text-on-surface-variant whitespace-nowrap">{f.type}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <span className={isToday(f.dueDate) ? 'text-rose-600 font-semibold' : 'text-on-surface-variant'}>
                        {formatDate(f.dueDate)}
                        {isToday(f.dueDate) && (
                          <span className="ml-1 text-xs bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded">Today</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {f.status === 'Done' ? (
                        <span className="flex items-center gap-1 text-emerald-600 font-label-caps text-label-caps bg-emerald-50 px-2 py-1 rounded-md w-fit text-xs">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Done
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600 font-label-caps text-label-caps bg-amber-50 px-2 py-1 rounded-md w-fit text-xs">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-on-surface-variant max-w-40 truncate">
                      {f.notes || <span className="text-on-surface-variant/40 italic">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {f.status !== 'Done' && (
                        <button
                          className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          onClick={() => markDone(f.id)}
                          disabled={markingId === f.id}
                        >
                          {markingId === f.id
                            ? <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                            : <span className="material-symbols-outlined text-sm">check_circle</span>}
                          Done
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Notification Log Tab ────────────────────────────────────────────────────

function NotificationLogTab({ gymId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTenantCollection(gymId, 'notificationLogs', [], { field: 'sentAt', direction: 'desc' });
      setLogs(data);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [gymId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-stack-gap">
      <p className="font-h3 text-h3 text-on-surface">Notification Log</p>
      <div className="bg-surface-container-lowest rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.08)] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
            <span className="text-sm">Loading logs…</span>
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon="notifications_none"
            message="No notification logs yet. Sent notifications will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-175">
              <thead>
                <tr className="bg-surface-container-low/50 border-b border-outline-variant/20">
                  {['Date', 'Recipient', 'Channel', 'Message Summary', 'Status', 'Sent By'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-outline-variant/10 hover:bg-surface-container/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-on-surface-variant whitespace-nowrap">{formatDateTime(l.sentAt)}</td>
                    <td className="px-4 py-3 text-sm text-on-surface font-medium whitespace-nowrap">{l.recipient || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-md ${channelColors[l.channel] || 'bg-slate-50 text-slate-700'}`}>
                        {l.channel || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-on-surface-variant max-w-55 truncate">
                      {truncate(l.message || l.messageSummary, 100)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md w-fit ${notifStatusColors[l.status] || 'bg-slate-50 text-slate-700'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          l.status === 'Sent' ? 'bg-emerald-500' :
                          l.status === 'Failed' ? 'bg-rose-500' : 'bg-amber-500'
                        }`}></div>
                        {l.status || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-on-surface-variant whitespace-nowrap">{l.sentBy || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const TABS = [
  { key: 'announcements', label: 'Announcements', icon: 'campaign' },
  { key: 'followups', label: 'Follow-up Reminders', icon: 'notifications' },
  { key: 'logs', label: 'Notification Log', icon: 'history' },
];

export default function CommunicationHub() {
  const { gymId, userName } = useAuth();
  const [activeTab, setActiveTab] = useState('announcements');

  const [stats, setStats] = useState({
    announcementsThisMonth: 0,
    pendingFollowups: 0,
    dueToday: 0,
    loading: true,
  });

  useEffect(() => {
    if (!gymId) return;
    let cancelled = false;

    async function loadStats() {
      try {
        const [announcements, followups] = await Promise.all([
          getTenantCollection(gymId, 'announcements'),
          getTenantCollection(gymId, 'followups'),
        ]);

        if (cancelled) return;

        const announcementsThisMonth = announcements.filter((a) => isThisMonth(a.createdAt)).length;
        const pendingFollowups = followups.filter((f) => f.status === 'Pending').length;
        const dueToday = followups.filter((f) => f.status === 'Pending' && isToday(f.dueDate)).length;

        setStats({ announcementsThisMonth, pendingFollowups, dueToday, loading: false });
      } catch {
        if (!cancelled) setStats((s) => ({ ...s, loading: false }));
      }
    }

    loadStats();
    return () => { cancelled = true; };
  }, [gymId]);

  return (
    <div className="p-6 flex flex-col gap-stack-gap max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-2xl p-3 bg-primary-container/30">
          <span
            className="material-symbols-outlined text-3xl text-primary"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            campaign
          </span>
        </div>
        <div>
          <h1 className="font-h1 text-h1 text-on-surface">Communication Hub</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Manage announcements, follow-ups, and notification history
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon="campaign"
          label="Announcements This Month"
          value={stats.loading ? '—' : stats.announcementsThisMonth}
          color="bg-violet-100 text-violet-600"
        />
        <StatCard
          icon="notifications_active"
          label="Pending Follow-ups"
          value={stats.loading ? '—' : stats.pendingFollowups}
          color="bg-amber-100 text-amber-600"
        />
        <StatCard
          icon="event_busy"
          label="Reminders Due Today"
          value={stats.loading ? '—' : stats.dueToday}
          color="bg-rose-100 text-rose-600"
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 bg-surface-container rounded-2xl p-1.5 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-surface-container-lowest text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span
              className="material-symbols-outlined text-base"
              style={activeTab === tab.key ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              {tab.icon}
            </span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'announcements' && (
        <AnnouncementsTab gymId={gymId} userName={userName} />
      )}
      {activeTab === 'followups' && (
        <FollowupsTab gymId={gymId} />
      )}
      {activeTab === 'logs' && (
        <NotificationLogTab gymId={gymId} />
      )}
    </div>
  );
}
