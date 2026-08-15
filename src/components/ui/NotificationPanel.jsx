import { useState, useEffect, useRef } from 'react';
import { getTenantCollection, deleteTenantDocument } from '../../firebase/tenantDb';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

export default function NotificationPanel({ isOpen, onClose, onClear, triggerRef }) {
  const { gymId } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (triggerRef?.current?.contains(e.target)) return;
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, triggerRef]);

  useEffect(() => {
    if (!isOpen || !gymId) return;
    setLoading(true);
    getTenantCollection(gymId, 'notifications')
      .then(docs => {
        const sorted = [...docs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setNotifications(sorted);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isOpen, gymId]);

  const handleClearAll = async () => {
    if (!notifications.length) return;
    setClearing(true);
    try {
      await Promise.all(notifications.map(n => deleteTenantDocument(gymId, 'notifications', n.id)));
      setNotifications([]);
      onClear?.();
    } catch (e) { console.error(e); }
    finally { setClearing(false); }
  };

  const handleDismissOne = async (id) => {
    try {
      await deleteTenantDocument(gymId, 'notifications', id);
      setNotifications(prev => {
        const next = prev.filter(n => n.id !== id);
        if (next.length === 0) onClear?.();
        return next;
      });
    } catch (e) { console.error(e); }
  };

  if (!isOpen) return null;

  return (
    <div ref={panelRef}
      className="absolute top-14 right-0 w-80 sm:w-96 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[80vh]">

      <div className="px-4 py-3 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-low/50 shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-on-surface">Notifications</h3>
          {notifications.length > 0 && (
            <span className="text-xs bg-primary-container text-primary px-2 py-0.5 rounded-full font-medium">
              {notifications.length}
            </span>
          )}
        </div>
        {notifications.length > 0 && (
          <button onClick={handleClearAll} disabled={clearing}
            className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600 font-medium transition-colors disabled:opacity-50">
            {clearing
              ? <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
              : <span className="material-symbols-outlined text-[14px]">delete_sweep</span>}
            Clear All
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="p-8 flex justify-center text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center gap-2 text-on-surface-variant opacity-70">
            <span className="material-symbols-outlined text-[32px]">notifications_paused</span>
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {notifications.map(notif => (
              <div key={notif.id} className="flex items-start border-b border-outline-variant/20 hover:bg-surface-container transition-colors group">
                <Link to={notif.link} onClick={onClose} className="flex-1 p-4 flex gap-3 items-start min-w-0">
                  <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    notif.type === 'expiry'  ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                    notif.type === 'expired' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' :
                                               'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                  }`}>
                    <span className="material-symbols-outlined text-[16px]">
                      {notif.type === 'expiry' ? 'schedule' : notif.type === 'expired' ? 'event_busy' : 'payments'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-semibold text-on-surface">{notif.title}</span>
                    <span className="text-xs text-on-surface-variant leading-relaxed">{notif.message}</span>
                    <span className="text-[10px] text-on-surface-variant/60 mt-0.5 uppercase font-medium tracking-wider">
                      {notif.type === 'payment'
                        ? new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Today'}
                    </span>
                  </div>
                </Link>
                <button onClick={() => handleDismissOne(notif.id)}
                  className="p-3 text-on-surface-variant/40 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                  title="Dismiss">
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
