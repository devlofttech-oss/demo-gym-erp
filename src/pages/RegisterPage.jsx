import { useState } from 'react';
import { Link } from 'react-router-dom';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '../firebase/config';
import { createDocument, setDocument } from '../firebase/db';
import { setTenantDocument } from '../firebase/tenantDb';
import logoImage from '../assets/kilos_logo.png';

function generatePassword() {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  let p = 'Kilos@';
  p += upper[Math.floor(Math.random() * upper.length)];
  p += lower[Math.floor(Math.random() * lower.length)];
  for (let i = 0; i < 3; i++) p += digits[Math.floor(Math.random() * digits.length)];
  return p;
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const EMPTY = { gymName: '', ownerName: '', phone: '', city: '', email: '' };

export default function RegisterPage() {
  const [form, setForm]     = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState(null);
  const [copied, setCopied]   = useState('');

  const handle = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const password = generatePassword();
    const today    = new Date().toISOString().split('T')[0];
    const trialEnd = addDays(7);

    try {
      const appName      = 'trial-reg-' + Date.now();
      const secondaryApp = initializeApp(firebaseConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);
      let ownerUid;
      try {
        const { user } = await createUserWithEmailAndPassword(secondaryAuth, form.email.trim(), password);
        ownerUid = user.uid;
      } finally {
        await deleteApp(secondaryApp);
      }

      const gymDoc = await createDocument('gyms', {
        name:          form.gymName.trim(),
        address:       form.city.trim(),
        phone:         form.phone.trim(),
        email:         form.email.trim(),
        ownerEmail:    form.email.trim(),
        ownerName:     form.ownerName.trim(),
        ownerPhone:    form.phone.trim(),
        ownerCity:     form.city.trim(),
        ownerPassword: password,
        ownerId:       ownerUid,
        isActive:      true,
        isTrial:       true,
        trialStartDate: today,
        trialEndDate:   trialEnd,
        subscriptionPlan: 'Trial',
      });
      const gymId = gymDoc.id;

      await setDocument('users', ownerUid, {
        role:  'admin',
        name:  form.ownerName.trim() || form.gymName.trim() + ' Admin',
        email: form.email.trim(),
        gymId,
      });

      await setTenantDocument(gymId, 'settings', 'general', {
        gymInfo: {
          name:     form.gymName.trim(),
          location: form.city.trim(),
          contact:  form.phone.trim(),
        },
      });

      setSuccess({ gymName: form.gymName.trim(), ownerName: form.ownerName.trim(), email: form.email.trim(), password, trialEnd });
    } catch (err) {
      setError(
        err.code === 'auth/email-already-in-use' ? 'This email already has an account.' :
        err.code === 'auth/invalid-email'        ? 'Invalid email address.' :
        'Something went wrong. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  /* ── Success screen ── */
  if (success) {
    const loginUrl = window.location.origin + '/login';
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-emerald-600 text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900">You're all set, {success.ownerName || success.gymName}!</h2>
            <p className="text-slate-500 mt-1 text-sm">Your 7-day free trial has started. Save the credentials below.</p>
          </div>

          <div className="w-full bg-slate-50 rounded-2xl p-5 flex flex-col gap-3 border border-slate-100">
            {[
              { label: 'Login URL', value: loginUrl,        key: 'url' },
              { label: 'Email',     value: success.email,   key: 'email' },
              { label: 'Password',  value: success.password, key: 'pass' },
            ].map(({ label, value, key }) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-400 mb-0.5">{label}</div>
                  <div className="text-sm font-semibold text-slate-800 truncate">{value}</div>
                </div>
                <button
                  onClick={() => copy(value, key)}
                  className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${copied === key ? 'bg-emerald-100 text-emerald-600' : 'bg-white border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'}`}
                >
                  <span className="material-symbols-outlined text-[16px]">{copied === key ? 'check' : 'content_copy'}</span>
                </button>
              </div>
            ))}
            <div className="pt-2 border-t border-slate-200 text-xs text-slate-400 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">timer</span>
              Trial valid until <span className="font-semibold text-slate-600">{success.trialEnd}</span>
            </div>
          </div>

          <Link
            to="/login"
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-center hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">login</span>
            Go to Login
          </Link>

          <p className="text-xs text-slate-400 text-center">
            Need help? Contact us — we'll get you set up in no time.
          </p>
        </div>
      </div>
    );
  }

  /* ── Registration form ── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl flex rounded-3xl shadow-2xl overflow-hidden bg-white">

        {/* Left panel — branding */}
        <div className="hidden md:flex flex-col justify-between w-2/5 bg-indigo-700 p-10 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/20 flex items-center justify-center shrink-0">
              <img src={logoImage} alt="Kilos" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-xl">Kilos</span>
          </div>

          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-3xl font-bold leading-tight">Start your free 7-day trial</h1>
              <p className="mt-3 text-indigo-200 text-sm">No credit card needed. Your gym account is ready in seconds.</p>
            </div>
            {[
              { icon: 'group',               text: 'Member management & renewals' },
              { icon: 'account_balance_wallet', text: 'Payment tracking & receipts' },
              { icon: 'how_to_reg',          text: 'QR check-in for members' },
              { icon: 'insert_chart',        text: 'Reports & lead tracking' },
            ].map(({ icon, text }) => (
              <div key={icon} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                </div>
                <span className="text-sm text-indigo-100">{text}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-indigo-300">Powered by Kilos · Built by Devloft Technologies</p>
        </div>

        {/* Right panel — form */}
        <div className="flex-1 p-8 md:p-10 flex flex-col justify-center">
          {/* Mobile logo */}
          <div className="md:hidden flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-indigo-100 flex items-center justify-center">
              <img src={logoImage} alt="Kilos" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-slate-900">Kilos</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">Create your gym account</h2>
          <p className="text-slate-500 text-sm mb-7">Fill in your details — login credentials will be shown instantly.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {[
              { label: 'Gym Name',       name: 'gymName',   placeholder: 'e.g. Iron Fitness Gym',    required: true  },
              { label: 'Owner Name',     name: 'ownerName', placeholder: 'e.g. Rahul Sharma',        required: true  },
              { label: 'WhatsApp Number', name: 'phone',   placeholder: 'e.g. 9876543210',          required: true  },
              { label: 'City',           name: 'city',      placeholder: 'e.g. Bangalore, Karnataka', required: false },
              { label: 'Email Address',  name: 'email',     placeholder: 'owner@gymname.com',        required: true, type: 'email' },
            ].map(({ label, name, placeholder, required, type }) => (
              <div key={name} className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">
                  {label} {required && <span className="text-rose-500">*</span>}
                </label>
                <input
                  type={type || 'text'}
                  name={name}
                  value={form[name]}
                  onChange={handle}
                  required={required}
                  placeholder={placeholder}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all text-sm placeholder:text-slate-400"
                />
              </div>
            ))}

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="mt-2 bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {saving ? (
                <><span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span> Creating your account…</>
              ) : (
                <><span className="material-symbols-outlined text-[20px]">rocket_launch</span> Start Free Trial</>
              )}
            </button>
          </form>

          <p className="text-xs text-slate-400 text-center mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
