import { useState, useEffect } from 'react';
import { useDarkMode } from '../../hooks/useDarkMode';
import { getTenantDocument, setTenantDocument } from '../../firebase/tenantDb';
import { useAuth } from '../../context/AuthContext';
import { updateDocument, createDocument } from '../../firebase/db';
import toast from 'react-hot-toast';

const DEFAULT_GYM_INFO = {
  name: '',
  location: 'Bangalore, Karnataka',
  contact: '+91 94497 49003',
  email: '',
  website: '',
  gstNumber: '',
  openingHours: '6:00 AM - 10:00 PM',
  instagram: '',
};

export default function Settings() {
  const { gymId, gymIds, gymBranches, switchBranch, addBranch, updateGymData, currentUser, role } = useAuth();
  const { isDarkMode, setLightMode, setDarkMode } = useDarkMode();

  const [gymInfo, setGymInfo]       = useState(DEFAULT_GYM_INFO);
  const [loading, setLoading]       = useState(true);
  const [isEditGymInfoOpen, setIsEditGymInfoOpen] = useState(false);
  const [editGymInfo, setEditGymInfo]             = useState(DEFAULT_GYM_INFO);

  // Branch creation state
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
  const [newBranchName, setNewBranchName]     = useState('');
  const [creatingBranch, setCreatingBranch]   = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const doc = await getTenantDocument(gymId, 'settings', 'general');
        if (doc?.gymInfo) setGymInfo(doc.gymInfo);
        else await setTenantDocument(gymId, 'settings', 'general', { gymInfo: DEFAULT_GYM_INFO });
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [gymId]);

  const handleSaveGymInfo = async (e) => {
    e.preventDefault();
    try {
      await Promise.all([
        setTenantDocument(gymId, 'settings', 'general', { gymInfo: editGymInfo }),
        updateDocument('gyms', gymId, { name: editGymInfo.name }),
      ]);
      setGymInfo(editGymInfo);
      updateGymData({ name: editGymInfo.name });
      setIsEditGymInfoOpen(false);
      toast.success('Gym Information updated!');
    } catch (error) {
      toast.error('Failed to update Gym Information.');
      console.error(error);
    }
  };

  const handleAddBranch = async (e) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    setCreatingBranch(true);
    try {
      // 1. Create the new gym (branch) document
      const newGym = await createDocument('gyms', {
        name: newBranchName.trim(),
        isActive: true,
        ownerUid: currentUser?.uid,
      });

      const newGymId = newGym.id;

      // 2. Persist the updated gymIds array on the admin's user doc
      const updatedGymIds = [...gymIds, newGymId];
      await updateDocument('users', currentUser.uid, { gymIds: updatedGymIds });

      // 3. Initialise default settings for the new branch
      await setTenantDocument(newGymId, 'settings', 'general', {
        gymInfo: { ...DEFAULT_GYM_INFO, name: newBranchName.trim() },
      });

      // 4. Update context so the branch appears in the switcher immediately
      addBranch(newGymId, newBranchName.trim());

      toast.success(`Branch "${newBranchName.trim()}" created!`);
      setIsAddBranchOpen(false);
      setNewBranchName('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to create branch.');
    } finally {
      setCreatingBranch(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex flex-col gap-2">
        <h1 className="font-h1 text-h1 text-on-surface">Settings</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">Manage your gym preferences and display settings.</p>
      </div>

      {/* Appearance */}
      <div className="bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.1)]">
        <h3 className="font-h3 text-h3 text-on-surface mb-1">Appearance</h3>
        <p className="text-sm text-on-surface-variant mb-5">Choose your preferred display theme.</p>
        <div className="flex gap-3">
          <button
            onClick={setLightMode}
            className={`flex-1 flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              !isDarkMode ? 'border-primary bg-primary-container/20' : 'border-outline-variant/30 hover:border-outline-variant'
            }`}
          >
            <div className="w-full h-16 bg-slate-100 rounded-lg border border-slate-200 flex items-end p-1.5 gap-1">
              <div className="w-8 h-full bg-slate-300 rounded"></div>
              <div className="flex-1 flex flex-col gap-1">
                <div className="h-2 bg-slate-300 rounded w-3/4"></div>
                <div className="h-2 bg-slate-200 rounded w-1/2"></div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>light_mode</span>
              <span className={`text-sm font-medium ${!isDarkMode ? 'text-primary' : 'text-on-surface-variant'}`}>Light Mode</span>
            </div>
            {!isDarkMode && <span className="text-xs text-primary font-medium">✓ Active</span>}
          </button>

          <button
            onClick={setDarkMode}
            className={`flex-1 flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              isDarkMode ? 'border-primary bg-primary-container/20' : 'border-outline-variant/30 hover:border-outline-variant'
            }`}
          >
            <div className="w-full h-16 bg-slate-800 rounded-lg border border-slate-700 flex items-end p-1.5 gap-1">
              <div className="w-8 h-full bg-slate-600 rounded"></div>
              <div className="flex-1 flex flex-col gap-1">
                <div className="h-2 bg-slate-600 rounded w-3/4"></div>
                <div className="h-2 bg-slate-700 rounded w-1/2"></div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-indigo-400" style={{ fontVariationSettings: "'FILL' 1" }}>dark_mode</span>
              <span className={`text-sm font-medium ${isDarkMode ? 'text-primary' : 'text-on-surface-variant'}`}>Dark Mode</span>
            </div>
            {isDarkMode && <span className="text-xs text-primary font-medium">✓ Active</span>}
          </button>
        </div>
      </div>

      {/* Gym Info */}
      <div className="bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.1)] relative">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-h3 text-h3 text-on-surface mb-1">Gym Information</h3>
            <p className="text-sm text-on-surface-variant">Basic details about this branch.</p>
          </div>
          <button
            onClick={() => { setEditGymInfo(gymInfo); setIsEditGymInfoOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container border border-outline-variant/30 text-on-surface rounded-lg text-sm font-medium hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">edit</span> Edit
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: 'Gym Name',      value: gymInfo.name,         icon: 'fitness_center' },
            { label: 'Location',      value: gymInfo.location,     icon: 'location_on'    },
            { label: 'Contact',       value: gymInfo.contact,      icon: 'call'           },
            { label: 'Email',         value: gymInfo.email,        icon: 'mail'           },
            { label: 'Website',       value: gymInfo.website,      icon: 'language'       },
            { label: 'GST Number',    value: gymInfo.gstNumber,    icon: 'receipt_long'   },
            { label: 'Opening Hours', value: gymInfo.openingHours, icon: 'schedule'       },
            { label: 'Instagram',     value: gymInfo.instagram,    icon: 'photo_camera'   },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-container border border-outline-variant/20">
              <span className="material-symbols-outlined text-primary shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
              <div className="min-w-0">
                <div className="text-xs text-on-surface-variant font-medium">{item.label}</div>
                <div className="text-sm font-semibold text-on-surface truncate">{loading ? '...' : (item.value || '—')}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Branches — admin only */}
      {role === 'admin' && (
        <div className="bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.1)]">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-h3 text-h3 text-on-surface mb-1">Branches</h3>
              <p className="text-sm text-on-surface-variant">
                {gymBranches.length === 1
                  ? 'You have 1 branch. Add more to manage multiple locations.'
                  : `You have ${gymBranches.length} branches.`}
              </p>
            </div>
            <button
              onClick={() => setIsAddBranchOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">add</span> Add Branch
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {gymBranches.map((branch, idx) => (
              <div
                key={branch.id}
                className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
                  branch.id === gymId
                    ? 'bg-primary/5 border-primary/20'
                    : 'bg-surface-container border-outline-variant/20'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm ${
                    branch.id === gymId ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-on-surface truncate">{branch.name}</div>
                    {branch.id === gymId && (
                      <div className="text-xs text-primary font-medium">Currently viewing</div>
                    )}
                  </div>
                </div>
                {branch.id !== gymId && (
                  <button
                    onClick={() => switchBranch(branch.id)}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-container-high hover:bg-surface-container text-on-surface-variant transition-colors"
                  >
                    Switch
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Gym Info Modal */}
      {isEditGymInfoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-fade-in">
            <h2 className="text-xl font-bold text-on-surface mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">edit</span> Edit Gym Info
            </h2>
            <form onSubmit={handleSaveGymInfo} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Gym Name',      key: 'name',         type: 'text',  required: true  },
                { label: 'Location',      key: 'location',     type: 'text',  required: false },
                { label: 'Contact',       key: 'contact',      type: 'text',  required: false },
                { label: 'Email',         key: 'email',        type: 'email', required: false },
                { label: 'Website',       key: 'website',      type: 'text',  required: false },
                { label: 'GST Number',    key: 'gstNumber',    type: 'text',  required: false },
                { label: 'Opening Hours', key: 'openingHours', type: 'text',  required: false },
                { label: 'Instagram',     key: 'instagram',    type: 'text',  required: false },
              ].map(({ label, key, type, required }) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-on-surface-variant">{label}{required && <span className="text-error ml-1">*</span>}</label>
                  <input
                    required={required}
                    type={type}
                    value={editGymInfo[key] ?? ''}
                    onChange={e => setEditGymInfo({ ...editGymInfo, [key]: e.target.value })}
                    className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary"
                  />
                </div>
              ))}
              </div>
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-outline-variant/20">
                <button type="button" onClick={() => setIsEditGymInfoOpen(false)} className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-primary text-on-primary rounded-lg font-medium hover:bg-primary/90 shadow-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">save</span> Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Branch Modal */}
      {isAddBranchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in">
            <h2 className="text-lg font-bold text-on-surface mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">add_business</span>
              Add New Branch
            </h2>
            <p className="text-sm text-on-surface-variant mb-5">
              Each branch has its own members, payments, and staff — completely separate data.
            </p>
            <form onSubmit={handleAddBranch} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-on-surface-variant">Branch Name <span className="text-error">*</span></label>
                <input
                  required
                  type="text"
                  value={newBranchName}
                  onChange={e => setNewBranchName(e.target.value)}
                  placeholder="e.g. Koramangala, Indiranagar..."
                  className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsAddBranchOpen(false); setNewBranchName(''); }}
                  className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingBranch || !newBranchName.trim()}
                  className="px-5 py-2 bg-primary text-on-primary rounded-lg font-medium hover:bg-primary/90 shadow-sm flex items-center gap-2 text-sm disabled:opacity-70"
                >
                  {creatingBranch
                    ? <><span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span> Creating...</>
                    : <><span className="material-symbols-outlined text-[14px]">add</span> Create Branch</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
