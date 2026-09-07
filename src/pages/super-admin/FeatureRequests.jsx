import { useState, useEffect } from 'react';
import { getCollection, updateDocument } from '../../firebase/db';

function fmtDate(v) {
  if (!v) return '';
  try {
    const d = v?.toDate ? v.toDate() : new Date(v);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function FeatureRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | pending | done

  useEffect(() => {
    getCollection('featureRequests', [], { field: 'createdAt', direction: 'desc' })
      .then(setRequests)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function toggleStatus(req) {
    const next = req.status === 'done' ? 'pending' : 'done';
    setRequests(rs => rs.map(r => (r.id === req.id ? { ...r, status: next } : r)));
    try {
      await updateDocument('featureRequests', req.id, { status: next });
    } catch {
      setRequests(rs => rs.map(r => (r.id === req.id ? { ...r, status: req.status } : r)));
    }
  }

  const pendingCount = requests.filter(r => r.status !== 'done').length;
  const shown = requests.filter(r =>
    filter === 'all' ? true : filter === 'pending' ? r.status !== 'done' : r.status === 'done'
  );

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-h1 text-h1 text-on-surface">Feature Requests</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            What gym owners are asking for. {pendingCount} pending.
          </p>
        </div>
        <div className="flex gap-1 bg-surface-container rounded-xl p-1">
          {['all', 'pending', 'done'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                filter === f ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
              }`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-on-surface-variant">Loading…</div>
      ) : shown.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl p-16 text-center shadow-sm">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">inbox</span>
          <p className="text-on-surface-variant mt-2">No {filter === 'all' ? '' : filter} requests yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map(req => {
            const done = req.status === 'done';
            return (
              <div key={req.id}
                className={`bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex items-start gap-4 ${done ? 'opacity-60' : ''}`}>
                <div className="w-10 h-10 rounded-xl bg-primary-container/30 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-[22px]">star</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-on-surface text-sm ${done ? 'line-through' : ''}`}>{req.message}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-on-surface-variant flex-wrap">
                    <span className="font-medium text-on-surface">{req.gymName || 'Unknown gym'}</span>
                    <span>·</span>
                    <span>{fmtDate(req.createdAt)}</span>
                    {req.source && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 capitalize">
                          <span className="material-symbols-outlined text-[13px]">
                            {req.source === 'mobile' ? 'smartphone' : 'computer'}
                          </span>
                          {req.source}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <button onClick={() => toggleStatus(req)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    done
                      ? 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                      : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'
                  }`}>
                  {done ? 'Reopen' : 'Mark done'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
