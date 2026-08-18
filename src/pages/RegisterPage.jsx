import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '../firebase/config';
import { getCollection, createDocument, setDocument } from '../firebase/db';
import { setTenantDocument } from '../firebase/tenantDb';
import logoImage from '../assets/kilos_logo.png';

const EMPTY = { gymName: '', ownerName: '', phone: '', city: '', email: '' };

function generatePassword(gymName) {
  const word = (gymName || 'Kilos').replace(/\s+/g, '').slice(0, 5) || 'Kilos';
  const cap  = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  const num  = Math.floor(1000 + Math.random() * 9000);
  const sym  = ['@', '#', '!', '$'][Math.floor(Math.random() * 4)];
  return `${cap}${sym}${num}`;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [creds, setCreds]         = useState(null); // { email, password }
  const [showPass, setShowPass]   = useState(false);
  const [copied, setCopied]       = useState(false);

  const handle = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      // 1. Fetch Trial plan
      const plans = await getCollection('subscriptionPlans');
      const trialPlan = plans.find(p =>
        (p.name || '').toLowerCase() === 'trial' || (p.durationDays === 7)
      );

      // 2. Generate password
      const password = generatePassword(form.gymName);

      // 3. Create Firebase Auth user via secondary app so main auth session is unaffected
      const appName = 'register-' + Date.now();
      const secondaryApp = initializeApp(firebaseConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);
      let uid;
      try {
        const { user } = await createUserWithEmailAndPassword(secondaryAuth, form.email.trim(), password);
        uid = user.uid;
      } finally {
        await deleteApp(secondaryApp);
      }

      // 4. Calculate trial dates
      const today = new Date();
      const end   = new Date(today);
      end.setDate(end.getDate() + (trialPlan?.durationDays || 7));
      const fmt = (d) => d.toISOString().split('T')[0];

      // 5. Create gym document
      const gymDoc = await createDocument('gyms', {
        name:             form.gymName.trim(),
        ownerName:        form.ownerName.trim(),
        address:          form.city.trim(),
        phone:            form.phone.trim(),
        email:            form.email.trim(),
        ownerEmail:       form.email.trim(),
        ownerId:          uid,
        isActive:         true,
        subscriptionPlan: trialPlan?.name || 'Trial',
        planId:           trialPlan?.id   || '',
        planName:         trialPlan?.name || 'Trial',
        planStartDate:    fmt(today),
        planEndDate:      fmt(end),
      });
      const gymId = gymDoc.id;

      // 6. Create users doc
      await setDocument('users', uid, {
        role:   'admin',
        name:   form.ownerName.trim(),
        email:  form.email.trim(),
        gymId,
      });

      // 7. Seed gym settings (empty categories — gym owner sets their own plans)
      await setTenantDocument(gymId, 'settings', 'general', {
        gymInfo: {
          name:     form.gymName.trim(),
          location: form.city.trim(),
          contact:  form.phone.trim(),
        },
        categories: [],
      });

      setCreds({ email: form.email.trim(), password });
    } catch (err) {
      const msg =
        err.code === 'auth/email-already-in-use' ? 'An account with this email already exists.' :
        err.code === 'auth/invalid-email'         ? 'Please enter a valid email address.'        :
        err.code === 'auth/weak-password'         ? 'Password too weak, please try again.'       :
        'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(creds.password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSaveToBrowser = async () => {
    if (!window.PasswordCredential) return;
    try {
      const c = new window.PasswordCredential({ id: creds.email, password: creds.password, name: form.gymName });
      await navigator.credentials.store(c);
    } catch {
      // silently ignore — browser may not support or user dismissed
    }
  };

  /* ── Credentials screen ── */
  if (creds) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-10 flex flex-col gap-6">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-green-600 text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Account Ready!</h2>
              <p className="text-slate-500 text-sm mt-1">Save your login credentials before you continue.</p>
            </div>
          </div>

          {/* Credentials box */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col gap-4">
            {/* Email */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</label>
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5">
                <span className="text-slate-800 text-sm font-medium flex-1 truncate">{creds.email}</span>
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Password</label>
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5">
                <span className="text-slate-800 text-sm font-medium flex-1 font-mono tracking-wider">
                  {showPass ? creds.password : '•'.repeat(creds.password.length)}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]">{showPass ? 'visibility_off' : 'visibility'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]">{copied ? 'check' : 'content_copy'}</span>
                </button>
              </div>
            </div>
          </div>

          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 leading-relaxed">
            <strong>Note:</strong> Save these credentials now. You can change your password anytime from your profile after logging in.
          </p>

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            {typeof window !== 'undefined' && window.PasswordCredential && (
              <button
                type="button"
                onClick={handleSaveToBrowser}
                className="flex items-center justify-center gap-2 w-full border border-slate-200 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-50 transition-colors text-sm"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                Save to Browser
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="flex items-center justify-center gap-2 w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">login</span>
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Registration form ── */
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl flex rounded-3xl shadow-2xl overflow-hidden bg-white">

        {/* Left panel */}
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
              <p className="mt-3 text-indigo-200 text-sm">Fill in your details and your account will be created instantly.</p>
            </div>
            {[
              { icon: 'group',                  text: 'Member management & renewals' },
              { icon: 'account_balance_wallet', text: 'Payment tracking & receipts'  },
              { icon: 'how_to_reg',             text: 'QR check-in for members'      },
              { icon: 'insert_chart',           text: 'Reports & lead tracking'      },
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

        {/* Right panel */}
        <div className="flex-1 p-8 md:p-10 flex flex-col justify-center">
          <div className="md:hidden flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-indigo-100 flex items-center justify-center">
              <img src={logoImage} alt="Kilos" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-slate-900">Kilos</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">Create your gym account</h2>
          <p className="text-slate-500 text-sm mb-7">Your login credentials will be generated automatically.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {[
              { label: 'Gym Name',        name: 'gymName',   placeholder: 'e.g. Iron Fitness Gym',     required: true              },
              { label: 'Owner Name',      name: 'ownerName', placeholder: 'e.g. Rahul Sharma',         required: true              },
              { label: 'WhatsApp Number', name: 'phone',     placeholder: 'e.g. 9876543210',           required: true              },
              { label: 'City',            name: 'city',      placeholder: 'e.g. Bangalore, Karnataka', required: false             },
              { label: 'Email Address',   name: 'email',     placeholder: 'owner@gymname.com',         required: true, type:'email' },
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
                <><span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span> Creating account…</>
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
