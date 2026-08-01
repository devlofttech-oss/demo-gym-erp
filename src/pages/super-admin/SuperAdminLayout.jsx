import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useDarkMode } from '../../hooks/useDarkMode';
import logoImage from '../../assets/kilos_logo.png';

const NAV = [
  { to: '/super-admin',         label: 'Dashboard', icon: 'monitoring',     end: true  },
  { to: '/super-admin/gyms',    label: 'Gyms',      icon: 'fitness_center', end: false },
  { to: '/super-admin/trials',  label: 'Trials',    icon: 'timer',          end: false },
];

export default function SuperAdminLayout() {
  const { logout } = useAuth();
  const { isDarkMode, setLightMode, setDarkMode } = useDarkMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef(null);

  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) setDrawerOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [drawerOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
      isActive
        ? 'bg-primary text-on-primary'
        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
    }`;

  const SidebarContent = () => (
    <>
      {/* Header */}
      <div className="px-5 py-5 border-b border-outline-variant/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 bg-primary-container/10 flex items-center justify-center">
            <img src={logoImage} alt="Kilos" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="font-bold text-on-surface text-sm">Kilos</div>
            <div className="text-xs text-on-surface-variant">Super Admin Platform</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {NAV.map(({ to, label, icon, end }) => (
          <NavLink key={to} to={to} end={end} className={navLinkClass}>
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Theme + Logout */}
      <div className="px-3 py-4 border-t border-outline-variant/20 flex flex-col gap-2">
        <div className="flex gap-1 bg-surface-container rounded-xl p-1">
          <button onClick={setLightMode}
            className={`flex-1 flex items-center justify-center h-9 rounded-lg transition-colors ${!isDarkMode ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-low'}`}>
            <span className="material-symbols-outlined text-[18px]">light_mode</span>
          </button>
          <button onClick={setDarkMode}
            className={`flex-1 flex items-center justify-center h-9 rounded-lg transition-colors ${isDarkMode ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-low'}`}>
            <span className="material-symbols-outlined text-[18px]">dark_mode</span>
          </button>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors w-full">
          <span className="material-symbols-outlined text-[18px]">logout</span>
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="bg-background text-on-background antialiased flex flex-col h-screen overflow-hidden">
      {/* Mobile topbar */}
      <header className="md:hidden flex items-center justify-between h-14 px-4 bg-white dark:bg-slate-900 border-b border-outline-variant/20 shrink-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(v => !v)}
            className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">menu</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 bg-primary-container/10 flex items-center justify-center">
              <img src={logoImage} alt="Kilos" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-on-surface text-sm">Kilos</span>
          </div>
        </div>
        <button onClick={handleLogout} className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors">
          <span className="material-symbols-outlined text-[20px]">logout</span>
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex flex-col w-60 bg-white dark:bg-slate-900 border-r border-outline-variant/20 shrink-0">
          <SidebarContent />
        </aside>

        {/* Mobile slide-in drawer */}
        {drawerOpen && (
          <>
            <div
              className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
            />
            <aside
              ref={drawerRef}
              className="md:hidden fixed left-0 top-0 bottom-0 z-50 w-72 bg-white dark:bg-slate-900 flex flex-col shadow-2xl"
            >
              <SidebarContent />
            </aside>
          </>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
