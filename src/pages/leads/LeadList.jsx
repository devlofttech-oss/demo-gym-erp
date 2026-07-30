import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getTenantCollection, deleteTenantDocument } from '../../firebase/tenantDb';
import { useAuth } from '../../context/AuthContext';
import LeadForm from './LeadForm';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'follow-up', label: 'Follow-up' },
  { value: 'interested', label: 'Interested' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

const STATUS_STYLES = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  'follow-up': 'bg-amber-100 text-amber-700',
  interested: 'bg-purple-100 text-purple-700',
  won: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-slate-100 text-slate-500',
};

const SOURCE_STYLES = {
  'walk-in': 'bg-indigo-50 text-indigo-600',
  phone: 'bg-sky-50 text-sky-600',
  whatsapp: 'bg-green-50 text-green-600',
  website: 'bg-violet-50 text-violet-600',
  referral: 'bg-orange-50 text-orange-600',
};

const SOURCE_LABELS = {
  'walk-in': 'Walk-in',
  phone: 'Phone',
  whatsapp: 'WhatsApp',
  website: 'Website',
  referral: 'Referral',
};

function formatDate(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function thisMonthISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function LeadList() {
  const { gymId } = useAuth();
  const navigate = useNavigate();

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const data = await getTenantCollection(gymId, 'leads');
      data.sort((a, b) => {
        const ta = a.createdAt ?? '';
        const tb = b.createdAt ?? '';
        return tb.localeCompare(ta);
      });
      setLeads(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gymId]);

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return leads;
    return leads.filter((l) => l.status === activeFilter);
  }, [leads, activeFilter]);

  // Stat chips
  const today = todayISO();
  const monthPrefix = thisMonthISO();
  const totalCount = leads.length;
  const thisMonthCount = leads.filter((l) => (l.createdAt ?? '').startsWith(monthPrefix)).length;
  const wonCount = leads.filter((l) => l.status === 'won').length;
  const followUpTodayCount = leads.filter(
    (l) => l.nextFollowUp === today && l.status !== 'won' && l.status !== 'lost'
  ).length;

  const openAdd = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (lead) => {
    setEditing(lead);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
  };

  const handleDeleteClick = (id) => {
    if (!window.confirm('Delete this lead? This cannot be undone.')) return;
    confirmDelete(id);
  };

  const confirmDelete = async (id) => {
    setDeleting(true);
    try {
      await deleteTenantDocument(gymId, 'leads', id);
      setLeads((prev) => prev.filter((l) => l.id !== id));
      toast.success('Lead deleted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete lead');
    } finally {
      setDeleting(false);
      setDeletingId(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Leads &amp; CRM</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Track prospects and manage your sales pipeline
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-medium hover:opacity-90 transition-opacity self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Add Lead
        </button>
      </div>

      {/* Stat Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-xl">group</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-on-surface">{totalCount}</p>
            <p className="text-xs text-on-surface-variant">Total Leads</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-blue-600 text-xl">calendar_month</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-on-surface">{thisMonthCount}</p>
            <p className="text-xs text-on-surface-variant">This Month</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-emerald-600 text-xl">trophy</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-on-surface">{wonCount}</p>
            <p className="text-xs text-on-surface-variant">Won</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-amber-600 text-xl">alarm</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-on-surface">{followUpTodayCount}</p>
            <p className="text-xs text-on-surface-variant">Follow-up Today</p>
          </div>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-1.5 min-w-max md:flex-wrap md:min-w-0">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setActiveFilter(f.value)}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
              activeFilter === f.value
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-highest'
            }`}
          >
            {f.label}
            {f.value !== 'all' && (
              <span className="ml-1.5 opacity-70">
                ({leads.filter((l) => l.status === f.value).length})
              </span>
            )}
          </button>
        ))}
        </div>
      </div>

      {/* Mobile: loading / empty states */}
      {loading && (
        <div className="md:hidden flex items-center justify-center gap-2 py-12 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-2xl text-primary">progress_activity</span>
          <span className="text-sm">Loading leads…</span>
        </div>
      )}
      {!loading && filtered.length === 0 && (
        <div className="md:hidden flex flex-col items-center justify-center py-16 gap-3 text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl opacity-30">person_search</span>
          <p className="text-base font-medium">
            {activeFilter === 'all' ? 'No leads yet' : `No ${activeFilter} leads`}
          </p>
          <p className="text-sm opacity-70">
            {activeFilter === 'all'
              ? 'Add your first lead to start tracking prospects'
              : 'Try a different filter or add a new lead'}
          </p>
          {activeFilter === 'all' && (
            <button onClick={openAdd}
              className="mt-2 px-5 py-2 bg-primary text-on-primary rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
              Add Lead
            </button>
          )}
        </div>
      )}

      {/* Mobile card list */}
      {!loading && filtered.length > 0 && (
        <div className="md:hidden space-y-3">
          {filtered.map((lead) => {
            const isFollowUpToday =
              lead.nextFollowUp === today &&
              lead.status !== 'won' &&
              lead.status !== 'lost';
            return (
              <div key={lead.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-4 border border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-on-surface">{lead.name}</div>
                    <div className="text-sm text-on-surface-variant">{lead.phone}</div>
                    {lead.email && <div className="text-xs text-on-surface-variant/70">{lead.email}</div>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[lead.status] ?? 'bg-surface-container text-on-surface-variant'}`}>
                      {lead.status}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${SOURCE_STYLES[lead.source] ?? 'bg-surface-container text-on-surface-variant'}`}>
                      {SOURCE_LABELS[lead.source] ?? lead.source}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-2">
                  <div className="text-on-surface-variant">Plan</div>
                  <div className="text-on-surface">{lead.interestedPlan || '—'}</div>
                  {lead.budget && (
                    <>
                      <div className="text-on-surface-variant">Budget</div>
                      <div className="text-on-surface">₹{Number(lead.budget).toLocaleString('en-IN')}</div>
                    </>
                  )}
                  <div className="text-on-surface-variant">Follow-up</div>
                  <div>
                    {lead.nextFollowUp ? (
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-lg ${isFollowUpToday ? 'bg-amber-100 text-amber-700' : 'text-on-surface'}`}>
                        {isFollowUpToday && <span className="material-symbols-outlined text-sm">alarm</span>}
                        {formatDate(lead.nextFollowUp)}
                      </span>
                    ) : <span className="text-on-surface-variant/50 text-xs">—</span>}
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => openEdit(lead)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                    <span className="material-symbols-outlined text-base">edit</span> Edit
                  </button>
                  <button onClick={() => handleDeleteClick(lead.id)} disabled={deleting}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-sm bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors disabled:opacity-50">
                    <span className="material-symbols-outlined text-base">delete</span> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block bg-surface-container-lowest border border-outline-variant/30 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-2xl text-primary">
              progress_activity
            </span>
            <span className="text-sm">Loading leads…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined text-5xl opacity-30">person_search</span>
            <p className="text-base font-medium">
              {activeFilter === 'all' ? 'No leads yet' : `No ${activeFilter} leads`}
            </p>
            <p className="text-sm opacity-70">
              {activeFilter === 'all'
                ? 'Add your first lead to start tracking prospects'
                : 'Try a different filter or add a new lead'}
            </p>
            {activeFilter === 'all' && (
              <button
                onClick={openAdd}
                className="mt-2 px-5 py-2 bg-primary text-on-primary rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Add Lead
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-175">
              <thead>
                <tr className="border-b border-outline-variant/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    Lead
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    Source
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    Follow-up
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {filtered.map((lead) => {
                  const isFollowUpToday =
                    lead.nextFollowUp === today &&
                    lead.status !== 'won' &&
                    lead.status !== 'lost';

                  return (
                    <tr
                      key={lead.id}
                      className="hover:bg-surface-container/30 transition-colors"
                    >
                      {/* Name + phone */}
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-on-surface">{lead.name}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">{lead.phone}</p>
                        {lead.email && (
                          <p className="text-xs text-on-surface-variant/70">{lead.email}</p>
                        )}
                      </td>

                      {/* Source badge */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            SOURCE_STYLES[lead.source] ?? 'bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          {SOURCE_LABELS[lead.source] ?? lead.source}
                        </span>
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                            STATUS_STYLES[lead.status] ?? 'bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          {lead.status}
                        </span>
                      </td>

                      {/* Interested Plan */}
                      <td className="px-4 py-3">
                        <p className="text-sm text-on-surface">
                          {lead.interestedPlan || '—'}
                        </p>
                        {lead.budget ? (
                          <p className="text-xs text-on-surface-variant mt-0.5">
                            ₹{Number(lead.budget).toLocaleString('en-IN')}
                          </p>
                        ) : null}
                      </td>

                      {/* Next Follow-up */}
                      <td className="px-4 py-3">
                        {lead.nextFollowUp ? (
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-lg ${
                              isFollowUpToday
                                ? 'bg-amber-100 text-amber-700'
                                : 'text-on-surface-variant'
                            }`}
                          >
                            {isFollowUpToday && (
                              <span className="material-symbols-outlined text-sm">alarm</span>
                            )}
                            {formatDate(lead.nextFollowUp)}
                          </span>
                        ) : (
                          <span className="text-xs text-on-surface-variant/50">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(lead.status === 'won' || lead.status === 'interested') && (
                            <button
                              onClick={() => navigate(`/members/add?name=${encodeURIComponent(lead.name)}&phone=${encodeURIComponent(lead.phone)}&email=${encodeURIComponent(lead.email || '')}&plan=${encodeURIComponent(lead.interestedPlan || '')}`)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors text-xs font-medium"
                              title="Convert to Member"
                            >
                              <span className="material-symbols-outlined text-[14px]">person_add</span>
                              Convert
                            </button>
                          )}
                          <button
                            onClick={() => openEdit(lead)}
                            className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            title="Edit lead"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteClick(lead.id)}
                            disabled={deleting}
                            className="p-2 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors disabled:opacity-50"
                            title="Delete lead"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* end desktop table */}

      {/* Add / Edit Modal */}
      {showModal && (
        <LeadForm
          lead={editing}
          onClose={closeModal}
          onSaved={fetchLeads}
        />
      )}
    </div>
  );
}
