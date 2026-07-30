import { useState, useEffect, useCallback } from 'react';
import { getTenantCollection, deleteTenantDocument } from '../../firebase/tenantDb';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import DietForm from './DietForm';

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'weight-loss', label: 'Weight Loss' },
  { key: 'muscle-gain', label: 'Muscle Gain' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'medical', label: 'Medical' },
];

const GOAL_META = {
  'weight-loss': { label: 'Weight Loss', dotColor: 'bg-rose-400', badgeClass: 'bg-rose-50 text-rose-600' },
  'muscle-gain': { label: 'Muscle Gain', dotColor: 'bg-emerald-400', badgeClass: 'bg-emerald-50 text-emerald-600' },
  maintenance: { label: 'Maintenance', dotColor: 'bg-blue-400', badgeClass: 'bg-blue-50 text-blue-600' },
  medical: { label: 'Medical', dotColor: 'bg-purple-400', badgeClass: 'bg-purple-50 text-purple-600' },
};

function GoalBadge({ goal }) {
  const meta = GOAL_META[goal] || { label: goal, dotColor: 'bg-slate-400', badgeClass: 'bg-surface-container text-on-surface-variant' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${meta.badgeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dotColor}`} />
      {meta.label}
    </span>
  );
}

function MacroTag({ label, value, unit, colorClass }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      <span className="font-bold">{value ?? '—'}</span>
      <span className="opacity-70">{unit} {label}</span>
    </span>
  );
}

function StatCard({ icon, label, value, iconColor }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconColor}`}>
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-xl font-bold text-on-surface leading-tight">{value}</span>
        <span className="text-xs text-on-surface-variant">{label}</span>
      </div>
    </div>
  );
}

function DietCard({ plan, onEdit, onDelete }) {
  const isTemplate = !plan.assignedMemberId && !plan.assignedMemberName;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <h3 className="font-bold text-on-surface text-base leading-tight truncate">{plan.name}</h3>
          <div className="flex items-center gap-1.5 text-on-surface-variant text-sm">
            <span className="material-symbols-outlined text-[15px]">person</span>
            <span className="truncate">{isTemplate ? 'Template' : (plan.assignedMemberName || plan.assignedMemberId)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit(plan)}
            className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors"
            title="Edit plan"
          >
            <span className="material-symbols-outlined text-[17px]">edit</span>
          </button>
          <button
            onClick={() => onDelete(plan)}
            className="w-8 h-8 rounded-full hover:bg-rose-50 flex items-center justify-center text-on-surface-variant hover:text-rose-500 transition-colors"
            title="Delete plan"
          >
            <span className="material-symbols-outlined text-[17px]">delete</span>
          </button>
        </div>
      </div>

      {/* Goal badge + template indicator */}
      <div className="flex items-center gap-2 flex-wrap">
        <GoalBadge goal={plan.goal} />
        {isTemplate && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">
            <span className="material-symbols-outlined text-[11px]">bookmark</span>
            Template
          </span>
        )}
      </div>

      {/* Calories */}
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[16px] text-amber-500">local_fire_department</span>
        <span className="text-sm font-semibold text-on-surface">{plan.caloriesPerDay ?? '—'}</span>
        <span className="text-xs text-on-surface-variant">kcal / day</span>
      </div>

      {/* Macro breakdown */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <MacroTag label="Protein" value={plan.protein} unit="g" colorClass="bg-emerald-50 text-emerald-700" />
        <MacroTag label="Carbs" value={plan.carbs} unit="g" colorClass="bg-blue-50 text-blue-700" />
        <MacroTag label="Fat" value={plan.fat} unit="g" colorClass="bg-orange-50 text-orange-700" />
      </div>

      {/* Description */}
      {plan.description && (
        <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-2">{plan.description}</p>
      )}

      {/* Meal count */}
      {plan.meals?.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-on-surface-variant border-t border-outline-variant/20 pt-3">
          <span className="material-symbols-outlined text-[13px]">restaurant_menu</span>
          <span>{plan.meals.length} meal{plan.meals.length !== 1 ? 's' : ''} planned</span>
        </div>
      )}
    </div>
  );
}

export default function DietList() {
  const { gymId } = useAuth();

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTenantCollection(gymId, 'dietPlans');
      setPlans(data || []);
    } catch {
      toast.error('Failed to load diet plans');
    } finally {
      setLoading(false);
    }
  }, [gymId]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleEdit = (plan) => {
    setEditingPlan(plan);
    setShowForm(true);
  };

  const handleCreateNew = () => {
    setEditingPlan(null);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingPlan(null);
  };

  const handleSaved = () => {
    fetchPlans();
  };

  const handleDelete = async (plan) => {
    const confirmed = window.confirm(
      `Delete "${plan.name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(plan.id);
    try {
      await deleteTenantDocument(gymId, 'dietPlans', plan.id);
      toast.success('Diet plan deleted');
      fetchPlans();
    } catch {
      toast.error('Failed to delete diet plan');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredPlans =
    activeTab === 'all' ? plans : plans.filter((p) => p.goal === activeTab);

  const totalPlans = plans.length;
  const templates = plans.filter((p) => !p.assignedMemberId && !p.assignedMemberName).length;
  const assigned = plans.filter((p) => p.assignedMemberId || p.assignedMemberName).length;
  const avgCalories =
    plans.length > 0
      ? Math.round(plans.reduce((sum, p) => sum + (Number(p.caloriesPerDay) || 0), 0) / plans.length)
      : 0;

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-h1 text-h1 text-on-surface">Diet & Nutrition</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">Manage diet plans and nutrition goals</p>
        </div>
        <button
          onClick={handleCreateNew}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl font-medium hover:bg-primary/90 shadow-sm text-sm transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Diet Plan
        </button>
      </div>

      {/* Stat Summary Cards */}
      {!loading && plans.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon="nutrition" label="Total Plans" value={totalPlans} iconColor="bg-primary/10 text-primary" />
          <StatCard icon="bookmark" label="Templates" value={templates} iconColor="bg-amber-100 text-amber-600" />
          <StatCard icon="person" label="Assigned to Members" value={assigned} iconColor="bg-emerald-100 text-emerald-600" />
          <StatCard icon="local_fire_department" label="Avg Calories / Day" value={avgCalories ? `${avgCalories}` : '—'} iconColor="bg-orange-100 text-orange-600" />
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 flex-wrap bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-1 w-fit">
        {FILTER_TABS.map((tab) => {
          const count = tab.key === 'all' ? plans.length : plans.filter((p) => p.goal === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {tab.label}
              {!loading && (
                <span
                  className={`text-xs font-bold px-1.5 py-0.5 rounded-full leading-none ${
                    activeTab === tab.key ? 'bg-white/20 text-on-primary' : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
            <span className="text-sm">Loading diet plans...</span>
          </div>
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant">nutrition</span>
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-on-surface text-base">
              {activeTab === 'all' ? 'No diet plans yet' : `No ${GOAL_META[activeTab]?.label || activeTab} plans yet`}
            </p>
            <p className="text-sm text-on-surface-variant max-w-xs">
              {activeTab === 'all'
                ? 'Start by creating a diet plan to track nutrition goals for your members.'
                : 'No plans match this goal filter. Switch tabs or create a new plan.'}
            </p>
          </div>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl font-medium hover:bg-primary/90 shadow-sm text-sm transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Diet Plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlans.map((plan) => (
            <div
              key={plan.id}
              className={deletingId === plan.id ? 'opacity-50 pointer-events-none transition-opacity' : ''}
            >
              <DietCard plan={plan} onEdit={handleEdit} onDelete={handleDelete} />
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <DietForm
          plan={editingPlan}
          onClose={handleCloseForm}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
