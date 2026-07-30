import { useState, useEffect } from 'react';
import { getTenantCollection, updateTenantDocument, deleteTenantDocument } from '../../firebase/tenantDb';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import PlanForm from './PlanForm';

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'gym', label: 'Gym' },
  { key: 'personal-training', label: 'Personal Training' },
  { key: 'group-class', label: 'Group Class' },
  { key: 'day-pass', label: 'Day Pass' },
  { key: 'addon', label: 'Add-ons' },
];

const TYPE_META = {
  gym:               { label: 'Gym',              bg: 'bg-violet-100',  text: 'text-violet-700',  icon: 'fitness_center' },
  'personal-training': { label: 'Personal Training', bg: 'bg-blue-100',    text: 'text-blue-700',    icon: 'sports' },
  'group-class':     { label: 'Group Class',      bg: 'bg-emerald-100', text: 'text-emerald-700', icon: 'groups' },
  'day-pass':        { label: 'Day Pass',         bg: 'bg-orange-100',  text: 'text-orange-700',  icon: 'calendar_today' },
  addon:             { label: 'Add-on',           bg: 'bg-amber-100',   text: 'text-amber-700',   icon: 'add_circle' },
};

function TypeBadge({ type }) {
  const meta = TYPE_META[type] || { label: type, bg: 'bg-surface-container', text: 'text-on-surface-variant', icon: 'label' };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${meta.bg} ${meta.text}`}>
      <span className="material-symbols-outlined text-[12px]">{meta.icon}</span>
      {meta.label}
    </span>
  );
}

function PlanCard({ plan, onEdit, onDelete, onToggleActive }) {
  const displayDuration = plan.sessions
    ? `${plan.sessions} Sessions`
    : plan.durationMonths
      ? `${plan.durationMonths} Month${plan.durationMonths > 1 ? 's' : ''}`
      : null;

  return (
    <div className={`bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 flex flex-col gap-4 shadow-[0_4px_20px_rgba(207,196,255,0.12)] transition-all hover:shadow-[0_8px_30px_rgba(207,196,255,0.2)] ${!plan.isActive ? 'opacity-70' : ''}`}>

      {/* Top row: name + type badge + active dot */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5 min-w-0">
          <h3 className="font-bold text-on-surface text-base leading-snug truncate">{plan.name}</h3>
          <TypeBadge type={plan.type} />
        </div>
        {/* Active indicator */}
        <span className={`mt-0.5 shrink-0 flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${plan.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-container text-on-surface-variant'}`}>
          <span className={`w-1.5 h-1.5 rounded-full inline-block ${plan.isActive ? 'bg-emerald-500' : 'bg-on-surface-variant/40'}`} />
          {plan.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Price + duration */}
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-2xl font-bold text-primary">
            ₹{Number(plan.price || 0).toLocaleString('en-IN')}
          </div>
          {plan.joiningFee > 0 && (
            <div className="text-xs text-on-surface-variant mt-0.5">
              Joining: ₹{Number(plan.joiningFee).toLocaleString('en-IN')}
            </div>
          )}
        </div>
        {displayDuration && (
          <div className="flex items-center gap-1 text-sm text-on-surface-variant bg-surface-container px-3 py-1.5 rounded-lg">
            <span className="material-symbols-outlined text-[15px]">
              {plan.sessions ? 'event_repeat' : 'calendar_month'}
            </span>
            {displayDuration}
          </div>
        )}
      </div>

      {/* Description */}
      {plan.description && (
        <p className="text-sm text-on-surface-variant line-clamp-2 leading-relaxed">
          {plan.description}
        </p>
      )}

      {/* Features (first 3) */}
      {plan.features && plan.features.length > 0 && (
        <ul className="flex flex-col gap-1">
          {plan.features.slice(0, 3).map((feat, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-primary text-[14px] mt-0.5 shrink-0">check_circle</span>
              <span className="leading-snug">{feat}</span>
            </li>
          ))}
          {plan.features.length > 3 && (
            <li className="text-xs text-on-surface-variant pl-5">+{plan.features.length - 3} more</li>
          )}
        </ul>
      )}

      {/* Footer: toggle + actions */}
      <div className="flex items-center justify-between pt-3 border-t border-outline-variant/20 mt-auto">
        {/* Active toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div className="relative inline-flex items-center">
            <input
              type="checkbox"
              checked={plan.isActive}
              onChange={() => onToggleActive(plan)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-surface-container-high rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
          </div>
          <span className="text-xs text-on-surface-variant">{plan.isActive ? 'Active' : 'Inactive'}</span>
        </label>

        {/* Edit + Delete */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onEdit(plan)}
            className="w-8 h-8 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center transition-colors"
            title="Edit plan"
          >
            <span className="material-symbols-outlined text-[15px]">edit</span>
          </button>
          <button
            onClick={() => onDelete(plan)}
            className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition-colors"
            title="Delete plan"
          >
            <span className="material-symbols-outlined text-[15px]">delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PlanList() {
  const { gymId } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [deletingPlan, setDeletingPlan] = useState(null);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const data = await getTenantCollection(gymId, 'plans');
      setPlans(data.sort((a, b) => {
        // Active first, then by name
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return (a.name || '').localeCompare(b.name || '');
      }));
    } catch {
      toast.error('Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPlans(); }, []);

  const handleSaved = () => {
    setShowForm(false);
    setEditingPlan(null);
    fetchPlans();
  };

  const handleEdit = (plan) => {
    setEditingPlan(plan);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deletingPlan) return;
    try {
      await deleteTenantDocument(gymId, 'plans', deletingPlan.id);
      toast.success('Plan deleted');
      setDeletingPlan(null);
      setPlans(prev => prev.filter(p => p.id !== deletingPlan.id));
    } catch {
      toast.error('Delete failed');
    }
  };

  const handleToggleActive = async (plan) => {
    try {
      const next = !plan.isActive;
      await updateTenantDocument(gymId, 'plans', plan.id, { isActive: next });
      setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, isActive: next } : p));
      toast.success(next ? 'Plan activated' : 'Plan deactivated');
    } catch {
      toast.error('Failed to update plan');
    }
  };

  const openAdd = () => {
    setEditingPlan(null);
    setShowForm(true);
  };

  const filtered = activeTab === 'all'
    ? plans
    : plans.filter(p => p.type === activeTab);

  const activePlans = plans.filter(p => p.isActive).length;

  return (
    <div className="flex flex-col gap-6">

      {/* Page header */}
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 className="font-h1 text-h1 text-on-surface">Membership Plans</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">Manage your gym's service packages</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-primary text-on-primary px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          New Plan
        </button>
      </div>

      {/* Summary chips */}
      {!loading && plans.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-xl text-sm shadow-sm">
            <span className="material-symbols-outlined text-primary text-[18px]">loyalty</span>
            <span className="font-semibold text-on-surface">{plans.length}</span>
            <span className="text-on-surface-variant">Total Plans</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-xl text-sm shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span className="font-semibold text-on-surface">{activePlans}</span>
            <span className="text-on-surface-variant">Active</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-xl text-sm shadow-sm">
            <span className="w-2 h-2 rounded-full bg-on-surface-variant/30 inline-block" />
            <span className="font-semibold text-on-surface">{plans.length - activePlans}</span>
            <span className="text-on-surface-variant">Inactive</span>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {tab.label}
            {tab.key !== 'all' && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key ? 'bg-white/20 text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
              }`}>
                {plans.filter(p => p.type === tab.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-on-surface-variant gap-3">
          <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
          <span className="text-sm">Loading plans...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-on-surface-variant bg-surface-container-lowest rounded-2xl border border-outline-variant/20">
          <span className="material-symbols-outlined text-6xl opacity-30">loyalty</span>
          <div className="text-center">
            <p className="font-medium text-on-surface">No plans found</p>
            <p className="text-sm mt-1">
              {activeTab === 'all' ? 'Create your first membership plan to get started.' : `No ${FILTER_TABS.find(t => t.key === activeTab)?.label} plans yet.`}
            </p>
          </div>
          {activeTab === 'all' && (
            <button
              onClick={openAdd}
              className="bg-primary text-on-primary px-5 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2 text-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Create Plan
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onEdit={handleEdit}
              onDelete={setDeletingPlan}
              onToggleActive={handleToggleActive}
            />
          ))}
        </div>
      )}

      {/* Add/Edit form modal */}
      {showForm && (
        <PlanForm
          plan={editingPlan}
          onClose={() => { setShowForm(false); setEditingPlan(null); }}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirm modal */}
      {deletingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-rose-600 text-[20px]">warning</span>
              </div>
              <div>
                <h3 className="font-semibold text-on-surface">Delete Plan?</h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  <span className="font-medium text-on-surface">"{deletingPlan.name}"</span> will be permanently deleted. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingPlan(null)}
                className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium text-sm shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
