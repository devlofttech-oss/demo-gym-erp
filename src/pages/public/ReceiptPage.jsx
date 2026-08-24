import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getDocument } from '../../firebase/db';
import kilosLogo from '../../assets/kilos_logo.png';

function fmt(n) { return Number(n || 0).toLocaleString('en-IN'); }

function Row({ label, value, green, red }) {
  return (
    <div className="flex justify-between items-baseline py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-400 font-medium">{label}</span>
      <span className={`text-sm font-bold ${green ? 'text-emerald-600' : red ? 'text-rose-600' : 'text-gray-900'}`}>{value}</span>
    </div>
  );
}

export default function ReceiptPage() {
  const { receiptId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getDocument('receipts', receiptId)
      .then(doc => { if (doc) setData(doc); else setNotFound(true); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [receiptId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50 p-6 text-center">
      <div className="text-4xl">🧾</div>
      <h2 className="text-lg font-bold text-gray-800">Receipt not found</h2>
      <p className="text-sm text-gray-500">This receipt link may have expired or is invalid.</p>
    </div>
  );

  const bal = Number(data.balanceFees || 0);
  const gstAmt = data.gstPercent > 0 ? Number(data.totalFees || 0) * data.gstPercent / 100 : 0;
  const generated = data.generatedAt
    ? new Date(data.generatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-start justify-center p-4 pt-8">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-indigo-600 px-6 py-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0 overflow-hidden p-1">
            {data.gymLogoUrl
              ? <img src={data.gymLogoUrl} alt={data.gymName} className="w-full h-full object-contain" />
              : <img src={kilosLogo} alt="Kilos" className="w-full h-full object-contain" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-base truncate">{data.gymName || 'Kilos'}</div>
            {(data.gymAddress || data.gymPhone) && (
              <div className="text-indigo-200 text-xs mt-0.5 truncate">
                {[data.gymAddress, data.gymPhone].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] text-indigo-300 font-semibold uppercase tracking-wider">Receipt</div>
            <div className="text-indigo-200 text-xs mt-0.5">{generated}</div>
          </div>
        </div>

        <div className="px-5 py-4 flex flex-col gap-5">

          {/* Member */}
          <div>
            <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-2">Member Details</div>
            <Row label="Name"  value={data.memberName  || '—'} />
            <Row label="Phone" value={data.memberPhone || '—'} />
            {data.membershipId && <Row label="Membership ID" value={data.membershipId} />}
          </div>

          {/* Plan */}
          <div>
            <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-2">Plan Details</div>
            <Row label="Plan"        value={data.planName      || '—'} />
            <Row label="Active From" value={data.planActiveFrom || '—'} />
            <Row label="Valid Until" value={data.expiryDate     || '—'} />
          </div>

          {/* Payment */}
          <div>
            <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-2">Payment Summary</div>
            <Row label="Total Fees" value={`₹${fmt(data.totalFees)}`} />
            {gstAmt > 0 && <Row label={`GST (${data.gstPercent}%)`} value={`₹${fmt(gstAmt)}`} />}
            <Row label="Amount Paid"  value={`₹${fmt(data.paidFees)}`}  green />
            <div className={bal > 0 ? 'rounded-lg px-2 -mx-2 bg-rose-50' : ''}>
              <Row label="Balance Due" value={`₹${fmt(bal)}`} red={bal > 0} green={bal === 0} />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="text-center px-5 pb-6 pt-1 border-t border-gray-100">
          <p className="text-xs text-gray-400">Thank you for choosing <span className="font-semibold text-gray-500">{data.gymName || 'us'}</span>! 💪</p>
          <p className="text-[10px] text-gray-300 mt-1">Powered by Kilos · {generated}</p>
        </div>

      </div>
    </div>
  );
}
