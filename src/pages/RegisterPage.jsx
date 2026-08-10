import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createDocument } from '../firebase/db';
import logoImage from '../assets/kilos_logo.png';

const EMPTY = { gymName: '', ownerName: '', phone: '', city: '', email: '' };

export default function RegisterPage() {
  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handle = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await createDocument('trialRequests', {
        gymName:   form.gymName.trim(),
        ownerName: form.ownerName.trim(),
        phone:     form.phone.trim(),
        city:      form.city.trim(),
        email:     form.email.trim(),
        status:    'pending',
      });
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /* ── Success screen ── */
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-10 flex flex-col items-center gap-6 text-center">
          <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-indigo-600 text-[44px]" style={{ fontVariationSettings: "'FILL' 1" }}>mark_email_read</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Request Received!</h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              Thanks, <span className="font-semibold text-slate-700">{form.ownerName || form.gymName}</span>! We've received your request and our team will
              review it and <span className="font-semibold text-slate-700">get back to you shortly</span> with your login credentials.
            </p>
          </div>
          <div className="w-full bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-left">
            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-2">What happens next?</p>
            <ul className="flex flex-col gap-2">
              {[
                'Our team reviews your request',
                'We set up your gym account',
                'You receive login credentials',
              ].map((step, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-slate-400">Kilos by Devloft Technologies</p>
        </div>
      </div>
    );
  }

  /* ── Registration form ── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4">
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
              <p className="mt-3 text-indigo-200 text-sm">Fill in your details — our team will set up your account and send you the credentials.</p>
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
          <p className="text-slate-500 text-sm mb-7">Fill in your details and we'll get back to you with login credentials.</p>

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
                <><span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span> Submitting…</>
              ) : (
                <><span className="material-symbols-outlined text-[20px]">rocket_launch</span> Request Free Trial</>
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
