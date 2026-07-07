import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { setDocument } from '../../firebase/db';
import toast from 'react-hot-toast';

export default function SetupSuperAdmin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: 'devlofttech@gmail.com', password: 'devlofttech@321', name: 'Super Admin' });
  const [saving, setSaving] = useState(false);

  const handleSetup = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setSaving(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await setDocument('users', user.uid, {
        role: 'superadmin',
        name: form.name,
        email: form.email,
      });
      toast.success('Super admin created! You are now logged in.');
      navigate('/super-admin');
    } catch (err) {
      const msg =
        err.code === 'auth/email-already-in-use' ? 'That email already exists. Try logging in directly.' :
        err.code === 'auth/invalid-email' ? 'Invalid email address' :
        err.message || 'Setup failed';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-4 py-3 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary transition-colors';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>admin_panel_settings</span>
            </div>
            <div>
              <h1 className="font-bold text-on-surface text-xl">Platform Setup</h1>
              <p className="text-sm text-on-surface-variant">Create the super admin account</p>
            </div>
          </div>

          <form onSubmit={handleSetup} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Name</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputCls} placeholder="Super Admin" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Email</label>
              <input type="email" required value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Password</label>
              <input type="password" required minLength={6} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} className={inputCls} />
            </div>
            <button type="submit" disabled={saving}
              className="w-full bg-primary text-on-primary py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 mt-2">
              {saving ? <><span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> Creating…</> : 'Create Super Admin'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
