import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getTenantCollection, updateTenantDocument } from '../../firebase/tenantDb';
import toast from 'react-hot-toast';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  return Math.ceil((d - today) / 86400000);
}

export default function RenewalsList() {
  const { gymId } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(30);
  const [freezeModal, setFreezeModal] = useState(null);
  const [freezeDate, setFreezeDate] = useState('');
  const [freezing, setFreezing] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const data = await getTenantCollection(gymId, 'members');
      setMembers(data);
    } catch { toast.error('Failed to load members'); }
    finally { setLoading(false); }
  };

  const getDueList = () => {
    return members
      .filter(m => {
        if (m.status === 'Frozen') return false;
        const days = daysUntil(m.expiryDate);
        return days !== null && days <= range;
      })
      .sort((a, b) => {
        const da = daysUntil(a.expiryDate) ?? 999;
        const db = daysUntil(b.expiryDate) ?? 999;
        return da - db;
      });
  };

  const frozenList = members.filter(m => m.status === 'Frozen');
  const dueList = getDueList();

  const handleFreeze = async () => {
    if (!freezeModal || !freezeDate) { toast.error('Select a resume date'); return; }
    setFreezing(true);
    try {
      await updateTenantDocument(gymId, 'members', freezeModal.id, {
        status: 'Frozen',
        frozenOn: new Date().toISOString().split('T')[0],
        resumeDate: freezeDate,
      });
      toast.success(`${freezeModal.name}'s membership frozen until ${freezeDate}`);
      setFreezeModal(null);
      setFreezeDate('');
      fetchMembers();
    } catch { toast.error('Failed to freeze membership'); }
    finally { setFreezing(false); }
  };

  const handleUnfreeze = async (member) => {
    try {
      await updateTenantDocument(gymId, 'members', member.id, {
        status: 'Active',
        frozenOn: null,
        resumeDate: null,
      });
      toast.success(`${member.name}'s membership resumed`);
      fetchMembers();
    } catch { toast.error('Failed to unfreeze membership'); }
  };

  const getDaysBadge = (days) => {
    if (days < 0) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Expired {Math.abs(days)}d ago</span>;
    if (days === 0) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Expires Today</span>;
    if (days <= 3) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">{days}d left</span>;
    if (days <= 7) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{days}d left</span>;
    return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">{days}d left</span>;
  };

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const minFreezeDate = tomorrow.toISOString().split('T')[0];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-h1 text-h1 text-on-surface">Renewals</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">Members expiring soon and frozen memberships.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-on-surface-variant">Show expiring in</span>
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setRange(d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${range === d ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-rose-600">event_busy</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-on-surface">{loading ? '—' : dueList.filter(m => (daysUntil(m.expiryDate) ?? 1) < 0).length}</p>
            <p className="text-xs text-on-surface-variant">Expired</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-amber-600">warning</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-on-surface">{loading ? '—' : dueList.filter(m => { const d = daysUntil(m.expiryDate) ?? 1; return d >= 0 && d <= range; }).length}</p>
            <p className="text-xs text-on-surface-variant">Expiring soon</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-blue-600">pause_circle</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-on-surface">{loading ? '—' : frozenList.length}</p>
            <p className="text-xs text-on-surface-variant">Frozen</p>
          </div>
        </div>
      </div>

      {/* Due for Renewal */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.15)] overflow-hidden">
        <div className="flex items-center gap-3 p-5 border-b border-outline-variant/20">
          <span className="material-symbols-outlined text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>event_upcoming</span>
          <h2 className="font-h3 text-h3 text-on-surface">Due for Renewal ({dueList.length})</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-on-surface-variant gap-2">
            <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
          </div>
        ) : dueList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined text-5xl opacity-30">celebration</span>
            <p className="font-medium">No members expiring in the next {range} days!</p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/10">
            {dueList.map(member => {
              const days = daysUntil(member.expiryDate);
              return (
                <div key={member.id} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-container/30 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-primary-container text-primary flex items-center justify-center font-bold shrink-0 overflow-hidden">
                    {member.photoUrl
                      ? <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                      : member.name?.charAt(0)
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-on-surface truncate">{member.name}</div>
                    <div className="text-xs text-on-surface-variant flex items-center gap-2 mt-0.5">
                      <span>{member.phone}</span>
                      <span className="w-1 h-1 rounded-full bg-outline-variant/50"></span>
                      <span>{member.planName || 'No plan'}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="text-xs text-on-surface-variant">Expires {member.expiryDate}</div>
                    {getDaysBadge(days)}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => { setFreezeModal(member); setFreezeDate(''); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                      title="Freeze membership"
                    >
                      <span className="material-symbols-outlined text-[14px]">pause_circle</span>
                      Freeze
                    </button>
                    <button
                      onClick={() => navigate(`/payments/new?memberId=${member.id}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-on-primary hover:bg-primary/90 transition-colors shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[14px]">autorenew</span>
                      Renew
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Frozen Members */}
      {frozenList.length > 0 && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.15)] overflow-hidden">
          <div className="flex items-center gap-3 p-5 border-b border-outline-variant/20">
            <span className="material-symbols-outlined text-blue-500" style={{ fontVariationSettings: "'FILL' 1" }}>ac_unit</span>
            <h2 className="font-h3 text-h3 text-on-surface">Frozen Memberships ({frozenList.length})</h2>
          </div>
          <div className="divide-y divide-outline-variant/10">
            {frozenList.map(member => (
              <div key={member.id} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-container/30 transition-colors">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0 overflow-hidden">
                  {member.photoUrl
                    ? <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                    : member.name?.charAt(0)
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-on-surface truncate flex items-center gap-2">
                    {member.name}
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Frozen</span>
                  </div>
                  <div className="text-xs text-on-surface-variant flex items-center gap-2 mt-0.5">
                    <span>Frozen: {member.frozenOn || '—'}</span>
                    {member.resumeDate && <><span className="w-1 h-1 rounded-full bg-outline-variant/50"></span><span>Resumes: {member.resumeDate}</span></>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link to={`/members/${member.id}`}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors">
                    View
                  </Link>
                  <button
                    onClick={() => handleUnfreeze(member)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">play_circle</span>
                    Unfreeze
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Freeze Modal */}
      {freezeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-blue-600">ac_unit</span>
              </div>
              <div>
                <p className="font-bold text-on-surface">Freeze Membership</p>
                <p className="text-sm text-on-surface-variant">{freezeModal.name}</p>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Resume Date</label>
              <input
                type="date"
                value={freezeDate}
                min={minFreezeDate}
                onChange={e => setFreezeDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary text-sm"
              />
              <p className="text-xs text-on-surface-variant">Membership will be paused and resumed on this date.</p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setFreezeModal(null); setFreezeDate(''); }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors">
                Cancel
              </button>
              <button onClick={handleFreeze} disabled={!freezeDate || freezing}
                className="px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2">
                {freezing && <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>}
                Freeze Membership
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
