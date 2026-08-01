import { useState, useEffect } from 'react';
import { getTenantCollection, createTenantDocument, updateTenantDocument, deleteTenantDocument, getTenantDocument, setTenantDocument } from '../../firebase/tenantDb';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const CATEGORIES = ['Rent', 'Electricity', 'Salaries', 'Equipment', 'Supplements', 'Maintenance', 'Marketing', 'Other'];
const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer'];

const CAT_META = {
  Rent:         { icon: 'home',            color: 'text-blue-600',   bg: 'bg-blue-100',    bar: '#2563eb' },
  Electricity:  { icon: 'bolt',            color: 'text-amber-600',  bg: 'bg-amber-100',   bar: '#d97706' },
  Salaries:     { icon: 'badge',           color: 'text-violet-600', bg: 'bg-violet-100',  bar: '#7c3aed' },
  Equipment:    { icon: 'fitness_center',  color: 'text-rose-600',   bg: 'bg-rose-100',    bar: '#e11d48' },
  Supplements:  { icon: 'medication',      color: 'text-emerald-600',bg: 'bg-emerald-100', bar: '#059669' },
  Maintenance:  { icon: 'build',           color: 'text-orange-600', bg: 'bg-orange-100',  bar: '#ea580c' },
  Marketing:    { icon: 'campaign',        color: 'text-pink-600',   bg: 'bg-pink-100',    bar: '#db2777' },
  Other:        { icon: 'more_horiz',      color: 'text-slate-600',  bg: 'bg-slate-100',   bar: '#475569' },
};

const empty = () => ({
  category: 'Rent',
  amount: '',
  date: new Date().toISOString().split('T')[0],
  description: '',
  paymentMode: 'Cash',
  isRecurring: false,
});

function exportToCSV(expenses, label) {
  const rows = [
    ['Date', 'Category', 'Description', 'Amount (₹)', 'Payment Mode', 'Recurring'],
    ...expenses.map(e => [
      e.date || '',
      e.category || '',
      `"${(e.description || '').replace(/"/g, '""')}"`,
      e.amount ?? 0,
      e.paymentMode || '',
      e.isRecurring ? 'Yes' : 'No',
    ]),
  ];
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `expenses-${label}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function CategoryChart({ catTotals, budgets }) {
  if (!catTotals.length) return null;
  const maxVal = Math.max(...catTotals.map(c => Math.max(c.total, Number(budgets[c.cat] || 0))), 1);
  return (
    <div className="flex flex-col gap-4">
      {catTotals.map(({ cat, total }) => {
        const meta = CAT_META[cat] || CAT_META.Other;
        const budget = Number(budgets[cat] || 0);
        const overBudget = budget > 0 && total > budget;
        const pct = Math.min(100, Math.round((total / maxVal) * 100));
        const budgetPct = Math.min(100, Math.round((budget / maxVal) * 100));
        return (
          <div key={cat}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`material-symbols-outlined text-[14px] ${meta.color} shrink-0`}>{meta.icon}</span>
                <span className="text-sm font-medium text-on-surface truncate">{cat}</span>
                {overBudget && (
                  <span className="text-xs font-semibold text-rose-600 shrink-0">over budget</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-3">
                <span className="text-sm font-bold text-on-surface">₹{total.toLocaleString('en-IN')}</span>
                {budget > 0 && (
                  <span className="text-xs text-on-surface-variant">/ ₹{budget.toLocaleString('en-IN')}</span>
                )}
              </div>
            </div>
            <div className="relative h-2 bg-surface-container rounded-full overflow-hidden">
              {budget > 0 && (
                <div className="absolute top-0 left-0 h-full rounded-full bg-slate-300 dark:bg-slate-600 opacity-50" style={{ width: `${budgetPct}%` }} />
              )}
              <div className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: overBudget ? '#e11d48' : meta.bar }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BudgetModal({ budgets, onSave, onClose }) {
  const [form, setForm] = useState(() => {
    const f = {};
    CATEGORIES.forEach(c => { f[c] = budgets[c] ?? ''; });
    return f;
  });
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const cleaned = {};
      CATEGORIES.forEach(c => { if (form[c]) cleaned[c] = Number(form[c]); });
      await onSave(cleaned);
    } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-outline-variant/20">
          <h2 className="font-bold text-on-surface text-lg">Monthly Budget Targets</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-1 p-5 max-h-[60vh] overflow-y-auto">
          {CATEGORIES.map(cat => {
            const meta = CAT_META[cat] || CAT_META.Other;
            return (
              <div key={cat} className="flex items-center gap-3 py-2">
                <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center shrink-0`}>
                  <span className={`material-symbols-outlined text-[16px] ${meta.color}`}>{meta.icon}</span>
                </div>
                <span className="text-sm font-medium text-on-surface w-28 shrink-0">{cat}</span>
                <input type="number" min="0" placeholder="No limit"
                  value={form[cat]} onChange={e => setForm(p => ({ ...p, [cat]: e.target.value }))}
                  className="flex-1 px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
            );
          })}
          <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/20 mt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container text-sm">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 bg-primary text-on-primary rounded-lg font-medium hover:bg-primary/90 shadow-sm flex items-center gap-2 disabled:opacity-70 text-sm">
              {saving ? <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>Saving...</> : <><span className="material-symbols-outlined text-[16px]">save</span>Save Budgets</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ExpenseList() {
  const { gymId } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterMonth, setFilterMonth] = useState('');
  const [budgets, setBudgets] = useState({});
  const [showBudgetModal, setShowBudgetModal] = useState(false);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const data = await getTenantCollection(gymId, 'expenses');
      setExpenses(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch { toast.error('Failed to load expenses'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchExpenses();
    getTenantDocument(gymId, 'settings', 'expenses').then(doc => {
      if (doc?.budgets) setBudgets(doc.budgets);
    }).catch(() => {});
  }, []);

  const saveBudgets = async (newBudgets) => {
    await setTenantDocument(gymId, 'settings', 'expenses', { budgets: newBudgets });
    setBudgets(newBudgets);
    setShowBudgetModal(false);
    toast.success('Budgets saved!');
  };

  const openAdd = () => { setEditing(null); setForm(empty()); setShowModal(true); };
  const openEdit = (exp) => {
    setEditing(exp);
    setForm({
      category: exp.category || 'Other',
      amount: exp.amount ?? '',
      date: exp.date || '',
      description: exp.description || '',
      paymentMode: exp.paymentMode || 'Cash',
      isRecurring: exp.isRecurring || false,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    setSaving(true);
    try {
      const payload = { ...form, amount: Number(form.amount), isRecurring: !!form.isRecurring };
      if (editing) {
        await updateTenantDocument(gymId, 'expenses', editing.id, payload);
        toast.success('Expense updated!');
      } else {
        await createTenantDocument(gymId, 'expenses', payload);
        toast.success('Expense added!');
      }
      setShowModal(false);
      fetchExpenses();
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await deleteTenantDocument(gymId, 'expenses', deletingId);
      toast.success('Expense deleted');
      setDeletingId(null);
      setExpenses(prev => prev.filter(e => e.id !== deletingId));
    } catch { toast.error('Delete failed'); }
  };

  const now = new Date();
  const totalAll = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalMonth = expenses
    .filter(e => { const d = new Date(e.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const catTotals = CATEGORIES.map(cat => ({
    cat,
    total: expenses.filter(e => e.category === cat).reduce((s, e) => s + (Number(e.amount) || 0), 0),
  })).filter(x => x.total > 0).sort((a, b) => b.total - a.total);

  const filtered = expenses.filter(e => {
    const catOk = filterCategory === 'All' || e.category === filterCategory;
    const monthOk = !filterMonth || e.date?.startsWith(filterMonth);
    return catOk && monthOk;
  });

  const hasBudgets = Object.keys(budgets).length > 0;
  const exportLabel = filterMonth || now.toISOString().split('T')[0];

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-h1 text-h1 text-on-surface">Expenses</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">Track gym operating costs and expenditures.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportToCSV(filtered, exportLabel)}
            className="flex items-center gap-2 bg-surface-container text-on-surface-variant px-4 py-2.5 rounded-xl font-medium hover:bg-surface-container-high transition-colors text-sm">
            <span className="material-symbols-outlined text-[18px]">download</span>Export CSV
          </button>
          <button onClick={() => setShowBudgetModal(true)}
            className="flex items-center gap-2 bg-surface-container text-on-surface-variant px-4 py-2.5 rounded-xl font-medium hover:bg-surface-container-high transition-colors text-sm">
            <span className="material-symbols-outlined text-[18px]">tune</span>Budgets
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.1)] flex flex-col gap-3">
          <div className="p-2.5 bg-rose-100 rounded-xl w-fit">
            <span className="material-symbols-outlined text-rose-600">account_balance_wallet</span>
          </div>
          <div>
            <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Total Expenses</div>
            <div className="text-2xl font-bold text-on-surface mt-0.5">₹{totalAll.toLocaleString('en-IN')}</div>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.1)] flex flex-col gap-3">
          <div className="p-2.5 bg-amber-100 rounded-xl w-fit">
            <span className="material-symbols-outlined text-amber-600">calendar_month</span>
          </div>
          <div>
            <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">This Month</div>
            <div className="text-2xl font-bold text-on-surface mt-0.5">₹{totalMonth.toLocaleString('en-IN')}</div>
            {hasBudgets && (() => {
              const monthBudgetTotal = CATEGORIES.reduce((s, c) => s + (Number(budgets[c] || 0)), 0);
              if (!monthBudgetTotal) return null;
              const pct = Math.round((totalMonth / monthBudgetTotal) * 100);
              const over = totalMonth > monthBudgetTotal;
              return <div className={`text-xs mt-1 font-medium ${over ? 'text-rose-600' : 'text-on-surface-variant'}`}>{pct}% of ₹{monthBudgetTotal.toLocaleString('en-IN')} budget{over ? ' — over!' : ''}</div>;
            })()}
          </div>
        </div>
        <div className="bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.1)] flex flex-col gap-3">
          <div className="p-2.5 bg-violet-100 rounded-xl w-fit">
            <span className="material-symbols-outlined text-violet-600">repeat</span>
          </div>
          <div>
            <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Recurring</div>
            <div className="text-2xl font-bold text-on-surface mt-0.5">{expenses.filter(e => e.isRecurring).length}</div>
            <div className="text-xs text-on-surface-variant mt-0.5">monthly fixed expenses</div>
          </div>
        </div>
      </div>

      {/* Category Chart */}
      {catTotals.length > 0 && (
        <div className="bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.1)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-h3 text-h3 text-on-surface">Spending by Category</h3>
            {hasBudgets && <span className="text-xs text-on-surface-variant">Grey bar = budget target</span>}
          </div>
          <CategoryChart catTotals={catTotals} budgets={budgets} />
        </div>
      )}

      {/* Filters + Add */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="overflow-x-auto pb-1 -mb-1">
          <div className="flex gap-2 min-w-max">
            {['All', ...CATEGORIES].map(cat => (
              <button key={cat} onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${filterCategory === cat ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            className="px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-xl text-sm text-on-surface outline-none focus:border-primary" />
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-sm text-sm whitespace-nowrap">
            <span className="material-symbols-outlined text-[18px]">add</span>Add Expense
          </button>
        </div>
      </div>

      {/* Mobile card list */}
      {!loading && filtered.length > 0 && (
        <div className="md:hidden space-y-3">
          {filtered.map(exp => {
            const meta = CAT_META[exp.category] || CAT_META.Other;
            return (
              <div key={exp.id} className="bg-surface-container-lowest rounded-2xl shadow-sm p-4 border border-outline-variant/20">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-on-surface truncate max-w-50">{exp.description || '—'}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${meta.bg} ${meta.color}`}>
                        <span className="material-symbols-outlined text-[12px]">{meta.icon}</span>{exp.category}
                      </div>
                      {exp.isRecurring && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[11px]">repeat</span>Recurring
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-lg font-bold text-rose-600 whitespace-nowrap">₹{Number(exp.amount || 0).toLocaleString('en-IN')}</div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-2">
                  <div className="text-on-surface-variant">Date</div>
                  <div className="text-on-surface">{new Date(exp.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                  <div className="text-on-surface-variant">Payment</div>
                  <div className="text-on-surface">{exp.paymentMode || '—'}</div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => openEdit(exp)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                    <span className="material-symbols-outlined text-[14px]">edit</span>Edit
                  </button>
                  <button onClick={() => setDeletingId(exp.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-sm bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors">
                    <span className="material-symbols-outlined text-[14px]">delete</span>Delete
                  </button>
                </div>
              </div>
            );
          })}
          <div className="text-sm text-on-surface-variant text-right pr-1">
            Total ({filtered.length} records): <span className="font-bold text-rose-600">₹{filtered.reduce((s, e) => s + (Number(e.amount) || 0), 0).toLocaleString('en-IN')}</span>
          </div>
        </div>
      )}

      {/* Mobile loading/empty */}
      {loading && (
        <div className="md:hidden flex items-center justify-center py-12 text-on-surface-variant gap-2">
          <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
        </div>
      )}
      {!loading && filtered.length === 0 && (
        <div className="md:hidden flex flex-col items-center justify-center py-12 gap-3 text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl opacity-30">receipt_long</span>
          <p className="text-sm">No expenses found.</p>
          <button onClick={openAdd} className="text-primary text-sm hover:underline">Add your first expense</button>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block bg-surface-container-lowest rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.1)] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-on-surface-variant gap-2">
            <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined text-5xl opacity-30">receipt_long</span>
            <p className="text-sm">No expenses found.</p>
            <button onClick={openAdd} className="text-primary text-sm hover:underline">Add your first expense</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant/20 bg-surface-container-low/50">
                  <th className="p-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Date</th>
                  <th className="p-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Category</th>
                  <th className="p-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Description</th>
                  <th className="p-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Mode</th>
                  <th className="p-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Recurring</th>
                  <th className="p-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-right">Amount</th>
                  <th className="p-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(exp => {
                  const meta = CAT_META[exp.category] || CAT_META.Other;
                  return (
                    <tr key={exp.id} className="border-b border-outline-variant/10 hover:bg-surface-container/30 transition-colors">
                      <td className="p-4 text-sm text-on-surface-variant whitespace-nowrap">
                        {new Date(exp.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="p-4">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.bg} ${meta.color}`}>
                          <span className="material-symbols-outlined text-[14px]">{meta.icon}</span>
                          {exp.category}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-on-surface max-w-50 truncate">{exp.description || '—'}</td>
                      <td className="p-4 text-sm text-on-surface-variant">{exp.paymentMode || '—'}</td>
                      <td className="p-4">
                        {exp.isRecurring ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full w-fit">
                            <span className="material-symbols-outlined text-[12px]">repeat</span>Yes
                          </span>
                        ) : <span className="text-xs text-on-surface-variant">—</span>}
                      </td>
                      <td className="p-4 text-sm font-bold text-rose-600 text-right whitespace-nowrap">
                        ₹{Number(exp.amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => openEdit(exp)}
                            className="w-8 h-8 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center transition-colors">
                            <span className="material-symbols-outlined text-[15px]">edit</span>
                          </button>
                          <button onClick={() => setDeletingId(exp.id)}
                            className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition-colors">
                            <span className="material-symbols-outlined text-[15px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-surface-container-low/50 border-t border-outline-variant/20">
                  <td colSpan={5} className="p-4 text-sm font-semibold text-on-surface-variant text-right">
                    Total ({filtered.length} records)
                  </td>
                  <td className="p-4 text-base font-bold text-rose-600 text-right whitespace-nowrap">
                    ₹{filtered.reduce((s, e) => s + (Number(e.amount) || 0), 0).toLocaleString('en-IN')}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-outline-variant/20">
              <h2 className="font-bold text-on-surface text-lg">{editing ? 'Edit Expense' : 'Add Expense'}</h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-on-surface-variant">Category</label>
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary appearance-none">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-on-surface-variant">Amount (₹) *</label>
                  <input type="number" min="0" step="0.01" required value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-on-surface-variant">Date</label>
                  <input type="date" required value={form.date}
                    onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-on-surface-variant">Payment Mode</label>
                  <select value={form.paymentMode} onChange={e => setForm(p => ({ ...p, paymentMode: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary appearance-none">
                    {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-on-surface-variant">Description</label>
                  <input type="text" value={form.description} placeholder="Optional note"
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary" />
                </div>
                <div className="col-span-2 flex items-center gap-3">
                  <input type="checkbox" id="isRecurring" checked={!!form.isRecurring}
                    onChange={e => setForm(p => ({ ...p, isRecurring: e.target.checked }))}
                    className="w-4 h-4 accent-primary rounded" />
                  <label htmlFor="isRecurring" className="text-sm font-medium text-on-surface cursor-pointer">
                    Recurring monthly expense
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant/20">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container transition-colors text-sm">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-primary text-on-primary rounded-lg font-medium hover:bg-primary/90 shadow-sm text-sm disabled:opacity-70">
                  {saving ? <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>Saving...</> : <><span className="material-symbols-outlined text-[16px]">save</span>Save</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBudgetModal && <BudgetModal budgets={budgets} onSave={saveBudgets} onClose={() => setShowBudgetModal(false)} />}

      {/* Delete Confirm */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-rose-600 text-[20px]">warning</span>
              </div>
              <div>
                <h3 className="font-semibold text-on-surface">Delete Expense?</h3>
                <p className="text-sm text-on-surface-variant mt-1">This record will be permanently deleted.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeletingId(null)} className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container text-sm">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium text-sm shadow-sm">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
