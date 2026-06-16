import { useState, useEffect } from 'react';
import { getCollection, createDocument, updateDocument, deleteDocument } from '../../firebase/db';
import toast from 'react-hot-toast';

const CATEGORIES = ['Rent', 'Electricity', 'Salaries', 'Equipment', 'Supplements', 'Maintenance', 'Marketing', 'Other'];
const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer'];

const CAT_META = {
  Rent:         { icon: 'home',            color: 'text-blue-600',   bg: 'bg-blue-100'   },
  Electricity:  { icon: 'bolt',            color: 'text-amber-600',  bg: 'bg-amber-100'  },
  Salaries:     { icon: 'badge',           color: 'text-violet-600', bg: 'bg-violet-100' },
  Equipment:    { icon: 'fitness_center',  color: 'text-rose-600',   bg: 'bg-rose-100'   },
  Supplements:  { icon: 'medication',      color: 'text-emerald-600',bg: 'bg-emerald-100'},
  Maintenance:  { icon: 'build',           color: 'text-orange-600', bg: 'bg-orange-100' },
  Marketing:    { icon: 'campaign',        color: 'text-pink-600',   bg: 'bg-pink-100'   },
  Other:        { icon: 'more_horiz',      color: 'text-slate-600',  bg: 'bg-slate-100'  },
};

const empty = () => ({
  category: 'Rent',
  amount: '',
  date: new Date().toISOString().split('T')[0],
  description: '',
  paymentMode: 'Cash',
});

export default function ExpenseList() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterMonth, setFilterMonth] = useState('');

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const data = await getCollection('expenses');
      setExpenses(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch { toast.error('Failed to load expenses'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchExpenses(); }, []);

  const openAdd = () => { setEditing(null); setForm(empty()); setShowModal(true); };
  const openEdit = (exp) => {
    setEditing(exp);
    setForm({
      category: exp.category || 'Other',
      amount: exp.amount ?? '',
      date: exp.date || '',
      description: exp.description || '',
      paymentMode: exp.paymentMode || 'Cash',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    setSaving(true);
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (editing) {
        await updateDocument('expenses', editing.id, payload);
        toast.success('Expense updated!');
      } else {
        await createDocument('expenses', payload);
        toast.success('Expense added!');
      }
      setShowModal(false);
      fetchExpenses();
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await deleteDocument('expenses', deletingId);
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

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      <div className="flex flex-col gap-2">
        <h1 className="font-h1 text-h1 text-on-surface">Expenses</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">Track gym operating costs and expenditures.</p>
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
          </div>
        </div>
        <div className="bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.1)] flex flex-col gap-3">
          <div className="p-2.5 bg-violet-100 rounded-xl w-fit">
            <span className="material-symbols-outlined text-violet-600">pie_chart</span>
          </div>
          <div>
            <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Top Category</div>
            <div className="text-2xl font-bold text-on-surface mt-0.5">{catTotals[0]?.cat || '—'}</div>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      {catTotals.length > 0 && (
        <div className="bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.1)]">
          <h3 className="font-h3 text-h3 text-on-surface mb-4">By Category</h3>
          <div className="flex flex-wrap gap-3">
            {catTotals.map(({ cat, total }) => {
              const meta = CAT_META[cat] || CAT_META.Other;
              return (
                <div key={cat} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${meta.bg} border-transparent`}>
                  <span className={`material-symbols-outlined text-[18px] ${meta.color}`}>{meta.icon}</span>
                  <div>
                    <div className={`text-xs font-semibold ${meta.color}`}>{cat}</div>
                    <div className="text-sm font-bold text-on-surface">₹{total.toLocaleString('en-IN')}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters + Add */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {['All', ...CATEGORIES].map(cat => (
            <button key={cat} onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterCategory === cat ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>
              {cat}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            className="px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-xl text-sm text-on-surface outline-none focus:border-primary" />
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-sm text-sm whitespace-nowrap">
            <span className="material-symbols-outlined text-[18px]">add</span> Add Expense
          </button>
        </div>
      </div>

      {/* Expense List */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.1)] overflow-hidden">
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
                      <td className="p-4 text-sm text-on-surface max-w-[200px] truncate">{exp.description || '—'}</td>
                      <td className="p-4 text-sm text-on-surface-variant">{exp.paymentMode || '—'}</td>
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
                  <td colSpan={4} className="p-4 text-sm font-semibold text-on-surface-variant text-right">
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
                  <label className="text-sm font-medium text-on-surface-variant">Amount (₹) <span className="text-error">*</span></label>
                  <input type="number" min="0" step="0.01" required value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary" />
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
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant/20">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container transition-colors text-sm">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-primary text-on-primary rounded-lg font-medium hover:bg-primary/90 shadow-sm text-sm disabled:opacity-70">
                  {saving ? <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> Saving...</> : <><span className="material-symbols-outlined text-[16px]">save</span> Save</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
