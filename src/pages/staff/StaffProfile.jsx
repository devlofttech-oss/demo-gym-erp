import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getDocument, getCollection, updateDocument } from '../../firebase/db';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import PhotoUpload from '../../components/ui/PhotoUpload';

function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function formatTime(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
}

const ROLES = ['Trainer', 'Staff', 'Manager', 'Receptionist'];

export default function StaffProfile() {
  const { id } = useParams();
  const [member, setMember] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [doc, att] = await Promise.all([
        getDocument('staff', id),
        getCollection('staffAttendance', [{ field: 'staffId', op: '==', value: id }]),
      ]);
      setMember(doc);
      setAttendance(att.sort((a, b) => new Date(b.checkInTime) - new Date(a.checkInTime)));
    } catch { toast.error('Failed to load profile'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDocument('staff', id, { ...editForm, salary: Number(editForm.salary) || 0 });
      toast.success('Profile updated!');
      setIsEditing(false);
      fetchData();
    } catch { toast.error('Update failed'); }
    finally { setSaving(false); }
  };

  const handlePhotoUpload = async (url) => {
    await updateDocument('staff', id, { photoUrl: url });
    toast.success('Photo updated!');
    fetchData();
  };

  const handlePhotoDelete = async () => {
    await updateDocument('staff', id, { photoUrl: null });
    toast.success('Photo removed!');
    fetchData();
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-100 text-on-surface-variant">
      <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
    </div>
  );

  if (!member) return (
    <div className="flex flex-col items-center justify-center min-h-100 gap-4 text-on-surface-variant">
      <span className="material-symbols-outlined text-5xl opacity-40">badge</span>
      <p>Staff member not found.</p>
      <Link to="/staff" className="text-primary hover:underline text-sm">Back to Staff</Link>
    </div>
  );

  const roleBadgeColor = {
    Trainer: 'bg-violet-100 text-violet-700', Staff: 'bg-blue-100 text-blue-700',
    Manager: 'bg-amber-100 text-amber-700', Receptionist: 'bg-emerald-100 text-emerald-700',
  };

  const todayCount = attendance.filter(a => new Date(a.checkInTime).toDateString() === new Date().toDateString()).length;
  const thisMonthCount = attendance.filter(a => {
    const d = new Date(a.checkInTime); const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-4">
        <Link to="/staff" className="w-10 h-10 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center transition-colors text-on-surface">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <h1 className="font-h2 text-h2 text-on-surface">Staff Profile</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.1)] flex flex-col items-center gap-4 text-center">
          <div className="relative">
            {member.photoUrl
              ? <img src={member.photoUrl} alt={member.name} className="w-24 h-24 rounded-full object-cover border-4 border-surface-container" />
              : <div className="w-24 h-24 rounded-full bg-primary-container text-primary flex items-center justify-center text-3xl font-bold border-4 border-surface-container">{member.name?.charAt(0)}</div>
            }
          </div>
          <PhotoUpload compact hasPhoto={!!member.photoUrl} onUpload={handlePhotoUpload} onDelete={handlePhotoDelete} />
          <div>
            <h2 className="font-h2 text-h2 text-on-surface">{member.name}</h2>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full mt-1 inline-block ${roleBadgeColor[member.role] || 'bg-slate-100 text-slate-600'}`}>{member.role}</span>
          </div>
          <div className="w-full flex flex-col gap-2 text-left">
            {[
              { icon: 'call', label: 'Phone', value: member.phone },
              { icon: 'mail', label: 'Email', value: member.email || '—' },
              { icon: 'location_on', label: 'Address', value: member.address || '—' },
              { icon: 'calendar_today', label: 'Joined', value: formatDate(member.joiningDate) },
              { icon: 'payments', label: 'Salary', value: member.salary ? `₹${Number(member.salary).toLocaleString('en-IN')}` : '—' },
            ].map(({ icon, label, value }) => (
              <div key={label} className="flex items-start gap-3 p-2.5 rounded-xl bg-surface-container border border-outline-variant/20">
                <span className="material-symbols-outlined text-primary text-[18px] mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                <div>
                  <div className="text-xs text-on-surface-variant">{label}</div>
                  <div className="text-sm font-medium text-on-surface">{value}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 w-full">
            <button onClick={() => { setEditForm({ name: member.name, role: member.role, phone: member.phone, email: member.email || '', address: member.address || '', joiningDate: member.joiningDate || '', salary: member.salary || '' }); setIsEditing(true); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface transition-colors">
              <span className="material-symbols-outlined text-[18px]">edit</span> Edit
            </button>
            <button onClick={() => setShowQR(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-xl text-sm font-medium text-primary transition-colors">
              <span className="material-symbols-outlined text-[18px]">qr_code</span> QR Code
            </button>
          </div>
        </div>

        {/* Attendance Stats + History */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Days', value: attendance.length, icon: 'calendar_month', color: 'text-primary' },
              { label: 'This Month', value: thisMonthCount, icon: 'today', color: 'text-secondary' },
              { label: 'Today', value: todayCount, icon: 'login', color: 'text-emerald-600' },
            ].map(({ label, value, icon, color }) => (
              <div key={label} className="bg-surface-container-lowest p-4 rounded-xl shadow-sm border border-outline-variant/20 flex flex-col gap-2">
                <span className={`material-symbols-outlined ${color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                <div className="text-2xl font-bold text-on-surface">{value}</div>
                <div className="text-xs text-on-surface-variant">{label}</div>
              </div>
            ))}
          </div>

          {/* Attendance Log */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.1)] overflow-hidden flex-1">
            <div className="p-4 border-b border-outline-variant/20">
              <h3 className="font-h3 text-h3 text-on-surface">Attendance History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-outline-variant/20 bg-surface-container-low/50">
                    <th className="p-3 text-xs font-semibold text-on-surface-variant uppercase">Date</th>
                    <th className="p-3 text-xs font-semibold text-on-surface-variant uppercase">Check In</th>
                    <th className="p-3 text-xs font-semibold text-on-surface-variant uppercase">Check Out</th>
                    <th className="p-3 text-xs font-semibold text-on-surface-variant uppercase">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.length === 0 ? (
                    <tr><td colSpan="4" className="p-8 text-center text-on-surface-variant text-sm opacity-60">No attendance records yet.</td></tr>
                  ) : attendance.slice(0, 30).map(a => (
                    <tr key={a.id} className="border-b border-outline-variant/10 hover:bg-surface-container/30">
                      <td className="p-3 text-sm text-on-surface">{formatDate(a.date || a.checkInTime)}</td>
                      <td className="p-3 text-sm text-emerald-600 font-medium">{formatTime(a.checkInTime)}</td>
                      <td className="p-3 text-sm text-rose-500">{a.checkOutTime ? formatTime(a.checkOutTime) : <span className="text-on-surface-variant italic">Active</span>}</td>
                      <td className="p-3 text-sm text-on-surface-variant">{a.duration ? `${a.duration} min` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-outline-variant/20">
              <h2 className="font-bold text-on-surface text-lg">Edit Staff Member</h2>
              <button onClick={() => setIsEditing(false)} className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <form onSubmit={handleSave} className="flex flex-col gap-4 p-5">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Full Name', key: 'name', type: 'text', colSpan: true },
                  { label: 'Phone', key: 'phone', type: 'text' },
                  { label: 'Email', key: 'email', type: 'email' },
                  { label: 'Joining Date', key: 'joiningDate', type: 'date' },
                  { label: 'Salary (₹)', key: 'salary', type: 'number' },
                  { label: 'Address', key: 'address', type: 'text', colSpan: true },
                ].map(({ label, key, type, colSpan }) => (
                  <div key={key} className={`flex flex-col gap-1.5 ${colSpan ? 'col-span-2' : ''}`}>
                    <label className="text-sm font-medium text-on-surface-variant">{label}</label>
                    <input type={type} value={editForm[key] || ''} onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary" />
                  </div>
                ))}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-on-surface-variant">Role</label>
                  <select value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary appearance-none">
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/20">
                <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container">Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-primary text-on-primary rounded-lg font-medium hover:bg-primary/90 shadow-sm flex items-center gap-2 disabled:opacity-70">
                  {saving ? <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> Saving...</> : <><span className="material-symbols-outlined text-[16px]">save</span> Save</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center gap-4">
            <h2 className="font-bold text-on-surface text-lg">Staff QR Code</h2>
            <p className="text-sm text-on-surface-variant text-center">Use this QR for attendance check-in/out</p>
            <div className="p-4 bg-white rounded-2xl shadow-sm">
              <QRCodeSVG value={member.qrId || member.id} size={180} />
            </div>
            <p className="text-xs text-on-surface-variant font-mono">{member.name}</p>
            <button onClick={() => setShowQR(false)} className="w-full py-2.5 rounded-xl bg-surface-container text-on-surface font-medium hover:bg-surface-container-high transition-colors">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
