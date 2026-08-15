import { useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { qrSvgToPngBlob, downloadBlob } from '../../utils/memberQr';
import toast from 'react-hot-toast';

export default function MemberQRPage() {
  const { memberId } = useParams();
  const [searchParams] = useSearchParams();
  const name = searchParams.get('name') || 'Member';
  const gym  = searchParams.get('gym') || '';
  const qrRef = useRef(null);

  const handleDownload = async () => {
    try {
      const svg  = qrRef.current?.querySelector('svg');
      const blob = await qrSvgToPngBlob(svg, { name, caption: gym });
      downloadBlob(blob, `${name.replace(/\s+/g, '-')}-qr.png`);
    } catch {
      toast.error('Could not download QR');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-5 w-full max-w-xs">
        {/* Header */}
        <div className="text-center">
          {gym && <p className="text-xs font-bold uppercase tracking-widest text-indigo-500 mb-1">{gym}</p>}
          <h1 className="text-xl font-bold text-gray-900">{name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gym Check-in QR</p>
        </div>

        {/* QR */}
        <div ref={qrRef} className="p-4 bg-white rounded-2xl border-2 border-indigo-100 shadow-inner">
          <QRCodeSVG
            value={memberId}
            size={200}
            fgColor="#1e1b4b"
            bgColor="#ffffff"
            level="H"
          />
        </div>

        <p className="text-xs text-gray-400 text-center">Show this at the gym entrance to check in</p>

        {/* Download */}
        <button
          onClick={handleDownload}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3.5 rounded-2xl font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-md"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
          </svg>
          Download QR Code
        </button>

        <p className="text-[10px] text-gray-300 text-center">Powered by Kilos ERP</p>
      </div>
    </div>
  );
}
