import { useState, useEffect, useMemo } from 'react';
import { getTenantCollection, deleteTenantDocument } from '../../firebase/tenantDb';
import { useAuth } from '../../context/AuthContext';
import MeasurementForm from './MeasurementForm';

export default function MeasurementList() {
  const { gymId } = useAuth();

  const [members, setMembers] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingMeasurements, setLoadingMeasurements] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingMeasurement, setEditingMeasurement] = useState(null);

  // Load members once
  useEffect(() => {
    if (!gymId) return;
    setLoadingMembers(true);
    getTenantCollection(gymId, 'members')
      .then(data => {
        const sorted = [...data].sort((a, b) =>
          (a.name || '').localeCompare(b.name || '')
        );
        setMembers(sorted);
      })
      .catch(console.error)
      .finally(() => setLoadingMembers(false));
  }, [gymId]);

  // Load measurements when member selected
  useEffect(() => {
    if (!gymId || !selectedMember) {
      setMeasurements([]);
      return;
    }
    setLoadingMeasurements(true);
    getTenantCollection(gymId, 'measurements', [
      { field: 'memberId', op: '==', value: selectedMember.id },
    ])
      .then(data => {
        const sorted = [...data].sort((a, b) =>
          new Date(a.date) - new Date(b.date)
        );
        setMeasurements(sorted);
      })
      .catch(console.error)
      .finally(() => setLoadingMeasurements(false));
  }, [gymId, selectedMember]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.toLowerCase();
    if (!q) return members;
    return members.filter(m => (m.name || '').toLowerCase().includes(q));
  }, [members, memberSearch]);

  function selectMember(member) {
    setSelectedMember(member);
    setMemberSearch(member.name || '');
    setShowDropdown(false);
  }

  function clearMember() {
    setSelectedMember(null);
    setMemberSearch('');
    setMeasurements([]);
  }

  async function handleDelete(m) {
    if (!window.confirm(`Delete measurement from ${formatDate(m.date)}? This cannot be undone.`)) return;
    try {
      await deleteTenantDocument(gymId, 'measurements', m.id);
      setMeasurements(prev => prev.filter(x => x.id !== m.id));
    } catch (err) {
      console.error(err);
      alert('Failed to delete measurement. Please try again.');
    }
  }

  function handleSaved() {
    setShowForm(false);
    setEditingMeasurement(null);
    if (!gymId || !selectedMember) return;
    setLoadingMeasurements(true);
    getTenantCollection(gymId, 'measurements', [
      { field: 'memberId', op: '==', value: selectedMember.id },
    ])
      .then(data => {
        const sorted = [...data].sort((a, b) =>
          new Date(a.date) - new Date(b.date)
        );
        setMeasurements(sorted);
      })
      .catch(console.error)
      .finally(() => setLoadingMeasurements(false));
  }

  function openAdd() {
    setEditingMeasurement(null);
    setShowForm(true);
  }

  function openEdit(m) {
    setEditingMeasurement(m);
    setShowForm(true);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function fmt(val, unit = '') {
    if (val === null || val === undefined || val === '') return '—';
    return `${val}${unit}`;
  }

  // Stats derived from sorted measurements (oldest → newest)
  const stats = useMemo(() => {
    if (measurements.length === 0) return null;
    const latest = measurements[measurements.length - 1];
    const first = measurements[0];
    const weightChange = latest.weight != null && first.weight != null
      ? (latest.weight - first.weight).toFixed(1)
      : null;
    return {
      latestWeight: latest.weight,
      weightChange,
      latestBodyFat: latest.bodyFat,
      latestBmi: latest.bmi,
    };
  }, [measurements]);

  const weightChangeColor = stats?.weightChange != null
    ? parseFloat(stats.weightChange) < 0
      ? 'text-emerald-600'
      : parseFloat(stats.weightChange) > 0
        ? 'text-rose-500'
        : 'text-on-surface-variant'
    : 'text-on-surface-variant';

  return (
    <div className="flex flex-col gap-6 p-6">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Body Measurements</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">Track member body composition and progress over time</p>
        </div>
        {selectedMember && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl font-medium hover:bg-primary/90 shadow-sm transition-colors self-start sm:self-auto"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Add Measurement
          </button>
        )}
      </div>

      {/* Member selector */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-[0_10px_30px_rgba(207,196,255,0.1)]">
        <label className="text-sm font-medium text-on-surface-variant block mb-2">Select Member</label>
        <div className="relative">
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-3 text-on-surface-variant text-[20px]">person_search</span>
            <input
              type="text"
              value={memberSearch}
              onChange={e => {
                setMemberSearch(e.target.value);
                setShowDropdown(true);
                if (!e.target.value) clearMember();
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder={loadingMembers ? 'Loading members...' : 'Search by member name...'}
              disabled={loadingMembers}
              className="w-full pl-10 pr-10 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-on-surface outline-none focus:border-primary transition-colors disabled:opacity-60"
            />
            {selectedMember && (
              <button
                type="button"
                onClick={clearMember}
                className="absolute right-3 text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>

          {showDropdown && memberSearch && !selectedMember && filteredMembers.length > 0 && (
            <div className="absolute z-20 top-full mt-1 w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-xl max-h-56 overflow-y-auto">
              {filteredMembers.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => selectMember(m)}
                  className="w-full text-left px-4 py-2.5 hover:bg-surface-container transition-colors flex items-center gap-3"
                >
                  <span className="material-symbols-outlined text-primary text-[18px]">person</span>
                  <div>
                    <p className="text-sm font-medium text-on-surface">{m.name}</p>
                    {m.phone && <p className="text-xs text-on-surface-variant">{m.phone}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {showDropdown && memberSearch && !selectedMember && filteredMembers.length === 0 && !loadingMembers && (
            <div className="absolute z-20 top-full mt-1 w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-xl px-4 py-3 text-sm text-on-surface-variant">
              No members found matching "{memberSearch}"
            </div>
          )}
        </div>

        {selectedMember && (
          <div className="mt-3 flex items-center gap-2 text-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>
            Showing data for <span className="font-semibold text-on-surface">{selectedMember.name}</span>
          </div>
        )}
      </div>

      {/* Stats summary */}
      {selectedMember && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 shadow-[0_10px_30px_rgba(207,196,255,0.1)] flex flex-col gap-1">
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Latest Weight</p>
            <p className="text-2xl font-bold text-on-surface">
              {stats.latestWeight != null ? stats.latestWeight : '—'}
              {stats.latestWeight != null && <span className="text-sm font-normal text-on-surface-variant ml-1">kg</span>}
            </p>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 shadow-[0_10px_30px_rgba(207,196,255,0.1)] flex flex-col gap-1">
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Weight Change</p>
            <p className={`text-2xl font-bold ${weightChangeColor}`}>
              {stats.weightChange != null
                ? (parseFloat(stats.weightChange) > 0 ? '+' : '') + stats.weightChange
                : '—'}
              {stats.weightChange != null && <span className="text-sm font-normal ml-1">kg</span>}
            </p>
            {measurements.length > 1 && (
              <p className="text-xs text-on-surface-variant">vs first entry</p>
            )}
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 shadow-[0_10px_30px_rgba(207,196,255,0.1)] flex flex-col gap-1">
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Latest Body Fat</p>
            <p className="text-2xl font-bold text-on-surface">
              {stats.latestBodyFat != null ? stats.latestBodyFat : '—'}
              {stats.latestBodyFat != null && <span className="text-sm font-normal text-on-surface-variant ml-1">%</span>}
            </p>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 shadow-[0_10px_30px_rgba(207,196,255,0.1)] flex flex-col gap-1">
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Latest BMI</p>
            <p className="text-2xl font-bold text-on-surface">
              {stats.latestBmi != null ? stats.latestBmi : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Measurements table */}
      {selectedMember && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-[0_10px_30px_rgba(207,196,255,0.15)] overflow-hidden border border-outline-variant/30">
          <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20">
            <h2 className="font-semibold text-on-surface">
              Measurement History
              {measurements.length > 0 && (
                <span className="ml-2 text-xs font-normal text-on-surface-variant">({measurements.length} {measurements.length === 1 ? 'entry' : 'entries'})</span>
              )}
            </h2>
          </div>

          {loadingMeasurements ? (
            <div className="flex items-center justify-center py-16 gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
              <span className="text-sm">Loading measurements...</span>
            </div>
          ) : measurements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined text-[48px] text-outline-variant">monitor_weight</span>
              <p className="font-medium text-on-surface">No measurements recorded</p>
              <p className="text-sm text-on-surface-variant">Click "Add Measurement" to record the first entry.</p>
              <button
                onClick={openAdd}
                className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl font-medium hover:bg-primary/90 shadow-sm transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Add Measurement
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/30 bg-surface-container-low/50">
                    <th className="p-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-left">Date</th>
                    <th className="p-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-right">Weight (kg)</th>
                    <th className="p-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-right">Body Fat (%)</th>
                    <th className="p-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-right">Chest (cm)</th>
                    <th className="p-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-right">Waist (cm)</th>
                    <th className="p-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-right">Hips (cm)</th>
                    <th className="p-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-right">Arms (cm)</th>
                    <th className="p-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-right">Thighs (cm)</th>
                    <th className="p-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-right">BMI</th>
                    <th className="p-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[...measurements].reverse().map((m, idx) => (
                    <tr
                      key={m.id}
                      className="border-b border-outline-variant/10 hover:bg-surface-container/30 transition-colors"
                    >
                      <td className="p-4 text-on-surface font-medium whitespace-nowrap">
                        {formatDate(m.date)}
                        {idx === 0 && (
                          <span className="ml-2 text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Latest</span>
                        )}
                      </td>
                      <td className="p-4 text-right text-on-surface font-semibold">{fmt(m.weight)}</td>
                      <td className="p-4 text-right text-on-surface-variant">{fmt(m.bodyFat)}</td>
                      <td className="p-4 text-right text-on-surface-variant">{fmt(m.chest)}</td>
                      <td className="p-4 text-right text-on-surface-variant">{fmt(m.waist)}</td>
                      <td className="p-4 text-right text-on-surface-variant">{fmt(m.hips)}</td>
                      <td className="p-4 text-right text-on-surface-variant">{fmt(m.arms)}</td>
                      <td className="p-4 text-right text-on-surface-variant">{fmt(m.thighs)}</td>
                      <td className="p-4 text-right text-on-surface-variant">{fmt(m.bmi)}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEdit(m)}
                            className="w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors"
                            title="Edit"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                          <button
                            onClick={() => handleDelete(m)}
                            className="w-8 h-8 rounded-lg hover:bg-rose-50 flex items-center justify-center text-on-surface-variant hover:text-rose-500 transition-colors"
                            title="Delete"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Placeholder when no member selected */}
      {!selectedMember && !loadingMembers && (
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-12 flex flex-col items-center gap-4 text-center shadow-[0_10px_30px_rgba(207,196,255,0.1)]">
          <span className="material-symbols-outlined text-[56px] text-outline-variant">person_search</span>
          <p className="font-semibold text-on-surface text-lg">Select a member to get started</p>
          <p className="text-sm text-on-surface-variant max-w-sm">
            Search for a member above to view their body measurement history and track their fitness progress.
          </p>
        </div>
      )}

      {/* Measurement form modal */}
      {showForm && selectedMember && (
        <MeasurementForm
          measurement={editingMeasurement}
          memberId={selectedMember.id}
          memberName={selectedMember.name}
          onClose={() => {
            setShowForm(false);
            setEditingMeasurement(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
