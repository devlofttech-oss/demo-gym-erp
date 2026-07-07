import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCollection } from '../../firebase/db';

export default function SuperAdminDashboard() {
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCollection('gyms', [], { field: 'createdAt', direction: 'desc' })
      .then(setGyms)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const activeCount   = gyms.filter(g => g.isActive !== false).length;
  const inactiveCount = gyms.filter(g => g.isActive === false).length;

  const statCards = [
    { label: 'Total Gyms',    value: gyms.length,   icon: 'fitness_center', color: 'text-primary',   bg: 'bg-primary-container/30'   },
    { label: 'Active',        value: activeCount,   icon: 'check_circle',   color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { label: 'Inactive',      value: inactiveCount, icon: 'cancel',         color: 'text-rose-600',   bg: 'bg-rose-100 dark:bg-rose-900/30'       },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-h1 text-h1 text-on-surface">Platform Overview</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">All gyms registered on this platform.</p>
        </div>
        <Link to="/super-admin/gyms/new"
          className="bg-primary text-on-primary px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">add</span>
          Add Gym
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map(({ label, value, icon, color, bg }) => (
          <div key={label} className="bg-surface-container-lowest rounded-2xl p-card-padding shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
              <span className={`material-symbols-outlined text-2xl ${color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
            </div>
            <div>
              <div className="text-xs text-on-surface-variant font-medium uppercase tracking-wider">{label}</div>
              <div className="text-3xl font-bold text-on-surface">{loading ? '…' : value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent gyms table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-outline-variant/20 flex items-center justify-between">
          <h3 className="font-semibold text-on-surface">Recent Gyms</h3>
          <Link to="/super-admin/gyms" className="text-sm text-primary hover:underline flex items-center gap-1">
            View all <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-container-low/50">
              <tr>
                {['Gym', 'Owner', 'Status', 'Created'].map(h => (
                  <th key={h} className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="p-8 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
                </td></tr>
              ) : gyms.slice(0, 8).map(gym => (
                <tr key={gym.id} className="border-t border-outline-variant/10 hover:bg-surface-container/30">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-primary-container/20 shrink-0 flex items-center justify-center">
                        {gym.logoUrl
                          ? <img src={gym.logoUrl} alt={gym.name} className="w-full h-full object-cover" />
                          : <span className="material-symbols-outlined text-primary text-[18px]">fitness_center</span>
                        }
                      </div>
                      <div>
                        <div className="font-medium text-on-surface">{gym.name}</div>
                        <div className="text-xs text-on-surface-variant">{gym.address}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-on-surface-variant">{gym.ownerEmail}</td>
                  <td className="p-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${gym.isActive !== false ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                      {gym.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-4 text-on-surface-variant text-xs">
                    {gym.createdAt?.toDate?.().toLocaleDateString('en-IN') ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
