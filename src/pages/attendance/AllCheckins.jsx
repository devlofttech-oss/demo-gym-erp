import { useState, useEffect, Fragment } from 'react';
import { getTenantCollection } from '../../firebase/tenantDb';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const PAGE_SIZE = 30;

function paginationPages(page, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  if (page > 3) pages.push('...');
  for (let p = Math.max(2, page - 1); p <= Math.min(total - 1, page + 1); p++) pages.push(p);
  if (page < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

function formatTime(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); }
  catch { return '—'; }
}

function formatDuration(mins) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function getRecordDate(a) {
  if (a.date && /^\d{4}-\d{2}-\d{2}$/.test(a.date)) return a.date;
  const ts = a.checkInTime || a.timestamp;
  if (!ts) return null;
  try { return new Date(ts).toISOString().split('T')[0]; }
  catch { return null; }
}

function formatDateLabel(iso) {
  try {
    const d = new Date(iso + 'T00:00:00');
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 864e5).toISOString().split('T')[0];
    if (iso === today) return 'Today';
    if (iso === yesterday) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return iso; }
}

export default function AllCheckins() {
  const { gymId } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const data = await getTenantCollection(gymId, 'attendance');
        data.sort((a, b) => {
          const da = a.checkInTime || a.timestamp || a.date || 0;
          const db = b.checkInTime || b.timestamp || b.date || 0;
          return new Date(db) - new Date(da);
        });
        setRecords(data);
      } catch { toast.error('Failed to load attendance'); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  useEffect(() => { setPage(1); }, [dateFilter, customDate, search]);

  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().split('T')[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const filtered = records.filter(a => {
    const d = getRecordDate(a);
    if (!d) return false;
    let matchDate = true;
    if (dateFilter === 'today') matchDate = d === today;
    else if (dateFilter === 'week') matchDate = d >= weekAgo;
    else if (dateFilter === 'month') matchDate = d >= monthStart;
    else if (dateFilter === 'custom') matchDate = d === customDate;
    const term = search.toLowerCase();
    return matchDate && (!term || a.memberName?.toLowerCase().includes(term));
  });

  const totalToday = records.filter(a => getRecordDate(a) === today).length;
  const totalMonth = records.filter(a => { const d = getRecordDate(a); return d && d >= monthStart; }).length;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-h1 text-h1 text-on-surface">Attendance Log</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">All member check-ins sorted by date.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: "Today's Check-ins", value: totalToday, icon: 'today', color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'This Month', value: totalMonth, icon: 'calendar_month', color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Total Records', value: records.length, icon: 'event_available', color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map(k => (
          <div key={k.label} className="bg-surface-container-lowest rounded-2xl p-5 shadow-[0_4px_20px_rgba(207,196,255,0.12)] flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${k.bg} flex items-center justify-center shrink-0`}>
              <span className={`material-symbols-outlined text-[24px] ${k.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{k.icon}</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-on-surface">{k.value}</div>
              <div className="text-xs text-on-surface-variant">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-surface-container rounded-xl p-1">
          {[
            { id: 'today', label: 'Today' },
            { id: 'week', label: 'This Week' },
            { id: 'month', label: 'This Month' },
            { id: 'all', label: 'All Time' },
            { id: 'custom', label: 'Custom Date' },
          ].map(f => (
            <button key={f.id} onClick={() => setDateFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${dateFilter === f.id ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {dateFilter === 'custom' && (
          <input type="date" value={customDate} onChange={e => setCustomDate(e.target.value)}
            className="px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-xl text-sm text-on-surface outline-none focus:border-primary" />
        )}

        <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2.5 flex-1 min-w-55 max-w-sm shadow-sm">
          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">search</span>
          <input type="text" placeholder="Search member name..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-on-surface outline-none text-sm placeholder:text-on-surface-variant" />
          {search && (
            <button onClick={() => setSearch('')}>
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.15)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/30 bg-surface-container-low/50">
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Member</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Date</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Check-in</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Check-out</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Duration</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="p-8 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined animate-spin text-2xl mr-2">progress_activity</span>Loading attendance...
                </td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan="5" className="p-12 text-center">
                  <div className="flex flex-col items-center gap-3 text-on-surface-variant">
                    <span className="material-symbols-outlined text-5xl opacity-30">event_busy</span>
                    <p className="font-medium">No check-ins found</p>
                  </div>
                </td></tr>
              ) : paginated.map((a, i) => {
                const d = getRecordDate(a);
                const prevDate = i > 0 ? getRecordDate(paginated[i - 1]) : null;
                const showHeader = d !== prevDate;
                return (
                  <Fragment key={a.id}>
                    {showHeader && (
                      <tr className="bg-surface-container/40">
                        <td colSpan="5" className="px-4 py-2 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                          {d ? formatDateLabel(d) : 'Unknown Date'}
                        </td>
                      </tr>
                    )}
                    <tr className="border-b border-outline-variant/20 hover:bg-surface-container/40 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary-container text-primary flex items-center justify-center font-bold text-sm shrink-0">
                            {a.memberName?.charAt(0) || '?'}
                          </div>
                          <div className="font-medium text-on-surface text-sm">{a.memberName || 'Unknown'}</div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-on-surface-variant">
                        {d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="p-4">
                        <span className="flex items-center gap-1.5 text-emerald-600 font-medium text-sm">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 inline-block"></span>
                          {formatTime(a.checkInTime || a.timestamp)}
                        </span>
                      </td>
                      <td className="p-4">
                        {a.checkOutTime ? (
                          <span className="flex items-center gap-1.5 text-rose-500 font-medium text-sm">
                            <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0 inline-block"></span>
                            {formatTime(a.checkOutTime)}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">Active</span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-on-surface font-medium">{formatDuration(a.duration)}</td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-outline-variant/20 flex items-center justify-between">
            <span className="text-xs text-on-surface-variant">
              {totalPages > 1
                ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} check-ins`
                : `${filtered.length} check-in${filtered.length !== 1 ? 's' : ''}`}
            </span>
            {totalPages > 1 && (
              <div className="flex gap-1 items-center">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container disabled:opacity-30 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                {paginationPages(page, totalPages).map((p, i) => p === '...'
                  ? <span key={`e${i}`} className="w-6 text-center text-xs text-on-surface-variant">…</span>
                  : <button key={p} onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${p === page ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}>
                      {p}
                    </button>
                )}
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container disabled:opacity-30 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
