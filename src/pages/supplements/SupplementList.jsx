import { useState, useEffect } from 'react';
import { getTenantCollection, createTenantDocument, updateTenantDocument, deleteTenantDocument } from '../../firebase/tenantDb';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const EMPTY_FORM = { name: '', stock: '', price: '' };
const LOW_STOCK_THRESHOLD = 10;

function StockBadge({ stock }) {
  const n = Number(stock);
  if (n === 0) return <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block"></span>Out of Stock</span>;
  if (n < LOW_STOCK_THRESHOLD) return <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>Low ({n})</span>;
  return <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>In Stock ({n})</span>;
}

function SupplementModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const handle = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name) { toast.error('Supplement name is required'); return; }
    setSaving(true);
    try { await onSave(form); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-outline-variant/20">
          <h2 className="font-bold text-on-surface text-lg">{initial ? 'Edit Supplement' : 'Add Supplement'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface-variant">Supplement Name *</label>
            <input required name="name" value={form.name} onChange={handle} placeholder="e.g. Whey Protein 1kg"
              className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Available Stock</label>
              <input type="number" name="stock" value={form.stock} onChange={handle} placeholder="0" min="0"
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Price (₹)</label>
              <input type="number" name="price" value={form.price} onChange={handle} placeholder="0" min="0"
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/20">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 bg-primary text-on-primary rounded-lg font-medium hover:bg-primary/90 shadow-sm flex items-center gap-2 disabled:opacity-70">
              {saving ? <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> Saving...</> : <><span className="material-symbols-outlined text-[16px]">save</span> Save</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SupplementList() {
  const { gymId } = useAuth();
  const [supplements, setSupplements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchSupplements = async () => {
    try {
      setLoading(true);
      const data = await getTenantCollection(gymId, 'supplements');
      setSupplements(data.sort((a, b) => Number(a.stock) - Number(b.stock)));
    } catch { toast.error('Failed to load supplements'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSupplements(); }, []);

  const handleAdd = async (form) => {
    await createTenantDocument(gymId, 'supplements', { ...form, stock: Number(form.stock) || 0, price: Number(form.price) || 0 });
    toast.success('Supplement added!');
    setShowModal(false);
    fetchSupplements();
  };

  const handleEdit = async (form) => {
    await updateTenantDocument(gymId, 'supplements', editingItem.id, { ...form, stock: Number(form.stock) || 0, price: Number(form.price) || 0 });
    toast.success('Supplement updated!');
    setEditingItem(null);
    fetchSupplements();
  };

  const handleDelete = async (id) => {
    try {
      await deleteTenantDocument(gymId, 'supplements', id);
      toast.success('Supplement deleted');
      setDeletingId(null);
      fetchSupplements();
    } catch { toast.error('Delete failed'); }
  };

  const lowStockCount = supplements.filter(s => Number(s.stock) < LOW_STOCK_THRESHOLD).length;
  const filtered = supplements.filter(s => !searchTerm || s.name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 className="font-h1 text-h1 text-on-surface">Supplement Stock</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">Manage supplement inventory and pricing.</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="bg-primary text-on-primary px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">add</span> Add Supplement
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Products', value: supplements.length, icon: 'medication', color: 'text-primary', bg: 'bg-primary-container/30' },
          { label: 'Low Stock', value: lowStockCount, icon: 'warning', color: 'text-amber-600', bg: 'bg-amber-100/60' },
          { label: 'Total Value', value: `₹${supplements.reduce((s, x) => s + Number(x.stock || 0) * Number(x.price || 0), 0).toLocaleString('en-IN')}`, icon: 'payments', color: 'text-emerald-600', bg: 'bg-emerald-100/60' },
        ].map(({ label, value, icon, color, bg }) => (
          <div key={label} className="bg-surface-container-lowest p-4 rounded-xl shadow-sm border border-outline-variant/20">
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>
              <span className={`material-symbols-outlined ${color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
            </div>
            <div className="text-2xl font-bold text-on-surface">{value}</div>
            <div className="text-xs text-on-surface-variant mt-1">{label}</div>
          </div>
        ))}
      </div>

      {lowStockCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
          <p className="text-sm font-medium text-amber-700">{lowStockCount} supplement{lowStockCount > 1 ? 's' : ''} running low on stock.</p>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2.5 max-w-sm shadow-sm">
        <span className="material-symbols-outlined text-on-surface-variant text-[20px]">search</span>
        <input type="text" placeholder="Search supplements..." value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="flex-1 bg-transparent text-on-surface outline-none text-sm placeholder:text-on-surface-variant" />
        {searchTerm && <button onClick={() => setSearchTerm('')} className="text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>}
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.15)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/30 bg-surface-container-low/50">
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Supplement</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Price</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Stock</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Status</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="p-8 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined animate-spin text-2xl mr-2">progress_activity</span>Loading...
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="5" className="p-12 text-center">
                  <div className="flex flex-col items-center gap-3 text-on-surface-variant">
                    <span className="material-symbols-outlined text-5xl opacity-40">medication</span>
                    <p className="font-medium">No supplements added yet</p>
                  </div>
                </td></tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id} className="border-b border-outline-variant/20 hover:bg-surface-container/40 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-secondary-container/30 flex items-center justify-center">
                          <span className="material-symbols-outlined text-secondary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>medication</span>
                        </div>
                        <span className="font-medium text-on-surface">{item.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm font-medium text-on-surface">{item.price ? `₹${Number(item.price).toLocaleString('en-IN')}` : '—'}</td>
                    <td className="p-4 text-sm font-bold text-on-surface">{item.stock ?? '—'}</td>
                    <td className="p-4"><StockBadge stock={item.stock} /></td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setEditingItem(item)}
                          className="bg-surface-container hover:bg-surface-container-high text-on-surface-variant px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">edit</span> Edit
                        </button>
                        <button onClick={() => setDeletingId(item.id)}
                          className="bg-rose-50 text-rose-600 hover:bg-rose-100 px-3 py-1.5 rounded-lg text-sm transition-colors">
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-outline-variant/20 text-xs text-on-surface-variant">
            {filtered.length} supplements
          </div>
        )}
      </div>

      {showModal && <SupplementModal onSave={handleAdd} onClose={() => setShowModal(false)} />}
      {editingItem && (
        <SupplementModal
          initial={{ name: editingItem.name, stock: editingItem.stock ?? '', price: editingItem.price || '' }}
          onSave={handleEdit}
          onClose={() => setEditingItem(null)}
        />
      )}

      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-rose-600 text-[20px]">warning</span>
              </div>
              <div>
                <h3 className="font-semibold text-on-surface">Delete Supplement?</h3>
                <p className="text-sm text-on-surface-variant mt-1">This cannot be undone.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeletingId(null)} className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container text-sm">Cancel</button>
              <button onClick={() => handleDelete(deletingId)} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium text-sm shadow-sm">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
