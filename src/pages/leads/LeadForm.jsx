import { useState } from 'react';
import toast from 'react-hot-toast';
import { createTenantDocument, updateTenantDocument } from '../../firebase/tenantDb';
import { useAuth } from '../../context/AuthContext';

const SOURCES = [
  { value: 'walk-in', label: 'Walk-in' },
  { value: 'phone', label: 'Phone' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
];

const STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'follow-up', label: 'Follow-up' },
  { value: 'interested', label: 'Interested' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

const fieldClass =
  'px-4 py-3 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary transition-colors w-full';

const labelClass = 'block text-xs font-medium text-on-surface-variant mb-1';

export default function LeadForm({ lead, onClose, onSaved }) {
  const { gymId } = useAuth();

  const [form, setForm] = useState({
    name: lead?.name ?? '',
    phone: lead?.phone ?? '',
    email: lead?.email ?? '',
    source: lead?.source ?? 'walk-in',
    status: lead?.status ?? 'new',
    interestedPlan: lead?.interestedPlan ?? '',
    budget: lead?.budget ?? '',
    nextFollowUp: lead?.nextFollowUp ?? '',
    notes: lead?.notes ?? '',
    assignedTo: lead?.assignedTo ?? '',
  });

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.phone.trim()) errs.phone = 'Phone is required';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const payload = {
        ...form,
        budget: form.budget !== '' ? Number(form.budget) : null,
        updatedAt: new Date().toISOString(),
      };
      if (lead?.id) {
        await updateTenantDocument(gymId, 'leads', lead.id, payload);
        toast.success('Lead updated');
      } else {
        payload.createdAt = new Date().toISOString();
        await createTenantDocument(gymId, 'leads', payload);
        toast.success('Lead added');
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save lead');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-on-surface">
              {lead?.id ? 'Edit Lead' : 'Add Lead'}
            </h2>
            <p className="text-sm text-on-surface-variant mt-0.5">
              {lead?.id ? 'Update lead details' : 'Fill in the details to create a new lead'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name & Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={set('name')}
                placeholder="Full name"
                className={fieldClass}
              />
              {errors.name && (
                <p className="text-xs text-rose-500 mt-1">{errors.name}</p>
              )}
            </div>
            <div>
              <label className={labelClass}>
                Phone <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={set('phone')}
                placeholder="10-digit number"
                className={fieldClass}
              />
              {errors.phone && (
                <p className="text-xs text-rose-500 mt-1">{errors.phone}</p>
              )}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="email@example.com"
              className={fieldClass}
            />
          </div>

          {/* Source & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Source</label>
              <select value={form.source} onChange={set('source')} className={fieldClass}>
                {SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select value={form.status} onChange={set('status')} className={fieldClass}>
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Interested Plan & Budget */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Interested Plan</label>
              <input
                type="text"
                value={form.interestedPlan}
                onChange={set('interestedPlan')}
                placeholder="e.g. Monthly, Annual"
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Budget (₹)</label>
              <input
                type="number"
                min="0"
                value={form.budget}
                onChange={set('budget')}
                placeholder="0"
                className={fieldClass}
              />
            </div>
          </div>

          {/* Next Follow-up & Assigned To */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Next Follow-up</label>
              <input
                type="date"
                value={form.nextFollowUp}
                onChange={set('nextFollowUp')}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Assigned To</label>
              <input
                type="text"
                value={form.assignedTo}
                onChange={set('assignedTo')}
                placeholder="Staff name"
                className={fieldClass}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={set('notes')}
              placeholder="Any additional notes..."
              className={fieldClass + ' resize-none'}
            />
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-sm font-medium bg-primary text-on-primary hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-2"
            >
              {saving && (
                <span className="material-symbols-outlined text-base animate-spin">
                  progress_activity
                </span>
              )}
              {saving ? 'Saving…' : lead?.id ? 'Update Lead' : 'Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
