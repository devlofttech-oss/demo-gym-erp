import { useState, useEffect } from 'react';
import { createTenantDocument, updateTenantDocument } from '../../firebase/tenantDb';
import { useAuth } from '../../context/AuthContext';

export default function MeasurementForm({ measurement, memberId, memberName, onClose, onSaved }) {
  const { gymId } = useAuth();
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    date: today,
    weight: '',
    height: '',
    bodyFat: '',
    chest: '',
    waist: '',
    hips: '',
    arms: '',
    thighs: '',
    notes: '',
  });

  const [bmi, setBmi] = useState('');

  useEffect(() => {
    if (measurement) {
      setForm({
        date: measurement.date || today,
        weight: measurement.weight ?? '',
        height: measurement.height ?? '',
        bodyFat: measurement.bodyFat ?? '',
        chest: measurement.chest ?? '',
        waist: measurement.waist ?? '',
        hips: measurement.hips ?? '',
        arms: measurement.arms ?? '',
        thighs: measurement.thighs ?? '',
        notes: measurement.notes || '',
      });
      setBmi(measurement.bmi || '');
    }
  }, [measurement]);

  useEffect(() => {
    const w = parseFloat(form.weight);
    const h = parseFloat(form.height);
    if (w > 0 && h > 0) {
      const hm = h / 100;
      setBmi((w / (hm * hm)).toFixed(1));
    } else {
      setBmi('');
    }
  }, [form.weight, form.height]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.date || !form.weight) return;

    setSaving(true);
    try {
      const payload = {
        memberId,
        memberName,
        date: form.date,
        weight: parseFloat(form.weight) || null,
        height: form.height !== '' ? parseFloat(form.height) : null,
        bodyFat: form.bodyFat !== '' ? parseFloat(form.bodyFat) : null,
        chest: form.chest !== '' ? parseFloat(form.chest) : null,
        waist: form.waist !== '' ? parseFloat(form.waist) : null,
        hips: form.hips !== '' ? parseFloat(form.hips) : null,
        arms: form.arms !== '' ? parseFloat(form.arms) : null,
        thighs: form.thighs !== '' ? parseFloat(form.thighs) : null,
        bmi: bmi || null,
        notes: form.notes || '',
        updatedAt: new Date().toISOString(),
      };

      if (measurement?.id) {
        await updateTenantDocument(gymId, 'measurements', measurement.id, payload);
      } else {
        payload.createdAt = new Date().toISOString();
        await createTenantDocument(gymId, 'measurements', payload);
      }

      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-outline-variant/20 shrink-0">
          <div>
            <h2 className="font-bold text-on-surface text-lg">
              {measurement ? 'Edit Measurement' : 'Add Measurement'}
            </h2>
            {memberName && (
              <p className="text-sm text-on-surface-variant mt-0.5">{memberName}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5 overflow-y-auto">

          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface-variant">
              Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              required
              className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Weight + Height */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">
                Weight (kg) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                name="weight"
                value={form.weight}
                onChange={handleChange}
                required
                min="0"
                step="0.1"
                placeholder="e.g. 72.5"
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Height (cm)</label>
              <input
                type="number"
                name="height"
                value={form.height}
                onChange={handleChange}
                min="0"
                step="0.1"
                placeholder="e.g. 175"
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* BMI display */}
          {bmi && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 border border-primary/20 rounded-lg">
              <span className="material-symbols-outlined text-primary text-[18px]">monitor_weight</span>
              <span className="text-sm font-medium text-primary">
                Calculated BMI: <strong>{bmi}</strong>
              </span>
            </div>
          )}

          {/* Body Fat */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Body Fat (%)</label>
              <input
                type="number"
                name="bodyFat"
                value={form.bodyFat}
                onChange={handleChange}
                min="0"
                max="100"
                step="0.1"
                placeholder="e.g. 18.5"
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Chest (cm)</label>
              <input
                type="number"
                name="chest"
                value={form.chest}
                onChange={handleChange}
                min="0"
                step="0.1"
                placeholder="e.g. 95"
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Waist (cm)</label>
              <input
                type="number"
                name="waist"
                value={form.waist}
                onChange={handleChange}
                min="0"
                step="0.1"
                placeholder="e.g. 80"
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Hips (cm)</label>
              <input
                type="number"
                name="hips"
                value={form.hips}
                onChange={handleChange}
                min="0"
                step="0.1"
                placeholder="e.g. 98"
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Arms (cm)</label>
              <input
                type="number"
                name="arms"
                value={form.arms}
                onChange={handleChange}
                min="0"
                step="0.1"
                placeholder="e.g. 35"
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Thighs (cm)</label>
              <input
                type="number"
                name="thighs"
                value={form.thighs}
                onChange={handleChange}
                min="0"
                step="0.1"
                placeholder="e.g. 55"
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface-variant">Notes</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Any additional observations..."
              className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary transition-colors resize-none"
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-primary text-on-primary rounded-lg font-medium hover:bg-primary/90 shadow-sm flex items-center gap-2 disabled:opacity-70 transition-colors"
            >
              {saving ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  Saving...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  Save
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
