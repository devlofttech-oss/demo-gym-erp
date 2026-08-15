import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '../../context/AuthContext';

const ADMIN_NAV_ALL = [
  { to: '/',              icon: 'monitoring',             label: 'Dashboard',      fill: true,  end: true  },
  { to: '/members',       icon: 'group',                  label: 'Members',        fill: true               },
  { to: '/plans',         icon: 'loyalty',                label: 'Plans',          fill: true               },
  { to: '/payments',      icon: 'account_balance_wallet', label: 'Payments',       fill: false              },
  { to: '/checkin',       icon: 'how_to_reg',             label: 'Check-in',       fill: true               },
  { to: '/attendance',    icon: 'event_available',        label: 'Attendance',     fill: true               },
  { to: '/classes',       icon: 'sports_gymnastics',      label: 'Classes',        fill: true               },
  { to: '/staff',         icon: 'badge',                  label: 'Staff',          fill: true               },
  { to: '/equipment',     icon: 'fitness_center',         label: 'Equipment',      fill: false              },
  { to: '/supplements',   icon: 'medication',             label: 'Supplements',    fill: true               },
  { to: '/leads',         icon: 'person_search',          label: 'Leads & CRM',    fill: true               },
  { to: '/workouts',      icon: 'exercise',               label: 'Workouts',       fill: true               },
  { to: '/pt',            icon: 'sports_martial_arts',    label: 'Personal Trng',  fill: true               },
  { to: '/communication', icon: 'campaign',               label: 'Communication',  fill: true               },
  { to: '/expenses',      icon: 'receipt',                label: 'Expenses',       fill: true               },
  { to: '/reports/monthly',icon: 'insert_chart',          label: 'Reports',        fill: true               },
  { to: '/settings',      icon: 'settings',               label: 'Settings',       fill: true               },
];

// 4 items pinned in the mobile bottom bar (admin)
const ADMIN_PINNED = ['/', '/members', '/checkin', '/payments'];

// Categorised groups shown in the "More" drawer
const DRAWER_GROUPS = [
  {
    label: 'Members',
    items: ['/leads', '/attendance', '/plans'],
  },
  {
    label: 'Training',
    items: ['/classes', '/workouts', '/pt'],
  },
  {
    label: 'Finance',
    items: ['/expenses', '/reports/monthly'],
  },
  {
    label: 'Inventory',
    items: ['/equipment', '/supplements'],
  },
  {
    label: 'Manage',
    items: ['/staff', '/communication', '/settings'],
  },
];

const STAFF_NAV = [
  { to: '/checkin',      icon: 'how_to_reg',     label: 'Check-in',     fill: true, end: false },
  { to: '/attendance',   icon: 'event_available', label: 'Attendance',   fill: true, end: false },
  { to: '/measurements', icon: 'monitor_weight',  label: 'Measure',      fill: true, end: false },
];

export default function DashboardLayout() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { isImpersonating, gymData, exitGym, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Close More drawer on route change
  useEffect(() => { setMoreOpen(false); }, [location.pathname]);

  const handleExit = () => {
    exitGym();
    navigate('/super-admin');
  };

  const isAdmin = role !== 'staff';

  const pinnedItems = isAdmin
    ? ADMIN_NAV_ALL.filter(n => ADMIN_PINNED.includes(n.to))
    : STAFF_NAV;

  const drawerItems = isAdmin
    ? ADMIN_NAV_ALL.filter(n => !ADMIN_PINNED.includes(n.to))
    : [];

  const isMoreActive = drawerItems.some(n =>
    n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)
  );

  return (
    <div className="bg-background text-on-background antialiased flex flex-col h-screen overflow-hidden">
      {isImpersonating && (
        <div className="shrink-0 z-50 bg-amber-500 text-white flex items-center justify-between px-4 py-2 text-sm font-medium">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">visibility</span>
            Viewing as Super Admin: <span className="font-bold ml-1">{gymData?.name}</span>
          </div>
          <button
            onClick={handleExit}
            className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors text-xs font-semibold">
            <span className="material-symbols-outlined text-[14px]">logout</span>
            Exit
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden relative md:ml-24">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-gutter lg:p-container-margin space-y-section-gap custom-scrollbar pb-24 md:pb-10">
            <Outlet />
          </main>
        </div>

        {/* ── Mobile Bottom Navigation ── */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/50 dark:border-slate-800/50 flex items-center justify-around h-16 px-1">
          {pinnedItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 flex-1 h-full py-1 rounded-xl transition-colors ${
                  isActive ? 'text-primary' : 'text-slate-400 dark:text-slate-500'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="material-symbols-outlined text-[22px]"
                    style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                    {item.icon}
                  </span>
                  <span className="text-[10px] font-medium leading-none">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* More — only opens, never toggles (close lives inside the overlay) */}
          {isAdmin && (
            <button
              onClick={() => setMoreOpen(true)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full py-1 rounded-xl transition-colors ${
                isMoreActive || moreOpen ? 'text-primary' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]"
                style={{ fontVariationSettings: (isMoreActive || moreOpen) ? "'FILL' 1" : "'FILL' 0" }}>
                grid_view
              </span>
              <span className="text-[10px] font-medium leading-none">More</span>
            </button>
          )}
        </nav>

        {/* ── Full-screen App Drawer ── */}
        {moreOpen && (
          <div className="md:hidden fixed inset-0 z-9999 flex flex-col"
            style={{ background: 'rgba(10,10,20,0.96)', backdropFilter: 'blur(16px)' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-14 pb-5 shrink-0">
              <div>
                <h2 className="text-white text-xl font-bold tracking-tight">Modules</h2>
                <p className="text-white/40 text-xs mt-0.5">{gymData?.name || 'Kilos'}</p>
              </div>
              <button
                onClick={() => setMoreOpen(false)}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white active:bg-white/20 transition-colors"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            {/* Module grid */}
            <div className="flex-1 overflow-y-auto px-5 pb-24">
              <div className="flex flex-col gap-6">
                {DRAWER_GROUPS.map(group => {
                  const groupItems = group.items
                    .map(path => ADMIN_NAV_ALL.find(n => n.to === path))
                    .filter(Boolean);
                  return (
                    <div key={group.label}>
                      <p className="text-white/30 text-[10px] font-bold uppercase tracking-[0.15em] mb-3">
                        {group.label}
                      </p>
                      <div className="grid grid-cols-4 gap-3">
                        {groupItems.map(item => {
                          const isActive = item.end
                            ? location.pathname === item.to
                            : location.pathname.startsWith(item.to);
                          return (
                            <NavLink
                              key={item.to}
                              to={item.to}
                              className={`flex flex-col items-center gap-2 py-3 px-1 rounded-2xl transition-all active:scale-95 ${
                                isActive
                                  ? 'bg-primary/30 border border-primary/40'
                                  : 'bg-white/8 border border-white/5 active:bg-white/15'
                              }`}
                            >
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                isActive ? 'bg-primary' : 'bg-white/10'
                              }`}>
                                <span className="material-symbols-outlined text-[20px] text-white"
                                  style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                                  {item.icon}
                                </span>
                              </div>
                              <span className="text-[10px] font-medium text-white/70 text-center leading-tight">
                                {item.label}
                              </span>
                            </NavLink>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
