import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCollection } from '../../firebase/db';
import toast from 'react-hot-toast';

const CLASS_TYPES = ['All', 'Zumba', 'Yoga', 'Dance', 'HIIT', 'Kids Dance', 'Gym', 'Other'];

const fmt12 = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

const TYPE_META = {
  Zumba:     { icon: 'music_note',       color: 'text-pink-600',   bg: 'bg-pink-100'   },
  Yoga:      { icon: 'self_improvement', color: 'text-teal-600',   bg: 'bg-teal-100'   },
  Dance:     { icon: 'nightlife',        color: 'text-purple-600', bg: 'bg-purple-100' },
  HIIT:      { icon: 'speed',            color: 'text-rose-600',   bg: 'bg-rose-100'   },
  'Kids Dance': { icon: 'child_care',    color: 'text-amber-600',  bg: 'bg-amber-100'  },
  Gym:       { icon: 'fitness_center',   color: 'text-violet-600', bg: 'bg-violet-100' },
  Other:     { icon: 'sports_gymnastics',color: 'text-blue-600',   bg: 'bg-blue-100'   },
};

export default function ClassList() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const data = await getCollection('classes');
      setClasses(data);
    } catch { toast.error('Failed to load classes'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchClasses(); }, []);

  const filtered = classes.filter(c => {
    const matchType = filterType === 'All' || c.type === filterType;
    const term = searchTerm.toLowerCase();
    const matchSearch = !term || c.name?.toLowerCase().includes(term) || c.trainerName?.toLowerCase().includes(term);
    return matchType && matchSearch;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 className="font-h1 text-h1 text-on-surface">Group Classes</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">Manage classes, schedules, and enrolled members.</p>
        </div>
        <Link to="/classes/add"
          className="bg-primary text-on-primary px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">add</span> New Class
        </Link>
      </div>

      {/* Type Filter */}
      <div className="flex gap-2 flex-wrap">
        {CLASS_TYPES.map(type => {
          const meta = TYPE_META[type];
          const count = type === 'All' ? classes.length : classes.filter(c => c.type === type).length;
          return (
            <button key={type} onClick={() => setFilterType(type)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                filterType === type
                  ? 'bg-primary text-on-primary border-primary shadow-sm'
                  : 'bg-surface-container-lowest border-outline-variant/30 text-on-surface-variant hover:bg-surface-container'
              }`}>
              {meta && <span className={`material-symbols-outlined text-[15px] ${filterType === type ? 'text-white' : meta.color}`}>{meta.icon}</span>}
              {type}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${filterType === type ? 'bg-white/20 text-white' : 'bg-surface-container text-on-surface-variant'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2.5 max-w-sm shadow-sm">
        <span className="material-symbols-outlined text-on-surface-variant text-[20px]">search</span>
        <input type="text" placeholder="Search by class or trainer name..." value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="flex-1 bg-transparent text-on-surface outline-none text-sm placeholder:text-on-surface-variant" />
        {searchTerm && <button onClick={() => setSearchTerm('')} className="text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>}
      </div>

      {/* Class Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-on-surface-variant gap-2">
          <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
          Loading classes...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-on-surface-variant">
          <span className="material-symbols-outlined text-6xl opacity-30">sports_gymnastics</span>
          <p className="font-medium">No classes found</p>
          <Link to="/classes/add" className="bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            Create First Class
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(cls => {
            const meta = TYPE_META[cls.type] || TYPE_META.Other;
            const enrolled = cls.enrolledMemberIds?.length || 0;
            const capacity = cls.capacity || 0;
            const pct = capacity > 0 ? Math.min(100, Math.round((enrolled / capacity) * 100)) : 0;
            return (
              <Link key={cls.id} to={`/classes/${cls.id}`}
                className="bg-surface-container-lowest p-5 rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.1)] hover:shadow-[0_14px_40px_rgba(207,196,255,0.2)] transition-all border border-outline-variant/20 hover:border-primary/20 flex flex-col gap-4 group">
                <div className="flex items-start justify-between">
                  <div className={`w-12 h-12 ${meta.bg} rounded-xl flex items-center justify-center`}>
                    <span className={`material-symbols-outlined ${meta.color} text-[24px]`}>{meta.icon}</span>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${meta.bg} ${meta.color}`}>{cls.type}</span>
                </div>
                <div>
                  <h3 className="font-bold text-on-surface text-lg group-hover:text-primary transition-colors">{cls.name}</h3>
                  {cls.trainerName && (
                    <p className="text-sm text-on-surface-variant mt-0.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">person</span>{cls.trainerName}
                    </p>
                  )}
                  {cls.description && <p className="text-sm text-on-surface-variant mt-1 line-clamp-2">{cls.description}</p>}
                </div>
                {cls.schedule?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {cls.schedule.slice(0, 3).map((s, i) => (
                      <span key={i} className="text-xs bg-surface-container px-2 py-0.5 rounded-full text-on-surface-variant">
                        {s.day} {s.startTime && `· ${fmt12(s.startTime)}`}
                      </span>
                    ))}
                    {cls.schedule.length > 3 && <span className="text-xs text-on-surface-variant px-2 py-0.5">+{cls.schedule.length - 3} more</span>}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px]">group</span>
                    <span>{enrolled}{capacity > 0 ? `/${capacity}` : ''} enrolled</span>
                  </div>
                  {capacity > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-surface-container rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-on-surface-variant">{pct}%</span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
