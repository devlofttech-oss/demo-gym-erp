import { useState, useEffect } from 'react';
import { createTenantDocument, updateTenantDocument, getTenantCollection } from '../../firebase/tenantDb';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const EMPTY_EXERCISE = { name: '', sets: '', reps: '', restSeconds: '', notes: '' };

const EMPTY_FORM = {
  name: '',
  level: 'Beginner',
  goal: 'General Fitness',
  durationMinutes: '',
  daysPerWeek: '',
  description: '',
  exercises: [],
  assignedMemberId: '',
  assignedMemberName: '',
};

const LEVEL_OPTIONS = ['Beginner', 'Intermediate', 'Advanced'];
const GOAL_OPTIONS = ['Fat Loss', 'Muscle Gain', 'Endurance', 'Flexibility', 'General Fitness'];

export default function WorkoutForm({ workout, onClose, onSaved }) {
  const { gymId } = useAuth();

  const [form, setForm] = useState(() => {
    if (!workout) return { ...EMPTY_FORM, exercises: [] };
    return {
      name: workout.name || '',
      level: workout.level || 'Beginner',
      goal: workout.goal || 'General Fitness',
      durationMinutes: workout.durationMinutes != null ? String(workout.durationMinutes) : '',
      daysPerWeek: workout.daysPerWeek != null ? String(workout.daysPerWeek) : '',
      description: workout.description || '',
      exercises: workout.exercises ? workout.exercises.map(ex => ({ ...ex })) : [],
      assignedMemberId: workout.assignedMemberId || '',
      assignedMemberName: workout.assignedMemberName || '',
    };
  });

  const [saving, setSaving] = useState(false);
  const [membersList, setMembersList] = useState([]);
  useEffect(() => {
    getTenantCollection(gymId, 'members').then(data => {
      setMembersList(data.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    }).catch(() => {});
  }, [gymId]);

  const handle = (e) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
  };

  const handleExercise = (idx, e) => {
    const { name, value } = e.target;
    setForm(p => {
      const exercises = [...p.exercises];
      exercises[idx] = { ...exercises[idx], [name]: value };
      return { ...p, exercises };
    });
  };

  const addExercise = () => {
    setForm(p => ({ ...p, exercises: [...p.exercises, { ...EMPTY_EXERCISE }] }));
  };

  const removeExercise = (idx) => {
    setForm(p => ({ ...p, exercises: p.exercises.filter((_, i) => i !== idx) }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Workout name is required'); return; }
    if (!form.durationMinutes || Number(form.durationMinutes) <= 0) { toast.error('Duration must be greater than 0'); return; }
    if (!form.daysPerWeek || Number(form.daysPerWeek) < 1 || Number(form.daysPerWeek) > 7) { toast.error('Days per week must be between 1 and 7'); return; }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        level: form.level,
        goal: form.goal,
        durationMinutes: Number(form.durationMinutes),
        daysPerWeek: Number(form.daysPerWeek),
        description: form.description.trim(),
        assignedMemberId: form.assignedMemberId || null,
        assignedMemberName: form.assignedMemberName || null,
        exercises: form.exercises.map(ex => ({
          name: ex.name.trim(),
          sets: ex.sets ? Number(ex.sets) : null,
          reps: ex.reps ? Number(ex.reps) : null,
          restSeconds: ex.restSeconds ? Number(ex.restSeconds) : null,
          notes: ex.notes.trim(),
        })),
      };

      if (workout?.id) {
        await updateTenantDocument(gymId, 'workouts', workout.id, payload);
        toast.success('Workout plan updated!');
      } else {
        await createTenantDocument(gymId, 'workouts', payload);
        toast.success('Workout plan created!');
      }
      onSaved();
    } catch {
      toast.error('Failed to save workout plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-outline-variant/20 sticky top-0 bg-surface-container-lowest z-10">
          <h2 className="font-bold text-on-surface text-lg">
            {workout ? 'Edit Workout Plan' : 'New Workout Plan'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4 p-5">

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface-variant">
              Plan Name <span className="text-error">*</span>
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handle}
              placeholder="e.g. Full Body Burn, Strength Builder"
              className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary"
            />
          </div>

          {/* Level + Goal */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">
                Level <span className="text-error">*</span>
              </label>
              <select
                name="level"
                value={form.level}
                onChange={handle}
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary appearance-none"
              >
                {LEVEL_OPTIONS.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">
                Goal <span className="text-error">*</span>
              </label>
              <select
                name="goal"
                value={form.goal}
                onChange={handle}
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary appearance-none"
              >
                {GOAL_OPTIONS.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Duration + Days per Week */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">
                Duration (minutes) <span className="text-error">*</span>
              </label>
              <input
                type="number"
                name="durationMinutes"
                value={form.durationMinutes}
                onChange={handle}
                min="1"
                placeholder="e.g. 45"
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">
                Days per Week <span className="text-error">*</span>
              </label>
              <input
                type="number"
                name="daysPerWeek"
                value={form.daysPerWeek}
                onChange={handle}
                min="1"
                max="7"
                placeholder="e.g. 4"
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Assigned Member */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface-variant">
              Assigned Member <span className="text-xs font-normal text-on-surface-variant opacity-60">(optional — leave blank to save as template)</span>
            </label>
            <select
              name="assignedMemberId"
              value={form.assignedMemberId}
              onChange={e => {
                const m = membersList.find(m => m.id === e.target.value);
                setForm(p => ({ ...p, assignedMemberId: e.target.value, assignedMemberName: m?.name || '' }));
              }}
              className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary appearance-none"
            >
              <option value="">No member — save as template</option>
              {membersList.map(m => (
                <option key={m.id} value={m.id}>{m.name} — {m.phone}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-on-surface-variant">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handle}
              rows={3}
              placeholder="Brief description of this workout plan..."
              className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary resize-none"
            />
          </div>

          {/* Exercises Section */}
          <div className="flex flex-col gap-3 pt-2 border-t border-outline-variant/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-on-surface">Exercises</div>
                <div className="text-xs text-on-surface-variant">{form.exercises.length} exercise{form.exercises.length !== 1 ? 's' : ''} added</div>
              </div>
              <button
                type="button"
                onClick={addExercise}
                className="px-3 py-2 bg-primary/10 text-primary rounded-lg font-medium text-sm hover:bg-primary/20 transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Add Exercise
              </button>
            </div>

            {form.exercises.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-6 border border-dashed border-outline-variant/40 rounded-xl text-on-surface-variant">
                <span className="material-symbols-outlined text-3xl opacity-40">fitness_center</span>
                <p className="text-sm">No exercises yet. Click "Add Exercise" to begin.</p>
              </div>
            )}

            {form.exercises.map((ex, idx) => (
              <div key={idx} className="flex flex-col gap-3 p-4 bg-surface-container rounded-xl border border-outline-variant/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Exercise {idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeExercise(idx)}
                    className="w-7 h-7 rounded-full hover:bg-rose-100 flex items-center justify-center text-on-surface-variant hover:text-rose-600 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>

                {/* Exercise Name */}
                <input
                  name="name"
                  value={ex.name}
                  onChange={e => handleExercise(idx, e)}
                  placeholder="Exercise name (e.g. Barbell Squat)"
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-on-surface text-sm outline-none focus:border-primary"
                />

                {/* Sets / Reps / Rest */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-on-surface-variant">Sets</label>
                    <input
                      type="number"
                      name="sets"
                      value={ex.sets}
                      onChange={e => handleExercise(idx, e)}
                      min="1"
                      placeholder="3"
                      className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-on-surface text-sm outline-none focus:border-primary"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-on-surface-variant">Reps</label>
                    <input
                      type="number"
                      name="reps"
                      value={ex.reps}
                      onChange={e => handleExercise(idx, e)}
                      min="1"
                      placeholder="12"
                      className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-on-surface text-sm outline-none focus:border-primary"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-on-surface-variant">Rest (sec)</label>
                    <input
                      type="number"
                      name="restSeconds"
                      value={ex.restSeconds}
                      onChange={e => handleExercise(idx, e)}
                      min="0"
                      placeholder="60"
                      className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-on-surface text-sm outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* Notes */}
                <input
                  name="notes"
                  value={ex.notes}
                  onChange={e => handleExercise(idx, e)}
                  placeholder="Notes (e.g. keep back straight, go to failure)"
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-on-surface text-sm outline-none focus:border-primary"
                />
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-primary text-on-primary rounded-lg font-medium hover:bg-primary/90 shadow-sm flex items-center gap-2 disabled:opacity-70 text-sm"
            >
              {saving
                ? <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> Saving...</>
                : <><span className="material-symbols-outlined text-[16px]">save</span> {workout ? 'Update Plan' : 'Create Plan'}</>
              }
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
