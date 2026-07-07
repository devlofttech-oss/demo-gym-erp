import { useState, useEffect, useRef } from 'react';

const PAGE_SIZE = 25;

function paginationPages(page, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  if (page > 3) pages.push('...');
  for (let p = Math.max(2, page - 1); p <= Math.min(total - 1, page + 1); p++) pages.push(p);
  if (page < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}
import { useAuth } from '../../context/AuthContext';
import { getTenantCollection, createTenantDocument } from '../../firebase/tenantDb';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import SendSMSModal from '../../components/messaging/SendSMSModal';

function daysUntilExpiry(expiryDate) {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
}

export default function MemberList() {
  const { gymId } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [smsMember, setSmsMember] = useState(null);
  const [smsMessage, setSmsMessage] = useState('');
  const [page, setPage] = useState(1);
  const fileInputRef = useRef(null);

  const [absentees, setAbsentees] = useState([]);
  const [absenteesLoading, setAbsenteesLoading] = useState(false);
  const [absenteesLoaded, setAbsenteesLoaded] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, []);

  useEffect(() => { setPage(1); }, [searchTerm, filterStatus, filterCategory]);

  useEffect(() => {
    if (filterStatus === 'Absentees' && !absenteesLoaded && members.length > 0) {
      fetchAbsentees();
    }
  }, [filterStatus, members.length]);

  const fetchAbsentees = async () => {
    setAbsenteesLoading(true);
    try {
      const today = new Date();
      const fiveDaysAgo = new Date(today);
      fiveDaysAgo.setDate(today.getDate() - 4);
      const fiveDaysAgoStr = fiveDaysAgo.toISOString().split('T')[0];

      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

      const recentAttendance = await getTenantCollection(gymId, 'attendance', [
        { field: 'date', op: '>=', value: thirtyDaysAgoStr },
      ]);

      // Build memberId → latest visit date map
      const lastVisitMap = {};
      recentAttendance.forEach(a => {
        if (!lastVisitMap[a.memberId] || a.date > lastVisitMap[a.memberId]) {
          lastVisitMap[a.memberId] = a.date;
        }
      });

      const list = members
        .filter(m => {
          const days = daysUntilExpiry(m.expiryDate);
          const isActive = days === null || days >= 0;
          const lastVisit = lastVisitMap[m.id];
          const hasRecentVisit = lastVisit && lastVisit >= fiveDaysAgoStr;
          return isActive && !hasRecentVisit;
        })
        .map(m => ({ ...m, lastVisit: lastVisitMap[m.id] || null }));

      setAbsentees(list);
      setAbsenteesLoaded(true);
    } catch (err) {
      console.error('Failed to fetch absentees', err);
      import('react-hot-toast').then(m => m.default.error('Failed to load absentees'));
    } finally {
      setAbsenteesLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const data = await getTenantCollection(gymId, 'members');
      setMembers(data);
    } catch (error) {
      console.error('Failed to fetch members', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Excel Import ──────────────────────────────────────────────────────────

  // Converts Excel serial numbers and common string formats → YYYY-MM-DD
  function parseDate(val) {
    if (val === null || val === undefined || val === '') return '';
    if (typeof val === 'number') {
      // Excel date serial (days since 1900-01-01, with leap-year bug offset)
      const d = new Date(Math.round((val - 25569) * 864e5));
      return d.toISOString().split('T')[0];
    }
    const s = String(val).trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // already YYYY-MM-DD
    // DD-MM-YYYY or DD/MM/YYYY
    const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    // MM-DD-YYYY fallback via native Date
    const parsed = new Date(s);
    if (!isNaN(parsed)) return parsed.toISOString().split('T')[0];
    return s;
  }

  // Case-insensitive column lookup — tries each key variant
  function col(row, ...keys) {
    for (const k of keys) {
      for (const attempt of [k, k.toLowerCase(), k.toUpperCase()]) {
        if (row[attempt] !== undefined && row[attempt] !== '') return row[attempt];
      }
    }
    return '';
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (rows.length === 0) { toast.error('No data found in the file.'); return; }
        setImportPreview({ rows, fileName: file.name });
      } catch (err) {
        toast.error('Failed to read Excel file. Please use .xlsx or .xls format.');
        console.error(err);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleImportConfirm = async () => {
    if (!importPreview) return;
    setImporting(true);
    let success = 0, failed = 0;
    try {
      for (const row of importPreview.rows) {
        try {
          const name       = col(row, 'NAME', 'Name', 'Member Name', 'name');
          const phone      = String(col(row, 'MOBILE NUMBER', 'Mobile Number', 'Phone', 'Mobile', 'phone') || '');
          const admDate    = parseDate(col(row, 'ADMISSION DATE', 'Admission Date', 'Join Date', 'joinDate', 'Active From', 'Start Date'));
          const dueDate    = parseDate(col(row, 'DUE DATE', 'Due Date', 'Expiry Date', 'Expiry', 'expiryDate'));
          const membership = col(row, 'MEMBERSHIP', 'Membership', 'Plan', 'Plan Name', 'planName');
          const totalFees  = Number(col(row, 'Total fees', 'Total Fees', 'TOTAL FEES', 'totalFees'))  || 0;
          const paidFees   = Number(col(row, 'Fees paid', 'Fees Paid', 'FEES PAID', 'paidFees'))      || 0;
          const balFees    = Number(col(row, 'Balance fees', 'Balance Fees', 'BALANCE FEES', 'balanceFees')) || 0;
          const payMode    = col(row, 'Payment mode', 'Payment Mode', 'PAYMENT MODE', 'paymentMode') || 'Cash';
          const statusRaw  = col(row, 'STATUS', 'Status', 'status');
          const email      = col(row, 'Email', 'EMAIL', 'email');

          if (!name) { failed++; continue; }

          // Prefix with "Gym - " since these are gym-category members
          const planName = membership ? `Gym - ${String(membership).trim()}` : '';

          // Derive status from due date if not explicitly set
          const effectiveStatus = dueDate && new Date(dueDate) < new Date()
            ? 'Expired'
            : (statusRaw ? String(statusRaw).trim() : 'Active');

          await createTenantDocument(gymId, 'members', {
            name: String(name).trim(),
            phone: String(phone).trim(),
            email: String(email).trim(),
            planName,
            joinDate: admDate,
            planActiveFrom: admDate,
            expiryDate: dueDate,
            totalFees,
            paidFees,
            balanceFees: balFees,
            paymentMode: String(payMode).trim(),
            status: effectiveStatus,
            importedAt: new Date().toISOString(),
          });
          success++;
        } catch {
          failed++;
        }
      }
      toast.success(`Imported ${success} member${success !== 1 ? 's' : ''}${failed > 0 ? ` (${failed} skipped)` : ''}!`);
      setImportPreview(null);
      fetchMembers();
    } catch (err) {
      toast.error('Import failed. Please try again.');
      console.error(err);
    } finally {
      setImporting(false);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  const getStatusBadge = (status) => {
    if (status === 'Active') {
      return (
        <span className="flex items-center gap-1 text-emerald-600 font-label-caps text-label-caps bg-emerald-50 px-2 py-1 rounded-md w-fit">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Active
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-rose-600 font-label-caps text-label-caps bg-rose-50 px-2 py-1 rounded-md w-fit">
        <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div> Expired
      </span>
    );
  };

  const CATEGORIES = ['All', 'Gym', 'Zumba', 'Group Classes'];
  const CATEGORY_META = {
    Gym:             { icon: 'fitness_center', color: 'text-violet-600', bg: 'bg-violet-50', activeBg: 'bg-violet-600' },
    Zumba:           { icon: 'music_note',     color: 'text-pink-600',   bg: 'bg-pink-50',   activeBg: 'bg-pink-500'  },
    'Group Classes': { icon: 'groups',         color: 'text-amber-600',  bg: 'bg-amber-50',  activeBg: 'bg-amber-500' },
  };

  const matchesCategory = (member, cat) => {
    if (cat === 'All') return true;
    if (cat === 'Group Classes') {
      // Match both new "Group Classes" and old "Kids Dance" plan prefixes
      return member.planName?.startsWith('Group Classes') || member.planName?.startsWith('Kids Dance');
    }
    return member.planName?.startsWith(cat);
  };

  const filtered = members.filter(m => {
    const term = searchTerm.toLowerCase();
    const matchSearch = !term || m.name?.toLowerCase().includes(term) || m.phone?.includes(term);
    const days = daysUntilExpiry(m.expiryDate);
    let matchStatus = true;
    if (filterStatus === 'Active') matchStatus = days === null || days >= 0;
    else if (filterStatus === 'Expired') matchStatus = days !== null && days < 0;
    else if (filterStatus === 'Expiring') matchStatus = days !== null && days >= 0 && days <= 7;
    return matchSearch && matchStatus && matchesCategory(m, filterCategory);
  });

  const expiringCount = members.filter(m => {
    const days = daysUntilExpiry(m.expiryDate);
    return days !== null && days >= 0 && days <= 7;
  }).length;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-h1 text-h1 text-on-surface">Members</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">Manage your gym members, plans, and statuses.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Import Excel */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium border border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container text-on-surface transition-colors shadow-sm text-sm"
            title="Import members from Excel (.xlsx / .xls)"
          >
            <span className="material-symbols-outlined text-[18px] text-emerald-600">upload_file</span>
            Import Excel
          </button>

          <Link
            to="/members/add"
            className="bg-primary text-on-primary px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">person_add</span>
            New Member
          </Link>
        </div>
      </div>

      {/* Expiring Soon Alert */}
      {expiringCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-amber-500 text-2xl">notification_important</span>
          <p className="text-sm font-medium text-amber-800">
            <strong>{expiringCount} member{expiringCount > 1 ? 's' : ''}</strong> expiring within 7 days — send an SMS reminder using the{' '}
            <span className="inline-flex items-center gap-0.5 text-primary">
              <span className="material-symbols-outlined text-[14px]">sms</span> SMS
            </span>{' '}
            button in their row.
          </p>
        </div>
      )}

      {/* ── Import Preview Modal ── */}
      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/20">
              <div>
                <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-500">upload_file</span>
                  Import Preview
                </h2>
                <p className="text-sm text-on-surface-variant mt-1">{importPreview.fileName} — {importPreview.rows.length} records found</p>
              </div>
              <button onClick={() => setImportPreview(null)} className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              <p className="text-sm text-on-surface-variant mb-3">
                The following members will be added. Existing members will not be duplicated automatically — please verify before confirming.
              </p>
              <div className="overflow-x-auto rounded-xl border border-outline-variant/20">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-container-low/60">
                    <tr>
                      {['Name', 'Mobile', 'Membership', 'Admission', 'Due Date', 'Total', 'Paid', 'Balance', 'Status'].map(h => (
                        <th key={h} className="p-3 font-semibold text-on-surface-variant text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.rows.slice(0, 10).map((row, i) => {
                      const name       = col(row, 'NAME', 'Name', 'Member Name') || '';
                      const phone      = col(row, 'MOBILE NUMBER', 'Mobile Number', 'Phone', 'Mobile') || '';
                      const membership = col(row, 'MEMBERSHIP', 'Membership', 'Plan', 'Plan Name') || '';
                      const admDate    = parseDate(col(row, 'ADMISSION DATE', 'Admission Date', 'Join Date'));
                      const dueDate    = parseDate(col(row, 'DUE DATE', 'Due Date', 'Expiry Date', 'Expiry'));
                      const totalF     = col(row, 'Total fees', 'Total Fees', 'TOTAL FEES') || '—';
                      const paidF      = col(row, 'Fees paid', 'Fees Paid', 'FEES PAID') || '—';
                      const balF       = col(row, 'Balance fees', 'Balance Fees', 'BALANCE FEES') || '—';
                      const status     = col(row, 'STATUS', 'Status') || '';
                      return (
                        <tr key={i} className="border-t border-outline-variant/10 hover:bg-surface-container/30">
                          <td className="p-3 font-medium text-on-surface">{name || <em className="text-rose-400">Missing</em>}</td>
                          <td className="p-3 text-on-surface-variant">{String(phone)}</td>
                          <td className="p-3 text-on-surface-variant">{String(membership)}</td>
                          <td className="p-3 text-on-surface-variant">{admDate}</td>
                          <td className="p-3 text-on-surface-variant">{dueDate}</td>
                          <td className="p-3 text-on-surface-variant">{String(totalF)}</td>
                          <td className="p-3 text-on-surface-variant">{String(paidF)}</td>
                          <td className="p-3 text-on-surface-variant">{String(balF)}</td>
                          <td className="p-3 text-on-surface-variant">{String(status)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {importPreview.rows.length > 10 && (
                <p className="text-xs text-on-surface-variant mt-2 text-center">
                  Showing 10 of {importPreview.rows.length} records.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-outline-variant/20">
              <button
                onClick={() => setImportPreview(null)}
                className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImportConfirm}
                disabled={importing}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70"
              >
                {importing ? (
                  <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> Importing...</>
                ) : (
                  <><span className="material-symbols-outlined text-[16px]">upload</span> Import {importPreview.rows.length} Members</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(cat => {
          const meta = CATEGORY_META[cat];
          const isActive = filterCategory === cat;
          const count = cat === 'All'
            ? members.length
            : members.filter(m => matchesCategory(m, cat)).length;
          return (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                isActive
                  ? cat === 'All'
                    ? 'bg-primary text-on-primary border-primary shadow-sm'
                    : `${meta.activeBg} text-white border-transparent shadow-sm`
                  : `bg-surface-container-lowest border-outline-variant/30 text-on-surface-variant hover:bg-surface-container`
              }`}
            >
              {meta && (
                <span className={`material-symbols-outlined text-[16px] ${isActive ? 'text-white' : meta.color}`}>
                  {meta.icon}
                </span>
              )}
              {cat}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                isActive ? 'bg-white/20 text-white' : 'bg-surface-container text-on-surface-variant'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search + Status Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2.5 flex-1 min-w-55 max-w-xs shadow-sm">
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">search</span>
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent text-on-surface outline-none text-sm placeholder:text-on-surface-variant"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'All',       label: 'All' },
            { id: 'Active',    label: 'Active' },
            { id: 'Expiring',  label: 'Expiring Soon' },
            { id: 'Expired',   label: 'Expired' },
            { id: 'Absentees', label: 'Absentees' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilterStatus(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === id
                  ? id === 'Expiring'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : id === 'Absentees'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container-lowest border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {id === 'Absentees' && <span className="material-symbols-outlined text-[14px]">person_off</span>}
              {label}
              {id === 'Expiring' && expiringCount > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-px rounded-full ${filterStatus === 'Expiring' ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-700'}`}>
                  {expiringCount}
                </span>
              )}
              {id === 'Absentees' && absenteesLoaded && absentees.length > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-px rounded-full ${filterStatus === 'Absentees' ? 'bg-white/25 text-white' : 'bg-orange-100 text-orange-700'}`}>
                  {absentees.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Absentees View ── */}
      {filterStatus === 'Absentees' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-500">person_off</span>
              <h2 className="font-semibold text-on-surface">
                {absenteesLoading ? 'Loading absentees…' : `${absentees.length} active member${absentees.length !== 1 ? 's' : ''} absent for 5+ days`}
              </h2>
            </div>
            <button
              onClick={() => { setAbsenteesLoaded(false); fetchAbsentees(); }}
              disabled={absenteesLoading}
              className="flex items-center gap-1.5 text-sm text-primary hover:underline disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span> Refresh
            </button>
          </div>

          {absenteesLoading ? (
            <div className="flex items-center justify-center py-16 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin text-3xl mr-3">progress_activity</span>
              Checking attendance records…
            </div>
          ) : absentees.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-2xl p-12 flex flex-col items-center gap-3 text-on-surface-variant shadow-[0_10px_30px_rgba(207,196,255,0.15)]">
              <span className="material-symbols-outlined text-5xl opacity-40 text-emerald-500">sentiment_satisfied</span>
              <p className="font-medium">No absentees — everyone has visited in the last 5 days!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {absentees.map(member => {
                const daysSinceVisit = member.lastVisit
                  ? Math.ceil((new Date() - new Date(member.lastVisit)) / (1000 * 60 * 60 * 24))
                  : null;
                return (
                  <div key={member.id} className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-lg shrink-0 overflow-hidden">
                        {member.photoUrl
                          ? <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                          : (member.name?.charAt(0) || '?')
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-on-surface truncate">{member.name}</div>
                        <div className="text-xs text-on-surface-variant">{member.phone}</div>
                      </div>
                    </div>
                    <div className="text-xs text-on-surface-variant flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">event_busy</span>
                      {daysSinceVisit
                        ? `Last visit: ${daysSinceVisit} day${daysSinceVisit !== 1 ? 's' : ''} ago (${member.lastVisit})`
                        : 'No visit record found'}
                    </div>
                    <div className="text-xs text-on-surface-variant flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">card_membership</span>
                      {member.planName || 'No plan'}
                    </div>
                    <div className="flex gap-2 pt-1">
                      {member.phone && (
                        <button
                          onClick={() => {
                            setSmsMember(member);
                            setSmsMessage(`Dear ${member.name},\n\nThis is a kind reminder from Deep Fitness Gym.\n\nWe noticed your absence from recent classes. Regular attendance is very important to achieve your fitness goals and maintain consistency.\n\nKindly make sure to attend your upcoming sessions without fail. If you are unable to attend due to any reason, please inform the trainer in advance.\n\nLet's stay consistent and achieve your fitness goals together 💪\n\nThank you\nDeep Fitness Gym`);
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors shadow-sm"
                        >
                          <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
                          Send Reminder
                        </button>
                      )}
                      <Link
                        to={`/members/${member.id}`}
                        className="flex items-center justify-center gap-1 bg-primary/10 text-primary hover:bg-primary/20 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                        View
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* List Card */}
      <div className={`bg-surface-container-lowest rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.15)] overflow-hidden ${filterStatus === 'Absentees' ? 'hidden' : ''}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/30 bg-surface-container-low/50">
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Member</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Phone</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Plan</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Expiry Date</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Status</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined animate-spin text-2xl mr-2">progress_activity</span>
                    Loading members...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-on-surface-variant">
                      <span className="material-symbols-outlined text-5xl opacity-40">group_off</span>
                      <p className="font-medium">No members found</p>
                      <Link to="/members/add" className="bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                        Add First Member
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map(member => {
                  const days = daysUntilExpiry(member.expiryDate);
                  const isExpiringSoon = days !== null && days >= 0 && days <= 7;
                  const isExpired = days !== null && days < 0;
                  const effectiveStatus = isExpired ? 'Expired' : 'Active';

                  return (
                    <tr key={member.id} className="border-b border-outline-variant/20 hover:bg-surface-container/40 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary-container text-primary flex items-center justify-center font-bold shrink-0 overflow-hidden">
                            {member.photoUrl
                              ? <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                              : (member.name?.charAt(0) || '?')
                            }
                          </div>
                          <div>
                            <div className="font-medium text-on-surface">{member.name}</div>
                            {member.email && (
                              <div className="text-xs text-on-surface-variant">{member.email}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-on-surface-variant">{member.phone}</td>
                      <td className="p-4 text-sm text-on-surface-variant">{member.planName || 'N/A'}</td>
                      <td className="p-4">
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-sm font-medium ${isExpired ? 'text-rose-600' : isExpiringSoon ? 'text-amber-600' : 'text-on-surface'}`}>
                            {member.expiryDate || 'N/A'}
                          </span>
                          {isExpiringSoon && (
                            <span className="text-xs text-amber-500 font-medium">
                              ⚠ Expires in {days} day{days !== 1 ? 's' : ''}
                            </span>
                          )}
                          {isExpired && (
                            <span className="text-xs text-rose-500 font-medium">
                              Expired {Math.abs(days)} day{Math.abs(days) !== 1 ? 's' : ''} ago
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">{getStatusBadge(effectiveStatus)}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          {isExpiringSoon && member.phone && (
                            <button
                              onClick={() => {
                                setSmsMember(member);
                                setSmsMessage(`Hi ${member.name}! Your Deep Fitness membership expires on ${member.expiryDate}. Renew now to continue your fitness journey! Visit us or call us to renew. - Deep Fitness`);
                              }}
                              title={`Send SMS renewal reminder to ${member.name}`}
                              className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-on-primary px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm animate-pulse hover:animate-none"
                            >
                              <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>sms</span>
                              Remind
                            </button>
                          )}
                          <Link
                            to={`/members/${member.id}`}
                            className="bg-primary/10 text-primary dark:bg-indigo-500/20 dark:text-indigo-300 hover:bg-primary/20 dark:hover:bg-indigo-500/30 px-3 py-1.5 rounded-lg font-medium text-sm transition-colors"
                          >
                            View Profile
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-outline-variant/20 flex items-center justify-between">
            <span className="text-xs text-on-surface-variant">
              {totalPages > 1
                ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} members`
                : `${filtered.length} of ${members.length} members`}
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

      {smsMember && (
        <SendSMSModal
          phones={[smsMember.phone]}
          recipientLabel={`${smsMember.name} · ${smsMember.phone}`}
          defaultMessage={smsMessage}
          onClose={() => { setSmsMember(null); setSmsMessage(''); }}
        />
      )}
    </div>
  );
}
