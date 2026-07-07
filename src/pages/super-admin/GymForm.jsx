import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '../../firebase/config';
import { getDocument, createDocument, updateDocument, setDocument } from '../../firebase/db';
import { setTenantDocument } from '../../firebase/tenantDb';
import { uploadGymLogo } from '../../utils/imagekit';
import toast from 'react-hot-toast';

const DEFAULT_CATEGORIES = [
  {
    id: 'gym', name: 'Gym',
    plans: [
      { id: 'gym-1', name: 'Monthly',    durationDays: 30,  amount: 0 },
      { id: 'gym-2', name: '3 Months',   durationDays: 90,  amount: 0 },
      { id: 'gym-3', name: '6 Months',   durationDays: 180, amount: 0 },
      { id: 'gym-4', name: 'Annual Pack', durationDays: 365, amount: 0 },
    ],
  },
  {
    id: 'zumba', name: 'Zumba',
    plans: [
      { id: 'zumba-1', name: 'Monthly',  durationDays: 30,  amount: 0 },
      { id: 'zumba-2', name: '3 Months', durationDays: 90,  amount: 0 },
      { id: 'zumba-3', name: '6 Months', durationDays: 180, amount: 0 },
    ],
  },
  {
    id: 'group_classes', name: 'Group Classes',
    plans: [
      { id: 'grp-1', name: 'Monthly',  durationDays: 30,  amount: 0 },
      { id: 'grp-2', name: '3 Months', durationDays: 90,  amount: 0 },
    ],
  },
];

const EMPTY_FORM = {
  name: '', address: '', phone: '', email: '',
  ownerEmail: '', ownerPassword: '',
  subscriptionPlan: '',
};

export default function GymForm() {
  const { id } = useParams();
  const isEdit = Boolean(id) && id !== 'new';
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [existingLogoUrl, setExistingLogoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(isEdit);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isEdit) return;
    getDocument('gyms', id)
      .then(gym => {
        if (!gym) { toast.error('Gym not found'); navigate('/super-admin/gyms'); return; }
        setForm({
          name: gym.name || '',
          address: gym.address || '',
          phone: gym.phone || '',
          email: gym.email || '',
          ownerEmail: gym.ownerEmail || '',
          ownerPassword: '',
          subscriptionPlan: gym.subscriptionPlan || '',
        });
        setExistingLogoUrl(gym.logoUrl || '');
      })
      .catch(() => toast.error('Failed to load gym'))
      .finally(() => setLoadingEdit(false));
  }, [id, isEdit, navigate]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handle = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) { toast.error('Gym name is required'); return; }
    if (!isEdit && !form.ownerEmail) { toast.error('Owner email is required'); return; }
    if (!isEdit && form.ownerPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }

    setSaving(true);
    try {
      // Upload logo if selected
      let logoUrl = existingLogoUrl;
      if (logoFile) {
        logoUrl = await uploadGymLogo(logoFile);
      }

      if (isEdit) {
        // Update existing gym
        await updateDocument('gyms', id, {
          name: form.name,
          address: form.address,
          phone: form.phone,
          email: form.email,
          subscriptionPlan: form.subscriptionPlan,
          ...(logoUrl && { logoUrl }),
        });
        toast.success('Gym updated!');
        navigate('/super-admin/gyms');
        return;
      }

      // Create Firebase Auth user for gym admin via secondary app
      const appName = 'gym-creator-' + Date.now();
      const secondaryApp = initializeApp(firebaseConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);
      let ownerUid;
      try {
        const { user } = await createUserWithEmailAndPassword(secondaryAuth, form.ownerEmail, form.ownerPassword);
        ownerUid = user.uid;
      } finally {
        await deleteApp(secondaryApp);
      }

      // Create gym doc
      const gymData = {
        name: form.name,
        address: form.address,
        phone: form.phone,
        email: form.email,
        ownerEmail: form.ownerEmail,
        ownerId: ownerUid,
        logoUrl,
        isActive: true,
        subscriptionPlan: form.subscriptionPlan || 'Standard',
      };
      const gymDoc = await createDocument('gyms', gymData);
      const newGymId = gymDoc.id;

      // Create users doc for the gym admin
      await setDocument('users', ownerUid, {
        role: 'admin',
        name: form.name + ' Admin',
        email: form.ownerEmail,
        gymId: newGymId,
      });

      // Seed default settings for the new gym
      await setTenantDocument(newGymId, 'settings', 'general', {
        gymInfo: {
          name: form.name,
          location: form.address,
          contact: form.phone,
        },
        categories: DEFAULT_CATEGORIES,
      });

      toast.success(`Gym "${form.name}" created! Owner can now log in.`);
      navigate('/super-admin/gyms');
    } catch (err) {
      const msg =
        err.code === 'auth/email-already-in-use' ? 'That email already has an account' :
        err.code === 'auth/invalid-email' ? 'Invalid email address' :
        err.message || 'Failed to create gym';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loadingEdit) {
    return (
      <div className="flex items-center justify-center py-20 text-on-surface-variant gap-2">
        <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
        Loading…
      </div>
    );
  }

  const inputCls = 'w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary transition-colors text-sm';
  const labelCls = 'text-sm font-medium text-on-surface-variant';

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <button onClick={() => navigate('/super-admin/gyms')}
          className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface mb-4 transition-colors">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span> Back to Gyms
        </button>
        <h1 className="font-h1 text-h1 text-on-surface">{isEdit ? 'Edit Gym' : 'Add New Gym'}</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant mt-1">
          {isEdit ? 'Update gym details below.' : 'Fill in the gym details and create login credentials for the owner.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">

        {/* Logo */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col gap-4">
          <h3 className="font-semibold text-on-surface">Gym Logo</h3>
          <div className="flex items-center gap-5">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 rounded-2xl border-2 border-dashed border-outline-variant/50 overflow-hidden bg-surface-container cursor-pointer hover:border-primary transition-colors flex items-center justify-center shrink-0 relative group"
            >
              {(logoPreview || existingLogoUrl) ? (
                <>
                  <img src={logoPreview || existingLogoUrl} alt="Logo" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-[22px]">edit</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1 text-on-surface-variant">
                  <span className="material-symbols-outlined text-3xl">add_photo_alternate</span>
                  <span className="text-[10px] font-medium">Upload</span>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <div className="text-sm text-on-surface-variant">
              <p className="font-medium text-on-surface mb-1">Gym Logo</p>
              <p>PNG, JPG up to 5MB</p>
              <p>Compressed and stored on ImageKit</p>
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="mt-2 text-primary hover:underline font-medium">
                Choose file
              </button>
            </div>
          </div>
        </div>

        {/* Gym Details */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col gap-4">
          <h3 className="font-semibold text-on-surface">Gym Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2 flex flex-col gap-1.5">
              <label className={labelCls}>Gym Name *</label>
              <input name="name" required value={form.name} onChange={handle} placeholder="e.g. Iron Fitness Gym" className={inputCls} />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <label className={labelCls}>Address / City</label>
              <input name="address" value={form.address} onChange={handle} placeholder="e.g. 12 MG Road, Bangalore" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Phone</label>
              <input name="phone" value={form.phone} onChange={handle} placeholder="+91 98765 43210" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Gym Email</label>
              <input type="email" name="email" value={form.email} onChange={handle} placeholder="gym@example.com" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Subscription Plan</label>
              <input name="subscriptionPlan" value={form.subscriptionPlan} onChange={handle} placeholder="e.g. Standard, Premium" className={inputCls} />
            </div>
          </div>
        </div>

        {/* Owner Credentials (new gym only) */}
        {!isEdit && (
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col gap-4">
            <div>
              <h3 className="font-semibold text-on-surface">Owner Login Credentials</h3>
              <p className="text-sm text-on-surface-variant mt-0.5">The gym owner will use these to log into the ERP.</p>
            </div>
            <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 text-xs text-primary font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">info</span>
              The owner gets full admin access to their gym. Share these credentials securely.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Owner Email *</label>
                <input type="email" name="ownerEmail" required value={form.ownerEmail} onChange={handle}
                  placeholder="owner@gymname.com" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Password *</label>
                <input type="password" name="ownerPassword" required minLength={6} value={form.ownerPassword}
                  onChange={handle} placeholder="Min. 6 characters" className={inputCls} />
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={() => navigate('/super-admin/gyms')}
            className="px-5 py-2.5 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="px-6 py-2.5 bg-primary text-on-primary rounded-lg font-semibold hover:bg-primary/90 shadow-sm flex items-center gap-2 disabled:opacity-70 transition-colors">
            {saving ? (
              <><span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> Saving…</>
            ) : (
              <><span className="material-symbols-outlined text-[18px]">save</span> {isEdit ? 'Save Changes' : 'Create Gym'}</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
