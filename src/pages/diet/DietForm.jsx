import { useState } from 'react';
import { createTenantDocument, updateTenantDocument } from '../../firebase/tenantDb';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const GOAL_OPTIONS = [
  { value: 'weight-loss', label: 'Weight Loss' },
  { value: 'muscle-gain', label: 'Muscle Gain' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'medical', label: 'Medical' },
];

const MEAL_NAME_OPTIONS = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Pre-Workout', 'Post-Workout', 'Custom'];

function emptyMeal() {
  return { mealName: 'Breakfast', description: '', calories: '' };
}

function MacroCalorieSummary({ protein, carbs, fat, caloriesPerDay }) {
  const p = Number(protein) || 0;
  const c = Number(carbs) || 0;
  const f = Number(fat) || 0;
  const target = Number(caloriesPerDay) || 0;

  if (!p && !c && !f) return null;

  const macroTotal = p * 4 + c * 4 + f * 9;
  const diff = target > 0 ? Math.abs(macroTotal - target) : null;
  const withinRange = diff !== null && diff <= target * 0.05;
  const hasTarget = target > 0;

  return (
    <div
      className={`flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs border ${
        !hasTarget
          ? 'bg-surface-container border-outline-variant/30 text-on-surface-variant'
          : withinRange
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : 'bg-amber-50 border-amber-200 text-amber-700'
      }`}
    >
      <span className="material-symbols-outlined text-[15px] mt-0.5 shrink-0">
        {!hasTarget ? 'info' : withinRange ? 'check_circle' : 'warning'}
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold">
          Macro calories: {macroTotal} kcal
          {hasTarget && (
            <span className="font-normal ml-1">
              ({withinRange ? 'matches' : `${diff > 0 ? '+' : ''}${macroTotal - target} vs`} target {target} kcal)
            </span>
          )}
        </span>
        <span className="opacity-80">
          {p}g protein × 4 + {c}g carbs × 4 + {f}g fat × 9
        </span>
      </div>
    </div>
  );
}

export default function DietForm({ plan, onClose, onSaved }) {
  const { gymId } = useAuth();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(plan?.name || '');
  const [goal, setGoal] = useState(plan?.goal || 'weight-loss');
  const [caloriesPerDay, setCaloriesPerDay] = useState(plan?.caloriesPerDay || '');
  const [protein, setProtein] = useState(plan?.protein || '');
  const [carbs, setCarbs] = useState(plan?.carbs || '');
  const [fat, setFat] = useState(plan?.fat || '');
  const [assignedMemberId, setAssignedMemberId] = useState(plan?.assignedMemberId || '');
  const [description, setDescription] = useState(plan?.description || '');
  const [meals, setMeals] = useState(
    plan?.meals?.length > 0 ? plan.meals : [emptyMeal()]
  );

  const handleMealChange = (index, field, value) => {
    setMeals((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addMeal = () => {
    setMeals((prev) => [...prev, emptyMeal()]);
  };

  const removeMeal = (index) => {
    setMeals((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Plan name is required');
      return;
    }
    if (!caloriesPerDay || Number(caloriesPerDay) <= 0) {
      toast.error('Calories per day must be a positive number');
      return;
    }

    setSaving(true);

    const payload = {
      name: name.trim(),
      goal,
      caloriesPerDay: Number(caloriesPerDay),
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      assignedMemberId: assignedMemberId.trim() || null,
      assignedMemberName: assignedMemberId.trim() || null,
      description: description.trim(),
      meals: meals
        .filter((m) => m.mealName || m.description || m.calories)
        .map((m) => ({
          mealName: m.mealName,
          description: m.description,
          calories: Number(m.calories) || 0,
        })),
      updatedAt: new Date().toISOString(),
    };

    try {
      if (plan?.id) {
        await updateTenantDocument(gymId, 'dietPlans', plan.id, payload);
        toast.success('Diet plan updated');
      } else {
        await createTenantDocument(gymId, 'dietPlans', {
          ...payload,
          createdAt: new Date().toISOString(),
        });
        toast.success('Diet plan created');
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save diet plan');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary text-sm transition-colors';
  const labelClass = 'text-sm font-medium text-on-surface-variant';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 bg-surface-container-lowest rounded-t-2xl">
          <div>
            <h2 className="font-bold text-on-surface text-lg leading-tight">
              {plan?.id ? 'Edit Diet Plan' : 'New Diet Plan'}
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              {plan?.id ? 'Update nutrition details' : 'Create a nutrition plan for a member or as a reusable template'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          id="diet-form"
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 px-6 py-5 overflow-y-auto"
        >
          {/* Plan Name */}
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>
              Plan Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer Cut Plan, Lean Bulk Phase 1"
              required
              className={inputClass}
            />
          </div>

          {/* Goal */}
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>
              Goal <span className="text-rose-500">*</span>
            </label>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              required
              className={inputClass}
            >
              {GOAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Daily Macros Section */}
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-on-surface">Daily Macros</p>

            {/* Calories */}
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>
                Calories / Day (kcal) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={caloriesPerDay}
                onChange={(e) => setCaloriesPerDay(e.target.value)}
                placeholder="2000"
                required
                className={inputClass}
              />
            </div>

            {/* Protein, Carbs, Fat */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-emerald-600">
                  Protein (g) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  placeholder="150"
                  required
                  className="w-full px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-on-surface outline-none focus:border-emerald-400 text-sm transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-blue-600">
                  Carbs (g) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                  placeholder="200"
                  required
                  className="w-full px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-on-surface outline-none focus:border-blue-400 text-sm transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-orange-600">
                  Fat (g) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={fat}
                  onChange={(e) => setFat(e.target.value)}
                  placeholder="60"
                  required
                  className="w-full px-4 py-2.5 bg-orange-50 border border-orange-200 rounded-xl text-on-surface outline-none focus:border-orange-400 text-sm transition-colors"
                />
              </div>
            </div>

            {/* Macro validation hint */}
            <MacroCalorieSummary
              protein={protein}
              carbs={carbs}
              fat={fat}
              caloriesPerDay={caloriesPerDay}
            />
          </div>

          {/* Assigned Member */}
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>
              Assigned Member
              <span className="ml-1.5 text-xs font-normal text-on-surface-variant opacity-60">(leave blank to save as template)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px] text-on-surface-variant">person</span>
              <input
                type="text"
                value={assignedMemberId}
                onChange={(e) => setAssignedMemberId(e.target.value)}
                placeholder="Member name or ID (optional)"
                className="w-full pl-9 pr-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary text-sm transition-colors"
              />
            </div>
            {!assignedMemberId.trim() && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">bookmark</span>
                This plan will be saved as a reusable template
              </p>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief overview of this diet plan, goals, dietary restrictions..."
              className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface outline-none focus:border-primary text-sm transition-colors resize-none"
            />
          </div>

          {/* Meals Section */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-on-surface">Meal Schedule</p>
              <span className="text-xs text-on-surface-variant">
                {meals.length} meal{meals.length !== 1 ? 's' : ''}
              </span>
            </div>

            {meals.length === 0 && (
              <p className="text-xs text-on-surface-variant italic px-1">No meals added. Click "Add Meal" to begin.</p>
            )}

            {meals.map((meal, index) => (
              <div
                key={index}
                className="flex flex-col gap-3 p-4 bg-surface-container-low border border-outline-variant/30 rounded-xl"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    Meal {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeMeal(index)}
                    className="w-6 h-6 rounded-full hover:bg-rose-50 flex items-center justify-center text-on-surface-variant hover:text-rose-500 transition-colors"
                    title="Remove meal"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Meal Name */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-on-surface-variant">Meal Name</label>
                    {meal.mealName === 'Custom' || !MEAL_NAME_OPTIONS.includes(meal.mealName) ? (
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={meal.mealName === 'Custom' ? '' : meal.mealName}
                          onChange={(e) => handleMealChange(index, 'mealName', e.target.value || 'Custom')}
                          placeholder="e.g. Evening Snack"
                          className="flex-1 px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface text-xs outline-none focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => handleMealChange(index, 'mealName', 'Breakfast')}
                          className="px-2 rounded-lg border border-outline-variant/30 hover:bg-surface-container text-on-surface-variant text-xs"
                          title="Pick from list"
                        >
                          <span className="material-symbols-outlined text-[14px]">list</span>
                        </button>
                      </div>
                    ) : (
                      <select
                        value={meal.mealName}
                        onChange={(e) => handleMealChange(index, 'mealName', e.target.value)}
                        className="w-full px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface text-xs outline-none focus:border-primary"
                      >
                        {MEAL_NAME_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Calories */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-on-surface-variant">Calories (kcal)</label>
                    <input
                      type="number"
                      min="0"
                      value={meal.calories}
                      onChange={(e) => handleMealChange(index, 'calories', e.target.value)}
                      placeholder="e.g. 400"
                      className="w-full px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface text-xs outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* Meal Description */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-on-surface-variant">Description</label>
                  <input
                    type="text"
                    value={meal.description}
                    onChange={(e) => handleMealChange(index, 'description', e.target.value)}
                    placeholder="e.g. Oatmeal with banana, boiled eggs, black coffee"
                    className="w-full px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addMeal}
              className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-outline-variant/50 rounded-xl text-on-surface-variant hover:bg-surface-container hover:border-primary hover:text-primary transition-colors text-sm font-medium"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add Meal
            </button>
          </div>
        </form>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 flex justify-end gap-3 px-6 py-4 border-t border-outline-variant/20 bg-surface-container-lowest rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="diet-form"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-on-primary rounded-lg font-medium hover:bg-primary/90 shadow-sm text-sm disabled:opacity-70 transition-colors"
          >
            {saving ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                Saving...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">save</span>
                {plan?.id ? 'Save Changes' : 'Create Plan'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
