import { useState } from 'react';
import { createTenantDocument, updateTenantDocument } from '../../firebase/tenantDb';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const EMPTY_FORM = {
  name: '',
  type: 'gym',
  durationMonths: '',
  sessions: '',
  price: '',
  joiningFee: '0',
  description: '',
  features: [],
  isActive: true,
};

const TYPE_OPTIONS = [
  { value: 'gym', label: 'Gym Membership' },
  { value: 'personal-training', label: 'Personal Training' },
  { value: 'group-class', label: 'Group Class' },
  { value: 'addon', label: 'Add-on' },
];

export default function PlanForm({ plan, onClose, onSaved }) {
  const { gymId } = useAuth();

  const [form, setForm] = useState(() => {
    if (!plan) return { ...EMPTY_FORM };
    return {
      name: plan.name || '',
      type: plan.type || 'gym',
      durationMonths: plan.durationMonths != null ? String(plan.durationMonths) : '',
      sessions: plan.sessions != null ? String(plan.sessions) : '',
      price: plan.price != null ? String(plan.price) : '',
      joiningFee: plan.joiningFee != null ? String(plan.joiningFee) : '0',
      description: plan.description || '',
      features: plan.features ? [...plan.features] : [],
      isActive: plan.isActive !== false,
    };
  });

  const [featureInput, setFeatureInput] = useState('');
  const [saving, setSaving] = useState(false);

  const handle = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };

  const addFeature = () => {
    const trimmed = featureInput.trim();
    if (!trimmed) return;
    setForm(p => ({ ...p, features: [...p.features, trimmed] }));
    setFeatureInput('');
  };

  const removeFeature = (idx) => {
    setForm(p => ({ ...p, features: p.features.filter((_, i) => i !== idx) }));
  };

  const handleFeatureKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addFeature(); }
  };

  // Show sessions for PT and Group Class
  const showSessions = form.type === 'personal-training' || form.type === 'group-class';
  // Show duration always except when type is PT and sessions is filled
  const showDuration = !(form.type === 'personal-training' && form.sessions && Number(form.sessions) > 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Plan name is required'); return; }
    if (!form.price || Number(form.price) <= 0) { toast.error('Price must be greater than 0'); return; }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        price: Number(form.price),
        joiningFee: Number(form.joiningFee) || 0,
        description: form.description.trim(),
        features: form.features,
        isActive: form.isActive,
      };
      if (showDuration && form.durationMonths) payload.durationMonths = Number(form.durationMonths);
      if (showSessions && form.sessions) payload.sessions = Number(form.sessions);
      if (!showDuration) payload.durationMonths = null;

      if (plan?.id) {
        await updateTenantDocument(gymId, 'plans', plan.id, payload);
        toast.success('Plan updated!');
      } else {
        await createTenantDocument(gymId, 'plans', { ...payload, createdAt: new Date().toISOString() });
        toast.success('Plan created!');
      }
      onSaved();
    } catch (err) {
      toast.error('Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-outline-variant/20 sticky top-0 bg-surface-container-lowest z-10">
          <h2 className="font-bold text-on-surface text-lg">
            {plan ? 'Edit Plan' : 'New Membership Plan'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="flex flex-col gap-4 p-5">

          {/* Plan Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface-variant">
              Plan Name <span className="text-error">*</span>
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handle}
              placeholder="e.g. Monthly Standard, PT 20 Sessions"
              className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary"
            />
          </div>

          {/* Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface-variant">
              Type <span className="text-error">*</span>
            </label>
            <select
              name="type"
              value={form.type}
              onChange={handle}
              className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary appearance-none"
            >
              {TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Duration + Sessions row */}
          <div className="grid grid-cols-2 gap-4">
            {showDuration && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-on-surface-variant">Duration in Months</label>
                <input
                  type="number"
                  name="durationMonths"
                  value={form.durationMonths}
                  onChange={handle}
                  min="1"
                  placeholder="e.g. 3"
                  className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary"
                />
              </div>
            )}
            {showSessions && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-on-surface-variant">Number of Sessions</label>
                <input
                  type="number"
                  name="sessions"
                  value={form.sessions}
                  onChange={handle}
                  min="1"
                  placeholder="e.g. 20"
                  className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary"
                />
              </div>
            )}
            {!showDuration && !showSessions && <div />}
          </div>

          {/* Price + Joining Fee */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">
                Price (₹) <span className="text-error">*</span>
              </label>
              <input
                type="number"
                name="price"
                value={form.price}
                onChange={handle}
                min="0"
                placeholder="0"
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Joining Fee (₹)</label>
              <input
                type="number"
                name="joiningFee"
                value={form.joiningFee}
                onChange={handle}
                min="0"
                placeholder="0"
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface-variant">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handle}
              rows={3}
              placeholder="Brief description of this plan..."
              className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary resize-none"
            />
          </div>

          {/* Features */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-on-surface-variant">Features / Benefits</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={featureInput}
                onChange={e => setFeatureInput(e.target.value)}
                onKeyDown={handleFeatureKeyDown}
                placeholder="e.g. Unlimited access, Locker room..."
                className="flex-1 px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary text-sm"
              />
              <button
                type="button"
                onClick={addFeature}
                className="px-4 py-2.5 bg-primary/10 text-primary rounded-lg font-medium text-sm hover:bg-primary/20 transition-colors flex items-center gap-1 whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Add
              </button>
            </div>
            {form.features.length > 0 && (
              <ul className="flex flex-col gap-1.5 mt-1">
                {form.features.map((feat, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-2 px-3 py-2 bg-surface-container rounded-lg text-sm text-on-surface"
                  >
                    <span className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[14px]">check_circle</span>
                      {feat}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFeature(idx)}
                      className="text-on-surface-variant hover:text-rose-600 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between py-2 border-t border-outline-variant/20">
            <div>
              <div className="text-sm font-medium text-on-surface">Active</div>
              <div className="text-xs text-on-surface-variant">Inactive plans won't appear during member enrollment</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="isActive"
                checked={form.isActive}
                onChange={handle}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-surface-container-high rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
            </label>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-primary text-on-primary rounded-lg font-medium hover:bg-primary/90 shadow-sm flex items-center gap-2 disabled:opacity-70 text-sm"
            >
              {saving
                ? <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> Saving...</>
                : <><span className="material-symbols-outlined text-[16px]">save</span> {plan ? 'Update Plan' : 'Create Plan'}</>
              }
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
