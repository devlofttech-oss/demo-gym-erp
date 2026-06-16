import { useState, useEffect, useRef } from 'react';
import { getCollection, createDocument, updateDocument } from '../../firebase/db';
import toast from 'react-hot-toast';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';

const playBeep = (type) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const makeBeep = (freq, waveType, startAt, duration, volume = 0.5) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = waveType;
      osc.frequency.setValueAtTime(freq, startAt);
      gain.gain.setValueAtTime(volume, startAt);
      gain.gain.exponentialRampToValueAtTime(0.01, startAt + duration);
      osc.start(startAt);
      osc.stop(startAt + duration);
    };

    if (type === 'checkin') {
      makeBeep(1000, 'sine', ctx.currentTime, 0.2);
    } else if (type === 'checkout') {
      makeBeep(800, 'sine', ctx.currentTime, 0.15);
      makeBeep(1100, 'sine', ctx.currentTime + 0.2, 0.2);
    } else if (type === 'warning') {
      // Big alarm buzzer — harsh sawtooth, high volume, 4 pulses
      makeBeep(200, 'sawtooth', ctx.currentTime,       0.35, 0.9);
      makeBeep(200, 'sawtooth', ctx.currentTime + 0.45, 0.35, 0.9);
      makeBeep(200, 'sawtooth', ctx.currentTime + 0.9,  0.35, 0.9);
      makeBeep(200, 'sawtooth', ctx.currentTime + 1.35, 0.35, 0.9);
    } else {
      makeBeep(150, 'sawtooth', ctx.currentTime, 1.0);
      makeBeep(150, 'sawtooth', ctx.currentTime + 1.2, 1.0);
    }
  } catch(e) {
    console.error('Audio beep failed', e);
  }
};

const todayStr = () => new Date().toISOString().split('T')[0];

export default function CheckinScreen({ isKiosk = false }) {
  const [members, setMembers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [recentCheckins, setRecentCheckins] = useState([]);
  const [tabVisible, setTabVisible] = useState(!document.hidden);
  const [scannerKey, setScannerKey] = useState(0);
  const lastScannedRef = useRef({ id: null, time: 0 });
  const scanBufferRef = useRef('');
  const scanTimerRef = useRef(null);
  const membersRef = useRef(members);
  const staffRef = useRef(staff);
  const processCheckinRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [membersData, staffData] = await Promise.all([
          getCollection('members'),
          getCollection('staff'),
        ]);
        setMembers(membersData);
        setStaff(staffData);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => { membersRef.current = members; }, [members]);
  useEffect(() => { staffRef.current = staff; }, [staff]);

  // Page visibility — detect when user switches tabs
  useEffect(() => {
    const handleVisibility = () => {
      const visible = !document.hidden;
      setTabVisible(visible);
      if (visible) {
        // Increment key to force scanner useEffect to tear down and recreate
        setScannerKey(k => k + 1);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Hardware barcode/QR scanner keyboard support
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Enter') {
        const scannedId = scanBufferRef.current.trim();
        scanBufferRef.current = '';
        if (scanTimerRef.current) { clearTimeout(scanTimerRef.current); scanTimerRef.current = null; }
        if (!scannedId) return;

        const now = Date.now();
        if (lastScannedRef.current.id === scannedId && now - lastScannedRef.current.time < 3000) return;
        lastScannedRef.current = { id: scannedId, time: now };

        processCheckinRef.current?.(scannedId);
      } else if (e.key.length === 1) {
        scanBufferRef.current += e.key;
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        scanTimerRef.current = setTimeout(() => { scanBufferRef.current = ''; scanTimerRef.current = null; }, 100);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (loading || !tabVisible) return;

    const scanner = new Html5QrcodeScanner('reader', {
      qrbox: { width: 250, height: 250 },
      fps: 10,
      supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
      rememberLastUsedCamera: true
    }, false);

    scanner.render(async (decodedText) => {
      const now = Date.now();
      if (lastScannedRef.current.id === decodedText && now - lastScannedRef.current.time < 3000) return;
      lastScannedRef.current = { id: decodedText, time: now };
      await processCheckinRef.current?.(decodedText);
    }, () => {});

    return () => { scanner.clear().catch(() => {}); };
  }, [loading, scannerKey, tabVisible]);

  // Core check-in/check-out logic — handles both members and staff
  const processCheckin = async (scannedId) => {
    if (checkingIn) return;

    // Look up in members first, then staff (by qrId or doc id)
    const member = membersRef.current.find(m => m.id === scannedId);
    const staffMember = !member ? staffRef.current.find(s => s.qrId === scannedId || s.id === scannedId) : null;

    if (!member && !staffMember) {
      playBeep('error');
      toast.error('Invalid QR Code. Not found.');
      return;
    }

    setCheckingIn(true);
    try {
      if (member) {
        await processMemberCheckin(member);
      } else {
        await processStaffCheckin(staffMember);
      }
    } finally {
      setCheckingIn(false);
    }
  };

  const processMemberCheckin = async (member) => {
    if (member.status !== 'Active') {
      playBeep('error');
      toast.error(`${member.name} - Membership Expired! Please renew.`, { duration: 4000 });
      return;
    }

    const today = todayStr();

    // Find active session for today (checked in but not checked out)
    const todayRecords = await getCollection('attendance', [
      { field: 'memberId', op: '==', value: member.id },
      { field: 'date', op: '==', value: today },
    ]);
    const activeSession = todayRecords.find(r => !r.checkOutTime);

    const hasBalance = member.balanceFees && Number(member.balanceFees) > 0;
    const isInGracePeriod = hasBalance && member.nextPaymentDate && today <= member.nextPaymentDate;
    const shouldWarnBalance = hasBalance && !isInGracePeriod;

    if (activeSession) {
      // Check-out
      const checkOutTime = new Date().toISOString();
      const duration = Math.round((new Date(checkOutTime) - new Date(activeSession.checkInTime)) / 60000);
      await updateDocument('attendance', activeSession.id, { checkOutTime, duration });

      playBeep('checkout');
      toast.success(`${member.name} checked out! (${duration} min)`, { duration: 3000 });
      setRecentCheckins(prev => [
        { memberName: member.name, type: 'member', action: 'out', time: checkOutTime, duration },
        ...prev
      ].slice(0, 10));
    } else {
      // Check-in
      const checkInTime = new Date().toISOString();
      await createDocument('attendance', {
        memberId: member.id,
        memberName: member.name,
        date: today,
        checkInTime,
        checkOutTime: null,
        duration: null,
        status: member.status,
        ...(hasBalance && { balanceFees: member.balanceFees }),
      });

      if (shouldWarnBalance) {
        playBeep('warning');
        toast(`${member.name} checked in — Balance due: ₹${member.balanceFees}`, {
          icon: '⚠️', duration: 5000,
          style: { background: '#b45309', color: '#fff' },
        });
      } else if (isInGracePeriod) {
        playBeep('checkin');
        toast(`${member.name} checked in — Balance due by ${member.nextPaymentDate}`, {
          icon: '🕐', duration: 4000,
          style: { background: '#1d4ed8', color: '#fff' },
        });
      } else {
        playBeep('checkin');
        toast.success(`${member.name} checked in!`);
      }
      setRecentCheckins(prev => [
        { memberName: member.name, type: 'member', action: 'in', time: checkInTime, balanceDue: shouldWarnBalance, gracePeriod: isInGracePeriod, balanceFees: member.balanceFees, nextPaymentDate: member.nextPaymentDate },
        ...prev
      ].slice(0, 10));
    }
  };

  const processStaffCheckin = async (staffMember) => {
    const today = todayStr();

    const todayRecords = await getCollection('staffAttendance', [
      { field: 'staffId', op: '==', value: staffMember.id },
      { field: 'date', op: '==', value: today },
    ]);
    const activeSession = todayRecords.find(r => !r.checkOutTime);

    if (activeSession) {
      const checkOutTime = new Date().toISOString();
      const duration = Math.round((new Date(checkOutTime) - new Date(activeSession.checkInTime)) / 60000);
      await updateDocument('staffAttendance', activeSession.id, { checkOutTime, duration });

      playBeep('checkout');
      toast.success(`${staffMember.name} checked out! (${duration} min)`);
      setRecentCheckins(prev => [
        { memberName: staffMember.name, type: 'staff', role: staffMember.role, action: 'out', time: checkOutTime, duration },
        ...prev
      ].slice(0, 10));
    } else {
      const checkInTime = new Date().toISOString();
      await createDocument('staffAttendance', {
        staffId: staffMember.id,
        staffName: staffMember.name,
        role: staffMember.role,
        date: today,
        checkInTime,
        checkOutTime: null,
        duration: null,
      });

      playBeep('checkin');
      toast.success(`${staffMember.name} (${staffMember.role}) checked in!`);
      setRecentCheckins(prev => [
        { memberName: staffMember.name, type: 'staff', role: staffMember.role, action: 'in', time: checkInTime },
        ...prev
      ].slice(0, 10));
    }
  };

  processCheckinRef.current = processCheckin;

  const handleManualCheckin = async (e) => {
    e.preventDefault();
    if (!selectedMemberId) { toast.error('Please select a member'); return; }
    const member = membersRef.current.find(m => m.id === selectedMemberId);
    if (member) {
      await processMemberCheckin(member);
      setSelectedMemberId('');
    }
  };

  const handlePopOut = () => {
    window.open(
      '/scanner',
      'gym-scanner',
      'width=540,height=820,resizable=yes,scrollbars=no,status=no,toolbar=no,menubar=no',
    );
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      {!isKiosk && (
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-h1 text-h1 text-on-surface">Gym Check-in Scanner</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant">Scan QR to check in or check out. Works for members and staff.</p>
            <p className="text-xs text-on-surface-variant/70 flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">info</span>
              Keep this tab active — the camera pauses when you switch to another tab.
            </p>
          </div>
          <button
            onClick={handlePopOut}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm shrink-0"
            title="Open scanner in a separate floating window so you can use other tabs freely"
          >
            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
            Pop Out Scanner
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scanner */}
        <div className="bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.15)] flex flex-col justify-center min-h-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">qr_code_scanner</span>
              <h3 className="font-h3 text-h3 text-on-surface">QR Scanner</h3>
            </div>
            {/* Live status pill */}
            <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
              tabVisible
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${tabVisible ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              {tabVisible ? 'Scanning Active' : 'Scanner Paused'}
            </span>
          </div>

          {/* Paused overlay banner */}
          {!tabVisible && (
            <div className="mb-4 bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3 dark:bg-amber-900/20 dark:border-amber-700">
              <span className="material-symbols-outlined text-amber-500 text-2xl shrink-0 mt-0.5">warning</span>
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">Scanner Paused</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  The camera stops when this tab is not active. Switch back to this tab to resume scanning automatically.
                </p>
              </div>
            </div>
          )}

          <div className="rounded-xl overflow-hidden border-2 border-outline-variant/30 mb-6 bg-black flex-1 relative">
            <div id="reader" className="w-full h-full min-h-75"></div>
            <style>{`
              #reader__scan_region { background: #000; }
              #reader__dashboard_section_csr span { color: #fff; margin-bottom: 8px; display: block; }
              #reader button { background: #7c3aed; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; margin: 4px; font-weight: 500; }
              #reader select { padding: 8px; border-radius: 8px; border: 1px solid #ccc; margin-bottom: 8px; }
            `}</style>
          </div>

          <div className="border-t border-outline-variant/20 pt-6">
            <form onSubmit={handleManualCheckin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="font-medium text-sm text-on-surface">Manual Fallback (Members)</label>
                <div className="flex gap-2">
                  <select value={selectedMemberId} onChange={e => setSelectedMemberId(e.target.value)}
                    className="flex-1 px-4 py-3 bg-surface-container border border-outline-variant/30 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface outline-none appearance-none font-medium">
                    <option value="">-- Select Member --</option>
                    {loading ? <option disabled>Loading...</option> : members.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.phone})</option>
                    ))}
                  </select>
                  <button type="submit" disabled={checkingIn || loading || !selectedMemberId}
                    className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center">
                    Check In
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Recent Check-ins */}
        <div className="bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.15)] flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-emerald-600">history</span>
            <h3 className="font-h3 text-h3 text-on-surface">Live Activity</h3>
          </div>

          <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {recentCheckins.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant opacity-60">
                <span className="material-symbols-outlined text-5xl mb-2 opacity-50">how_to_reg</span>
                <p>Waiting for scans...</p>
              </div>
            ) : (
              recentCheckins.map((record, index) => {
                const isOut = record.action === 'out';
                const isWarning = record.balanceDue;
                const isGrace = record.gracePeriod;
                const isStaff = record.type === 'staff';
                const bgClass = isWarning
                  ? 'bg-amber-50 border-amber-300 dark:bg-amber-900/20 dark:border-amber-700'
                  : isGrace
                    ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700'
                    : isOut
                      ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700'
                      : 'bg-surface-container-low border-outline-variant/20';
                const iconColor = isWarning ? 'bg-amber-100 text-amber-700' : isGrace ? 'bg-blue-100 text-blue-600' : isOut ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600';
                const icon = isWarning ? 'warning' : isGrace ? 'schedule' : isOut ? 'logout' : 'login';
                return (
                  <div key={index} className={`flex items-center justify-between p-4 rounded-xl border shadow-sm ${bgClass}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconColor}`}>
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-on-surface">{record.memberName}</span>
                        <span className="text-xs text-on-surface-variant">
                          {isStaff ? `${record.role} · ` : ''}{isOut ? `Check-out${record.duration ? ` · ${record.duration} min` : ''}` : 'Check-in'}
                          {isWarning ? ` · Balance: ₹${record.balanceFees}` : ''}
                          {isGrace ? ` · Pay by ${record.nextPaymentDate}` : ''}
                        </span>
                      </div>
                    </div>
                    <span className="font-bold text-on-surface text-sm">
                      {new Date(record.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
