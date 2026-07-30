import { useState, useEffect } from 'react';
import { getTenantCollection, deleteTenantDocument } from '../../firebase/tenantDb';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import WorkoutForm from './WorkoutForm';

const LEVEL_TABS = ['All', 'Beginner', 'Intermediate', 'Advanced'];

const LEVEL_BADGE = {
  Beginner: 'bg-emerald-100 text-emerald-700',
  Intermediate: 'bg-amber-100 text-amber-700',
  Advanced: 'bg-rose-100 text-rose-700',
};

const LEVEL_DOT = {
  Beginner: 'bg-emerald-500',
  Intermediate: 'bg-amber-500',
  Advanced: 'bg-rose-500',
};

const GOAL_ICON = {
  'Fat Loss': 'local_fire_department',
  'Muscle Gain': 'fitness_center',
  'Endurance': 'directions_run',
  'Flexibility': 'self_improvement',
  'General Fitness': 'sports_gymnastics',
};

function LevelBadge({ level }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${LEVEL_BADGE[level] || 'bg-surface-container text-on-surface-variant'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${LEVEL_DOT[level] || 'bg-on-surface-variant'}`} />
      {level}
    </span>
  );
}

export default function WorkoutList() {
  const { gymId } = useAuth();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchWorkouts = async () => {
    try {
      setLoading(true);
      const data = await getTenantCollection(gymId, 'workouts');
      setWorkouts(data);
    } catch {
      toast.error('Failed to load workout plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWorkouts(); }, []);

  const handleDelete = async (id) => {
    try {
      await deleteTenantDocument(gymId, 'workouts', id);
      toast.success('Workout plan deleted');
      setDeletingId(null);
      fetchWorkouts();
    } catch {
      toast.error('Failed to delete workout plan');
    }
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditingWorkout(null);
    fetchWorkouts();
  };

  const filtered = activeTab === 'All'
    ? workouts
    : workouts.filter(w => w.level === activeTab);

  const tabCounts = LEVEL_TABS.reduce((acc, tab) => {
    acc[tab] = tab === 'All' ? workouts.length : workouts.filter(w => w.level === tab).length;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">

      {/* Page Header */}
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 className="font-h1 text-h1 text-on-surface">Workout Plans</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Create and manage training programs for your members.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary text-on-primary px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          New Workout Plan
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {LEVEL_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === tab
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container-lowest border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            {tab}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
              activeTab === tab ? 'bg-white/20 text-white' : 'bg-surface-container text-on-surface-variant'
            }`}>
              {tabCounts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-on-surface-variant gap-3">
          <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
          <span className="text-sm">Loading workout plans...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-on-surface-variant bg-surface-container-lowest rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.15)]">
          <div className="w-16 h-16 rounded-full bg-primary-container/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-3xl">fitness_center</span>
          </div>
          <div className="text-center">
            <p className="font-semibold text-on-surface">No workout plans found</p>
            <p className="text-sm mt-1">
              {activeTab === 'All'
                ? 'Create your first workout plan to get started.'
                : `No ${activeTab} plans yet. Try a different filter or create one.`}
            </p>
          </div>
          {activeTab === 'All' && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-2 px-4 py-2.5 bg-primary text-on-primary rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2 text-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              New Workout Plan
            </button>
          )}
        </div>
      )}

      {/* Card Grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(workout => (
            <div
              key={workout.id}
              className="bg-white rounded-2xl shadow-sm border border-outline-variant/20 flex flex-col hover:shadow-md transition-shadow"
            >
              {/* Card Top: colored band by level */}
              <div className={`h-1.5 rounded-t-2xl ${
                workout.level === 'Beginner' ? 'bg-emerald-400' :
                workout.level === 'Intermediate' ? 'bg-amber-400' :
                'bg-rose-400'
              }`} />

              <div className="flex flex-col gap-3 p-5 flex-1">
                {/* Name + Level Badge */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-on-surface text-base leading-snug flex-1">{workout.name}</h3>
                  <LevelBadge level={workout.level} />
                </div>

                {/* Goal + Duration chips */}
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-primary-container/30 text-primary">
                    <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {GOAL_ICON[workout.goal] || 'sports_gymnastics'}
                    </span>
                    {workout.goal}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant">
                    <span className="material-symbols-outlined text-[13px]">timer</span>
                    {workout.durationMinutes} min
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant">
                    <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                    {workout.daysPerWeek}x / week
                  </span>
                </div>

                {/* Description */}
                {workout.description ? (
                  <p className="text-sm text-on-surface-variant line-clamp-2 leading-relaxed">
                    {workout.description}
                  </p>
                ) : (
                  <p className="text-sm text-on-surface-variant italic opacity-60">No description provided.</p>
                )}

                {/* Exercise count */}
                <div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-auto pt-2 border-t border-outline-variant/20">
                  <span className="material-symbols-outlined text-[14px]">format_list_bulleted</span>
                  {workout.exercises?.length
                    ? `${workout.exercises.length} exercise${workout.exercises.length !== 1 ? 's' : ''}`
                    : 'No exercises added'}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 px-5 pb-4">
                <button
                  onClick={() => setEditingWorkout(workout)}
                  className="flex-1 bg-surface-container hover:bg-surface-container-high text-on-surface-variant px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-1.5 font-medium"
                >
                  <span className="material-symbols-outlined text-[15px]">edit</span>
                  Edit
                </button>
                <button
                  onClick={() => setDeletingId(workout.id)}
                  className="px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-sm transition-colors flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Workout Form Modal */}
      {showForm && (
        <WorkoutForm
          onClose={() => setShowForm(false)}
          onSaved={handleSaved}
        />
      )}
      {editingWorkout && (
        <WorkoutForm
          workout={editingWorkout}
          onClose={() => setEditingWorkout(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Delete Confirmation */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-rose-600 text-[20px]">warning</span>
              </div>
              <div>
                <h3 className="font-semibold text-on-surface">Delete Workout Plan?</h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  This will permanently remove the workout plan and all its exercises. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium text-sm shadow-sm transition-colors"
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
