import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { setDocument, deleteDocument as deleteDocumentFlat } from '../../firebase/db';
import { getTenantCollection, createTenantDocument, updateTenantDocument, deleteTenantDocument } from '../../firebase/tenantDb';
import { useAuth } from '../../context/AuthContext';
import { firebaseConfig } from '../../firebase/config';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import toast from 'react-hot-toast';

const ROLES = ['Trainer', 'Staff', 'Manager', 'Receptionist'];
const EMPTY_FORM = {
  name: '', role: 'Trainer', phone: '', email: '',
  address: '', joiningDate: new Date().toISOString().split('T')[0],
  salary: '', photoUrl: '',
};

function generateQrId() {
  return 'staff_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function StaffModal({ initial, onSave, onClose, gymId }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [createLogin, setCreateLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState(initial?.email || '');
  const [loginPassword, setLoginPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handle = (e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    if (e.target.name === 'email' && !initial) setLoginEmail(e.target.value);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) { toast.error('Name and phone are required'); return; }
    if (createLogin) {
      if (!loginEmail) { toast.error('Email is required for login access'); return; }
      if (!initial && loginPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    }
    setSaving(true);
    try {
      let authUid = null;
      if (createLogin && loginEmail && loginPassword) {
        const appName = 'staff-creator-' + Date.now();
        const secondaryApp = initializeApp(firebaseConfig, appName);
        const secondaryAuth = getAuth(secondaryApp);
        try {
          const { user } = await createUserWithEmailAndPassword(secondaryAuth, loginEmail, loginPassword);
          authUid = user.uid;
        } finally {
          await deleteApp(secondaryApp);
        }
        await setDocument('users', authUid, { role: 'staff', name: form.name, email: loginEmail, gymId });
      }
      await onSave({ ...form, ...(authUid && { authUid }) });
    } catch (err) {
      const msg = err.code === 'auth/email-already-in-use'
        ? 'That email already has a login account'
        : err.code === 'auth/invalid-email'
          ? 'Invalid email address'
          : 'Failed to create login account';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const isEdit = Boolean(initial);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-outline-variant/20">
          <h2 className="font-bold text-on-surface text-lg">{isEdit ? 'Edit Staff Member' : 'Add Staff Member'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4 p-5 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Full Name *</label>
              <input required name="name" value={form.name} onChange={handle} placeholder="e.g. Priya Sharma"
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Role</label>
              <select name="role" value={form.role} onChange={handle}
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary appearance-none">
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Phone *</label>
              <input required name="phone" value={form.phone} onChange={handle} placeholder="9876543210"
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Email</label>
              <input type="email" name="email" value={form.email} onChange={handle} placeholder="email@example.com"
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Joining Date</label>
              <input type="date" name="joiningDate" value={form.joiningDate} onChange={handle}
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Salary (₹)</label>
              <input type="number" name="salary" value={form.salary} onChange={handle} placeholder="0"
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary" />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Address</label>
              <input name="address" value={form.address} onChange={handle} placeholder="Full address"
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary" />
            </div>
          </div>

          {/* Login Access */}
          {!isEdit && (
            <div className="border-t border-outline-variant/20 pt-4">
              <button type="button" onClick={() => setCreateLogin(v => !v)}
                className="flex items-center gap-2 text-sm font-medium text-on-surface w-full">
                <div className={`w-9 h-5 rounded-full transition-colors relative ${createLogin ? 'bg-primary' : 'bg-outline-variant/50'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${createLogin ? 'left-4' : 'left-0.5'}`} />
                </div>
                <span className="text-on-surface">Create login access for this staff member</span>
              </button>

              {createLogin && (
                <div className="mt-3 grid grid-cols-2 gap-3 p-4 bg-primary/5 rounded-xl border border-primary/20">
                  <div className="col-span-2 flex items-center gap-2 text-xs text-primary font-medium">
                    <span className="material-symbols-outlined text-[16px]">lock</span>
                    Staff will log in with these credentials and have access to Check-in only.
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-on-surface-variant">Login Email *</label>
                    <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                      placeholder="staff@email.com" required={createLogin}
                      className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary" />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-on-surface-variant">Password *</label>
                    <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                      placeholder="Min. 6 characters" required={createLogin} minLength={6}
                      className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary" />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/20">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 bg-primary text-on-primary rounded-lg font-medium hover:bg-primary/90 shadow-sm flex items-center gap-2 disabled:opacity-70">
              {saving ? <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> Saving...</> : <><span className="material-symbols-outlined text-[16px]">save</span> Save</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function StaffList() {
  const { gymId } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const data = await getTenantCollection(gymId, 'staff');
      setStaff(data);
    } catch { toast.error('Failed to load staff'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStaff(); }, []);

  const handleAdd = async (form) => {
    await createTenantDocument(gymId, 'staff', { ...form, salary: Number(form.salary) || 0, qrId: generateQrId() });
    toast.success('Staff member added!');
    setShowModal(false);
    fetchStaff();
  };

  const handleEdit = async (form) => {
    await updateTenantDocument(gymId, 'staff', editingStaff.id, { ...form, salary: Number(form.salary) || 0 });
    toast.success('Staff member updated!');
    setEditingStaff(null);
    fetchStaff();
  };

  const handleDelete = async (id) => {
    try {
      const staffMember = staff.find(s => s.id === id);
      await deleteTenantDocument(gymId, 'staff', id);
      if (staffMember?.authUid) {
        await deleteDocumentFlat('users', staffMember.authUid);
      }
      toast.success('Staff member deleted');
      setDeletingId(null);
      fetchStaff();
    } catch { toast.error('Delete failed'); }
  };

  const ROLE_FILTERS = ['All', ...ROLES];
  const filtered = staff.filter(s => {
    const matchRole = filterRole === 'All' || s.role === filterRole;
    const term = searchTerm.toLowerCase();
    const matchSearch = !term || s.name?.toLowerCase().includes(term) || s.phone?.includes(term);
    return matchRole && matchSearch;
  });

  const roleBadgeColor = {
    Trainer:     'bg-violet-100 text-violet-700',
    Staff:       'bg-blue-100 text-blue-700',
    Manager:     'bg-amber-100 text-amber-700',
    Receptionist:'bg-emerald-100 text-emerald-700',
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 className="font-h1 text-h1 text-on-surface">Staff & Trainers</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">Manage your staff members and trainers.</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="bg-primary text-on-primary px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">person_add</span> Add Staff
        </button>
      </div>

      {/* Role Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {ROLE_FILTERS.map(r => (
          <button key={r} onClick={() => setFilterRole(r)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
              filterRole === r
                ? 'bg-primary text-on-primary border-primary shadow-sm'
                : 'bg-surface-container-lowest border-outline-variant/30 text-on-surface-variant hover:bg-surface-container'
            }`}>
            {r}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-semibold ${filterRole === r ? 'bg-white/20 text-white' : 'bg-surface-container text-on-surface-variant'}`}>
              {r === 'All' ? staff.length : staff.filter(s => s.role === r).length}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2.5 max-w-sm shadow-sm">
        <span className="material-symbols-outlined text-on-surface-variant text-[20px]">search</span>
        <input type="text" placeholder="Search by name or phone..." value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="flex-1 bg-transparent text-on-surface outline-none text-sm placeholder:text-on-surface-variant" />
        {searchTerm && <button onClick={() => setSearchTerm('')} className="text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>}
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.15)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/30 bg-surface-container-low/50">
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Name</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Role</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Phone</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Joining Date</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Salary</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="p-8 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined animate-spin text-2xl mr-2">progress_activity</span>Loading staff...
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="6" className="p-12 text-center">
                  <div className="flex flex-col items-center gap-3 text-on-surface-variant">
                    <span className="material-symbols-outlined text-5xl opacity-40">badge</span>
                    <p className="font-medium">No staff members found</p>
                  </div>
                </td></tr>
              ) : (
                filtered.map(s => (
                  <tr key={s.id} className="border-b border-outline-variant/20 hover:bg-surface-container/40 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {s.photoUrl
                          ? <img src={s.photoUrl} alt={s.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                          : <div className="w-10 h-10 rounded-full bg-primary-container text-primary flex items-center justify-center font-bold shrink-0">{s.name?.charAt(0) || '?'}</div>
                        }
                        <div>
                          <div className="font-medium text-on-surface">{s.name}</div>
                          {s.email && <div className="text-xs text-on-surface-variant">{s.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${roleBadgeColor[s.role] || 'bg-slate-100 text-slate-600'}`}>{s.role}</span>
                    </td>
                    <td className="p-4 text-sm text-on-surface-variant">{s.phone}</td>
                    <td className="p-4 text-sm text-on-surface-variant">{s.joiningDate || '—'}</td>
                    <td className="p-4 text-sm font-medium text-on-surface">{s.salary ? `₹${Number(s.salary).toLocaleString('en-IN')}` : '—'}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/staff/${s.id}`}
                          className="bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-lg font-medium text-sm transition-colors">
                          View
                        </Link>
                        <button onClick={() => setEditingStaff(s)}
                          className="bg-surface-container hover:bg-surface-container-high text-on-surface-variant px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">edit</span>
                        </button>
                        <button onClick={() => setDeletingId(s.id)}
                          className="bg-rose-50 text-rose-600 hover:bg-rose-100 px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-outline-variant/20 text-xs text-on-surface-variant">
            Showing {filtered.length} of {staff.length} staff members
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showModal && <StaffModal gymId={gymId} onSave={handleAdd} onClose={() => setShowModal(false)} />}

      {/* Edit Modal */}
      {editingStaff && (
        <StaffModal
          gymId={gymId}
          initial={{ name: editingStaff.name, role: editingStaff.role, phone: editingStaff.phone,
            email: editingStaff.email || '', address: editingStaff.address || '',
            joiningDate: editingStaff.joiningDate || '', salary: editingStaff.salary || '', photoUrl: editingStaff.photoUrl || '' }}
          onSave={handleEdit}
          onClose={() => setEditingStaff(null)}
        />
      )}

      {/* Delete Confirm */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-rose-600 text-[20px]">warning</span>
              </div>
              <div>
                <h3 className="font-semibold text-on-surface">Delete Staff Member?</h3>
                <p className="text-sm text-on-surface-variant mt-1">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeletingId(null)} className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container text-sm">Cancel</button>
              <button onClick={() => handleDelete(deletingId)} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium text-sm shadow-sm">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
