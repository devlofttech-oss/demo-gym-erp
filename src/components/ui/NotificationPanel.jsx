import { useState, useEffect, useRef } from 'react';
import { getCollection } from '../../firebase/db';
import { Link } from 'react-router-dom';

export default function NotificationPanel({ isOpen, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef(null);

  // Close panel if clicked outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!isOpen) return;
      try {
        setLoading(true);
        const [members, payments] = await Promise.all([
          getCollection('members'),
          getCollection('payments')
        ]);

        const now = new Date();
        const in7days = new Date();
        in7days.setDate(in7days.getDate() + 7);
        now.setHours(0, 0, 0, 0);
        in7days.setHours(23, 59, 59, 999);

        const notifs = [];

        // 1. Expiry Reminders (Members expiring in <= 7 days)
        members.forEach(m => {
          if (m.expiryDate) {
            const exp = new Date(m.expiryDate);
            if (exp >= now && exp <= in7days) {
              const diffTime = exp - now;
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              notifs.push({
                id: `exp-${m.id}`,
                type: 'expiry',
                title: 'Membership Expiring Soon',
                message: `${m.name}'s plan expires in ${diffDays} day${diffDays !== 1 ? 's' : ''}.`,
                date: new Date(),
                link: `/members/${m.id}`
              });
            } else if (exp < now && exp > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) { // Expired in last 7 days
               const diffTime = now - exp;
               const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
               notifs.push({
                id: `exp-${m.id}`,
                type: 'expired',
                title: 'Membership Expired',
                message: `${m.name}'s plan expired ${diffDays} day${diffDays !== 1 ? 's' : ''} ago.`,
                date: new Date(),
                link: `/members/${m.id}`
              });
            }
          }
        });

        // 2. Payment Alerts (Payments made today or yesterday)
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        
        payments.forEach(p => {
          if (p.date) {
            const pDate = new Date(p.date);
            if (pDate >= yesterday) {
              notifs.push({
                id: `pay-${p.id}`,
                type: 'payment',
                title: 'New Payment Received',
                message: `Received ₹${p.amount} from ${p.memberName || 'a member'}.`,
                date: pDate,
                link: `/payments`
              });
            }
          }
        });

        // Sort by date descending (newest first)
        notifs.sort((a, b) => b.date - a.date);
        
        setNotifications(notifs);
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      ref={panelRef}
      className="absolute top-14 right-0 w-80 sm:w-96 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[80vh]"
    >
      <div className="p-4 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-low/50">
        <h3 className="font-h3 text-h3 text-on-surface">Notifications</h3>
        <span className="text-xs bg-primary-container text-primary px-2 py-0.5 rounded-full font-medium">
          {notifications.length} New
        </span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="p-8 flex justify-center items-center text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center gap-2 text-on-surface-variant opacity-70">
            <span className="material-symbols-outlined text-[32px]">notifications_paused</span>
            <p className="text-sm">No new notifications</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {notifications.map(notif => (
              <Link 
                key={notif.id}
                to={notif.link}
                onClick={onClose}
                className="p-4 border-b border-outline-variant/20 hover:bg-surface-container transition-colors flex gap-3 items-start"
              >
                <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  notif.type === 'expiry' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                  notif.type === 'expired' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' :
                  'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                }`}>
                  <span className="material-symbols-outlined text-[16px]">
                    {notif.type === 'expiry' ? 'schedule' : notif.type === 'expired' ? 'event_busy' : 'payments'}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-on-surface">{notif.title}</span>
                  <span className="text-xs text-on-surface-variant leading-relaxed">{notif.message}</span>
                  <span className="text-[10px] text-on-surface-variant/70 mt-1 uppercase font-medium tracking-wider">
                    {notif.type === 'payment' ? notif.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Today'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
