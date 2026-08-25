import { useState } from 'react';
import { openWhatsApp } from '../../utils/whatsapp';

// Free wa.me click-to-chat composer for Marketing messages (class reminders +
// announcements). Editable text + a per-recipient "Open" button that launches
// WhatsApp with the message pre-filled. No Cloud API, no cost. 1-to-1 only.
//   recipients  [{ name, phone }]
export default function WhatsAppLinkModal({ recipients = [], defaultMessage = '', recipientLabel = '', onClose }) {
  const [message, setMessage] = useState(defaultMessage);
  const valid = recipients.filter((r) => r?.phone && String(r.phone).replace(/\D/g, '').length >= 10);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-outline-variant/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#25D366]/15 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#128C4A]"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </div>
            <div>
              <h2 className="font-bold text-on-surface">Send WhatsApp</h2>
              <p className="text-xs text-on-surface-variant">
                {recipientLabel || `${valid.length} recipient${valid.length !== 1 ? 's' : ''} · free`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 p-5 overflow-y-auto">
          {valid.length === 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
              <span className="material-symbols-outlined text-[18px]">warning</span>
              No recipients with a valid phone number.
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface-variant">Message</label>
            <textarea
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              className="w-full px-4 py-3 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface text-sm outline-none focus:border-primary transition-all resize-none leading-relaxed"
            />
          </div>

          {valid.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">
                Open WhatsApp for each member (free)
              </p>
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                {valid.map((r, i) => {
                  const clean = String(r.phone).replace(/\D/g, '').slice(-10);
                  return (
                    <div key={r.id || i} className="flex items-center justify-between px-4 py-2.5 bg-surface-container rounded-xl">
                      <span className="text-sm text-on-surface truncate">
                        {r.name || `+91 ${clean}`}
                      </span>
                      <button
                        onClick={() => openWhatsApp(r.phone, message)}
                        disabled={!message.trim()}
                        className="flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0"
                      >
                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                        Open
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-5 border-t border-outline-variant/20">
          <button onClick={onClose} className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
