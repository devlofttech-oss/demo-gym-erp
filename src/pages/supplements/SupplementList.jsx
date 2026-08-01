import { useState, useEffect } from 'react';
import { getTenantCollection, createTenantDocument, updateTenantDocument, deleteTenantDocument } from '../../firebase/tenantDb';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const CATEGORIES = ['Protein', 'Creatine', 'Pre-Workout', 'Vitamins', 'Fat Burner', 'BCAA', 'Other'];
const LOW_STOCK_THRESHOLD = 10;
const EMPTY_FORM = { name: '', category: 'Protein', stock: '', price: '', expiryDate: '' };

function StockBadge({ stock }) {
  const n = Number(stock);
  if (n === 0) return <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />Out of Stock</span>;
  if (n < LOW_STOCK_THRESHOLD) return <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />Low ({n})</span>;
  return <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />In Stock ({n})</span>;
}

function ExpiryBadge({ date }) {
  if (!date) return null;
  const daysLeft = Math.ceil((new Date(date + 'T00:00:00') - new Date()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Expired</span>;
  if (daysLeft <= 30) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Exp. in {daysLeft}d</span>;
  return null;
}

const NUM_INPUT = 'w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

function SupplementModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const handle = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name) { toast.error('Name is required'); return; }
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
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
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface-variant">Category</label>
            <select name="category" value={form.category} onChange={handle}
              className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary appearance-none">
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Stock Qty</label>
              <input type="number" name="stock" value={form.stock} onChange={handle} placeholder="0" min="0" className={NUM_INPUT} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Price (₹)</label>
              <input type="number" name="price" value={form.price} onChange={handle} placeholder="0" min="0" className={NUM_INPUT} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface-variant">Expiry Date</label>
            <input type="date" name="expiryDate" value={form.expiryDate} onChange={handle}
              className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/20">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 bg-primary text-on-primary rounded-lg font-medium hover:bg-primary/90 shadow-sm flex items-center gap-2 disabled:opacity-70">
              {saving ? <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>Saving...</> : <><span className="material-symbols-outlined text-[16px]">save</span>Save</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SellModal({ item, onSell, onClose }) {
  const [qty, setQty] = useState('1');
  const [saving, setSaving] = useState(false);
  const max = Number(item.stock) || 0;
  const submit = async (e) => {
    e.preventDefault();
    const q = Number(qty);
    if (!q || q <= 0) { toast.error('Enter a quantity'); return; }
    if (q > max) { toast.error(`Only ${max} in stock`); return; }
    setSaving(true);
    try { await onSell(q); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-outline-variant/20">
          <h2 className="font-bold text-on-surface text-base">Sell {item.name}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4 p-5">
          <p className="text-sm text-on-surface-variant">Available: <span className="font-semibold text-on-surface">{max} units</span></p>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface-variant">Quantity to Sell *</label>
            <input required type="number" min="1" max={max} value={qty} onChange={e => setQty(e.target.value)} className={NUM_INPUT} />
          </div>
          {Number(item.price) > 0 && (
            <p className="text-sm text-on-surface-variant">Total: <span className="font-semibold text-primary">₹{(Number(qty || 0) * Number(item.price)).toLocaleString('en-IN')}</span></p>
          )}
          <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant/20">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container text-sm">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 shadow-sm flex items-center gap-2 disabled:opacity-70 text-sm">
              {saving ? <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>Selling...</> : <><span className="material-symbols-outlined text-[16px]">shopping_cart</span>Sell</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RestockModal({ item, onRestock, onClose }) {
  const [qty, setQty] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const q = Number(qty);
    if (!q || q <= 0) { toast.error('Enter quantity to add'); return; }
    setSaving(true);
    try { await onRestock(q); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-outline-variant/20">
          <h2 className="font-bold text-on-surface text-base">Restock {item.name}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4 p-5">
          <p className="text-sm text-on-surface-variant">Current Stock: <span className="font-semibold text-on-surface">{item.stock ?? 0} units</span></p>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface-variant">Quantity to Add *</label>
            <input required type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} className={NUM_INPUT} />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant/20">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container text-sm">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 bg-primary text-on-primary rounded-lg font-medium hover:bg-primary/90 shadow-sm flex items-center gap-2 disabled:opacity-70 text-sm">
              {saving ? <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>Restocking...</> : <><span className="material-symbols-outlined text-[16px]">add_circle</span>Add Stock</>}
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
  const [sellingItem, setSellingItem] = useState(null);
  const [restockingItem, setRestockingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');

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
    await createTenantDocument(gymId, 'supplements', {
      name: form.name, category: form.category || 'Other',
      stock: Number(form.stock) || 0, price: Number(form.price) || 0,
      expiryDate: form.expiryDate || null,
    });
    toast.success('Supplement added!');
    setShowModal(false);
    fetchSupplements();
  };

  const handleEdit = async (form) => {
    await updateTenantDocument(gymId, 'supplements', editingItem.id, {
      name: form.name, category: form.category || 'Other',
      stock: Number(form.stock) || 0, price: Number(form.price) || 0,
      expiryDate: form.expiryDate || null,
    });
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

  const handleSell = async (qty) => {
    const newStock = Math.max(0, Number(sellingItem.stock) - qty);
    await updateTenantDocument(gymId, 'supplements', sellingItem.id, { stock: newStock });
    toast.success(`Sold ${qty} unit${qty !== 1 ? 's' : ''} — stock now ${newStock}`);
    setSellingItem(null);
    fetchSupplements();
  };

  const handleRestock = async (qty) => {
    const newStock = Number(restockingItem.stock || 0) + qty;
    await updateTenantDocument(gymId, 'supplements', restockingItem.id, { stock: newStock });
    toast.success(`Restocked ${qty} units — stock now ${newStock}`);
    setRestockingItem(null);
    fetchSupplements();
  };

  const today = new Date().toISOString().split('T')[0];
  const lowStockCount  = supplements.filter(s => Number(s.stock) < LOW_STOCK_THRESHOLD && Number(s.stock) >= 0).length;
  const expiringCount  = supplements.filter(s => {
    if (!s.expiryDate) return false;
    const d = Math.ceil((new Date(s.expiryDate + 'T00:00:00') - new Date()) / 86400000);
    return d >= 0 && d <= 30;
  }).length;
  const expiredCount   = supplements.filter(s => s.expiryDate && s.expiryDate < today).length;

  const filtered = supplements.filter(s => {
    const catOk = filterCategory === 'All' || s.category === filterCategory;
    const searchOk = !searchTerm || s.name?.toLowerCase().includes(searchTerm.toLowerCase());
    return catOk && searchOk;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 className="font-h1 text-h1 text-on-surface">Supplement Stock</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">Manage supplement inventory and pricing.</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="bg-primary text-on-primary px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">add</span>Add Supplement
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Products', value: supplements.length, icon: 'medication', color: 'text-primary', bg: 'bg-primary-container/30' },
          { label: 'Low Stock', value: lowStockCount, icon: 'warning', color: 'text-amber-600', bg: 'bg-amber-100/60' },
          { label: 'Expiring Soon', value: expiringCount, icon: 'event_busy', color: 'text-orange-600', bg: 'bg-orange-100/60' },
          { label: 'Inventory Value', value: `₹${supplements.reduce((s, x) => s + Number(x.stock || 0) * Number(x.price || 0), 0).toLocaleString('en-IN')}`, icon: 'payments', color: 'text-emerald-600', bg: 'bg-emerald-100/60' },
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

      {/* Alert banners */}
      {(lowStockCount > 0 || expiredCount > 0) && (
        <div className="flex flex-col gap-2">
          {lowStockCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
              <span className="material-symbols-outlined text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
              <p className="text-sm font-medium text-amber-700">{lowStockCount} supplement{lowStockCount > 1 ? 's' : ''} running low on stock.</p>
            </div>
          )}
          {expiredCount > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3">
              <span className="material-symbols-outlined text-rose-500" style={{ fontVariationSettings: "'FILL' 1" }}>event_busy</span>
              <p className="text-sm font-medium text-rose-700">{expiredCount} supplement{expiredCount > 1 ? 's are' : ' is'} expired.</p>
            </div>
          )}
        </div>
      )}

      {/* Category filter + search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-2 min-w-max">
            {['All', ...CATEGORIES].map(cat => (
              <button key={cat} onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${filterCategory === cat ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2.5 w-full sm:max-w-xs shadow-sm">
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">search</span>
          <input type="text" placeholder="Search supplements..." value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent text-on-surface outline-none text-sm placeholder:text-on-surface-variant" />
          {searchTerm && <button onClick={() => setSearchTerm('')} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>}
        </div>
      </div>

      {/* Mobile loading / empty */}
      {loading && (
        <div className="md:hidden flex items-center justify-center py-12 text-on-surface-variant gap-2">
          <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
          <span className="text-sm">Loading...</span>
        </div>
      )}
      {!loading && filtered.length === 0 && (
        <div className="md:hidden flex flex-col items-center justify-center py-12 gap-3 text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl opacity-40">medication</span>
          <p className="font-medium">No supplements found</p>
        </div>
      )}

      {/* Mobile card list */}
      {!loading && filtered.length > 0 && (
        <div className="md:hidden space-y-3">
          {filtered.map(item => (
            <div key={item.id} className="bg-surface-container-lowest rounded-2xl shadow-sm p-4 border border-outline-variant/20">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary-container/30 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-secondary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>medication</span>
                  </div>
                  <div>
                    <div className="font-semibold text-on-surface">{item.name}</div>
                    <div className="text-xs text-on-surface-variant">{item.category || '—'}</div>
                  </div>
                </div>
                <StockBadge stock={item.stock} />
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-3">
                <div className="text-on-surface-variant">Price</div>
                <div className="font-medium text-on-surface">{item.price ? `₹${Number(item.price).toLocaleString('en-IN')}` : '—'}</div>
                <div className="text-on-surface-variant">Stock</div>
                <div className={`font-bold ${Number(item.stock) < LOW_STOCK_THRESHOLD ? 'text-amber-600' : 'text-on-surface'}`}>{item.stock ?? '—'}</div>
                {item.expiryDate && (
                  <>
                    <div className="text-on-surface-variant">Expiry</div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-on-surface">{item.expiryDate}</span>
                      <ExpiryBadge date={item.expiryDate} />
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-2 mt-3 flex-wrap">
                <button onClick={() => setSellingItem(item)} disabled={Number(item.stock) === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-40">
                  <span className="material-symbols-outlined text-[13px]">shopping_cart</span>Sell
                </button>
                <button onClick={() => setRestockingItem(item)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                  <span className="material-symbols-outlined text-[13px]">add_circle</span>Restock
                </button>
                <button onClick={() => setEditingItem(item)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors">
                  <span className="material-symbols-outlined text-[13px]">edit</span>Edit
                </button>
                <button onClick={() => setDeletingId(item.id)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors">
                  <span className="material-symbols-outlined text-[13px]">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block bg-surface-container-lowest rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.15)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/30 bg-surface-container-low/50">
                {['Supplement', 'Category', 'Price', 'Stock', 'Expiry', 'Status', 'Actions'].map(h => (
                  <th key={h} className={`p-4 font-label-caps text-label-caps text-on-surface-variant uppercase ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="p-8 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined animate-spin text-2xl mr-2">progress_activity</span>Loading...
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="7" className="p-12 text-center">
                  <div className="flex flex-col items-center gap-3 text-on-surface-variant">
                    <span className="material-symbols-outlined text-5xl opacity-40">medication</span>
                    <p className="font-medium">No supplements found</p>
                  </div>
                </td></tr>
              ) : filtered.map(item => (
                <tr key={item.id} className="border-b border-outline-variant/20 hover:bg-surface-container/40 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-secondary-container/30 flex items-center justify-center">
                        <span className="material-symbols-outlined text-secondary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>medication</span>
                      </div>
                      <span className="font-medium text-on-surface">{item.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-on-surface-variant">{item.category || '—'}</td>
                  <td className="p-4 text-sm font-medium text-on-surface">{item.price ? `₹${Number(item.price).toLocaleString('en-IN')}` : '—'}</td>
                  <td className="p-4 text-sm font-bold text-on-surface">{item.stock ?? '—'}</td>
                  <td className="p-4">
                    {item.expiryDate ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-on-surface-variant">{item.expiryDate}</span>
                        <ExpiryBadge date={item.expiryDate} />
                      </div>
                    ) : <span className="text-xs text-on-surface-variant">—</span>}
                  </td>
                  <td className="p-4"><StockBadge stock={item.stock} /></td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => setSellingItem(item)} disabled={Number(item.stock) === 0} title="Sell"
                        className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center justify-center transition-colors disabled:opacity-40">
                        <span className="material-symbols-outlined text-[15px]">shopping_cart</span>
                      </button>
                      <button onClick={() => setRestockingItem(item)} title="Restock"
                        className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center justify-center transition-colors">
                        <span className="material-symbols-outlined text-[15px]">add_circle</span>
                      </button>
                      <button onClick={() => setEditingItem(item)} title="Edit"
                        className="w-8 h-8 rounded-lg bg-surface-container text-on-surface-variant hover:bg-surface-container-high flex items-center justify-center transition-colors">
                        <span className="material-symbols-outlined text-[15px]">edit</span>
                      </button>
                      <button onClick={() => setDeletingId(item.id)} title="Delete"
                        className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition-colors">
                        <span className="material-symbols-outlined text-[15px]">delete</span>
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
            {filtered.length} supplement{filtered.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {showModal && <SupplementModal onSave={handleAdd} onClose={() => setShowModal(false)} />}
      {editingItem && (
        <SupplementModal
          initial={{ name: editingItem.name, category: editingItem.category || 'Protein', stock: editingItem.stock ?? '', price: editingItem.price || '', expiryDate: editingItem.expiryDate || '' }}
          onSave={handleEdit}
          onClose={() => setEditingItem(null)}
        />
      )}
      {sellingItem && <SellModal item={sellingItem} onSell={handleSell} onClose={() => setSellingItem(null)} />}
      {restockingItem && <RestockModal item={restockingItem} onRestock={handleRestock} onClose={() => setRestockingItem(null)} />}

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
