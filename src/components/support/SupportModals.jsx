import { useState } from 'react';
import toast from 'react-hot-toast';
import { createDocument } from '../../firebase/db';

// Kilos support contacts (shared across web + mobile)
export const SUPPORT_WA_URL    = 'https://wa.me/917012583444';
export const SUPPORT_MAIL_URL  = 'mailto:support@kilos.devlofttech.com';

/**
 * Request a Feature — expandable message box + "Request" button.
 * Saves to the top-level `featureRequests` collection so it surfaces
 * on the Super Admin portal (not buried in a gym's subcollection).
 */
export function RequestFeatureModal({ gymId, gymName, onClose }) {
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!message.trim()) return;
    setSaving(true);
    try {
      await createDocument('featureRequests', {
        gymId: gymId || '',
        gymName: gymName || '',
        message: message.trim(),
        source: 'web',
        status: 'pending',
      });
      toast.success('Feature request sent!');
      onClose();
    } catch {
      toast.error('Failed to send request');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-9999 flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="font-bold text-on-surface text-lg">Request a Feature</p>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <p className="text-sm text-on-surface-variant">Tell us what feature you'd like to see in Kilos.</p>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Describe the feature you need..."
          rows={4}
          autoFocus
          className="w-full px-4 py-3 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface text-sm resize-none outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        />
        <button
          onClick={submit}
          disabled={saving || !message.trim()}
          className="w-full py-2.5 bg-primary text-on-primary rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
          Request
        </button>
      </div>
    </div>
  );
}

/**
 * Contact Us — popup with two buttons: Mail Us and WhatsApp.
 */
export function ContactModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-9999 flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="font-bold text-on-surface text-lg">Contact Us</p>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <p className="text-sm text-on-surface-variant">We're here to help. Reach out any time.</p>
        <div className="flex gap-3">
          <a href={SUPPORT_MAIL_URL}
            className="flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border border-outline-variant/30 hover:bg-surface-container transition-colors text-on-surface">
            <span className="material-symbols-outlined text-primary text-[28px]">mail</span>
            <span className="text-sm font-medium">Mail Us</span>
          </a>
          <a href={SUPPORT_WA_URL} target="_blank" rel="noopener noreferrer"
            className="flex-1 flex flex-col items-center gap-2 p-4 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors">
            <span className="material-symbols-outlined text-[28px]">chat</span>
            <span className="text-sm font-semibold">WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  );
}
