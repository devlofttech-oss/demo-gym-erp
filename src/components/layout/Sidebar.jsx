import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useAuth } from '../../context/AuthContext';
import logoImage from '../../assets/logo.png';

const ADMIN_NAV = [
  { to: '/',            icon: 'monitoring',          label: 'Dashboard',   fill: true  },
  { to: '/members',     icon: 'group',               label: 'Members',     fill: true  },
  { to: '/payments',    icon: 'account_balance_wallet', label: 'Payments', fill: false },
  { to: '/checkin',     icon: 'how_to_reg',          label: 'Check-in',    fill: true  },
  { to: '/attendance',  icon: 'event_available',     label: 'Attendance',  fill: true  },
  { to: '/classes',     icon: 'sports_gymnastics',   label: 'Classes',     fill: true  },
  { to: '/staff',       icon: 'badge',               label: 'Staff',       fill: true  },
  { to: '/equipment',   icon: 'fitness_center',      label: 'Equipment',   fill: false },
  { to: '/supplements', icon: 'medication',          label: 'Supplements', fill: true  },
  { to: '/expenses',    icon: 'receipt',             label: 'Expenses',    fill: true  },
  { to: '/settings',    icon: 'settings',            label: 'Settings',    fill: true  },
];

const STAFF_NAV = [
  { to: '/checkin',    icon: 'how_to_reg',      label: 'Check-in',   fill: true },
  { to: '/attendance', icon: 'event_available',  label: 'Attendance', fill: true },
];

export default function Sidebar({ onExpandChange }) {
  const { isDarkMode, setLightMode, setDarkMode } = useDarkMode();
  const { role } = useAuth();
  const [expanded, setExpanded] = useState(false);

  const navItems = role === 'staff' ? STAFF_NAV : ADMIN_NAV;

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    onExpandChange?.(next);
  };

  const getPillClasses = (isActive) => {
    return `h-11 flex items-center transition-all duration-300 mx-1.5 ${
      expanded ? 'w-auto justify-start px-4 rounded-full' : 'w-11 justify-center rounded-full'
    } ${
      isActive
        ? 'bg-slate-900 text-white shadow-md dark:bg-primary-container dark:text-primary'
        : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-400'
    }`;
  };

  return (
    <nav className={`hidden md:flex flex-col items-start gap-4 fixed left-4 top-4 bottom-4 z-50 transition-all duration-300 ${expanded ? 'w-56' : 'w-18'}`}>

      {/* Logo & Toggle */}
      <div className={`h-14 bg-white dark:bg-slate-900 flex items-center shadow-sm shrink-0 transition-all duration-300 overflow-hidden ${
        expanded ? 'w-full rounded-2xl justify-between px-3' : 'w-14 rounded-full justify-center flex-col relative'
      }`}>
        <div className={`flex items-center gap-3 overflow-hidden ${expanded ? 'w-auto' : 'w-full justify-center'}`}>
          {!expanded ? (
            <button onClick={toggle} className="w-full h-full flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors" title="Expand menu">
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>
          ) : (
            <>
              <img src={logoImage} alt="Logo" className="w-8 h-8 object-contain shrink-0" />
              <span className="font-bold text-slate-900 dark:text-white whitespace-nowrap text-sm">Deep Fitness</span>
            </>
          )}
        </div>

        {expanded && (
          <button
            onClick={toggle}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            title="Collapse menu"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
        )}
      </div>

      {/* Nav Links */}
      <div className={`bg-white dark:bg-slate-900 py-3 flex flex-col gap-2 shadow-sm shrink-0 transition-all duration-300 overflow-hidden overflow-y-auto ${
        expanded ? 'w-full rounded-3xl items-stretch' : 'w-14 rounded-full items-center'
      }`}>
        {navItems.map(({ to, icon, label, fill }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => getPillClasses(isActive)}
          >
            <span
              className="material-symbols-outlined text-[22px] shrink-0"
              style={{ fontVariationSettings: fill ? "'FILL' 1" : "'FILL' 0" }}
            >
              {icon}
            </span>
            {expanded && <span className="font-medium whitespace-nowrap ml-3 text-sm">{label}</span>}
          </NavLink>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1"></div>

      {/* Theme Toggle */}
      <div className={`bg-white dark:bg-slate-900 p-1.5 flex shadow-sm shrink-0 transition-all duration-300 ${
        expanded ? 'w-full rounded-2xl flex-row items-center justify-center gap-1' : 'w-14 rounded-full flex-col items-center justify-center gap-1'
      }`}>
        <button
          onClick={setLightMode}
          className={`h-11 flex items-center justify-center rounded-full transition-colors ${
            expanded ? 'flex-1' : 'w-11'
          } ${!isDarkMode ? 'bg-indigo-100 text-indigo-500 dark:bg-indigo-900/40 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: !isDarkMode ? "'FILL' 1" : "'FILL' 0" }}>light_mode</span>
        </button>
        <button
          onClick={setDarkMode}
          className={`h-11 flex items-center justify-center rounded-full transition-colors ${
            expanded ? 'flex-1' : 'w-11'
          } ${isDarkMode ? 'bg-indigo-100 text-indigo-500 dark:bg-indigo-900/40 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: isDarkMode ? "'FILL' 1" : "'FILL' 0" }}>dark_mode</span>
        </button>
      </div>

    </nav>
  );
}
