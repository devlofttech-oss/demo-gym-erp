import { useState, useRef, useEffect } from 'react';
import NotificationPanel from '../ui/NotificationPanel';
import { useAuth } from '../../context/AuthContext';
import { getCollection } from '../../firebase/db';
import { useNavigate } from 'react-router-dom';

export default function Topbar() {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const { logout, currentUser, role, userName } = useAuth();
  const navigate = useNavigate();
  const profileRef = useRef(null);

  // Fetch notification count on mount (admin only)
  useEffect(() => {
    if (role !== 'admin') return;
    const fetchCount = async () => {
      try {
        const [members, payments] = await Promise.all([
          getCollection('members'),
          getCollection('payments'),
        ]);
        const now = new Date(); now.setHours(0, 0, 0, 0);
        const in7days = new Date(now); in7days.setDate(in7days.getDate() + 7); in7days.setHours(23, 59, 59, 999);
        const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
        let count = 0;
        members.forEach(m => {
          if (m.expiryDate) {
            const exp = new Date(m.expiryDate);
            if (exp >= now && exp <= in7days) count++;
            else if (exp < now && exp > new Date(now.getTime() - 7 * 864e5)) count++;
          }
        });
        payments.forEach(p => { if (p.date && new Date(p.date) >= yesterday) count++; });
        setNotifCount(count);
      } catch { /* silent */ }
    };
    fetchCount();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileOpen]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  const displayName = userName || currentUser?.email?.split('@')[0] || 'User';
  const roleLabel = role === 'admin' ? 'Admin' : role === 'staff' ? 'Staff' : role || 'User';

  return (
    <header className="bg-white/80 dark:bg-slate-950/80 backdrop-blur-md text-purple-900 dark:text-purple-400 font-['Plus_Jakarta_Sans'] text-sm sticky top-4 z-40 mx-4 md:mx-gutter lg:mx-container-margin md:ml-0 mt-4 mb-4 border border-slate-200/50 dark:border-slate-800/50 shadow-sm rounded-full flex justify-between items-center h-16 px-6">
      <div className="flex items-center gap-6">
        <div className="flex md:hidden font-bold text-slate-900 dark:text-white text-sm tracking-tight">Deep Fitness</div>
        <div className="hidden md:flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium bg-slate-100/50 dark:bg-slate-800/50 px-4 py-1.5 rounded-full">
          <span className="material-symbols-outlined text-[18px]">calendar_today</span>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <div className="flex items-center gap-3 relative">
        {/* Notification Button — admin only */}
        {role === 'admin' && (
          <>
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className={`relative p-2 transition-colors rounded-full ${isNotifOpen ? 'bg-primary-container text-primary' : 'text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              <span className="material-symbols-outlined">notifications</span>
              {notifCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse shadow-sm">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>
            <NotificationPanel isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
          </>
        )}

        {/* Profile + User Info */}
        <div className="relative flex items-center gap-2.5" ref={profileRef}>
          {/* Name + Role (hidden on small screens) */}
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 capitalize">{displayName}</span>
            <span className={`text-[11px] font-medium px-1.5 py-px rounded-full ${
              role === 'admin'
                ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
            }`}>
              {roleLabel}
            </span>
          </div>

          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="w-9 h-9 rounded-full bg-primary-container text-primary flex items-center justify-center font-bold text-sm border border-outline-variant/20 uppercase cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
            title={`${displayName} · ${roleLabel}`}
          >
            {displayName.charAt(0)}
          </button>

          {isProfileOpen && (
            <div className="absolute top-12 right-0 w-52 bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-lg z-50 overflow-hidden animate-fade-in">
              <div className="px-4 py-3 border-b border-outline-variant/20 bg-surface-container/50">
                <div className="font-semibold text-on-surface text-sm truncate capitalize">{displayName}</div>
                <div className="text-xs text-on-surface-variant truncate mt-0.5">{currentUser?.email || ''}</div>
                <span className={`inline-block mt-1.5 text-[10px] font-semibold px-2 py-px rounded-full uppercase tracking-wide ${
                  role === 'admin'
                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                    : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                }`}>
                  {roleLabel}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2.5 text-sm text-error hover:bg-error-container/20 flex items-center gap-2 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
