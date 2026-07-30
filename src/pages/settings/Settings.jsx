import { useState, useEffect } from 'react';
import { useDarkMode } from '../../hooks/useDarkMode';
import { getTenantDocument, setTenantDocument } from '../../firebase/tenantDb';
import { useAuth } from '../../context/AuthContext';
import { updateDocument } from '../../firebase/db';
import toast from 'react-hot-toast';

const DEFAULT_GYM_INFO = {
  name: '',
  location: 'Bangalore, Karnataka',
  contact: '+91 94497 49003',
};

export default function Settings() {
  const { gymId, updateGymData } = useAuth();
  const { isDarkMode, setLightMode, setDarkMode } = useDarkMode();

  const [gymInfo, setGymInfo]       = useState(DEFAULT_GYM_INFO);
  const [loading, setLoading]       = useState(true);
  const [isEditGymInfoOpen, setIsEditGymInfoOpen] = useState(false);
  const [editGymInfo, setEditGymInfo]             = useState(DEFAULT_GYM_INFO);

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
  }, []);

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
            <p className="text-sm text-on-surface-variant">Basic details about your gym.</p>
          </div>
          <button
            onClick={() => { setEditGymInfo(gymInfo); setIsEditGymInfoOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container border border-outline-variant/30 text-on-surface rounded-lg text-sm font-medium hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">edit</span> Edit
          </button>
        </div>
        <div className="flex flex-col gap-4">
          {[
            { label: 'Gym Name', value: gymInfo.name,     icon: 'fitness_center' },
            { label: 'Location', value: gymInfo.location, icon: 'location_on'    },
            { label: 'Contact',  value: gymInfo.contact,  icon: 'call'           },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-surface-container border border-outline-variant/20">
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
              <div>
                <div className="text-xs text-on-surface-variant font-medium">{item.label}</div>
                <div className="text-sm font-semibold text-on-surface">{loading ? '...' : item.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>


      {/* Edit Gym Info Modal */}
      {isEditGymInfoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in">
            <h2 className="text-xl font-bold text-on-surface mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">edit</span> Edit Gym Info
            </h2>
            <form onSubmit={handleSaveGymInfo} className="flex flex-col gap-4">
              {[
                { label: 'Gym Name', key: 'name',     type: 'text' },
                { label: 'Location', key: 'location', type: 'text' },
                { label: 'Contact',  key: 'contact',  type: 'text' },
              ].map(({ label, key, type }) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-on-surface-variant">{label}</label>
                  <input
                    required
                    type={type}
                    value={editGymInfo[key]}
                    onChange={e => setEditGymInfo({ ...editGymInfo, [key]: e.target.value })}
                    className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary"
                  />
                </div>
              ))}
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
    </div>
  );
}
