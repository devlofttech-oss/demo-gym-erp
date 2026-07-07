import { useState, useEffect, useRef } from 'react';
import { getTenantCollection } from '../../firebase/tenantDb';
import { useAuth } from '../../context/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

// ── Date helpers ──────────────────────────────────────────────────
const toYYYYMM = (d) => d.toISOString().slice(0, 7);

const monthLabel = (yyyymm) => {
  const [y, m] = yyyymm.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
};

const daysInMonth = (yyyymm) => {
  const [y, m] = yyyymm.split('-');
  return new Date(Number(y), Number(m), 0).getDate();
};

const startOf = (yyyymm) => `${yyyymm}-01`;
const endOf   = (yyyymm) => `${yyyymm}-${String(daysInMonth(yyyymm)).padStart(2, '0')}`;

const prevMonth = (yyyymm) => {
  const [y, m] = yyyymm.split('-').map(Number);
  return toYYYYMM(new Date(y, m - 2, 1));
};

const toDateStr = (val) => {
  if (!val) return '';
  if (typeof val === 'string') return val.slice(0, 10);
  if (val.seconds) return new Date(val.seconds * 1000).toISOString().slice(0, 10);
  return new Date(val).toISOString().slice(0, 10);
};

const filterByMonth = (items, dateField, month) => {
  const s = startOf(month);
  const e = endOf(month);
  return items.filter((item) => {
    const d = toDateStr(item[dateField]);
    return d >= s && d <= e;
  });
};

const pct = (curr, prev) => {
  if (!prev) return null;
  return (((curr - prev) / prev) * 100).toFixed(1);
};

// ── Sub-components ────────────────────────────────────────────────
function StatCard({ icon, iconColor = 'text-primary', label, value, sub, trend }) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-6 flex flex-col gap-3 shadow-sm border border-outline-variant/20">
      <div className="flex items-center gap-2 text-on-surface-variant">
        <span
          className={`material-symbols-outlined text-[22px] ${iconColor}`}
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {icon}
        </span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="text-3xl font-extrabold text-on-surface">{value}</div>
      {sub && (
        <div
          className={`text-xs font-semibold flex items-center gap-1 ${
            trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-on-surface-variant'
          }`}
        >
          {trend === 'up' && <span className="material-symbols-outlined text-[14px]">trending_up</span>}
          {trend === 'down' && <span className="material-symbols-outlined text-[14px]">trending_down</span>}
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function MonthlyReport() {
  const { gymId } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(toYYYYMM(new Date()));
  const [members, setMembers]   = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef(null);

  useEffect(() => {
    if (!gymId) return;
    setLoading(true);
    Promise.all([
      getTenantCollection(gymId, 'members'),
      getTenantCollection(gymId, 'payments'),
    ]).then(([m, p]) => {
      setMembers(m);
      setPayments(p);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [gymId]);

  const prev = prevMonth(selectedMonth);

  // Current month
  const currNewMembers = filterByMonth(members, 'joinDate', selectedMonth);
  const currPayments   = filterByMonth(payments, 'date', selectedMonth);
  const currRenewals   = currPayments.filter((p) => p.type === 'renewal');
  const currRevenue    = currPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  // Previous month
  const prevNewMembers = filterByMonth(members, 'joinDate', prev);
  const prevPayments   = filterByMonth(payments, 'date', prev);
  const prevRenewals   = prevPayments.filter((p) => p.type === 'renewal');
  const prevRevenue    = prevPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const revChange    = pct(currRevenue, prevRevenue);
  const memberChange = pct(currNewMembers.length, prevNewMembers.length);

  const chartData = [
    {
      name: monthLabel(prev).split(' ')[0],
      Revenue: prevRevenue,
      'New Members': prevNewMembers.length,
      Renewals: prevRenewals.length,
    },
    {
      name: monthLabel(selectedMonth).split(' ')[0],
      Revenue: currRevenue,
      'New Members': currNewMembers.length,
      Renewals: currRenewals.length,
    },
  ];

  // ── Exports ───────────────────────────────────────────────────
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const el = reportRef.current;
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData  = canvas.toDataURL('image/png');
      const pdf      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW    = pdf.internal.pageSize.getWidth();
      const pageH    = pdf.internal.pageSize.getHeight();
      const margin   = 10;
      const imgW     = pageW - margin * 2;
      const imgH     = (canvas.height * imgW) / canvas.width;
      const pagesNeeded = Math.ceil(imgH / (pageH - margin * 2));

      for (let i = 0; i < pagesNeeded; i++) {
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, margin - i * (pageH - margin * 2), imgW, imgH);
      }
      pdf.save(`Monthly-Report-${selectedMonth}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Summary
    const summaryRows = [
      ['GYM-OS — Monthly Business Report'],
      [`Month: ${monthLabel(selectedMonth)}`],
      [],
      ['Metric', monthLabel(selectedMonth), monthLabel(prev), 'Change'],
      ['New Admissions', currNewMembers.length, prevNewMembers.length, memberChange ? `${memberChange}%` : 'N/A'],
      ['Renewals', currRenewals.length, prevRenewals.length, ''],
      ['Total Revenue (₹)', currRevenue, prevRevenue, revChange ? `${revChange}%` : 'N/A'],
      ['Total Payments', currPayments.length, prevPayments.length, ''],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');

    // New Members
    if (currNewMembers.length > 0) {
      const rows = [
        ['Name', 'Phone', 'Join Date', 'Category', 'Status'],
        ...currNewMembers.map((m) => [m.name, m.phone, m.joinDate, m.category || '', m.status]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'New Members');
    }

    // Payments
    if (currPayments.length > 0) {
      const rows = [
        ['Member', 'Date', 'Amount (₹)', 'Type', 'Mode'],
        ...currPayments.map((p) => [p.memberName || '', p.date || '', p.amount || 0, p.type || 'new', p.mode || '']),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Payments');
    }

    XLSX.writeFile(wb, `Monthly-Report-${selectedMonth}.xlsx`);
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-h1 text-h1 text-on-surface">Monthly Business Report</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Admissions, revenue, and month-on-month comparison.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="month"
            value={selectedMonth}
            max={toYYYYMM(new Date())}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary transition-colors font-medium"
          />
          <button
            onClick={handleExportPDF}
            disabled={exporting || loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-60 shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            {exporting ? 'Exporting…' : 'Export PDF'}
          </button>
          <button
            onClick={handleExportExcel}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-60 shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">table_view</span>
            Export Excel
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
        </div>
      ) : (
        <div ref={reportRef} className="flex flex-col gap-6 bg-surface rounded-2xl">
          {/* Month banner */}
          <div className="bg-primary/10 dark:bg-primary/20 rounded-2xl px-6 py-3 flex items-center gap-3">
            <span
              className="material-symbols-outlined text-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              calendar_month
            </span>
            <span className="font-bold text-on-surface">{monthLabel(selectedMonth)}</span>
            <span className="text-on-surface-variant text-sm">vs {monthLabel(prev)}</span>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon="person_add"
              iconColor="text-emerald-600"
              label="New Admissions"
              value={currNewMembers.length}
              sub={
                memberChange !== null
                  ? `${Number(memberChange) >= 0 ? '+' : ''}${memberChange}% vs last month`
                  : `${prevNewMembers.length} last month`
              }
              trend={memberChange !== null ? (Number(memberChange) >= 0 ? 'up' : 'down') : null}
            />
            <StatCard
              icon="autorenew"
              iconColor="text-blue-600"
              label="Renewals"
              value={currRenewals.length}
              sub={`${prevRenewals.length} last month`}
              trend={null}
            />
            <StatCard
              icon="currency_rupee"
              iconColor="text-primary"
              label="Revenue Collected"
              value={`₹${currRevenue.toLocaleString('en-IN')}`}
              sub={
                revChange !== null
                  ? `${Number(revChange) >= 0 ? '+' : ''}${revChange}% vs last month`
                  : `₹${prevRevenue.toLocaleString('en-IN')} last month`
              }
              trend={revChange !== null ? (Number(revChange) >= 0 ? 'up' : 'down') : null}
            />
            <StatCard
              icon="receipt_long"
              iconColor="text-amber-600"
              label="Total Payments"
              value={currPayments.length}
              sub={`${prevPayments.length} last month`}
              trend={null}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/20">
              <h3 className="font-semibold text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>bar_chart</span>
                Revenue Comparison
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barSize={48}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`} />
                  <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']} />
                  <Bar dataKey="Revenue" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/20">
              <h3 className="font-semibold text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
                Admissions vs Renewals
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barSize={30}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="New Members" fill="#10b981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Renewals"    fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* New members table */}
          {currNewMembers.length > 0 && (
            <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/20">
              <h3 className="font-semibold text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>person_add</span>
                New Admissions ({currNewMembers.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-outline-variant/30">
                      {['Name', 'Phone', 'Join Date', 'Category', 'Status'].map((h) => (
                        <th key={h} className="text-left py-2 pr-4 font-semibold text-on-surface-variant">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currNewMembers.map((m) => (
                      <tr key={m.id} className="border-b border-outline-variant/10">
                        <td className="py-2.5 pr-4 font-medium text-on-surface">{m.name}</td>
                        <td className="py-2.5 pr-4 text-on-surface-variant">{m.phone}</td>
                        <td className="py-2.5 pr-4 text-on-surface-variant">{m.joinDate}</td>
                        <td className="py-2.5 pr-4 text-on-surface-variant">{m.category || '—'}</td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Payments table */}
          {currPayments.length > 0 && (
            <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/20">
              <h3 className="font-semibold text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
                Payment Transactions ({currPayments.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-outline-variant/30">
                      {['Member', 'Date', 'Amount', 'Type', 'Mode'].map((h) => (
                        <th key={h} className="text-left py-2 pr-4 font-semibold text-on-surface-variant">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currPayments.map((p) => (
                      <tr key={p.id} className="border-b border-outline-variant/10">
                        <td className="py-2.5 pr-4 font-medium text-on-surface">{p.memberName || '—'}</td>
                        <td className="py-2.5 pr-4 text-on-surface-variant">{p.date || '—'}</td>
                        <td className="py-2.5 pr-4 font-semibold text-emerald-600">
                          ₹{Number(p.amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.type === 'renewal' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {p.type || 'new'}
                          </span>
                        </td>
                        <td className="py-2.5 text-on-surface-variant capitalize">{p.mode || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-outline-variant/40">
                      <td colSpan={2} className="py-3 font-bold text-on-surface">Total</td>
                      <td className="py-3 font-extrabold text-emerald-600">
                        ₹{currRevenue.toLocaleString('en-IN')}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {currPayments.length === 0 && currNewMembers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-on-surface-variant opacity-60">
              <span className="material-symbols-outlined text-5xl mb-3">bar_chart</span>
              <p className="font-medium">No data for {monthLabel(selectedMonth)}</p>
              <p className="text-sm mt-1">Admissions and payments will appear here once recorded.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
