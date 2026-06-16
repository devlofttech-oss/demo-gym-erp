import CheckinScreen from './CheckinScreen';

export default function ScannerKiosk() {
  const isPopup = window.opener !== null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Compact kiosk header */}
      <div className="bg-primary text-on-primary px-4 py-2.5 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            qr_code_scanner
          </span>
          <span className="font-bold text-sm tracking-wide">Deep Fitness — Scanner Kiosk</span>
          <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-medium hidden sm:inline">
            Standalone Mode
          </span>
        </div>
        {isPopup && (
          <button
            onClick={() => window.close()}
            className="flex items-center gap-1 text-xs text-on-primary/75 hover:text-on-primary transition-colors px-2 py-1 rounded-lg hover:bg-white/10"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
            Close
          </button>
        )}
      </div>

      {/* Scanner fills the rest */}
      <div className="flex-1 overflow-y-auto p-4">
        <CheckinScreen isKiosk />
      </div>
    </div>
  );
}
