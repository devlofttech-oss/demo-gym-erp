import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useAuth } from '../../context/AuthContext';
import { RequestFeatureModal, ContactModal } from '../support/SupportModals';
import logoImage from '../../assets/kilos_logo.png';

// ── Nav sections ──────────────────────────────────────────────────────────────

const PRIMARY = [
  { to: '/',               icon: 'monitoring',             label: 'Dashboard',         fill: true  },
  { to: '/members',        icon: 'group',                  label: 'Members',           fill: true  },
  { to: '/payments',       icon: 'account_balance_wallet', label: 'Payments',          fill: false },
  { to: '/checkin',        icon: 'how_to_reg',             label: 'Check-in',          fill: true  },
  { to: '/attendance',     icon: 'event_available',        label: 'Attendance',        fill: true  },
  { to: '/reports/monthly',icon: 'insert_chart',           label: 'Reports',           fill: true  },
];

const CONFIGURATION = [
  { to: '/plans',          icon: 'loyalty',                label: 'Plans',             fill: true  },
  { to: '/classes',        icon: 'sports_gymnastics',      label: 'Classes',           fill: true  },
  { to: '/staff',          icon: 'badge',                  label: 'Staff',             fill: true  },
  { to: '/pt',             icon: 'sports_martial_arts',    label: 'Personal Training', fill: true  },
];

const MANAGEMENT = [
  { to: '/leads',          icon: 'person_search',          label: 'Leads & CRM',       fill: true  },
  { to: '/workouts',       icon: 'exercise',               label: 'Workout Plans',     fill: true  },
  { to: '/equipment',      icon: 'fitness_center',         label: 'Equipment',         fill: false },
  { to: '/expenses',       icon: 'receipt',                label: 'Expenses',          fill: true  },
  { to: '/renewals',       icon: 'autorenew',              label: 'Renewals',          fill: false },
  { to: '/supplements',    icon: 'medication',             label: 'Supplements',       fill: true  },
];

const ADMIN_SECTIONS = [
  { label: 'Primary',           items: PRIMARY       },
  { label: 'Configuration',     items: CONFIGURATION },
  { label: 'Management',        items: MANAGEMENT    },
];

const STAFF_NAV = [
  { to: '/checkin',      icon: 'how_to_reg',      label: 'Check-in',     fill: true },
  { to: '/attendance',   icon: 'event_available', label: 'Attendance',   fill: true },
  { to: '/measurements', icon: 'monitor_weight',  label: 'Measurements', fill: true },
];

// ── Popups ────────────────────────────────────────────────────────────────────

function HowToModal({ onClose }) {
  const [platform, setPlatform] = useState(null); // 'web' | 'app'
  return (
    <div className="fixed inset-0 z-200 flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="font-bold text-on-surface text-lg">How to Use Kilos?</p>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        {!platform ? (
          <>
            <p className="text-sm text-on-surface-variant">Choose the platform you want a tutorial for:</p>
            <div className="flex gap-3">
              <button onClick={() => setPlatform('web')}
                className="flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border border-outline-variant/30 hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-primary text-[28px]">computer</span>
                <span className="text-sm font-medium text-on-surface">Web App</span>
              </button>
              <button onClick={() => setPlatform('app')}
                className="flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border border-outline-variant/30 hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-primary text-[28px]">phone_iphone</span>
                <span className="text-sm font-medium text-on-surface">Mobile App</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-on-surface-variant">Select your preferred language:</p>
            <div className="flex gap-3">
              <a href="https://www.youtube.com/@DevloftTechnologies" target="_blank" rel="noopener noreferrer"
                className="flex-1 flex flex-col items-center gap-2 p-4 rounded-xl bg-primary text-on-primary hover:bg-primary/90 transition-colors">
                <span className="material-symbols-outlined text-[24px]">play_circle</span>
                <span className="text-sm font-semibold">English</span>
              </a>
              <a href="https://www.youtube.com/@DevloftTechnologies" target="_blank" rel="noopener noreferrer"
                className="flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border border-outline-variant/30 hover:bg-surface-container transition-colors text-on-surface">
                <span className="material-symbols-outlined text-[24px]">play_circle</span>
                <span className="text-sm font-semibold">हिंदी</span>
              </a>
            </div>
            <button onClick={() => setPlatform(null)} className="text-sm text-on-surface-variant hover:text-on-surface transition-colors">← Back</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const { isDarkMode, setLightMode, setDarkMode } = useDarkMode();
  const { role, gymId, gymData } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [modal, setModal] = useState(null); // 'howto' | 'feature' | 'contact'

  const isStaff = role === 'staff';
  const expand  = () => setExpanded(true);
  const collapse = () => setExpanded(false);

  const pillCls = (isActive) =>
    `h-11 flex items-center transition-all duration-300 mx-2 shrink-0 ${
      expanded ? 'w-auto justify-start px-4 rounded-full' : 'w-14 justify-center rounded-full'
    } ${
      isActive
        ? 'bg-slate-900 text-white shadow-md dark:bg-primary-container dark:text-primary'
        : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-400'
    }`;

  const actionPillCls = `h-11 flex items-center transition-all duration-300 mx-2 shrink-0 cursor-pointer ${
    expanded ? 'w-auto justify-start px-4 rounded-full' : 'w-14 justify-center rounded-full'
  } text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-400`;

  const sectionLabel = (label) =>
    expanded ? (
      <p className="mx-4 mt-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 select-none">
        {label}
      </p>
    ) : (
      <div className="w-full flex justify-center my-1">
        <div className="w-6 h-px bg-slate-200 dark:bg-slate-700" />
      </div>
    );

  const navIcon = (icon, fill) => (
    <span className="material-symbols-outlined text-[22px] shrink-0"
      style={{ fontVariationSettings: fill ? "'FILL' 1" : "'FILL' 0" }}>
      {icon}
    </span>
  );

  // Other section items
  const otherItems = [
    {
      icon: 'upload_file', label: 'Bulk Import Members', fill: false,
      to: '/members/import',
    },
    {
      icon: 'shopping_cart', label: 'Buy / Renew Plan', fill: false,
      to: '/subscription',
    },
    {
      icon: 'mark_chat_read', label: 'WhatsApp Credits', fill: false,
      to: '/whatsapp-credits',
    },
    {
      icon: 'phone_iphone', label: 'Download iOS App', fill: false,
      href: 'https://apps.apple.com/in/app/kilos-gym/id6804961729',
    },
    {
      icon: 'android', label: 'Download Android App', fill: false,
      href: 'https://play.google.com/store/apps/details?id=com.devloft.kilos',
    },
    {
      icon: 'help', label: 'How to Use Kilos?', fill: false,
      action: 'howto',
    },
    {
      icon: 'star', label: 'Request a Feature', fill: false,
      action: 'feature',
    },
    {
      icon: 'support_agent', label: 'Contact Us', fill: false,
      action: 'contact',
    },
    {
      icon: 'settings', label: 'Settings', fill: true,
      to: '/settings',
    },
  ];

  return (
    <>
      <nav
        className={`hidden md:flex flex-col items-start gap-0 fixed left-4 top-4 bottom-4 z-50 transition-all duration-300 ${expanded ? 'w-56' : 'w-19'}`}
        onMouseEnter={expand}
        onMouseLeave={collapse}
      >
        {/* Logo */}
        <div className={`h-16 bg-white dark:bg-slate-900 flex items-center shadow-sm shrink-0 transition-all duration-300 overflow-hidden mb-2 ${
          expanded ? 'w-full rounded-2xl justify-start px-3 gap-2.5' : 'w-full rounded-2xl justify-center'
        }`}>
          <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-primary-container/10 flex items-center justify-center">
            <img src={logoImage} alt="Kilos" className="w-full h-full object-contain" />
          </div>
          {expanded && (
            <span className="font-bold text-slate-900 dark:text-white whitespace-nowrap text-sm truncate">Kilos</span>
          )}
        </div>

        {/* Nav Links */}
        <div className={`bg-white dark:bg-slate-900 py-2 flex flex-col gap-0 shadow-sm flex-1 min-h-0 overflow-y-auto scrollbar-hide transition-all duration-300 ${
          expanded ? 'w-full rounded-3xl items-stretch' : 'w-full rounded-2xl items-center'
        }`}>
          {isStaff ? (
            STAFF_NAV.map(({ to, icon, label, fill }) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => pillCls(isActive)}>
                {navIcon(icon, fill)}
                {expanded && <span className="font-medium whitespace-nowrap ml-3 text-[13px]">{label}</span>}
              </NavLink>
            ))
          ) : (
            <>
              {ADMIN_SECTIONS.map(({ label, items }) => (
                <div key={label}>
                  {sectionLabel(label)}
                  {items.map(({ to, icon, label: lbl, fill }) => (
                    <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => pillCls(isActive)}>
                      {navIcon(icon, fill)}
                      {expanded && <span className="font-medium whitespace-nowrap ml-3 text-[13px]">{lbl}</span>}
                    </NavLink>
                  ))}
                </div>
              ))}

              {/* Other section */}
              {sectionLabel('Other')}
              {otherItems.map((item) => {
                if (item.to) {
                  return (
                    <NavLink key={item.to} to={item.to} className={({ isActive }) => pillCls(isActive)}>
                      {navIcon(item.icon, item.fill)}
                      {expanded && <span className="font-medium whitespace-nowrap ml-3 text-[13px]">{item.label}</span>}
                    </NavLink>
                  );
                }
                if (item.href) {
                  return (
                    <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer" className={actionPillCls}>
                      {navIcon(item.icon, item.fill)}
                      {expanded && <span className="font-medium whitespace-nowrap ml-3 text-[13px]">{item.label}</span>}
                    </a>
                  );
                }
                return (
                  <button key={item.action} type="button" onClick={() => setModal(item.action)} className={actionPillCls}>
                    {navIcon(item.icon, item.fill)}
                    {expanded && <span className="font-medium whitespace-nowrap ml-3 text-[13px]">{item.label}</span>}
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Theme Toggle */}
        <div className={`bg-white dark:bg-slate-900 p-1.5 flex shadow-sm shrink-0 transition-all duration-300 mt-2 ${
          expanded ? 'w-full rounded-2xl flex-row items-center justify-center gap-1' : 'w-full rounded-2xl flex-col items-center justify-center gap-1'
        }`}>
          <button onClick={setLightMode} className={`h-11 flex items-center justify-center rounded-xl transition-colors ${expanded ? 'flex-1' : 'w-12'} ${!isDarkMode ? 'bg-indigo-100 text-indigo-500 dark:bg-indigo-900/40 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: !isDarkMode ? "'FILL' 1" : "'FILL' 0" }}>light_mode</span>
          </button>
          <button onClick={setDarkMode} className={`h-11 flex items-center justify-center rounded-xl transition-colors ${expanded ? 'flex-1' : 'w-12'} ${isDarkMode ? 'bg-indigo-100 text-indigo-500 dark:bg-indigo-900/40 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: isDarkMode ? "'FILL' 1" : "'FILL' 0" }}>dark_mode</span>
          </button>
        </div>
      </nav>

      {/* Modals */}
      {modal === 'howto'   && <HowToModal onClose={() => setModal(null)} />}
      {modal === 'feature' && <RequestFeatureModal gymId={gymId} gymName={gymData?.name} onClose={() => setModal(null)} />}
      {modal === 'contact' && <ContactModal onClose={() => setModal(null)} />}
    </>
  );
}
