import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getTenantDocument, getTenantCollection, updateTenantDocument, deleteTenantDocument } from '../../firebase/tenantDb';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import PhotoUpload from '../../components/ui/PhotoUpload';
import kilosLogo from '../../assets/kilos_logo.png';
import SendWhatsAppModal from '../../components/messaging/SendWhatsAppModal';
import MeasurementForm from '../measurements/MeasurementForm';
import { shareQrOnWhatsApp } from '../../utils/memberQr';

// ── Attendance Calendar ─────────────────────────────────────────────────────
function AttendanceCalendar({ attendance }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const attendedDates = new Set(
    attendance.map(a => {
      if (a.date && /^\d{4}-\d{2}-\d{2}$/.test(a.date)) return a.date;
      const d = new Date(a.checkInTime || a.timestamp || a.date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })
  );

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = viewDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const isToday = (d) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  const isAttended = (d) => {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return attendedDates.has(key);
  };

  const thisMonthCount = [...attendedDates].filter(k => k.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="select-none max-w-xs">
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="w-6 h-6 rounded flex items-center justify-center hover:bg-surface-container text-on-surface-variant transition-colors">
          <span className="material-symbols-outlined text-[16px]">chevron_left</span>
        </button>
        <div className="text-center">
          <div className="text-xs font-semibold text-on-surface">{monthName}</div>
          <div className="text-[10px] text-on-surface-variant">{thisMonthCount} visit{thisMonthCount !== 1 ? 's' : ''}</div>
        </div>
        <button onClick={nextMonth} disabled={month === today.getMonth() && year === today.getFullYear()} className="w-6 h-6 rounded flex items-center justify-center hover:bg-surface-container text-on-surface-variant transition-colors disabled:opacity-30">
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        </button>
      </div>
      <div className="grid grid-cols-7 mb-0.5">
        {days.map(d => (
          <div key={d} className="text-center text-[9px] font-semibold text-on-surface-variant uppercase py-0.5">{d[0]}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const attended = isAttended(day);
          const todayDay = isToday(day);
          return (
            <div key={day} className={`w-7 h-7 flex items-center justify-center rounded text-[11px] font-medium transition-all
              ${attended ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container'}
              ${todayDay && !attended ? 'ring-1 ring-primary/50 text-primary font-bold' : ''}
              ${todayDay && attended ? 'ring-1 ring-white/50' : ''}`}
              title={attended ? `Visited on ${day} ${monthName}` : ''}>
              {day}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-2 justify-end">
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded bg-primary"></div><span className="text-[10px] text-on-surface-variant">Attended</span></div>
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded border border-primary/50"></div><span className="text-[10px] text-on-surface-variant">Today</span></div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

function ConfirmModal({ title, message, confirmLabel = 'Delete', confirmClass = 'bg-rose-600 hover:bg-rose-700 text-white', onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-rose-600 text-[20px]">warning</span>
          </div>
          <div>
            <h3 className="font-semibold text-on-surface">{title}</h3>
            <p className="text-sm text-on-surface-variant mt-1">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container transition-colors text-sm">Cancel</button>
          <button onClick={onConfirm} className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm ${confirmClass}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export default function MemberProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { gymId } = useAuth();
  const [member, setMember] = useState(null);
  const [payments, setPayments] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gymInfo, setGymInfo] = useState({ name: '', location: '', contact: '' });
  const [attendanceTab, setAttendanceTab] = useState('calendar');
  const [showQR, setShowQR] = useState(false);
  const qrRef = useRef(null);


  // ── Remind (payment due) ──
  const [showRemindModal, setShowRemindModal] = useState(false);

  // ── Delete member confirm ──
  const [showDeleteMember, setShowDeleteMember] = useState(false);

  // ── Freeze modal ──
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [freezeDate, setFreezeDate] = useState('');
  const [freezing, setFreezing] = useState(false);

  // ── Payment edit/delete ──
  const [editingPayment, setEditingPayment] = useState(null); // full payment object
  const [paymentEditForm, setPaymentEditForm] = useState({});
  const [deletingPaymentId, setDeletingPaymentId] = useState(null);

  // ── Attendance delete ──
  const [deletingAttendanceId, setDeletingAttendanceId] = useState(null);

  // ── Measurements ──
  const [measurements, setMeasurements] = useState([]);
  const [showMeasurementForm, setShowMeasurementForm] = useState(false);
  const [editingMeasurement, setEditingMeasurement] = useState(null);
  const [photoLightbox, setPhotoLightbox] = useState(false);

  const downloadQR = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const qrSize = 200;
    const padding = 24;
    const textHeight = 52;
    const canvas = document.createElement('canvas');
    canvas.width = qrSize + padding * 2;
    canvas.height = qrSize + padding * 2 + textHeight;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, padding, padding, qrSize, qrSize);
      ctx.fillStyle = '#1e1b4b';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(member?.name || '', canvas.width / 2, qrSize + padding + 22);
      ctx.fillStyle = '#7c3aed';
      ctx.font = '11px sans-serif';
      ctx.fillText(gymInfo?.name?.toUpperCase() || 'KILOS', canvas.width / 2, qrSize + padding + 42);
      URL.revokeObjectURL(url);
      const a = document.createElement('a');
      a.download = `${member?.name || 'member'}-qr.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = url;
  };

  const shareQR = () => {
    shareQrOnWhatsApp(id, {
      name: member?.name, phone: member?.phone, gymName: gymInfo?.name,
    });
  };

  const downloadReceipt = () => {
    const bal = Number(member?.balanceFees || 0);
    const subLine = [gymInfo.location, gymInfo.contact].filter(Boolean).join('  &nbsp;|&nbsp;  ');
    const dateStr = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

    const html = `
      <html><head><title>Receipt - ${member?.name || 'Member'}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; font-family: 'Segoe UI', Arial, sans-serif; }
        body { background:#fff; color:#111827; }
        .receipt { max-width:600px; margin:0 auto; padding:0; }

        .header { background:#4f46e5; color:#fff; padding:24px 28px; display:flex; align-items:center; gap:16px; }
        .logo-circle { width:52px; height:52px; border-radius:12px; background:rgba(255,255,255,0.95);
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
          padding:4px; overflow:hidden; }
        .logo-circle img { width:100%; height:100%; object-fit:contain; }
        .gym-name { font-size:20px; font-weight:800; letter-spacing:1px; }
        .gym-sub  { font-size:11px; color:rgba(255,255,255,0.75); margin-top:3px; }
        .receipt-label { margin-left:auto; text-align:right; }
        .receipt-label span { display:block; font-size:10px; color:rgba(255,255,255,0.65); font-weight:600; letter-spacing:1px; }
        .receipt-label .date { font-size:11px; font-weight:400; margin-top:2px; }

        .body { padding:28px; }
        .section { margin-bottom:20px; }
        .section-title { font-size:9px; font-weight:700; color:#6366f1; letter-spacing:1.5px;
          text-transform:uppercase; margin-bottom:10px; }
        .row { display:flex; justify-content:space-between; align-items:baseline;
          padding:8px 0; border-bottom:1px solid #f3f4f6; }
        .row:last-child { border-bottom:none; }
        .row .label { font-size:12px; color:#9ca3af; }
        .row .value { font-size:13px; font-weight:700; color:#111827; }
        .value.green  { color:#059669; }
        .value.red    { color:#dc2626; }
        .bal-row { background:#fff1f2; border-radius:6px; padding:8px 10px; margin:0 -10px; }

        hr.section-divider { border:none; border-top:1px solid #e5e7eb; margin:4px 0 20px; }

        .footer { text-align:center; padding:20px 28px 28px; border-top:1px solid #e5e7eb;
          color:#9ca3af; font-size:10px; line-height:1.8; }

        @media print {
          body * { visibility:hidden; }
          #receipt-print, #receipt-print * { visibility:visible; }
          #receipt-print { position:fixed; top:0; left:0; width:100%; }
        }
      </style></head>
      <body><div class="receipt" id="receipt-print">
        <div class="header">
          <div class="logo-circle"><img src="${window.location.origin}${kilosLogo}" alt="Kilos" /></div>
          <div>
            <div class="gym-name">${gymInfo.name || 'Kilos'}</div>
            ${subLine ? `<div class="gym-sub">${subLine}</div>` : ''}
          </div>
          <div class="receipt-label">
            <span>MEMBERSHIP RECEIPT</span>
            <span class="date">${dateStr}</span>
          </div>
        </div>

        <div class="body">
          <div class="section">
            <div class="section-title">Member Details</div>
            <div class="row"><span class="label">Name</span><span class="value">${member?.name || 'N/A'}</span></div>
            <div class="row"><span class="label">Phone</span><span class="value">${member?.phone || 'N/A'}</span></div>
          </div>
          <hr class="section-divider"/>

          <div class="section">
            <div class="section-title">Plan Details</div>
            <div class="row"><span class="label">Membership Plan</span><span class="value">${member?.planName || 'N/A'}</span></div>
            <div class="row"><span class="label">Plan Active From</span><span class="value">${member?.planActiveFrom || 'N/A'}</span></div>
            <div class="row"><span class="label">Valid Until (Expiry)</span><span class="value">${member?.expiryDate || 'N/A'}</span></div>
          </div>
          <hr class="section-divider"/>

          <div class="section">
            <div class="section-title">Payment Summary</div>
            <div class="row"><span class="label">Total Fees</span><span class="value">&#8377;${Number(member?.totalFees || 0).toLocaleString('en-IN')}</span></div>
            ${member?.gstPercent > 0 ? `<div class="row"><span class="label">GST (${member.gstPercent}%)</span><span class="value">&#8377;${(Number(member.totalFees || 0) * member.gstPercent / 100).toLocaleString('en-IN')}</span></div>` : ''}
            <div class="row"><span class="label">Amount Paid</span><span class="value green">&#8377;${Number(member?.paidFees || 0).toLocaleString('en-IN')}</span></div>
            <div class="row ${bal > 0 ? 'bal-row' : ''}">
              <span class="label">Balance Due</span>
              <span class="value ${bal > 0 ? 'red' : 'green'}">&#8377;${bal.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        <div class="footer">
          Thank you for choosing ${gymInfo.name || 'Kilos'}!<br/>
          Generated: ${new Date().toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', year: 'numeric', month: 'short', day: 'numeric' })}
        </div>
      </div></body></html>
    `;

    const win = window.open('', '_blank', 'width=700,height=900');
    if (!win) { toast.error('Allow popups to download the receipt'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [profileData, settingsDoc] = await Promise.all([
          getTenantDocument(gymId, 'members', id),
          getTenantDocument(gymId, 'settings', 'general'),
        ]);
        setMember(profileData);
        if (settingsDoc?.gymInfo) setGymInfo(settingsDoc.gymInfo);
        const paymentsData = await getTenantCollection(gymId, 'payments', [{ field: 'memberId', op: '==', value: id }]);
        setPayments(paymentsData.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)));

        const attendanceData = await getTenantCollection(gymId, 'attendance', [{ field: 'memberId', op: '==', value: id }]);
        setAttendance(attendanceData.sort((a, b) => new Date(b.checkInTime || b.timestamp || b.date || 0) - new Date(a.checkInTime || a.timestamp || a.date || 0)));

        const measureData = await getTenantCollection(gymId, 'measurements', [{ field: 'memberId', op: '==', value: id }]);
        setMeasurements(measureData.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)));
      } catch (error) {
        console.error('Error fetching data', error);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchData();
  }, [id]);

  // ── Freeze / Unfreeze ────────────────────────────────────────────────────
  const handleFreeze = async () => {
    if (!freezeDate) { toast.error('Select a resume date'); return; }
    setFreezing(true);
    try {
      const updates = { status: 'Frozen', frozenOn: new Date().toISOString().split('T')[0], resumeDate: freezeDate };
      await updateTenantDocument(gymId, 'members', id, updates);
      setMember(prev => ({ ...prev, ...updates }));
      setShowFreezeModal(false);
      setFreezeDate('');
      toast.success('Membership frozen');
    } catch { toast.error('Failed to freeze membership'); }
    finally { setFreezing(false); }
  };

  const handleUnfreeze = async () => {
    try {
      const updates = { status: 'Active', frozenOn: null, resumeDate: null };
      await updateTenantDocument(gymId, 'members', id, updates);
      setMember(prev => ({ ...prev, ...updates }));
      toast.success('Membership resumed');
    } catch { toast.error('Failed to unfreeze'); }
  };

  // ── Member handlers ──────────────────────────────────────────────────────

  const handleDeleteMember = async () => {
    try {
      await deleteTenantDocument(gymId, 'members', id);
      // cascade delete payments and attendance
      await Promise.all([
        ...payments.map(p => deleteTenantDocument(gymId, 'payments', p.id)),
        ...attendance.map(a => deleteTenantDocument(gymId, 'attendance', a.id)),
      ]);
      toast.success('Member deleted.');
      navigate('/members');
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete member.');
    }
  };

  // ── Payment handlers ─────────────────────────────────────────────────────

  const openEditPayment = (payment) => {
    setEditingPayment(payment);
    setPaymentEditForm({
      amount: payment.amount ?? payment.paidAmount ?? 0,
      paymentMode: payment.paymentMode || 'Cash',
      date: payment.date ? new Date(payment.date).toISOString().split('T')[0] : '',
      planName: payment.planName || '',
      totalFees: payment.totalFees ?? 0,
      balanceFees: payment.balanceFees ?? 0,
      notes: payment.notes || '',
    });
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    try {
      const updates = {
        amount: Number(paymentEditForm.amount) || 0,
        paidAmount: Number(paymentEditForm.amount) || 0,
        paymentMode: paymentEditForm.paymentMode,
        date: new Date(paymentEditForm.date).toISOString(),
        planName: paymentEditForm.planName,
        totalFees: Number(paymentEditForm.totalFees) || 0,
        balanceFees: Number(paymentEditForm.balanceFees) || 0,
        notes: paymentEditForm.notes,
      };
      await updateTenantDocument(gymId, 'payments', editingPayment.id, updates);
      setPayments(prev => prev.map(p => p.id === editingPayment.id ? { ...p, ...updates } : p));
      setEditingPayment(null);
      toast.success('Payment updated!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to update payment.');
    }
  };

  const handleDeletePayment = async () => {
    try {
      await deleteTenantDocument(gymId, 'payments', deletingPaymentId);
      setPayments(prev => prev.filter(p => p.id !== deletingPaymentId));
      setDeletingPaymentId(null);
      toast.success('Payment record deleted.');
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete payment.');
    }
  };

  // ── Measurement handlers ─────────────────────────────────────────────────

  const refreshMeasurements = async () => {
    const data = await getTenantCollection(gymId, 'measurements', [{ field: 'memberId', op: '==', value: id }]);
    setMeasurements(data.sort((a, b) => new Date(a.date) - new Date(b.date)));
  };

  const handleMeasurementSaved = () => {
    setShowMeasurementForm(false);
    setEditingMeasurement(null);
    refreshMeasurements();
  };

  const handleDeleteMeasure = async (measureId) => {
    try {
      await deleteTenantDocument(gymId, 'measurements', measureId);
      setMeasurements(prev => prev.filter(m => m.id !== measureId));
      toast.success('Entry removed');
    } catch { toast.error('Failed to delete'); }
  };

  // ── Attendance handlers ──────────────────────────────────────────────────

  const handleDeleteAttendance = async () => {
    try {
      await deleteTenantDocument(gymId, 'attendance', deletingAttendanceId);
      setAttendance(prev => prev.filter(a => a.id !== deletingAttendanceId));
      setDeletingAttendanceId(null);
      toast.success('Attendance record deleted.');
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete attendance.');
    }
  };

  // ────────────────────────────────────────────────────────────────────────

  // measurements sorted oldest→newest for stats (must be before early returns — Rules of Hooks)
  const measureStats = useMemo(() => {
    if (measurements.length === 0) return null;
    const first = measurements[0];
    const latest = measurements[measurements.length - 1];
    const weightChange = latest.weight != null && first.weight != null
      ? (latest.weight - first.weight).toFixed(1) : null;
    return { latestWeight: latest.weight, weightChange, latestBodyFat: latest.bodyFat, latestBmi: latest.bmi };
  }, [measurements]);

  const weightChangeColor = measureStats?.weightChange != null
    ? parseFloat(measureStats.weightChange) < 0 ? 'text-emerald-600'
      : parseFloat(measureStats.weightChange) > 0 ? 'text-rose-500'
      : 'text-on-surface-variant'
    : 'text-on-surface-variant';

  function fmtDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function fmtVal(val) { return val !== null && val !== undefined && val !== '' ? val : '—'; }

  if (loading) return <div className="p-8 text-center text-on-surface-variant font-medium">Loading profile...</div>;
  if (!member) return <div className="p-8 text-center text-error font-medium">Member not found.</div>;

  const expiryDays = member.expiryDate
    ? Math.ceil((new Date(member.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
    : null;
  const isExpired = expiryDays !== null && expiryDays < 0;
  const isFrozen = member.status === 'Frozen';
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const minFreezeDate = tomorrow.toISOString().split('T')[0];

  return (
    <div className="flex flex-col gap-6">

      {/* ── Back ── */}
      <Link to="/members" className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors w-fit">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Members
      </Link>

      {/* ── Header Profile Card ── */}
      <div className="bg-surface-container-lowest px-5 py-4 rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.15)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="shrink-0 flex flex-col items-center gap-1.5">
            <div
              onClick={() => member.photoUrl && setPhotoLightbox(true)}
              className={`w-16 h-16 rounded-2xl bg-primary-container text-primary flex items-center justify-center text-2xl font-bold shadow-inner overflow-hidden ${member.photoUrl ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
            >
              {member.photoUrl
                ? <img src={member.photoUrl} alt={member.name} className="w-full h-full object-contain" />
                : (member.name?.charAt(0) || '?')
              }
            </div>
            <PhotoUpload
              compact
              hasPhoto={!!member.photoUrl}
              onUpload={async (url) => {
                await updateTenantDocument(gymId, 'members', id, { photoUrl: url });
                setMember(prev => ({ ...prev, photoUrl: url }));
                toast.success('Photo updated!');
              }}
              onDelete={async () => {
                await updateTenantDocument(gymId, 'members', id, { photoUrl: null });
                setMember(prev => ({ ...prev, photoUrl: null }));
                toast.success('Photo removed!');
              }}
            />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <h1 className="font-bold text-lg text-on-surface truncate">{member.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-on-surface-variant text-sm">
              <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">call</span>{member.phone}</span>
              {member.joinDate && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">calendar_month</span>Joined {member.joinDate}</span>}
              {member.birthday && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">cake</span>{member.birthday}</span>}
            </div>
            <div className="mt-1">
              {isFrozen ? (
                <span className="inline-flex items-center gap-1 text-blue-600 font-label-caps text-label-caps bg-blue-50 px-2 py-0.5 rounded-md text-xs">
                  <span className="material-symbols-outlined text-[11px]">ac_unit</span> Frozen
                  {member.resumeDate && <span className="ml-1 opacity-70">until {member.resumeDate}</span>}
                </span>
              ) : isExpired ? (
                <span className="inline-flex items-center gap-1 text-rose-600 font-label-caps text-label-caps bg-rose-50 px-2 py-0.5 rounded-md text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Expired Member
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-emerald-600 font-label-caps text-label-caps bg-emerald-50 px-2 py-0.5 rounded-md text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active Member
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto flex-wrap">
          <Link to={`/payments/new?memberId=${id}`} className="flex-1 md:flex-none bg-primary text-on-primary px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm text-center flex items-center justify-center gap-1.5 text-sm">
            <span className="material-symbols-outlined text-[16px]">payments</span>
            Collect Payment
          </Link>
          <button onClick={downloadReceipt} className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center justify-center gap-1.5 text-sm">
            <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
            Download Receipt
          </button>
          <Link to={`/members/${id}/edit`} className="flex-1 md:flex-none bg-surface-container border border-outline-variant/30 text-on-surface px-4 py-2 rounded-lg font-medium hover:bg-surface-container-high transition-colors shadow-sm flex items-center justify-center gap-1.5 text-sm">
            <span className="material-symbols-outlined text-[16px]">edit</span>
            Edit
          </Link>
          {isFrozen ? (
            <button onClick={handleUnfreeze} className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center justify-center gap-1.5 text-sm">
              <span className="material-symbols-outlined text-[16px]">play_circle</span>
              Unfreeze
            </button>
          ) : (
            <button onClick={() => { setFreezeDate(''); setShowFreezeModal(true); }} className="flex-1 md:flex-none bg-blue-50 border border-blue-200 text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-100 transition-colors shadow-sm flex items-center justify-center gap-1.5 text-sm">
              <span className="material-symbols-outlined text-[16px]">ac_unit</span>
              Freeze
            </button>
          )}
          <button onClick={() => setShowDeleteMember(true)} className="flex-1 md:flex-none bg-rose-50 border border-rose-200 text-rose-600 px-4 py-2 rounded-lg font-medium hover:bg-rose-100 transition-colors shadow-sm flex items-center justify-center gap-1.5 text-sm">
            <span className="material-symbols-outlined text-[16px]">delete</span>
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left Col ── */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Current Plan */}
          <div className="bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.15)]">
            <div className="flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-primary">card_membership</span>
              <h3 className="font-h3 text-h3 text-on-surface">Current Plan</h3>
            </div>
            <div className="flex flex-col gap-4">
              <div className="bg-primary-container/20 rounded-xl p-4 border border-primary/10">
                <div className="text-xs font-label-caps text-primary uppercase tracking-wider mb-1">Plan Name</div>
                <div className="font-h3 text-on-surface">{member.planName || 'No Active Plan'}</div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="text-sm text-on-surface-variant font-medium">Plan Active From</div>
                <div className="font-medium text-on-surface">{member.planActiveFrom || member.joinDate || 'N/A'}</div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="text-sm text-on-surface-variant font-medium">Valid Until</div>
                <div className={`font-medium text-lg ${isExpired ? 'text-rose-600' : 'text-on-surface'}`}>{member.expiryDate || 'N/A'}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-outline-variant/20">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">Total</span>
                  <span className="text-sm font-semibold text-on-surface">₹{Number(member.totalFees || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">Paid</span>
                  <span className="text-sm font-semibold text-emerald-600">₹{Number(member.paidFees || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">Balance</span>
                  <span className={`text-sm font-semibold ${Number(member.balanceFees) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    ₹{Number(member.balanceFees || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
              {Number(member.balanceFees) > 0 && (
                <button
                  onClick={() => setShowRemindModal(true)}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold bg-[#25D366] hover:bg-[#20b558] text-white transition-colors shadow-sm"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Remind — ₹{Number(member.balanceFees).toLocaleString('en-IN')} due
                </button>
              )}
            </div>
          </div>

          {/* Extra info: emergency contact / health notes */}
          {(member.emergencyContact || member.healthNotes) && (
            <div className="bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.15)]">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-amber-600">health_and_safety</span>
                <h3 className="font-h3 text-h3 text-on-surface">Health Info</h3>
              </div>
              <div className="flex flex-col gap-3">
                {member.emergencyContact && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Emergency Contact</span>
                    <span className="text-sm text-on-surface">{member.emergencyContact}</span>
                  </div>
                )}
                {member.healthNotes && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Health Notes</span>
                    <span className="text-sm text-on-surface">{member.healthNotes}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* QR Code */}
          <div className="bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.15)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">qr_code_2</span>
                <h3 className="font-h3 text-h3 text-on-surface">Member QR</h3>
              </div>
              <button onClick={() => setShowQR(v => !v)} className="text-xs text-primary font-medium hover:underline transition-colors">
                {showQR ? 'Hide' : 'Show QR'}
              </button>
            </div>
            {showQR ? (
              <div className="flex flex-col items-center gap-4">
                <div ref={qrRef} className="bg-white p-4 rounded-xl border-2 border-primary/20 shadow-inner">
                  <QRCodeSVG value={id} size={160} fgColor="#1e1b4b" bgColor="#ffffff" level="H" includeMargin={false} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-on-surface">{member.name}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">Scan at gym entrance to check in</p>
                </div>
                <div className="flex flex-col gap-2 w-full">
                  <button onClick={shareQR} className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white px-4 py-2.5 rounded-lg font-medium hover:brightness-95 transition-all text-sm shadow-sm">
                    <span className="material-symbols-outlined text-[18px]">share</span> Share on WhatsApp
                  </button>
                  <button onClick={downloadQR} className="w-full flex items-center justify-center gap-2 bg-primary/10 text-primary px-4 py-2.5 rounded-lg font-medium hover:bg-primary/20 transition-colors text-sm">
                    <span className="material-symbols-outlined text-[18px]">download</span> Download QR
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant">Click "Show QR" to view and print this member's entry QR code.</p>
            )}
          </div>
        </div>

        {/* ── Right Col ── */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Payment History */}
          <div className="bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.15)]">
            <h3 className="font-h3 text-h3 text-on-surface mb-6">Payment History</h3>
            {payments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl opacity-50 mb-2">receipt_long</span>
                <p>No payment history found yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {payments.map(payment => (
                  <div key={payment.id} className="flex items-center justify-between p-4 rounded-xl bg-surface-container border border-outline-variant/30 gap-3">
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <span className="font-bold text-on-surface truncate">{payment.planName}</span>
                      <span className="text-xs text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                        {payment.planActiveFrom ? `Active: ${payment.planActiveFrom}` : (payment.date ? new Date(payment.date).toLocaleDateString('en-IN') : '—')}
                        {payment.expiryDate && <span className="ml-1">→ {payment.expiryDate}</span>}
                      </span>
                      {payment.notes && <span className="text-xs text-on-surface-variant italic">{payment.notes}</span>}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="font-bold text-emerald-600 text-lg">₹{Number(payment.amount || 0).toLocaleString('en-IN')}</span>
                      <span className="text-xs bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full font-medium">{payment.paymentMode || 'Cash'}</span>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        onClick={() => openEditPayment(payment)}
                        title="Edit payment"
                        className="w-8 h-8 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button
                        onClick={() => setDeletingPaymentId(payment.id)}
                        title="Delete payment"
                        className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Measurements ── */}
          <div className="bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.15)]">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">monitor_weight</span>
                <h3 className="font-h3 text-h3 text-on-surface">Body Measurements</h3>
                {member.fitnessGoal && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{member.fitnessGoal}</span>}
              </div>
              <button onClick={() => { setEditingMeasurement(null); setShowMeasurementForm(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
                <span className="material-symbols-outlined text-[16px]">add</span>
                Add
              </button>
            </div>

            {/* Stats */}
            {measureStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Weight', value: measureStats.latestWeight != null ? `${measureStats.latestWeight} kg` : '—', color: 'text-on-surface' },
                  { label: 'Change', value: measureStats.weightChange != null ? `${parseFloat(measureStats.weightChange) > 0 ? '+' : ''}${measureStats.weightChange} kg` : '—', color: weightChangeColor },
                  { label: 'Body Fat', value: measureStats.latestBodyFat != null ? `${measureStats.latestBodyFat}%` : '—', color: 'text-on-surface' },
                  { label: 'BMI', value: measureStats.latestBmi != null ? measureStats.latestBmi : '—', color: 'text-on-surface' },
                ].map(s => (
                  <div key={s.label} className="bg-surface-container rounded-xl p-3 flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">{s.label}</span>
                    <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Table */}
            {measurements.length === 0 ? (
              <div className="flex flex-col items-center py-8 gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl opacity-40">monitor_weight</span>
                <p className="text-sm">No measurements recorded yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-outline-variant/20">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="bg-surface-container-low/60 border-b border-outline-variant/20">
                      {['Date','Weight','Body Fat','Chest','Waist','Hips','Arms','Thighs','BMI',''].map(h => (
                        <th key={h} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...measurements].reverse().map((m, idx) => (
                      <tr key={m.id} className="border-b border-outline-variant/10 hover:bg-surface-container/30 transition-colors">
                        <td className="px-3 py-2 font-medium text-on-surface whitespace-nowrap">
                          {fmtDate(m.date)}
                          {idx === 0 && <span className="ml-1.5 text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Latest</span>}
                        </td>
                        <td className="px-3 py-2 font-semibold text-on-surface">{fmtVal(m.weight)}{m.weight ? ' kg' : ''}</td>
                        <td className="px-3 py-2 text-on-surface-variant">{fmtVal(m.bodyFat)}{m.bodyFat ? '%' : ''}</td>
                        <td className="px-3 py-2 text-on-surface-variant">{fmtVal(m.chest)}</td>
                        <td className="px-3 py-2 text-on-surface-variant">{fmtVal(m.waist)}</td>
                        <td className="px-3 py-2 text-on-surface-variant">{fmtVal(m.hips)}</td>
                        <td className="px-3 py-2 text-on-surface-variant">{fmtVal(m.arms)}</td>
                        <td className="px-3 py-2 text-on-surface-variant">{fmtVal(m.thighs)}</td>
                        <td className="px-3 py-2 text-on-surface-variant">{fmtVal(m.bmi)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setEditingMeasurement(m); setShowMeasurementForm(true); }}
                              className="w-7 h-7 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors">
                              <span className="material-symbols-outlined text-[14px]">edit</span>
                            </button>
                            <button onClick={() => handleDeleteMeasure(m.id)}
                              className="w-7 h-7 rounded-lg hover:bg-rose-50 flex items-center justify-center text-on-surface-variant hover:text-rose-500 transition-colors">
                              <span className="material-symbols-outlined text-[14px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Attendance */}
          <div className="bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.15)]">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_month</span>
                <h3 className="font-h3 text-h3 text-on-surface">Attendance</h3>
              </div>
              <div className="flex gap-1 bg-surface-container rounded-lg p-0.5">
                <button onClick={() => setAttendanceTab('calendar')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${attendanceTab === 'calendar' ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant'}`}>
                  <span className="material-symbols-outlined text-[14px]">calendar_view_month</span> Calendar
                </button>
                <button onClick={() => setAttendanceTab('list')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${attendanceTab === 'list' ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant'}`}>
                  <span className="material-symbols-outlined text-[14px]">list</span> List
                </button>
              </div>
            </div>

            {attendance.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl opacity-50 mb-2">event_busy</span>
                <p>No attendance records found.</p>
              </div>
            ) : attendanceTab === 'calendar' ? (
              <AttendanceCalendar attendance={attendance} />
            ) : (
              <div className="flex flex-col gap-2 max-h-75 overflow-y-auto pr-2 custom-scrollbar">
                {attendance.map(record => (
                  <div key={record.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-container border border-outline-variant/30">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>how_to_reg</span>
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-medium text-on-surface text-sm">
                        {new Date(record.checkInTime || record.timestamp || record.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        {record.checkInTime || record.timestamp
                          ? new Date(record.checkInTime || record.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                          : record.date}
                        {record.checkOutTime && ` → ${new Date(record.checkOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}${record.duration ? ` (${record.duration} min)` : ''}`}
                      </span>
                    </div>
                    <button
                      onClick={() => setDeletingAttendanceId(record.id)}
                      title="Delete record"
                      className="w-7 h-7 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition-colors shrink-0"
                    >
                      <span className="material-symbols-outlined text-[15px]">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Edit Payment Modal ── */}
      {editingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/20">
              <h2 className="text-xl font-bold text-on-surface">Edit Payment</h2>
              <button onClick={() => setEditingPayment(null)} className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <form onSubmit={handleSavePayment} className="p-6 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-on-surface">Amount Paid (₹)</label>
                  <input type="number" min="0" value={paymentEditForm.amount} onChange={e => setPaymentEditForm(p => ({ ...p, amount: e.target.value }))}
                    className="px-3 py-2.5 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface focus:outline-none focus:border-primary text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-on-surface">Payment Mode</label>
                  <select value={paymentEditForm.paymentMode} onChange={e => setPaymentEditForm(p => ({ ...p, paymentMode: e.target.value }))}
                    className="px-3 py-2.5 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface focus:outline-none focus:border-primary text-sm appearance-none">
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-on-surface">Total Fees (₹)</label>
                  <input type="number" min="0" value={paymentEditForm.totalFees} onChange={e => setPaymentEditForm(p => ({ ...p, totalFees: e.target.value }))}
                    className="px-3 py-2.5 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface focus:outline-none focus:border-primary text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-on-surface">Balance (₹)</label>
                  <input type="number" min="0" value={paymentEditForm.balanceFees} onChange={e => setPaymentEditForm(p => ({ ...p, balanceFees: e.target.value }))}
                    className="px-3 py-2.5 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface focus:outline-none focus:border-primary text-sm" />
                </div>
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="text-sm font-medium text-on-surface">Plan Name</label>
                  <input value={paymentEditForm.planName} onChange={e => setPaymentEditForm(p => ({ ...p, planName: e.target.value }))}
                    className="px-3 py-2.5 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface focus:outline-none focus:border-primary text-sm" />
                </div>
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="text-sm font-medium text-on-surface">Payment Date</label>
                  <input type="date" value={paymentEditForm.date} onChange={e => setPaymentEditForm(p => ({ ...p, date: e.target.value }))}
                    className="px-3 py-2.5 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface focus:outline-none focus:border-primary text-sm" />
                </div>
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="text-sm font-medium text-on-surface">Notes (optional)</label>
                  <input value={paymentEditForm.notes} onChange={e => setPaymentEditForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Any remarks..."
                    className="px-3 py-2.5 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface focus:outline-none focus:border-primary text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditingPayment(null)} className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container transition-colors text-sm">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-primary text-on-primary rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm text-sm">Save Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm: Delete Member ── */}
      {showDeleteMember && (
        <ConfirmModal
          title="Delete Member?"
          message={`This will permanently delete ${member.name} along with all their payment and attendance records. This cannot be undone.`}
          confirmLabel="Yes, Delete"
          onConfirm={handleDeleteMember}
          onCancel={() => setShowDeleteMember(false)}
        />
      )}

      {/* ── Confirm: Delete Payment ── */}
      {deletingPaymentId && (
        <ConfirmModal
          title="Delete Payment Record?"
          message="This payment record will be permanently deleted."
          confirmLabel="Delete"
          onConfirm={handleDeletePayment}
          onCancel={() => setDeletingPaymentId(null)}
        />
      )}

      {/* ── Confirm: Delete Attendance ── */}
      {deletingAttendanceId && (
        <ConfirmModal
          title="Delete Attendance Record?"
          message="This check-in record will be permanently deleted."
          confirmLabel="Delete"
          onConfirm={handleDeleteAttendance}
          onCancel={() => setDeletingAttendanceId(null)}
        />
      )}

      {/* ── Freeze Modal ── */}
      {showFreezeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-blue-600">ac_unit</span>
              </div>
              <div>
                <p className="font-bold text-on-surface">Freeze Membership</p>
                <p className="text-sm text-on-surface-variant">{member.name}</p>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Resume Date</label>
              <input type="date" value={freezeDate} min={minFreezeDate}
                onChange={e => setFreezeDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary text-sm" />
              <p className="text-xs text-on-surface-variant">Membership will be paused and resumed on this date.</p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowFreezeModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors">Cancel</button>
              <button onClick={handleFreeze} disabled={!freezeDate || freezing}
                className="px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2">
                {freezing && <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>}
                Freeze
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Photo Lightbox ── */}
      {photoLightbox && member.photoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm cursor-pointer"
          onClick={() => setPhotoLightbox(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img src={member.photoUrl} alt={member.name}
              className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain"
              onClick={e => e.stopPropagation()} />
            <button
              onClick={() => setPhotoLightbox(false)}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-slate-900/70 flex items-center justify-center text-white hover:bg-slate-900 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
            <div className="text-center mt-3 text-white text-sm font-medium">{member.name}</div>
          </div>
        </div>
      )}

      {/* ── Measurement Form Modal ── */}
      {showMeasurementForm && (
        <MeasurementForm
          measurement={editingMeasurement}
          memberId={id}
          memberName={member.name}
          onClose={() => { setShowMeasurementForm(false); setEditingMeasurement(null); }}
          onSaved={handleMeasurementSaved}
        />
      )}

      {/* ── Remind Modal ── */}
      {showRemindModal && (
        <SendWhatsAppModal
          gymId={gymId}
          type="payment"
          recipients={[{ ...member, id }]}
          extra={{ amount: member.balanceFees }}
          recipientLabel={member.name}
          onClose={() => setShowRemindModal(false)}
        />
      )}
    </div>
  );
}
