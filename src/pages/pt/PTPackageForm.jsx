import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { createTenantDocument, updateTenantDocument, getTenantCollection } from '../../firebase/tenantDb';

export default function PTPackageForm({ package: pkg, onClose, onSaved }) {
  const { gymId } = useAuth();
  const [saving, setSaving] = useState(false);
  const [trainers, setTrainers] = useState([]);

  const [form, setForm] = useState({
    name: '',
    trainerName: '',
    sessionsIncluded: '',
    price: '',
    durationMonths: '',
    description: '',
  });

  useEffect(() => {
    if (pkg) {
      setForm({
        name: pkg.name ?? '',
        trainerName: pkg.trainerName ?? '',
        sessionsIncluded: pkg.sessionsIncluded ?? '',
        price: pkg.price ?? '',
        durationMonths: pkg.durationMonths ?? '',
        description: pkg.description ?? '',
      });
    }
  }, [pkg]);

  useEffect(() => {
    getTenantCollection(gymId, 'staff').then(data => {
      setTrainers(data.filter(s => s.role === 'Trainer' || s.role === 'Manager'));
    }).catch(() => {});
  }, [gymId]);

  function handle(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.name.trim()) { toast.error('Package name is required'); return; }
    if (!form.trainerName.trim()) { toast.error('Trainer name is required'); return; }
    if (!form.sessionsIncluded || Number(form.sessionsIncluded) < 1) { toast.error('Sessions included must be at least 1'); return; }
    if (form.price === '' || Number(form.price) < 0) { toast.error('Price must be a valid number'); return; }
    if (!form.durationMonths || Number(form.durationMonths) < 1) { toast.error('Duration must be at least 1 month'); return; }

    const payload = {
      name: form.name.trim(),
      trainerName: form.trainerName.trim(),
      sessionsIncluded: Number(form.sessionsIncluded),
      price: Number(form.price),
      durationMonths: Number(form.durationMonths),
      description: form.description.trim(),
      updatedAt: new Date().toISOString(),
    };

    setSaving(true);
    try {
      if (pkg?.id) {
        await updateTenantDocument(gymId, 'ptPackages', pkg.id, payload);
        toast.success('Package updated');
      } else {
        payload.createdAt = new Date().toISOString();
        await createTenantDocument(gymId, 'ptPackages', payload);
        toast.success('Package created');
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save package');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between p-5 border-b border-outline-variant/20 sticky top-0 bg-surface-container-lowest z-10">
          <h2 className="font-bold text-on-surface text-lg">
            {pkg ? 'Edit PT Package' : 'New PT Package'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form id="pt-package-form" onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface-variant">
              Package Name <span className="text-error">*</span>
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handle}
              placeholder="e.g. Premium Strength Training"
              className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface-variant">
              Trainer <span className="text-error">*</span>
            </label>
            {trainers.length > 0 ? (
              <select
                name="trainerName"
                value={form.trainerName}
                onChange={handle}
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary appearance-none"
              >
                <option value="">Select trainer...</option>
                {trainers.map(t => (
                  <option key={t.id} value={t.name}>{t.name} ({t.role})</option>
                ))}
              </select>
            ) : (
              <input
                name="trainerName"
                value={form.trainerName}
                onChange={handle}
                placeholder="e.g. Rajesh Kumar"
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">
                Sessions Included <span className="text-error">*</span>
              </label>
              <input
                name="sessionsIncluded"
                type="number"
                min="1"
                value={form.sessionsIncluded}
                onChange={handle}
                placeholder="12"
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">
                Duration (Months) <span className="text-error">*</span>
              </label>
              <input
                name="durationMonths"
                type="number"
                min="1"
                value={form.durationMonths}
                onChange={handle}
                placeholder="1"
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface-variant">
              Price (₹) <span className="text-error">*</span>
            </label>
            <input
              name="price"
              type="number"
              min="0"
              value={form.price}
              onChange={handle}
              placeholder="5000"
              className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface-variant">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handle}
              rows={3}
              placeholder="Brief description of what this package includes…"
              className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary resize-none"
            />
          </div>

        </form>

        <div className="flex justify-end gap-3 p-5 border-t border-outline-variant/20">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="pt-package-form"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-on-primary rounded-lg font-medium hover:bg-primary/90 shadow-sm text-sm disabled:opacity-70"
          >
            {saving ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                Saving…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">save</span>
                {pkg ? 'Update Package' : 'Create Package'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
