import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { getCollection, createDocument, updateDocument, getDocument } from '../../firebase/db';
import toast from 'react-hot-toast';

const CLASS_TYPES = ['Zumba', 'Yoga', 'Dance', 'HIIT', 'Kids Dance', 'Gym', 'Other'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const EMPTY = {
  name: '', type: [], trainerId: '', trainerName: '',
  capacity: '', description: '', schedule: [],
};

export default function AddClass() {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEdit = Boolean(editId);

  const [form, setForm] = useState(EMPTY);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const [staffData, classData] = await Promise.all([
        getCollection('staff'),
        isEdit ? getDocument('classes', editId) : Promise.resolve(null),
      ]);
      setStaff(staffData.filter(s => s.role === 'Trainer'));
      if (classData) setForm({
        name: classData.name || '',
        type: Array.isArray(classData.type)
          ? classData.type
          : (classData.type ? [classData.type] : []),
        trainerId: classData.trainerId || '', trainerName: classData.trainerName || '',
        capacity: classData.capacity || '', description: classData.description || '',
        schedule: classData.schedule || [],
      });
      setLoading(false);
    };
    init();
  }, [editId]);

  const handle = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleTrainer = (e) => {
    const s = staff.find(x => x.id === e.target.value);
    setForm(p => ({ ...p, trainerId: e.target.value, trainerName: s ? s.name : '' }));
  };

  const addSlot = () => setForm(p => ({ ...p, schedule: [...p.schedule, { day: 'Monday', startTime: '', endTime: '' }] }));
  const removeSlot = (i) => setForm(p => ({ ...p, schedule: p.schedule.filter((_, idx) => idx !== i) }));
  const updateSlot = (i, field, val) => setForm(p => ({
    ...p, schedule: p.schedule.map((s, idx) => idx === i ? { ...s, [field]: val } : s)
  }));

  const toggleType = (t) => {
    setForm(p => ({
      ...p,
      type: p.type.includes(t) ? p.type.filter(x => x !== t) : [...p.type, t],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) { toast.error('Class name is required'); return; }
    if (form.type.length === 0) { toast.error('Select at least one class type'); return; }
    setSaving(true);
    try {
      const data = { ...form, capacity: Number(form.capacity) || 0 };
      if (isEdit) {
        await updateDocument('classes', editId, data);
        toast.success('Class updated!');
        navigate(`/classes/${editId}`);
      } else {
        const doc = await createDocument('classes', { ...data, enrolledMemberIds: [] });
        toast.success('Class created!');
        navigate(`/classes/${doc.id}`);
      }
    } catch (err) { console.error(err); toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-75 text-on-surface-variant">
      <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-4">
        <Link to="/classes" className="w-10 h-10 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center transition-colors text-on-surface">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <div>
          <h1 className="font-h2 text-h2 text-on-surface">{isEdit ? 'Edit Class' : 'Create New Class'}</h1>
          <p className="text-sm text-on-surface-variant">Set up class details and schedule</p>
        </div>
      </div>

      <div className="bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.15)]">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">

          {/* Basic Info */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">info</span> Class Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-sm font-medium text-on-surface">Class Name *</label>
                <input required name="name" value={form.name} onChange={handle} placeholder="e.g. Morning Zumba Batch"
                  className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary" />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-sm font-medium text-on-surface">
                  Class Type <span className="text-on-surface-variant font-normal">(select all that apply)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {CLASS_TYPES.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleType(t)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                        form.type.includes(t)
                          ? 'bg-primary text-on-primary border-primary shadow-sm'
                          : 'bg-surface-container border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {form.type.length === 0 && (
                  <span className="text-xs text-rose-500">Please select at least one type</span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-on-surface">Capacity</label>
                <input type="number" name="capacity" value={form.capacity} onChange={handle} placeholder="Max members" min="0"
                  className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-on-surface">Trainer</label>
                <select value={form.trainerId} onChange={handleTrainer}
                  className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary appearance-none">
                  <option value="">-- Select Trainer --</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-sm font-medium text-on-surface">Description</label>
                <textarea name="description" value={form.description} onChange={handle} rows={3}
                  placeholder="Brief description of the class..."
                  className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary resize-none" />
              </div>
            </div>
          </div>

          <div className="border-t border-outline-variant/20" />

          {/* Schedule */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">schedule</span> Schedule
              </h2>
              <button type="button" onClick={addSlot}
                className="flex items-center gap-1 text-primary hover:text-primary/80 text-sm font-medium transition-colors">
                <span className="material-symbols-outlined text-[16px]">add</span> Add Time Slot
              </button>
            </div>
            {form.schedule.length === 0 ? (
              <p className="text-sm text-on-surface-variant italic">No schedule added yet. Click "Add Time Slot" to add.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {form.schedule.map((slot, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-surface-container rounded-xl border border-outline-variant/20">
                    <select value={slot.day} onChange={e => updateSlot(i, 'day', e.target.value)}
                      className="flex-1 px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary text-sm appearance-none">
                      {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <input type="time" value={slot.startTime} onChange={e => updateSlot(i, 'startTime', e.target.value)}
                      className="px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary text-sm" />
                    <span className="text-on-surface-variant text-sm">to</span>
                    <input type="time" value={slot.endTime} onChange={e => updateSlot(i, 'endTime', e.target.value)}
                      className="px-3 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary text-sm" />
                    <button type="button" onClick={() => removeSlot(i)}
                      className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition-colors">
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-outline-variant/30 pt-4 flex justify-end gap-3">
            <Link to="/classes" className="px-5 py-2.5 rounded-lg text-on-surface-variant font-medium hover:bg-surface-container transition-colors">Cancel</Link>
            <button type="submit" disabled={saving}
              className="bg-primary text-on-primary px-6 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-70 flex items-center gap-2">
              {saving ? <><span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> Saving...</> : <><span className="material-symbols-outlined text-[18px]">save</span> {isEdit ? 'Update Class' : 'Create Class'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
