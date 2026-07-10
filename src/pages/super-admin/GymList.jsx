import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getCollection, updateDocument, deleteDocument, getDocument } from '../../firebase/db';
import { getTenantCollection, deleteTenantDocument } from '../../firebase/tenantDb';
import { useAuth } from '../../context/AuthContext';

const SUB_COLLECTIONS = [
  'members', 'payments', 'attendance', 'staffAttendance',
  'staff', 'classes', 'equipment', 'supplements', 'expenses', 'settings',
];

async function deleteGymFully(gymId) {
  const gym = await getDocument('gyms', gymId);

  // Delete all sub-collection docs
  for (const coll of SUB_COLLECTIONS) {
    const docs = await getTenantCollection(gymId, coll).catch(() => []);
    for (const doc of docs) {
      await deleteTenantDocument(gymId, coll, doc.id).catch(() => {});
    }
  }

  // Delete users docs tied to this gym (admin + staff)
  const gymUsers = await getCollection('users', [{ field: 'gymId', op: '==', value: gymId }]).catch(() => []);
  for (const u of gymUsers) {
    await deleteDocument('users', u.id).catch(() => {});
  }

  // Delete gym doc
  await deleteDocument('gyms', gymId);
}

export default function GymList() {
  const { enterGym } = useAuth();
  const navigate = useNavigate();
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchGyms = async () => {
    setLoading(true);
    try {
      const data = await getCollection('gyms', [], { field: 'createdAt', direction: 'desc' });
      setGyms(data);
    } catch { toast.error('Failed to load gyms'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchGyms(); }, []);

  const handleToggle = async (gym) => {
    setTogglingId(gym.id);
    try {
      const newStatus = !(gym.isActive !== false);
      await updateDocument('gyms', gym.id, { isActive: newStatus });
      setGyms(prev => prev.map(g => g.id === gym.id ? { ...g, isActive: newStatus } : g));
      toast.success(`${gym.name} is now ${newStatus ? 'active' : 'inactive'}`);
    } catch { toast.error('Failed to update status'); }
    finally { setTogglingId(null); }
  };

  const handleDelete = async (gymId) => {
    setDeletingId(gymId);
    try {
      await deleteGymFully(gymId);
      setGyms(prev => prev.filter(g => g.id !== gymId));
      toast.success('Gym deleted successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete gym');
    } finally {
      setDeletingId(null);
      setDeleteConfirmId(null);
    }
  };

  const filtered = gyms.filter(g => {
    const t = searchTerm.toLowerCase();
    return !t || g.name?.toLowerCase().includes(t) || g.ownerEmail?.toLowerCase().includes(t) || g.address?.toLowerCase().includes(t);
  });

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-h1 text-h1 text-on-surface">All Gyms</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">Manage gym accounts and subscription status.</p>
        </div>
        <Link to="/super-admin/gyms/new"
          className="bg-primary text-on-primary px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">add</span>
          Add Gym
        </Link>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2.5 max-w-sm shadow-sm">
        <span className="material-symbols-outlined text-on-surface-variant text-[20px]">search</span>
        <input type="text" placeholder="Search by name, email, city…" value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="flex-1 bg-transparent text-on-surface outline-none text-sm placeholder:text-on-surface-variant" />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        )}
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/20 bg-surface-container-low/50">
                {['Gym', 'Contact', 'Owner Email', 'Plan', 'Status', 'Actions'].map(h => (
                  <th key={h} className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-10 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined animate-spin text-2xl mr-2">progress_activity</span> Loading…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center">
                  <div className="flex flex-col items-center gap-3 text-on-surface-variant">
                    <span className="material-symbols-outlined text-5xl opacity-30">fitness_center</span>
                    <p className="font-medium">{searchTerm ? 'No gyms match your search' : 'No gyms yet'}</p>
                    {!searchTerm && (
                      <Link to="/super-admin/gyms/new" className="bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
                        Add First Gym
                      </Link>
                    )}
                  </div>
                </td></tr>
              ) : filtered.map(gym => {
                const isActive = gym.isActive !== false;
                return (
                  <tr key={gym.id} className="border-b border-outline-variant/10 hover:bg-surface-container/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl overflow-hidden bg-primary-container/20 shrink-0 flex items-center justify-center">
                          {gym.logoUrl
                            ? <img src={gym.logoUrl} alt={gym.name} className="w-full h-full object-cover" />
                            : <span className="material-symbols-outlined text-primary text-[22px]">fitness_center</span>
                          }
                        </div>
                        <div>
                          <div className="font-semibold text-on-surface">{gym.name}</div>
                          <div className="text-xs text-on-surface-variant">{gym.address}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-on-surface-variant">{gym.phone || '—'}</td>
                    <td className="p-4 text-on-surface-variant">{gym.ownerEmail}</td>
                    <td className="p-4 text-on-surface-variant">{gym.subscriptionPlan || '—'}</td>

                    {/* Active / Inactive toggle */}
                    <td className="p-4">
                      <button
                        onClick={() => handleToggle(gym)}
                        disabled={togglingId === gym.id}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-700/40'
                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-700/40'
                        } disabled:opacity-60`}
                      >
                        {togglingId === gym.id ? (
                          <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                        ) : (
                          <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        )}
                        {isActive ? 'Active' : 'Inactive'}
                        <span className="material-symbols-outlined text-[14px] opacity-60">swap_horiz</span>
                      </button>
                    </td>

                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { enterGym(gym); navigate('/'); }}
                          className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">login</span>
                          Enter
                        </button>
                        <Link to={`/super-admin/gyms/${gym.id}/edit`}
                          className="bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">edit</span>
                          Edit
                        </Link>
                        <button onClick={() => setDeleteConfirmId(gym.id)}
                          className="bg-rose-50 text-rose-600 hover:bg-rose-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 dark:bg-rose-900/20 dark:text-rose-400">
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-outline-variant/20 text-xs text-on-surface-variant">
            {filtered.length} of {gyms.length} gym{gyms.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirmId && (() => {
        const gym = gyms.find(g => g.id === deleteConfirmId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
              <div className="flex items-start gap-3 mb-6">
                <div className="w-11 h-11 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-rose-600 text-[22px]">warning</span>
                </div>
                <div>
                  <h3 className="font-bold text-on-surface">Delete "{gym?.name}"?</h3>
                  <p className="text-sm text-on-surface-variant mt-1">
                    This will permanently delete all gym data — members, payments, attendance, staff, and classes. This cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container text-sm">
                  Cancel
                </button>
                <button onClick={() => handleDelete(deleteConfirmId)} disabled={deletingId === deleteConfirmId}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium text-sm shadow-sm flex items-center gap-2 disabled:opacity-70">
                  {deletingId === deleteConfirmId && (
                    <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                  )}
                  Delete Everything
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
