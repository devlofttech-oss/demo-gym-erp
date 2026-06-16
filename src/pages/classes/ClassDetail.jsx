import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getDocument, getCollection, updateDocument, deleteDocument } from '../../firebase/db';
import toast from 'react-hot-toast';
import SendSMSModal from '../../components/messaging/SendSMSModal';

const fmt12 = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
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

export default function ClassDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [cls, setCls] = useState(null);
  const [enrolledMembers, setEnrolledMembers] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSMS, setShowSMS] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [enrolling, setEnrolling] = useState(false);
  const [deletingClass, setDeletingClass] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [classDoc, members] = await Promise.all([
        getDocument('classes', id),
        getCollection('members'),
      ]);
      setCls(classDoc);
      setAllMembers(members);
      if (classDoc?.enrolledMemberIds?.length) {
        setEnrolledMembers(members.filter(m => classDoc.enrolledMemberIds.includes(m.id)));
      } else {
        setEnrolledMembers([]);
      }
    } catch { toast.error('Failed to load class'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [id]);

  const toggleSelect = (memberId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(memberId) ? next.delete(memberId) : next.add(memberId);
      return next;
    });
  };

  const enrollSelected = async () => {
    if (selectedIds.size === 0) return;
    setEnrolling(true);
    try {
      const ids = [...new Set([...(cls.enrolledMemberIds || []), ...selectedIds])];
      await updateDocument('classes', id, { enrolledMemberIds: ids });
      toast.success(`${selectedIds.size} member${selectedIds.size > 1 ? 's' : ''} added!`);
      setShowAddMember(false);
      setSelectedIds(new Set());
      fetchData();
    } catch { toast.error('Failed to add members'); }
    finally { setEnrolling(false); }
  };

  const removeMember = async (memberId) => {
    const ids = (cls.enrolledMemberIds || []).filter(x => x !== memberId);
    await updateDocument('classes', id, { enrolledMemberIds: ids });
    toast.success('Member removed from class');
    fetchData();
  };

  const handleDeleteClass = async () => {
    try {
      await deleteDocument('classes', id);
      toast.success('Class deleted');
      navigate('/classes');
    } catch { toast.error('Delete failed'); }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-100 text-on-surface-variant">
      <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
    </div>
  );

  if (!cls) return (
    <div className="flex flex-col items-center justify-center min-h-100 gap-4 text-on-surface-variant">
      <span className="material-symbols-outlined text-5xl opacity-40">sports_gymnastics</span>
      <p>Class not found.</p>
      <Link to="/classes" className="text-primary hover:underline text-sm">Back to Classes</Link>
    </div>
  );

  const meta = TYPE_META[cls.type] || TYPE_META.Other;
  const enrolled = enrolledMembers.length;
  const capacity = cls.capacity || 0;
  const phones = enrolledMembers.map(m => m.phone).filter(Boolean);

  const availableToAdd = allMembers.filter(m =>
    !(cls.enrolledMemberIds || []).includes(m.id) &&
    (!memberSearch || m.name?.toLowerCase().includes(memberSearch.toLowerCase()) || m.phone?.includes(memberSearch))
  );

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      {/* Back + Actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link to="/classes" className="w-10 h-10 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center transition-colors text-on-surface">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </Link>
          <h1 className="font-h2 text-h2 text-on-surface">{cls.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSMS(true)} disabled={phones.length === 0}
            className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50">
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>sms</span>
            Send SMS to Class
          </button>
          <Link to={`/classes/edit/${id}`}
            className="flex items-center gap-2 bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-on-surface px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <span className="material-symbols-outlined text-[16px]">edit</span> Edit
          </Link>
          <button onClick={() => setDeletingClass(true)}
            className="flex items-center gap-2 bg-rose-50 text-rose-600 hover:bg-rose-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <span className="material-symbols-outlined text-[16px]">delete</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Class Info Card */}
        <div className="bg-surface-container-lowest p-card-padding rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.1)] flex flex-col gap-4">
          <div className={`w-16 h-16 ${meta.bg} rounded-2xl flex items-center justify-center`}>
            <span className={`material-symbols-outlined ${meta.color} text-[30px]`}>{meta.icon}</span>
          </div>
          <div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${meta.bg} ${meta.color}`}>{cls.type}</span>
            <h2 className="font-bold text-on-surface text-xl mt-2">{cls.name}</h2>
            {cls.description && <p className="text-sm text-on-surface-variant mt-1">{cls.description}</p>}
          </div>

          <div className="flex flex-col gap-2">
            {cls.trainerName && (
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-container border border-outline-variant/20">
                <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
                <div>
                  <div className="text-xs text-on-surface-variant">Trainer</div>
                  <div className="text-sm font-medium text-on-surface">{cls.trainerName}</div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-container border border-outline-variant/20">
              <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
              <div>
                <div className="text-xs text-on-surface-variant">Enrolled / Capacity</div>
                <div className="text-sm font-medium text-on-surface">{enrolled}{capacity > 0 ? ` / ${capacity}` : ''}</div>
              </div>
            </div>
          </div>

          {cls.schedule?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Schedule</p>
              <div className="flex flex-col gap-1.5">
                {cls.schedule.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-on-surface bg-surface-container px-3 py-2 rounded-lg border border-outline-variant/20">
                    <span className="material-symbols-outlined text-[14px] text-on-surface-variant">schedule</span>
                    <span className="font-medium">{s.day}</span>
                    {s.startTime && <span className="text-on-surface-variant">{fmt12(s.startTime)}{s.endTime ? ` – ${fmt12(s.endTime)}` : ''}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Enrolled Members */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.1)] flex flex-col">
          <div className="flex items-center justify-between p-5 border-b border-outline-variant/20">
            <h3 className="font-h3 text-h3 text-on-surface">Enrolled Members ({enrolled})</h3>
            <button onClick={() => setShowAddMember(true)}
              className="flex items-center gap-1.5 text-primary hover:text-primary/80 text-sm font-medium transition-colors">
              <span className="material-symbols-outlined text-[18px]">person_add</span> Add Member
            </button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/10">
            {enrolledMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl opacity-30">group</span>
                <p className="text-sm">No members enrolled yet.</p>
                <button onClick={() => setShowAddMember(true)} className="text-primary text-sm hover:underline">Add members</button>
              </div>
            ) : (
              enrolledMembers.map(m => (
                <div key={m.id} className="flex items-center gap-4 px-5 py-3 hover:bg-surface-container/30 transition-colors">
                  {m.photoUrl
                    ? <img src={m.photoUrl} alt={m.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                    : <div className="w-10 h-10 rounded-full bg-primary-container text-primary flex items-center justify-center font-bold text-sm shrink-0">{m.name?.charAt(0)}</div>
                  }
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-on-surface">{m.name}</div>
                    <div className="text-xs text-on-surface-variant">{m.phone}</div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                    {m.status}
                  </span>
                  <button onClick={() => removeMember(m.id)}
                    className="w-7 h-7 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition-colors ml-2">
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-outline-variant/20">
              <div>
                <h2 className="font-bold text-on-surface">Add Members to Class</h2>
                {selectedIds.size > 0 && (
                  <p className="text-xs text-primary font-medium mt-0.5">{selectedIds.size} selected</p>
                )}
              </div>
              <button onClick={() => { setShowAddMember(false); setMemberSearch(''); setSelectedIds(new Set()); }}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Search + Select All */}
            <div className="p-4 border-b border-outline-variant/20 flex flex-col gap-2">
              <div className="flex items-center gap-2 bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-2.5">
                <span className="material-symbols-outlined text-on-surface-variant text-[20px]">search</span>
                <input type="text" placeholder="Search members..." value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  className="flex-1 bg-transparent text-on-surface outline-none text-sm placeholder:text-on-surface-variant" />
              </div>
              {availableToAdd.length > 0 && (
                <button
                  onClick={() => {
                    const allIds = new Set(availableToAdd.map(m => m.id));
                    const allSelected = availableToAdd.every(m => selectedIds.has(m.id));
                    setSelectedIds(allSelected ? new Set() : allIds);
                  }}
                  className="text-xs text-primary font-medium text-left hover:underline px-1"
                >
                  {availableToAdd.every(m => selectedIds.has(m.id)) ? 'Deselect All' : `Select All (${availableToAdd.length})`}
                </button>
              )}
            </div>

            {/* Member List */}
            <div className="overflow-y-auto flex-1 divide-y divide-outline-variant/10">
              {availableToAdd.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-on-surface-variant">No members found</div>
              ) : (
                availableToAdd.map(m => {
                  const checked = selectedIds.has(m.id);
                  return (
                    <button key={m.id} onClick={() => toggleSelect(m.id)}
                      className={`w-full flex items-center gap-3 px-5 py-3 transition-colors text-left ${checked ? 'bg-primary/5' : 'hover:bg-surface-container/50'}`}>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-primary border-primary' : 'border-outline-variant'}`}>
                        {checked && <span className="material-symbols-outlined text-on-primary text-[14px]">check</span>}
                      </div>
                      <div className="w-9 h-9 rounded-full bg-primary-container text-primary flex items-center justify-center font-bold text-sm shrink-0">
                        {m.photoUrl
                          ? <img src={m.photoUrl} alt={m.name} className="w-full h-full rounded-full object-cover" />
                          : m.name?.charAt(0)
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-on-surface text-sm">{m.name}</div>
                        <div className="text-xs text-on-surface-variant">{m.phone}</div>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${m.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                        {m.status}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-outline-variant/20 flex items-center justify-between gap-3">
              <span className="text-sm text-on-surface-variant">
                {selectedIds.size > 0 ? `${selectedIds.size} member${selectedIds.size > 1 ? 's' : ''} selected` : 'Select members above'}
              </span>
              <div className="flex gap-2">
                <button onClick={() => { setShowAddMember(false); setMemberSearch(''); setSelectedIds(new Set()); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors">
                  Cancel
                </button>
                <button onClick={enrollSelected} disabled={selectedIds.size === 0 || enrolling}
                  className="flex items-center gap-2 px-5 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50">
                  {enrolling
                    ? <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> Adding...</>
                    : <><span className="material-symbols-outlined text-[16px]">person_add</span> Add {selectedIds.size > 0 ? selectedIds.size : ''}</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SMS Modal */}
      {showSMS && (
        <SendSMSModal
          phones={phones}
          recipientLabel={`${phones.length} members in ${cls.name}`}
          defaultMessage={`Dear Students,\n\nThis is a kind reminder from Deep Fitness Gym.\n\nWe noticed your absence from recent classes. Regular attendance is very important to achieve your fitness goals and maintain consistency.\n\nKindly make sure to attend your upcoming sessions without fail. If you are unable to attend due to any reason, please inform the trainer in advance.\n\nLet's stay consistent and achieve your fitness goals together 💪\n\nThank you\nDeep Fitness Gym`}
          onClose={() => setShowSMS(false)}
        />
      )}

      {/* Delete Confirm */}
      {deletingClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-rose-600 text-[20px]">warning</span>
              </div>
              <div>
                <h3 className="font-semibold text-on-surface">Delete Class?</h3>
                <p className="text-sm text-on-surface-variant mt-1">This will delete "{cls.name}" and cannot be undone.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeletingClass(false)} className="px-4 py-2 rounded-lg font-medium text-on-surface-variant hover:bg-surface-container text-sm">Cancel</button>
              <button onClick={handleDeleteClass} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium text-sm shadow-sm">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
