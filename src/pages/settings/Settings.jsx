import { useState, useEffect } from 'react';
import { useDarkMode } from '../../hooks/useDarkMode';
import { getDocument, setDocument } from '../../firebase/db';
import toast from 'react-hot-toast';

const DEFAULT_CATEGORIES = [
  {
    id: 'gym',
    name: 'Gym',
    plans: [
      { id: 'gym-1',  name: 'Monthly',                                  durationDays: 30,   amount: 0 },
      { id: 'gym-2',  name: '3 Months',                                 durationDays: 90,   amount: 0 },
      { id: 'gym-3',  name: '3 Plus 1 Months',                          durationDays: 120,  amount: 0 },
      { id: 'gym-4',  name: '6 Month',                                  durationDays: 180,  amount: 0 },
      { id: 'gym-5',  name: '6+2 Months',                               durationDays: 240,  amount: 0 },
      { id: 'gym-6',  name: 'Annual Pack',                              durationDays: 365,  amount: 0 },
      { id: 'gym-7',  name: 'Annual Pack (Group of 3)',                  durationDays: 365,  amount: 0 },
      { id: 'gym-8',  name: 'Annual Pack (Couple Pack)',                 durationDays: 365,  amount: 0 },
      { id: 'gym-9',  name: 'Annual Pack (Couple Offer)',                durationDays: 365,  amount: 0 },
      { id: 'gym-10', name: 'Annual Pack (Student Offer)',               durationDays: 365,  amount: 0 },
      { id: 'gym-11', name: 'Annual Pack (Student Offer - Group of 3)',  durationDays: 365,  amount: 0 },
      { id: 'gym-12', name: '3 Years Special Offer',                     durationDays: 1095, amount: 0 },
    ],
  },
  {
    id: 'zumba',
    name: 'Zumba',
    plans: [
      { id: 'zumba-1', name: 'Monthly',      durationDays: 30,  amount: 0 },
      { id: 'zumba-2', name: '2 Months',     durationDays: 60,  amount: 0 },
      { id: 'zumba-3', name: '3 Months',     durationDays: 90,  amount: 0 },
      { id: 'zumba-4', name: '3+1 Month',    durationDays: 120, amount: 0 },
      { id: 'zumba-5', name: '6 Months',     durationDays: 180, amount: 0 },
      { id: 'zumba-6', name: 'Annual',       durationDays: 365, amount: 0 },
      { id: 'zumba-7', name: 'Annual (Z&C)', durationDays: 365, amount: 0 },
      { id: 'zumba-8', name: '15 Months',    durationDays: 450, amount: 0 },
      { id: 'zumba-9', name: '2 Years',      durationDays: 730, amount: 0 },
    ],
  },
  {
    id: 'group_classes',
    name: 'Group Classes',
    plans: [
      { id: 'grp-1', name: 'Monthly',  durationDays: 30,  amount: 0 },
      { id: 'grp-2', name: '3 Months', durationDays: 90,  amount: 0 },
      { id: 'grp-3', name: '6 Months', durationDays: 180, amount: 0 },
    ],
  },
];

const DEFAULT_GYM_INFO = {
  name: 'Deep Fitness',
  location: 'Bangalore, Karnataka',
  contact: '+91 94497 49003',
};

const CATEGORY_META = {
  gym:       { icon: 'fitness_center', color: 'text-blue-500',   bg: 'bg-blue-500/10'   },
  zumba:     { icon: 'music_note',     color: 'text-purple-500', bg: 'bg-purple-500/10' },
  group_classes: { icon: 'groups',     color: 'text-green-500',  bg: 'bg-green-500/10'  },
};

export default function Settings() {
  const { isDarkMode, setLightMode, setDarkMode } = useDarkMode();

  const [gymInfo, setGymInfo]         = useState(DEFAULT_GYM_INFO);
  const [categories, setCategories]   = useState(DEFAULT_CATEGORIES);
  const [loading, setLoading]         = useState(true);

  const [isEditGymInfoOpen, setIsEditGymInfoOpen] = useState(false);
  const [editGymInfo, setEditGymInfo]             = useState(DEFAULT_GYM_INFO);

  const [isEditPlansOpen, setIsEditPlansOpen]     = useState(false);
  const [editCategories, setEditCategories]       = useState([]);
  const [activeCatTab, setActiveCatTab]           = useState(0);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const doc = await getDocument('settings', 'general');
        if (doc) {
          if (doc.gymInfo) setGymInfo(doc.gymInfo);
          if (doc.categories) {
            setCategories(doc.categories);
          } else {
            await setDocument('settings', 'general', { categories: DEFAULT_CATEGORIES });
            setCategories(DEFAULT_CATEGORIES);
          }
        } else {
          await setDocument('settings', 'general', { gymInfo: DEFAULT_GYM_INFO, categories: DEFAULT_CATEGORIES });
        }
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
      await setDocument('settings', 'general', { gymInfo: editGymInfo });
      setGymInfo(editGymInfo);
      setIsEditGymInfoOpen(false);
      toast.success('Gym Information updated!');
    } catch (error) {
      toast.error('Failed to update Gym Information.');
      console.error(error);
    }
  };

  const handleSaveCategories = async () => {
    try {
      await setDocument('settings', 'general', { categories: editCategories });
      setCategories(editCategories);
      setIsEditPlansOpen(false);
      toast.success('Membership Plans updated!');
    } catch (error) {
      toast.error('Failed to update Plans.');
      console.error(error);
    }
  };

  const updatePlan = (catIdx, planIdx, field, value) => {
    setEditCategories(prev => prev.map((cat, ci) =>
      ci !== catIdx ? cat : {
        ...cat,
        plans: cat.plans.map((plan, pi) =>
          pi !== planIdx ? plan : {
            ...plan,
            [field]: field === 'durationDays' || field === 'amount' ? Number(value) : value,
          }
        ),
      }
    ));
  };

  const addPlan = (catIdx) => {
    setEditCategories(prev => prev.map((cat, ci) =>
      ci !== catIdx ? cat : {
        ...cat,
        plans: [...cat.plans, { id: Date.now().toString(), name: 'New Plan', durationDays: 30, amount: 0 }],
      }
    ));
  };

  const removePlan = (catIdx, planIdx) => {
    setEditCategories(prev => prev.map((cat, ci) =>
      ci !== catIdx ? cat : { ...cat, plans: cat.plans.filter((_, pi) => pi !== planIdx) }
    ));
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

      {/* Membership Plans by Category */}
      <div className="bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.1)] relative">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-h3 text-h3 text-on-surface mb-1">Membership Plans</h3>
            <p className="text-sm text-on-surface-variant">Plans configured per category.</p>
          </div>
          <button
            onClick={() => {
              setEditCategories(JSON.parse(JSON.stringify(categories)));
              setActiveCatTab(0);
              setIsEditPlansOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container border border-outline-variant/30 text-on-surface rounded-lg text-sm font-medium hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">edit</span> Edit
          </button>
        </div>

        {loading ? (
          <div className="text-center py-6 text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin">progress_activity</span>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {categories.map((cat) => {
              const meta = CATEGORY_META[cat.id] || { icon: 'category', color: 'text-primary', bg: 'bg-primary/10' };
              return (
                <div key={cat.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-8 h-8 ${meta.bg} rounded-lg flex items-center justify-center`}>
                      <span className={`material-symbols-outlined text-[18px] ${meta.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{meta.icon}</span>
                    </div>
                    <h4 className="font-semibold text-on-surface">{cat.name}</h4>
                    <span className="text-xs text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full ml-1">{cat.plans.length} plans</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {cat.plans.map((plan, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-container border border-outline-variant/30">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">card_membership</span>
                          <div>
                            <div className="font-medium text-on-surface text-sm">{plan.name}</div>
                            <div className="text-xs text-on-surface-variant">{plan.durationDays} days</div>
                          </div>
                        </div>
                        <div className={`font-bold text-base ${plan.amount === 0 ? 'text-on-surface-variant/40' : 'text-on-surface'}`}>
                          {plan.amount === 0 ? '—' : `₹${Number(plan.amount).toLocaleString('en-IN')}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Version */}
      <div className="text-center text-xs text-on-surface-variant opacity-50 pb-4">
        Deep Fitness ERP v1.0 · Powered by Firebase
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

      {/* Edit Plans Modal */}
      {isEditPlansOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">edit</span> Edit Plans
              </h2>
              <button onClick={() => setIsEditPlansOpen(false)} className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Category Tabs */}
            <div className="flex gap-1 mb-4 bg-surface-container p-1 rounded-xl">
              {editCategories.map((cat, i) => {
                const meta = CATEGORY_META[cat.id] || { icon: 'category', color: 'text-primary' };
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCatTab(i)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      activeCatTab === i
                        ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-[16px] ${activeCatTab === i ? meta.color : ''}`} style={{ fontVariationSettings: "'FILL' 1" }}>{meta.icon}</span>
                    {cat.name}
                  </button>
                );
              })}
            </div>

            {/* Plans list for active category */}
            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar flex flex-col gap-3 min-h-0">
              {editCategories[activeCatTab]?.plans.map((plan, planIdx) => (
                <div key={plan.id} className="p-4 bg-surface-container rounded-xl border border-outline-variant/30 flex flex-wrap gap-2 sm:gap-3 items-end">
                  <div className="w-full sm:flex-1 flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-on-surface-variant">Plan Name</label>
                    <input
                      type="text"
                      value={plan.name}
                      onChange={e => updatePlan(activeCatTab, planIdx, 'name', e.target.value)}
                      className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-md text-on-surface outline-none focus:border-primary text-sm"
                    />
                  </div>
                  <div className="w-20 sm:w-24 flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-on-surface-variant">Days</label>
                    <input
                      type="number"
                      value={plan.durationDays}
                      onChange={e => updatePlan(activeCatTab, planIdx, 'durationDays', e.target.value)}
                      className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-md text-on-surface outline-none focus:border-primary text-sm"
                    />
                  </div>
                  <div className="w-28 sm:w-32 flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-on-surface-variant">Amount (₹)</label>
                    <input
                      type="number"
                      value={plan.amount || ''}
                      placeholder="0"
                      onChange={e => updatePlan(activeCatTab, planIdx, 'amount', e.target.value || '0')}
                      className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-md text-on-surface outline-none focus:border-primary text-sm"
                    />
                  </div>
                  <button
                    onClick={() => removePlan(activeCatTab, planIdx)}
                    className="h-9.5 w-9.5 rounded-md bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 flex items-center justify-center hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors shrink-0"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              ))}
              <button
                onClick={() => addPlan(activeCatTab)}
                className="w-full py-3 border-2 border-dashed border-outline-variant/50 rounded-xl text-primary font-medium hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">add</span> Add Plan to {editCategories[activeCatTab]?.name}
              </button>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-outline-variant/20">
              <button onClick={() => setIsEditPlansOpen(false)} className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container">Cancel</button>
              <button onClick={handleSaveCategories} className="px-5 py-2 bg-primary text-on-primary rounded-lg font-medium hover:bg-primary/90 shadow-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">save</span> Save All Plans
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
