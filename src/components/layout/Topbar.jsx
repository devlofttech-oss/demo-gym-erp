import { useState, useRef, useEffect } from 'react';
import NotificationPanel from '../ui/NotificationPanel';
import { useAuth } from '../../context/AuthContext';
import { syncNotifications } from '../../services/notificationSync';
import { useNavigate } from 'react-router-dom';
import logoImage from '../../assets/kilos_logo.png';

function BranchSwitcher({ gymBranches, activeGymId, switchBranch }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const activeBranch = gymBranches.find(b => b.id === activeGymId) || gymBranches[0];

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 px-3 py-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="flex flex-col items-center leading-tight">
          <span className="font-bold text-slate-900 dark:text-white text-sm md:text-base tracking-tight whitespace-nowrap">
            {activeBranch?.name || 'Branch'}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium tracking-wider uppercase hidden sm:block">
            powered by Kilos
          </span>
        </div>
        <span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-slate-400">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-56 bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
          <div className="px-4 py-2.5 border-b border-outline-variant/20 bg-surface-container/40">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Switch Branch</p>
          </div>
          {gymBranches.map((branch) => (
            <button
              key={branch.id}
              onClick={() => { switchBranch(branch.id); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between gap-2 ${
                branch.id === activeGymId
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-on-surface hover:bg-surface-container'
              }`}
            >
              <span className="truncate">{branch.name}</span>
              {branch.id === activeGymId && (
                <span className="material-symbols-outlined text-[16px] text-primary shrink-0">check_circle</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Topbar() {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const { logout, currentUser, role, userName, gymId, gymData, gymIds, gymBranches, switchBranch, isImpersonating, impersonatedBranches, switchImpersonatedBranch } = useAuth();
  const navigate = useNavigate();
  const profileRef = useRef(null);
  const notifBtnRef = useRef(null);

  useEffect(() => {
    if (role !== 'admin' || !gymId) return;
    syncNotifications(gymId).then(count => setNotifCount(count)).catch(() => {});
  }, [role, gymId]);

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
  const gymName = gymData?.name || 'Kilos';
  const isMultiBranch = isImpersonating ? impersonatedBranches.length > 1 : gymIds.length > 1;

  const handleImpersonatedSwitch = (newGymId) => {
    switchImpersonatedBranch(newGymId);
    navigate('/');
  };

  return (
    <header className="bg-white/80 dark:bg-slate-950/80 backdrop-blur-md font-['Plus_Jakarta_Sans'] text-sm sticky top-4 z-40 mx-4 md:mx-gutter lg:mx-container-margin md:ml-0 mt-4 mb-4 border border-slate-200/50 dark:border-slate-800/50 shadow-sm rounded-full flex justify-between items-center h-16 px-4 md:px-6">
      {/* Left — logo (mobile only) */}
      <div className="flex items-center gap-2 md:min-w-0">
        <div className="flex md:hidden items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg overflow-hidden bg-primary-container/10 flex items-center justify-center">
            <img src={logoImage} alt="Kilos" className="w-full h-full object-contain" />
          </div>
        </div>
        {/* Date pill — desktop only */}
        <div className="hidden md:flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium bg-slate-100/50 dark:bg-slate-800/50 px-4 py-1.5 rounded-full">
          <span className="material-symbols-outlined text-[18px]">calendar_today</span>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Center — branch switcher (multi) or gym name (single) */}
      <div className="absolute left-1/2 -translate-x-1/2">
        {isMultiBranch ? (
          <BranchSwitcher
            gymBranches={isImpersonating ? impersonatedBranches : gymBranches}
            activeGymId={gymId}
            switchBranch={isImpersonating ? handleImpersonatedSwitch : switchBranch}
          />
        ) : (
          <div className="flex flex-col items-center leading-tight pointer-events-none">
            <span className="font-bold text-slate-900 dark:text-white text-sm md:text-base tracking-tight whitespace-nowrap">{gymName}</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium tracking-wider uppercase hidden sm:block">powered by Kilos</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 relative">
        {/* Notification Button — admin only */}
        {role === 'admin' && (
          <>
            <button
              ref={notifBtnRef}
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
            <NotificationPanel isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} onClear={() => setNotifCount(0)} triggerRef={notifBtnRef} />
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
          </>
        )}

        {/* Profile + User Info */}
        <div className="relative flex items-center gap-2.5" ref={profileRef}>
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
