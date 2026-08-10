import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getCollection, createDocument, updateDocument, deleteDocument } from '../../firebase/db';

const EMPTY_FORM = { name: '', durationDays: '', description: '' };

export default function SubscriptionPlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const data = await getCollection('subscriptionPlans', [], { field: 'createdAt', direction: 'asc' });
      setPlans(data);
    } catch {
      toast.error('Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPlans(); }, []);

  const handle = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const handleEdit = (plan) => {
    setEditingId(plan.id);
    setForm({
      name: plan.name || '',
      durationDays: plan.durationDays != null ? String(plan.durationDays) : '',
      description: plan.description || '',
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Plan name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        durationDays: form.durationDays ? Number(form.durationDays) : null,
        description: form.description.trim(),
      };
      if (editingId) {
        await updateDocument('subscriptionPlans', editingId, payload);
        setPlans(prev => prev.map(p => p.id === editingId ? { ...p, ...payload } : p));
        toast.success('Plan updated');
      } else {
        const doc = await createDocument('subscriptionPlans', payload);
        setPlans(prev => [...prev, { id: doc.id, ...payload }]);
        toast.success('Plan created');
      }
      handleCancel();
    } catch {
      toast.error('Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (planId) => {
    setDeletingId(planId);
    try {
      await deleteDocument('subscriptionPlans', planId);
      setPlans(prev => prev.filter(p => p.id !== planId));
      toast.success('Plan deleted');
    } catch {
      toast.error('Failed to delete plan');
    } finally {
      setDeletingId(null);
    }
  };

  const inputCls = 'w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary transition-colors text-sm';
  const labelCls = 'text-sm font-medium text-on-surface-variant';

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-h1 text-h1 text-on-surface">Subscription Plans</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">Create and manage plan templates to assign to gyms.</p>
        </div>
        <button
          onClick={handleNew}
          className="bg-primary text-on-primary px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">add</span>
          New Plan
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-on-surface mb-4">{editingId ? 'Edit Plan' : 'New Plan'}</h3>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Plan Name *</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handle}
                  placeholder="e.g. Standard, Premium"
                  className={inputCls}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Duration (days)</label>
                <input
                  type="number"
                  name="durationDays"
                  value={form.durationDays}
                  onChange={handle}
                  placeholder="e.g. 30, 365"
                  min="1"
                  className={inputCls}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Description</label>
                <input
                  name="description"
                  value={form.description}
                  onChange={handle}
                  placeholder="Optional description"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 justify-end">
              <button type="button" onClick={handleCancel}
                className="px-5 py-2.5 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container transition-colors text-sm">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="px-6 py-2.5 bg-primary text-on-primary rounded-lg font-semibold hover:bg-primary/90 shadow-sm flex items-center gap-2 disabled:opacity-70 transition-colors text-sm">
                {saving ? (
                  <><span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> Saving…</>
                ) : (
                  <><span className="material-symbols-outlined text-[18px]">save</span> {editingId ? 'Save Changes' : 'Create Plan'}</>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Plans table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/20 bg-surface-container-low/50">
                {['Plan Name', 'Duration', 'Description', 'Actions'].map(h => (
                  <th key={h} className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="p-10 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined animate-spin text-2xl mr-2">progress_activity</span> Loading…
                </td></tr>
              ) : plans.length === 0 ? (
                <tr><td colSpan={4} className="p-12 text-center">
                  <div className="flex flex-col items-center gap-3 text-on-surface-variant">
                    <span className="material-symbols-outlined text-5xl opacity-30">loyalty</span>
                    <p className="font-medium">No plans yet</p>
                    <button onClick={handleNew}
                      className="bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
                      Create First Plan
                    </button>
                  </div>
                </td></tr>
              ) : plans.map(plan => (
                <tr key={plan.id} className="border-b border-outline-variant/10 hover:bg-surface-container/30 transition-colors">
                  <td className="p-4 font-semibold text-on-surface">{plan.name}</td>
                  <td className="p-4 text-on-surface-variant">
                    {plan.durationDays ? `${plan.durationDays} days` : '—'}
                  </td>
                  <td className="p-4 text-on-surface-variant">{plan.description || '—'}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(plan)}
                        className="bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">edit</span>
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(plan.id)}
                        disabled={deletingId === plan.id}
                        className="bg-rose-50 text-rose-600 hover:bg-rose-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 dark:bg-rose-900/20 dark:text-rose-400 disabled:opacity-60">
                        {deletingId === plan.id
                          ? <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                          : <span className="material-symbols-outlined text-[14px]">delete</span>
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && plans.length > 0 && (
          <div className="px-4 py-3 border-t border-outline-variant/20 text-xs text-on-surface-variant">
            {plans.length} plan{plans.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
