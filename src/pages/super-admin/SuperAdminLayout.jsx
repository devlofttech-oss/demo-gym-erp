import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useDarkMode } from '../../hooks/useDarkMode';

const NAV = [
  { to: '/super-admin',       label: 'Dashboard', icon: 'monitoring',      end: true },
  { to: '/super-admin/gyms',  label: 'Gyms',      icon: 'fitness_center',  end: false },
];

export default function SuperAdminLayout() {
  const { logout } = useAuth();
  const { isDarkMode, setLightMode, setDarkMode } = useDarkMode();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="bg-background text-on-background antialiased flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-white dark:bg-slate-900 border-r border-outline-variant/20 shrink-0">
        {/* Header */}
        <div className="px-5 py-5 border-b border-outline-variant/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-white text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>admin_panel_settings</span>
            </div>
            <div>
              <div className="font-bold text-on-surface text-sm">Super Admin</div>
              <div className="text-xs text-on-surface-variant">GymERP Platform</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV.map(({ to, label, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`
              }
            >
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
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <Outlet />
      </main>
    </div>
  );
}
