import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { getTenantCollection, createTenantDocument } from '../../firebase/tenantDb';

const COLUMNS = [
  { icon: 'person',           label: 'Name',            keys: ['NAME', 'Name', 'Member Name', 'name'],                          required: true  },
  { icon: 'call',             label: 'Phone number',    keys: ['MOBILE NUMBER', 'Mobile Number', 'Phone', 'Mobile', 'phone'],   required: true  },
  { icon: 'calendar_today',   label: 'Date of joining', keys: ['ADMISSION DATE', 'Admission Date', 'Join Date', 'joinDate'],    required: false },
  { icon: 'cake',             label: 'Date of birth',   keys: ['Date of birth', 'DOB', 'dob', 'Birth Date'],                   required: false },
  { icon: 'wc',               label: 'Gender',          keys: ['Gender', 'GENDER', 'gender'],                                  required: false },
  { icon: 'loyalty',          label: 'Membership / Plan', keys: ['MEMBERSHIP', 'Membership', 'Plan', 'Plan Name', 'planName'], required: false },
  { icon: 'calendar_month',   label: 'Due / Expiry date', keys: ['DUE DATE', 'Due Date', 'Expiry Date', 'Expiry', 'expiryDate'], required: false },
  { icon: 'account_balance_wallet', label: 'Fees (Total / Paid / Balance)', keys: [], required: false },
];

function parseDate(val) {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 864e5));
    return d.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const parsed = new Date(s);
  if (!isNaN(parsed)) return parsed.toISOString().split('T')[0];
  return s;
}

function col(row, ...keys) {
  for (const k of keys) {
    for (const attempt of [k, k.toLowerCase(), k.toUpperCase()]) {
      if (row[attempt] !== undefined && row[attempt] !== '') return row[attempt];
    }
  }
  return '';
}

export default function BulkImportMembers() {
  const { gymId } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);

  const processFile = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (rows.length === 0) { toast.error('No data found in the file.'); return; }
        setPreview({ rows, fileName: file.name });
      } catch {
        toast.error('Could not read file. Use .xlsx, .xls, or .csv.');
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  const handleFileInput = (e) => {
    processFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    processFile(e.dataTransfer.files?.[0]);
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    let success = 0, failed = 0;

    // Fetch existing members to generate next member ID
    let maxNum = 0;
    try {
      const existing = await getTenantCollection(gymId, 'members');
      existing.forEach(m => {
        if (m.memberId?.startsWith('MEM')) {
          const n = parseInt(m.memberId.slice(3), 10);
          if (!isNaN(n) && n > maxNum) maxNum = n;
        }
      });
      if (maxNum === 0) maxNum = existing.length;
    } catch { /* proceed without memberId sequence */ }

    for (const row of preview.rows) {
      try {
        const name      = col(row, 'NAME', 'Name', 'Member Name', 'name');
        if (!name) { failed++; continue; }
        const phone     = String(col(row, 'MOBILE NUMBER', 'Mobile Number', 'Phone', 'Mobile', 'phone') || '');
        const admDate   = parseDate(col(row, 'ADMISSION DATE', 'Admission Date', 'Join Date', 'joinDate', 'Active From', 'Start Date'));
        const dueDate   = parseDate(col(row, 'DUE DATE', 'Due Date', 'Expiry Date', 'Expiry', 'expiryDate'));
        const dob       = parseDate(col(row, 'Date of birth', 'DOB', 'dob', 'Birth Date'));
        const gender    = col(row, 'Gender', 'GENDER', 'gender') || '';
        const membership = col(row, 'MEMBERSHIP', 'Membership', 'Plan', 'Plan Name', 'planName');
        const totalFees = Number(col(row, 'Total fees', 'Total Fees', 'TOTAL FEES', 'totalFees')) || 0;
        const paidFees  = Number(col(row, 'Fees paid', 'Fees Paid', 'FEES PAID', 'paidFees')) || 0;
        const balFees   = Number(col(row, 'Balance fees', 'Balance Fees', 'BALANCE FEES', 'balanceFees')) || 0;
        const payMode   = col(row, 'Payment mode', 'Payment Mode', 'PAYMENT MODE', 'paymentMode') || 'Cash';
        const statusRaw = col(row, 'STATUS', 'Status', 'status');
        const email     = col(row, 'Email', 'EMAIL', 'email');
        const planName  = membership ? `Gym - ${String(membership).trim()}` : '';
        const effectiveStatus = dueDate && new Date(dueDate) < new Date()
          ? 'Expired' : (statusRaw ? String(statusRaw).trim() : 'Active');

        maxNum++;
        const memberId = `MEM${String(maxNum).padStart(3, '0')}`;

        await createTenantDocument(gymId, 'members', {
          memberId,
          name: String(name).trim(),
          phone: phone.trim(),
          email: String(email).trim(),
          birthday: dob,
          gender: String(gender).trim(),
          planName,
          joinDate: admDate,
          planActiveFrom: admDate,
          expiryDate: dueDate,
          totalFees,
          paidFees,
          balanceFees: balFees,
          paymentMode: String(payMode).trim(),
          status: effectiveStatus,
          importedAt: new Date().toISOString(),
        });
        success++;
      } catch {
        failed++;
      }
    }

    setImporting(false);
    toast.success(`Imported ${success} member${success !== 1 ? 's' : ''}${failed > 0 ? ` (${failed} skipped)` : ''}!`);
    navigate('/members');
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/members')}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-surface-container text-on-surface-variant transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div>
          <h1 className="font-h1 text-h1 text-on-surface">Bulk Import Members</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">Import your gym's member list from a spreadsheet.</p>
        </div>
      </div>

      {!preview ? (
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 py-10 transition-colors cursor-pointer ${
              dragging ? 'border-primary bg-primary/5' : 'border-outline-variant/50 hover:border-primary/40 hover:bg-surface-container/40'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[28px] text-blue-600">table_view</span>
            </div>
            <p className="text-sm text-on-surface-variant font-medium">Drag &amp; drop .xlsx or .csv here</p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant/50 text-sm text-on-surface font-medium hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">upload</span>
              Choose file
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileInput} />
          </div>

          {/* Columns expected */}
          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Columns Expected</p>
            <div className="flex flex-col divide-y divide-outline-variant/20 rounded-xl overflow-hidden border border-outline-variant/20">
              {COLUMNS.map((c) => (
                <div key={c.label} className={`flex items-center gap-3 px-4 py-3 ${c.required ? 'bg-blue-50/60' : 'bg-surface-container-lowest'}`}>
                  <span className={`material-symbols-outlined text-[18px] ${c.required ? 'text-blue-500' : 'text-on-surface-variant'}`}>
                    {c.icon}
                  </span>
                  <span className={`flex-1 text-sm font-medium ${c.required ? 'text-blue-900' : 'text-on-surface'}`}>{c.label}</span>
                  {c.required
                    ? <span className="text-[11px] font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Required</span>
                    : <span className="text-[11px] text-on-surface-variant">Optional</span>
                  }
                </div>
              ))}
            </div>
          </div>

          {/* Paid users note */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <span className="material-symbols-outlined text-amber-500 text-[18px] mt-0.5">workspace_premium</span>
            <p className="text-sm text-amber-800 font-medium">Bulk import is available for <strong>paid plan</strong> subscribers only.</p>
          </div>
        </div>
      ) : (
        /* Preview table */
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm flex flex-col max-h-[70vh]">
          <div className="flex items-center justify-between p-5 border-b border-outline-variant/20">
            <div>
              <h2 className="font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-500 text-[20px]">upload_file</span>
                Import Preview
              </h2>
              <p className="text-sm text-on-surface-variant mt-0.5">{preview.fileName} — {preview.rows.length} records found</p>
            </div>
            <button onClick={() => setPreview(null)} className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div className="overflow-auto flex-1 p-4">
            <p className="text-sm text-on-surface-variant mb-3">
              Review the records below before importing. Existing members will not be deduplicated automatically.
            </p>
            <div className="overflow-x-auto rounded-xl border border-outline-variant/20">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-container-low/60">
                  <tr>
                    {['Name', 'Phone', 'Plan', 'Join Date', 'Expiry', 'DOB', 'Gender', 'Status'].map(h => (
                      <th key={h} className="p-3 font-semibold text-on-surface-variant text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 15).map((row, i) => {
                    const name    = col(row, 'NAME', 'Name', 'Member Name') || '';
                    const phone   = col(row, 'MOBILE NUMBER', 'Mobile Number', 'Phone', 'Mobile') || '';
                    const plan    = col(row, 'MEMBERSHIP', 'Membership', 'Plan', 'Plan Name') || '';
                    const join    = parseDate(col(row, 'ADMISSION DATE', 'Admission Date', 'Join Date'));
                    const expiry  = parseDate(col(row, 'DUE DATE', 'Due Date', 'Expiry Date', 'Expiry'));
                    const dob     = parseDate(col(row, 'Date of birth', 'DOB', 'dob'));
                    const gender  = col(row, 'Gender', 'GENDER', 'gender') || '';
                    const status  = col(row, 'STATUS', 'Status') || 'Active';
                    return (
                      <tr key={i} className="border-t border-outline-variant/10 hover:bg-surface-container/30">
                        <td className="p-3 font-medium text-on-surface">{name || <em className="text-rose-400">Missing</em>}</td>
                        <td className="p-3 text-on-surface-variant">{String(phone)}</td>
                        <td className="p-3 text-on-surface-variant">{String(plan)}</td>
                        <td className="p-3 text-on-surface-variant">{join}</td>
                        <td className="p-3 text-on-surface-variant">{expiry}</td>
                        <td className="p-3 text-on-surface-variant">{dob}</td>
                        <td className="p-3 text-on-surface-variant">{String(gender)}</td>
                        <td className="p-3 text-on-surface-variant">{String(status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {preview.rows.length > 15 && (
              <p className="text-xs text-on-surface-variant mt-2 text-center">Showing 15 of {preview.rows.length} records.</p>
            )}
          </div>

          <div className="flex justify-end gap-3 p-5 border-t border-outline-variant/20">
            <button onClick={() => setPreview(null)} className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container transition-colors">
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70"
            >
              {importing
                ? <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> Importing...</>
                : <><span className="material-symbols-outlined text-[16px]">upload</span> Import {preview.rows.length} Members</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
