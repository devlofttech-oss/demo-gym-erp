import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { qrSvgToPngBlob, downloadBlob, shareQrOnWhatsApp, memberQrPageUrl } from '../../utils/memberQr';

// Shown right after a member is created: their check-in QR + share/download actions.
export default function MemberQRModal({ member, gymName, onClose }) {
  const qrRef = useRef(null);
  if (!member) return null;

  const handleDownload = async () => {
    try {
      const blob = await qrSvgToPngBlob(qrRef.current?.querySelector('svg'), {
        name: member.name, caption: gymName,
      });
      downloadBlob(blob, `${member.name || 'member'}-qr.png`);
    } catch {
      toast.error('Could not generate QR');
    }
  };

  const handleShare = () => {
    shareQrOnWhatsApp(member.id, {
      name: member.name,
      phone: member.phone,
      gymName,
    });
  };

  const qrLink = memberQrPageUrl(member.id, { name: member.name, gymName });

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
        </div>
        <div className="text-center">
          <h2 className="font-bold text-on-surface text-lg">Member Added!</h2>
          <p className="text-sm text-on-surface-variant">Share the QR link with {member.name || 'the member'} for gym check-in.</p>
        </div>

        <div ref={qrRef} className="p-4 bg-white rounded-2xl shadow-sm">
          <QRCodeSVG value={member.id} size={180} fgColor="#1e1b4b" bgColor="#ffffff" level="H" />
        </div>
        <p className="text-xs text-on-surface-variant font-mono">{member.name}</p>

        {/* Copy link row */}
        <div className="w-full flex items-center gap-2 bg-surface-container rounded-xl px-3 py-2 border border-outline-variant/20">
          <span className="material-symbols-outlined text-[16px] text-on-surface-variant shrink-0">link</span>
          <p className="text-xs text-on-surface-variant truncate flex-1">{qrLink}</p>
          <button
            onClick={() => { navigator.clipboard?.writeText(qrLink); toast.success('Link copied!'); }}
            className="text-xs text-primary font-medium shrink-0 hover:underline"
          >
            Copy
          </button>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <button onClick={handleShare}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#25D366] text-white font-semibold hover:brightness-95 transition-all shadow-sm">
            <span className="material-symbols-outlined text-[18px]">share</span>
            Send QR Link on WhatsApp
          </button>
          <div className="flex gap-2">
            <button onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors">
              <span className="material-symbols-outlined text-[18px]">download</span> Download
            </button>
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-surface-container text-on-surface font-medium hover:bg-surface-container-high transition-colors">
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
