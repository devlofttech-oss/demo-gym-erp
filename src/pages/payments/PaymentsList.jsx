import { useState, useEffect, useCallback } from 'react';

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
import { Link } from 'react-router-dom';
import { getTenantCollection, updateTenantDocument } from '../../firebase/tenantDb';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import SendSMSModal from '../../components/messaging/SendSMSModal';

const PAYMENT_MODES = ['Cash', 'Card', 'UPI', 'Bank Transfer', 'Cheque'];
const TABS = [
  { id: 'payments', label: 'All Payments', icon: 'receipt_long' },
  { id: 'dues', label: 'Dues & Expired', icon: 'warning' },
];

function getSMSDefaultMessage(member) {
  if (member.expiryDate && new Date(member.expiryDate) < new Date()) {
    return `Hi ${member.name}! Your membership expired on ${member.expiryDate}. Please renew to continue your fitness journey. Visit us today!`;
  }
  return `Hi ${member.name}! This is a reminder that your membership payment is due. Please clear your dues at the earliest.`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return dateStr; }
}

function daysUntilExpiry(expiryDate) {
  if (!expiryDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate); exp.setHours(0, 0, 0, 0);
  return Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
}

export default function PaymentsList() {
  const { gymId } = useAuth();
  const [activeTab, setActiveTab] = useState('payments');
  const [payments, setPayments] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPayment, setEditingPayment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [messageMember, setMessageMember] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [activeTab, searchTerm]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [payData, memData] = await Promise.all([
        getTenantCollection(gymId, 'payments'),
        getTenantCollection(gymId, 'members'),
      ]);
      const sorted = payData.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      setPayments(sorted);
      setMembers(memData);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalRevenue = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const filteredPayments = payments.filter(p => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.memberName?.toLowerCase().includes(term) ||
      p.planName?.toLowerCase().includes(term) ||
      p.paymentMode?.toLowerCase().includes(term)
    );
  });

  // Dues: expired or no plan members
  const duesMembers = members.filter(m => {
    const days = daysUntilExpiry(m.expiryDate);
    return m.status === 'Expired' || (days !== null && days < 0) || !m.planName;
  });

  const filteredDues = duesMembers.filter(m => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return m.name?.toLowerCase().includes(term) || m.phone?.includes(term);
  });

  const paymentsTotalPages = Math.ceil(filteredPayments.length / PAGE_SIZE);
  const duesTotalPages = Math.ceil(filteredDues.length / PAGE_SIZE);
  const paginatedPayments = filteredPayments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const paginatedDues = filteredDues.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openEdit = (payment) => {
    setEditingPayment({
      id: payment.id,
      paymentMode: payment.paymentMode || 'Cash',
      amount: payment.amount || 0,
      notes: payment.notes || '',
    });
  };

  const handleEditSave = async () => {
    if (!editingPayment) return;
    try {
      setSaving(true);
      await updateTenantDocument(gymId, 'payments', editingPayment.id, {
        paymentMode: editingPayment.paymentMode,
        amount: Number(editingPayment.amount),
        notes: editingPayment.notes,
      });
      toast.success('Payment updated!');
      setEditingPayment(null);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update payment');
    } finally {
      setSaving(false);
    }
  };

  const modeColors = {
    Cash: 'bg-emerald-100 text-emerald-700',
    Card: 'bg-blue-100 text-blue-700',
    UPI: 'bg-purple-100 text-purple-700',
    'Bank Transfer': 'bg-amber-100 text-amber-700',
    Cheque: 'bg-slate-100 text-slate-700',
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-h1 text-h1 text-on-surface">Payments</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">Track payments, dues, and expired memberships.</p>
        </div>
        <Link
          to="/payments/new"
          className="bg-primary text-on-primary px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Record Payment
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-container rounded-xl p-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSearchTerm(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
            {tab.label}
            {tab.id === 'dues' && duesMembers.length > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-4.5 text-center">
                {duesMembers.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── PAYMENTS TAB ─── */}
      {activeTab === 'payments' && (
        <>
          {/* Revenue Summary */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.15)] p-6 flex flex-wrap gap-8">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Total Revenue</span>
              <span className="text-3xl font-bold text-emerald-600">₹{totalRevenue.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Total Payments</span>
              <span className="text-3xl font-bold text-on-surface">{payments.length}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">This Month</span>
              <span className="text-3xl font-bold text-on-surface">
                {payments.filter(p => {
                  if (!p.date) return false;
                  const d = new Date(p.date);
                  const now = new Date();
                  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                }).length}
              </span>
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2.5 max-w-md shadow-sm">
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">search</span>
            <input
              type="text"
              placeholder="Search by member, plan, mode..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent text-on-surface outline-none text-sm placeholder:text-on-surface-variant"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.15)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant/30 bg-surface-container-low/50">
                    <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Member</th>
                    <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Plan</th>
                    <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Active From</th>
                    <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Expiry</th>
                    <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Amount</th>
                    <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Mode</th>
                    <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Date</th>
                    <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-on-surface-variant">
                        <span className="material-symbols-outlined animate-spin text-2xl mr-2">progress_activity</span>
                        Loading payments...
                      </td>
                    </tr>
                  ) : filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-12 text-center">
                        <div className="flex flex-col items-center gap-3 text-on-surface-variant">
                          <span className="material-symbols-outlined text-5xl opacity-40">receipt_long</span>
                          <p className="font-medium">No payments found</p>
                          <Link to="/payments/new" className="bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                            Record First Payment
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedPayments.map(payment => (
                      <tr key={payment.id} className="border-b border-outline-variant/20 hover:bg-surface-container/40 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary-container text-primary flex items-center justify-center font-bold text-sm shrink-0">
                              {payment.memberName?.charAt(0) || '?'}
                            </div>
                            <div>
                              <div className="font-medium text-on-surface text-sm">{payment.memberName || '—'}</div>
                              <div className="text-xs text-on-surface-variant">{payment.memberPhone || ''}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-on-surface-variant">{payment.planName || '—'}</td>
                        <td className="p-4 text-sm text-on-surface-variant">{formatDate(payment.planActiveFrom)}</td>
                        <td className="p-4 text-sm text-on-surface-variant">{formatDate(payment.expiryDate)}</td>
                        <td className="p-4">
                          <span className="font-bold text-emerald-600">₹{Number(payment.amount || 0).toLocaleString('en-IN')}</span>
                        </td>
                        <td className="p-4">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${modeColors[payment.paymentMode] || 'bg-slate-100 text-slate-600'}`}>
                            {payment.paymentMode || 'Cash'}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-on-surface-variant">{formatDate(payment.date)}</td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => openEdit(payment)}
                            className="text-primary hover:text-primary/80 font-medium text-sm flex items-center gap-1 ml-auto transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!loading && filteredPayments.length > 0 && (
              <div className="px-4 py-3 border-t border-outline-variant/20 flex items-center justify-between">
                <span className="text-xs text-on-surface-variant">
                  {paymentsTotalPages > 1
                    ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filteredPayments.length)} of ${filteredPayments.length}`
                    : `${filteredPayments.length} payments`}
                </span>
                {paymentsTotalPages > 1 && (
                  <div className="flex gap-1 items-center">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container disabled:opacity-30 transition-colors">
                      <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                    </button>
                    {paginationPages(page, paymentsTotalPages).map((p, i) => p === '...'
                      ? <span key={`e${i}`} className="w-6 text-center text-xs text-on-surface-variant">…</span>
                      : <button key={p} onClick={() => setPage(p)}
                          className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${p === page ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}>
                          {p}
                        </button>
                    )}
                    <button disabled={page === paymentsTotalPages} onClick={() => setPage(p => p + 1)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container disabled:opacity-30 transition-colors">
                      <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── DUES TAB ─── */}
      {activeTab === 'dues' && (
        <>
          {/* Alert Banner */}
          {!loading && duesMembers.length > 0 && (
            <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700/40 rounded-2xl p-4 flex items-start gap-3">
              <span className="material-symbols-outlined text-rose-500 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
              <div>
                <p className="font-semibold text-rose-700 dark:text-rose-300">{duesMembers.length} member{duesMembers.length > 1 ? 's' : ''} with expired or missing memberships</p>
                <p className="text-sm text-rose-600 dark:text-rose-400 mt-0.5">Send SMS reminders or renew their plans directly.</p>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2.5 max-w-md shadow-sm">
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">search</span>
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent text-on-surface outline-none text-sm placeholder:text-on-surface-variant"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>

          {/* Dues Table */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.15)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant/30 bg-surface-container-low/50">
                    <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Member</th>
                    <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Phone</th>
                    <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Last Plan</th>
                    <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Expired On</th>
                    <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Overdue</th>
                    <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-on-surface-variant">
                        <span className="material-symbols-outlined animate-spin text-2xl mr-2">progress_activity</span>
                        Loading dues...
                      </td>
                    </tr>
                  ) : filteredDues.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-12 text-center">
                        <div className="flex flex-col items-center gap-3 text-on-surface-variant">
                          <span className="material-symbols-outlined text-5xl opacity-40">check_circle</span>
                          <p className="font-medium text-emerald-600">No dues! All members are up to date.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedDues.map(member => {
                      const days = daysUntilExpiry(member.expiryDate);
                      const overdueDays = days !== null ? Math.abs(days) : null;
                      return (
                        <tr key={member.id} className="border-b border-outline-variant/20 hover:bg-surface-container/40 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 flex items-center justify-center font-bold text-sm shrink-0">
                                {member.name?.charAt(0) || '?'}
                              </div>
                              <div className="font-medium text-on-surface text-sm">{member.name || '—'}</div>
                            </div>
                          </td>
                          <td className="p-4 text-sm text-on-surface-variant">{member.phone || '—'}</td>
                          <td className="p-4 text-sm text-on-surface-variant">{member.planName || <span className="text-on-surface-variant/50 italic">No plan</span>}</td>
                          <td className="p-4">
                            <span className="text-sm font-medium text-rose-600 dark:text-rose-400">
                              {member.expiryDate ? formatDate(member.expiryDate) : '—'}
                            </span>
                          </td>
                          <td className="p-4">
                            {overdueDays !== null ? (
                              <span className="flex items-center gap-1 text-rose-600 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-400 text-xs font-semibold px-2.5 py-1 rounded-full w-fit">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block"></span>
                                {overdueDays} day{overdueDays !== 1 ? 's' : ''} overdue
                              </span>
                            ) : (
                              <span className="text-xs text-on-surface-variant/60 italic">—</span>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setMessageMember(member)}
                                className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-on-primary px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm"
                                title={`Send SMS reminder to ${member.name}`}
                              >
                                <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>sms</span>
                                SMS
                              </button>
                              <Link
                                to={`/payments/new?memberId=${member.id}`}
                                className="bg-primary text-on-primary hover:bg-primary/90 px-3 py-1.5 rounded-lg font-medium text-xs transition-colors shadow-sm flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[14px]">payments</span>
                                Renew
                              </Link>
                              <Link
                                to={`/members/${member.id}`}
                                className="bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-lg font-medium text-xs transition-colors"
                              >
                                View
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
            {!loading && filteredDues.length > 0 && (
              <div className="px-4 py-3 border-t border-outline-variant/20 flex items-center justify-between">
                <span className="text-xs text-on-surface-variant">
                  {duesTotalPages > 1
                    ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filteredDues.length)} of ${filteredDues.length} members`
                    : `${filteredDues.length} member${filteredDues.length !== 1 ? 's' : ''} with dues`}
                </span>
                {duesTotalPages > 1 && (
                  <div className="flex gap-1 items-center">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container disabled:opacity-30 transition-colors">
                      <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                    </button>
                    {paginationPages(page, duesTotalPages).map((p, i) => p === '...'
                      ? <span key={`e${i}`} className="w-6 text-center text-xs text-on-surface-variant">…</span>
                      : <button key={p} onClick={() => setPage(p)}
                          className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${p === page ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}>
                          {p}
                        </button>
                    )}
                    <button disabled={page === duesTotalPages} onClick={() => setPage(p => p + 1)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container disabled:opacity-30 transition-colors">
                      <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Edit Payment Modal */}
      {editingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">edit</span>
                Edit Payment
              </h2>
              <button
                onClick={() => setEditingPayment(null)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center transition-colors text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-on-surface-variant">Payment Mode</label>
                <select
                  value={editingPayment.paymentMode}
                  onChange={e => setEditingPayment(prev => ({ ...prev, paymentMode: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary transition-all appearance-none"
                >
                  {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-on-surface-variant">Amount (₹)</label>
                <input
                  type="number"
                  value={editingPayment.amount}
                  onChange={e => setEditingPayment(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-on-surface-variant">Notes</label>
                <input
                  type="text"
                  value={editingPayment.notes}
                  onChange={e => setEditingPayment(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. Paid via PhonePe"
                  className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary transition-all"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={() => setEditingPayment(null)}
                className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={saving}
                className="px-5 py-2 bg-primary text-on-primary rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70"
              >
                {saving ? (
                  <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> Saving...</>
                ) : (
                  <><span className="material-symbols-outlined text-[16px]">save</span> Save Changes</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send SMS Modal */}
      {messageMember && (
        <SendSMSModal
          phones={[messageMember.phone]}
          recipientLabel={`${messageMember.name} · ${messageMember.phone}`}
          defaultMessage={getSMSDefaultMessage(messageMember)}
          onClose={() => setMessageMember(null)}
        />
      )}
    </div>
  );
}
