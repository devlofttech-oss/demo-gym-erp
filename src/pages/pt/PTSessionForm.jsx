import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  getTenantCollection,
  createTenantDocument,
  updateTenantDocument,
} from '../../firebase/tenantDb';

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function PTSessionForm({ session, onClose, onSaved }) {
  const { gymId } = useAuth();
  const [saving, setSaving] = useState(false);
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(true);

  const [form, setForm] = useState({
    date: session?.date ?? todayStr(),
    time: session?.time ?? '',
    memberName: session?.memberName ?? '',
    trainerName: session?.trainerName ?? '',
    packageId: session?.packageId ?? '',
    status: session?.status ?? 'Scheduled',
    notes: session?.notes ?? '',
  });

  useEffect(() => {
    async function fetchPackages() {
      try {
        const data = await getTenantCollection(gymId, 'ptPackages');
        setPackages(data);
      } catch (err) {
        toast.error('Failed to load packages');
      } finally {
        setLoadingPackages(false);
      }
    }
    fetchPackages();
  }, [gymId]);

  function handle(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.date) { toast.error('Date is required'); return; }
    if (!form.time) { toast.error('Time is required'); return; }
    if (!form.memberName.trim()) { toast.error('Member name is required'); return; }
    if (!form.trainerName.trim()) { toast.error('Trainer name is required'); return; }

    const payload = {
      date: form.date,
      time: form.time,
      memberName: form.memberName.trim(),
      trainerName: form.trainerName.trim(),
      packageId: form.packageId,
      status: form.status,
      notes: form.notes.trim(),
      updatedAt: new Date().toISOString(),
    };

    setSaving(true);
    try {
      if (session?.id) {
        await updateTenantDocument(gymId, 'ptSessions', session.id, payload);
        toast.success('Session updated');
      } else {
        payload.createdAt = new Date().toISOString();
        await createTenantDocument(gymId, 'ptSessions', payload);
        toast.success('Session logged');
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save session');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between p-5 border-b border-outline-variant/20 sticky top-0 bg-surface-container-lowest z-10">
          <h2 className="font-bold text-on-surface text-lg">
            {session ? 'Edit Session' : 'Log PT Session'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form id="pt-session-form" onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">
                Date <span className="text-error">*</span>
              </label>
              <input
                name="date"
                type="date"
                value={form.date}
                onChange={handle}
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">
                Time <span className="text-error">*</span>
              </label>
              <input
                name="time"
                type="time"
                value={form.time}
                onChange={handle}
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface-variant">
              Member Name <span className="text-error">*</span>
            </label>
            <input
              name="memberName"
              type="text"
              value={form.memberName}
              onChange={handle}
              placeholder="e.g. Priya Sharma"
              className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface-variant">
              Trainer Name <span className="text-error">*</span>
            </label>
            <input
              name="trainerName"
              type="text"
              value={form.trainerName}
              onChange={handle}
              placeholder="e.g. Rajesh Kumar"
              className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface-variant">Package</label>
            {loadingPackages ? (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface-variant">
                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                <span className="text-sm">Loading packages…</span>
              </div>
            ) : (
              <select
                name="packageId"
                value={form.packageId}
                onChange={handle}
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary"
              >
                <option value="">No package selected</option>
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name} — {pkg.trainerName} ({pkg.sessionsIncluded} sessions, {pkg.durationMonths}M)
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface-variant">Status</label>
            <select
              name="status"
              value={form.status}
              onChange={handle}
              className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary"
            >
              <option value="Scheduled">Scheduled</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface-variant">Notes</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handle}
              rows={3}
              placeholder="Optional session notes…"
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
            form="pt-session-form"
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
                {session ? 'Update Session' : 'Log Session'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
