import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const mobileNavItems = [
  { to: '/', label: 'Dashboard', icon: 'monitoring', end: true },
  { to: '/members', label: 'Members', icon: 'group' },
  { to: '/payments', label: 'Payments', icon: 'account_balance_wallet' },
  { to: '/checkin', label: 'Check-in', icon: 'how_to_reg' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

export default function DashboardLayout() {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  return (
    <div className="bg-background text-on-background antialiased flex h-screen overflow-hidden">
      <Sidebar onExpandChange={setSidebarExpanded} />
      <div
        className={`flex-1 flex flex-col overflow-hidden relative transition-all duration-300 ${
          sidebarExpanded ? 'md:ml-60' : 'md:ml-22'
        }`}
      >
        <Topbar />
        <main className="flex-1 overflow-y-auto p-gutter lg:p-container-margin space-y-section-gap custom-scrollbar pb-24 md:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation — hidden on md+ where sidebar is visible */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/50 dark:border-slate-800/50 flex items-center justify-around h-16 px-2">
        {mobileNavItems.map(item => (
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
                <span
                  className="material-symbols-outlined text-[22px]"
                  style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {item.icon}
                </span>
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
