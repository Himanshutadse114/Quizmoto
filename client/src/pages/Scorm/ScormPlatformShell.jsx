import React, { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  BookOpenCheck,
  Activity,
  BarChart3,
  Library,
  Sparkles,
  Palette,
  Menu,
  X,
  ChevronRight,
  Plus,
  Upload,
  ShieldCheck,
  ShieldAlert,
  LockKeyhole,
  Gamepad2,
  LogOut,
  Sun,
  Moon,
  UserCheck,
  Users,
  Megaphone,
  Mail,
  Settings,
  Bot
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ScormGenerationNotifier from '../../components/ScormGenerationNotifier';
import ScormWorkspaceSearch from './ScormWorkspaceSearch';
import GennyGuide from '../../components/mascot/GennyGuide';
import { topicForPath } from '../../components/mascot/genny-knowledge';
import { readScormPlatformTheme, saveScormPlatformTheme } from './platformTheme';
import './scormEditorialTheme.css';
import './scormDashboard.css';
import './scormContrastPolish.css';
import './scormModernDark.css';
import './scormPlatformBluePolish.css';
import './scormButtonTealOverride.css';
import './scormLightTheme.css';
import './scormLightContrastGuard.css';
import './scormLightRoutePolish.css';
import './courseGeneratorThemeFix.css';
import './scormSearchControls.css';

const OPERATIONAL_NAV_GROUPS = [
  {
    label: 'Platform',
    items: [
      { to: '/scorm', end: true, label: 'Overview', icon: LayoutDashboard },
      { to: '/scorm/quizmoto', label: 'Quizmoto', icon: Gamepad2, requiresScorm: true },
      { to: '/scorm/publica', label: 'Publica', icon: BookOpenCheck, unlocked: true }
    ]
  },
  {
    label: 'LMSGEN',
    items: [
      { to: '/scorm/author', label: 'AI Course Author', icon: Sparkles, requiresScorm: true },
      { to: '/scorm/awareness-templates', label: 'Awareness Emails', icon: Mail, requiresScorm: true },
      { to: '/scorm/courses', label: 'My Courses', icon: BookOpen, requiresScorm: true },
      { to: '/scorm/roster', label: 'Learner Roster', icon: UserCheck, requiresScorm: true },
      { to: '/scorm/assignments', label: 'Campaigns', icon: Megaphone, requiresScorm: true },
      { to: '/scorm/visual-studio', label: 'Content Editor', icon: Palette, requiresScorm: true },
      { to: '/scorm/avatar-studio', label: 'Avatar Studio', icon: Bot, unlocked: true },
      { to: '/scorm/library', label: 'Course Library', icon: Library, requiresScorm: true },
      { to: '/scorm/tracking', label: 'Learner Tracking', icon: Activity, requiresScorm: true },
      { to: '/scorm/reports', label: 'Reports & Insights', icon: BarChart3, requiresScorm: true }
    ]
  }
];

const ANALYTICS_NAV_GROUPS = [
  {
    label: 'Free tools',
    items: [
      { to: '/scorm/publica', label: 'Publica', icon: BookOpenCheck, unlocked: true },
      { to: '/scorm/avatar-studio', label: 'Avatar Studio', icon: Bot, unlocked: true }
    ]
  },
  {
    label: 'Analytics',
    items: [
      { to: '/scorm/tracking', label: 'Learner Tracking', icon: Activity, requiresScorm: true },
      { to: '/scorm/reports', label: 'Reports & Insights', icon: BarChart3, requiresScorm: true }
    ]
  }
];

const SALES_CONTACT_URL = 'https://www.lmsgen.in/contact';

function FreeAccessCard() {
  return (
    <div className="scorm-status-card rounded-lg px-2.5 py-2 flex items-center gap-2">
      <span className="scorm-status-dot shrink-0" />
      <span className="min-w-0 flex-1 truncate text-[10px] font-semibold">Demo mode</span>
      <a href={SALES_CONTACT_URL} className="inline-flex shrink-0 items-center gap-0.5 text-[9px] font-semibold text-[#4FC9BF] hover:text-[#7de0d8]">Activate <ChevronRight size={10} /></a>
    </div>
  );
}

const DEMO_NAV_GROUPS = [
  {
    label: 'Platform tour',
    items: [
      { to: '/scorm', end: true, label: 'Overview', icon: LayoutDashboard },
      { to: '/scorm/quizmoto', label: 'Quizmoto', icon: Gamepad2, requiresScorm: true },
      { to: '/scorm/publica', label: 'Publica', icon: BookOpenCheck, unlocked: true }
    ]
  },
  {
    label: 'Create',
    items: [
      { to: '/scorm/author', label: 'AI Course Author', icon: Sparkles, requiresScorm: true },
      { to: '/scorm/awareness-templates', label: 'Awareness Emails', icon: Mail, requiresScorm: true },
      { to: '/scorm/visual-studio', label: 'Content Editor', icon: Palette, requiresScorm: true },
      { to: '/scorm/avatar-studio', label: 'Avatar Studio', icon: Bot, unlocked: true },
      { to: '/scorm/library', label: 'Course Library', icon: Library, requiresScorm: true }
    ]
  },
  {
    label: 'Deliver',
    items: [
      { to: '/scorm/courses', label: 'Demo Course', icon: BookOpen, unlocked: true },
      { to: '/scorm/roster', label: 'Learner Roster', icon: UserCheck, requiresScorm: true },
      { to: '/scorm/assignments', label: 'Campaigns', icon: Megaphone, requiresScorm: true }
    ]
  },
  {
    label: 'Measure',
    items: [
      { to: '/scorm/tracking', label: 'Learner Tracking', icon: Activity, requiresScorm: true },
      { to: '/scorm/reports', label: 'Reports & Insights', icon: BarChart3, requiresScorm: true }
    ]
  },
  {
    label: 'Administer',
    items: [
      { to: '/scorm/team', label: 'Team & Roles', icon: Users, requiresScorm: true },
      { to: '/scorm/learner-access', label: 'Authentication & SSO', icon: LockKeyhole, requiresScorm: true }
    ]
  }
];

function displayRole(role, isSuperAdmin, scormAccess) {
  if (!scormAccess) return 'Platform demo';
  if (isSuperAdmin || role === 'super_admin') return 'Super Admin';
  if (role === 'admin') return 'Tenant Admin';
  if (role === 'co_admin') return 'Co-admin';
  if (role === 'analytics_viewer') return 'Analytics viewer';
  return 'LMSGEN member';
}

function navigationGroups({ isSuperAdmin, scormAccess, role }) {
  const analyticsOnly = scormAccess && role === 'analytics_viewer';
  let groups = !scormAccess ? DEMO_NAV_GROUPS : analyticsOnly ? ANALYTICS_NAV_GROUPS : OPERATIONAL_NAV_GROUPS;

  if (scormAccess && (role === 'admin' || isSuperAdmin)) {
    groups = [
      ...groups,
      {
        label: 'Tenant Administration',
        items: [
          { to: '/scorm/team', label: 'Team & Roles', icon: Users, requiresScorm: true },
          { to: '/scorm/learner-access', label: 'Authentication & SSO', icon: LockKeyhole, requiresScorm: true }
        ]
      }
    ];
  }

  if (isSuperAdmin) {
    groups = [
      ...groups,
      {
        label: 'Platform Administration',
        items: [
          { to: '/scorm/access', end: true, label: 'Tenant Management', icon: ShieldCheck, requiresScorm: true },
          { to: '/scorm/access/danger', end: true, label: 'Danger Zone', icon: ShieldAlert, requiresScorm: true }
        ]
      }
    ];
  }

  groups = [
    ...groups,
    {
      label: 'Account',
      items: [{ to: '/scorm/settings', label: 'Settings', icon: Settings }]
    }
  ];

  return groups;
}

function Navigation({ onNavigate, isSuperAdmin, scormAccess, role }) {
  const groups = navigationGroups({ isSuperAdmin, scormAccess, role });

  return (
    <nav className={`scorm-nav flex-1 px-3 overflow-y-auto ${scormAccess ? 'py-5' : 'py-3'}`}>
      {groups.map((group, groupIndex) => (
        <div key={group.label} className={groupIndex ? (scormAccess ? 'mt-6' : 'mt-3') : ''}>
          <div className={`scorm-nav-section px-2.5 uppercase font-semibold ${scormAccess ? 'pb-2.5 text-[10px]' : 'pb-1 text-[8px]'}`}>{group.label}</div>
          <div className={scormAccess ? 'space-y-1' : 'space-y-0.5'}>
            {group.items.map(({ to, end, label, icon, requiresScorm, unlocked }) => {
              const locked = Boolean(requiresScorm && !scormAccess);
              return (
                <NavLink
                  key={to}
                  to={to}
                  data-genny-topic={topicForPath(to)?.id}
                  end={end}
                  onClick={onNavigate}
                  className={({ isActive }) => `scorm-nav-item ${isActive ? 'scorm-nav-active' : ''} ${locked ? 'is-locked' : ''} group flex items-center font-medium ${scormAccess ? 'gap-3 px-3 py-2.5 text-[13px]' : 'gap-2.5 px-2.5 py-1.5 text-[11px]'}`}
                >
                  {({ isActive }) => (
                    <>
                      <span className={`scorm-nav-icon rounded-lg grid place-items-center shrink-0 ${scormAccess ? 'w-8 h-8' : 'w-7 h-7'}`}>{React.createElement(icon, { size: scormAccess ? 16 : 14, strokeWidth: isActive ? 2.2 : 1.9 })}</span>
                      <span className="flex-1 truncate">{label}</span>
                      {unlocked && !scormAccess && <span className="text-[8px] uppercase tracking-[.08em] font-bold text-[#60a5fa]">Open</span>}
                      {locked ? <LockKeyhole size={12} className="text-[#71839c]" /> : isActive ? <ChevronRight size={14} className="scorm-nav-chevron" /> : null}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Brand({ theme }) {
  const logoSrc = theme === 'light' ? '/branding/lmsgen-logo-light.png' : '/branding/lmsgen-logo-dark.png';
  return (
    <Link to="/scorm" className="scorm-brand flex items-center min-w-0">
      <img src={logoSrc} alt="LMSGEN" className="scorm-brand-logo shrink-0" />
    </Link>
  );
}

function ThemeToggle({ theme, onToggle, auth = false }) {
  const light = theme === 'light';
  const Icon = light ? Moon : Sun;
  return (
    <button type="button" onClick={onToggle} className={auth ? 'sa-theme-toggle' : 'scorm-theme-toggle'} aria-label={light ? 'Switch to dark theme' : 'Switch to light theme'} aria-pressed={light} title={light ? 'Switch to dark theme' : 'Switch to light theme'}>
      <Icon size={15} strokeWidth={2} />
      <span className="scorm-theme-toggle-label">{light ? 'Dark' : 'Light'}</span>
      <span className="scorm-theme-toggle-track" aria-hidden="true"><span className="scorm-theme-toggle-knob" /></span>
    </button>
  );
}

function MobileTabBar({ scormAccess, role }) {
  const analyticsOnly = scormAccess && role === 'analytics_viewer';
  const items = !scormAccess
    ? [
        { to: '/scorm', end: true, label: 'Tour', icon: LayoutDashboard },
        { to: '/scorm/courses', label: 'Course', icon: BookOpen },
        { to: '/scorm/quizmoto', label: 'Quizmoto', icon: LockKeyhole },
        { to: '/scorm/publica', label: 'Publica', icon: BookOpenCheck },
        { to: '/scorm/avatar-studio', label: 'Avatars', icon: Bot }
      ]
    : analyticsOnly
      ? [
          { to: '/scorm/publica', label: 'Publica', icon: BookOpenCheck },
          { to: '/scorm/tracking', label: 'Tracking', icon: Activity },
          { to: '/scorm/reports', label: 'Reports', icon: BarChart3 },
          { to: '/scorm/avatar-studio', label: 'Avatars', icon: Bot }
        ]
      : [
          { to: '/scorm', end: true, label: 'Home', icon: LayoutDashboard },
          { to: '/scorm/quizmoto', label: 'Quizmoto', icon: Gamepad2 },
          { to: '/scorm/publica', label: 'Publica', icon: BookOpenCheck },
          { to: '/scorm/avatar-studio', label: 'Avatars', icon: Bot },
          { to: '/scorm/author', label: scormAccess ? 'Create' : 'Locked', icon: scormAccess ? Sparkles : LockKeyhole }
        ];
  const gridClass = analyticsOnly ? 'grid-cols-4' : 'grid-cols-5';
  return <div className={`scorm-mobile-tabbar lg:hidden fixed bottom-3 left-1/2 -translate-x-1/2 z-40 grid ${gridClass} p-1.5`}>{items.map(({ to, end, label, icon }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `scorm-mobile-tab ${isActive ? 'is-active' : ''} flex flex-col items-center justify-center gap-1 px-3 py-2`}>{React.createElement(icon, { size: 17, strokeWidth: 2 })}<span>{label}</span></NavLink>)}</div>;
}

export default function ScormPlatformShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState(readScormPlatformTheme);
  const location = useLocation();
  const navigate = useNavigate();
  const { platformAccess, scormAccess, user, refreshScormAccess, logout } = useAuth();

  useEffect(() => { saveScormPlatformTheme(theme); }, [theme]);

  useEffect(() => {
    if (!platformAccess) return;
    refreshScormAccess().catch((err) => {
      if (err?.response?.status === 401) {
        logout();
        navigate('/login', { replace: true });
      }
    });
  }, [platformAccess]);

  if (!platformAccess) return <Navigate to="/login" replace />;

  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const toggleTheme = () => setTheme((current) => current === 'light' ? 'dark' : 'light');
  const quizmotoOnly = Boolean(user?.quizmotoOnly);
  const trialAccess = Boolean(user?.trialAccess || user?.role === 'trial');
  const role = user?.role || (scormAccess ? 'admin' : trialAccess ? 'trial' : quizmotoOnly ? 'quizmoto' : 'pending');
  const isSuperAdmin = Boolean(scormAccess && (user?.isSuperAdmin || role === 'super_admin'));
  const isWorkspaceAdmin = Boolean(scormAccess && (role === 'admin' || isSuperAdmin));
  const analyticsOnly = Boolean(scormAccess && role === 'analytics_viewer');
  const demoAccess = !scormAccess;
  const roleName = displayRole(role, isSuperAdmin, scormAccess);

  return (
    <div className={`scorm-editorial scorm-theme-${theme} min-h-screen relative z-20`}>
      <aside className="scorm-sidebar fixed inset-y-0 left-0 z-40 hidden lg:flex w-[268px] flex-col border-r">
        <div className="scorm-brand-wrap h-[76px] px-5 flex items-center border-b"><Brand theme={theme} /></div>
        <Navigation isSuperAdmin={isSuperAdmin} scormAccess={scormAccess} role={role} />
        <div className="scorm-sidebar-footer p-2 border-t space-y-1.5">
          {platformAccess && (
            <Link to="/scorm/settings" title={user?.email || 'Account settings'} className="scorm-sidebar-profile rounded-lg px-2.5 py-2 border border-[#29405f] bg-[#081321] block">
              <div className="flex items-center gap-2">
                {user?.avatar ? <img src={user.avatar} alt="" className="w-7 h-7 rounded-lg object-cover" /> : <div className="w-7 h-7 rounded-lg grid place-items-center bg-[#4FC9BF]/15 text-[#4FC9BF] text-[9px] font-bold">{String(user?.username || 'U').trim().slice(0, 1).toUpperCase()}</div>}
                <div className="min-w-0"><div className="text-[9px] font-semibold text-[#93c5fd] truncate">{user?.username || roleName}</div><div className="text-[7px] text-[#8295ae] truncate">{roleName}</div></div>
                <Settings size={12} className="ml-auto text-[#8295ae]" />
              </div>
            </Link>
          )}

          {demoAccess && <FreeAccessCard />}
          <button type="button" onClick={signOut} className="scorm-sidebar-switch w-full flex items-center justify-between gap-2 px-2.5 py-2 text-[10px] font-medium"><span className="flex items-center gap-2"><LogOut size={12} /> Sign out</span><ChevronRight size={11} /></button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close navigation" className="absolute inset-0 bg-[#02050b]/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="scorm-mobile-drawer absolute inset-y-0 left-0 w-[304px] max-w-[88vw] border-r flex flex-col">
            <div className="h-[72px] px-4 flex items-center justify-between border-b">
              <Brand theme={theme} />
              <button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="scorm-drawer-close w-9 h-9 grid place-items-center"><X size={17} /></button>
            </div>
            <Navigation isSuperAdmin={isSuperAdmin} scormAccess={scormAccess} role={role} onNavigate={() => setMobileOpen(false)} />
            <div className="p-2 border-t space-y-1.5">
              {demoAccess && <FreeAccessCard />}
              <button type="button" onClick={signOut} className="scorm-sidebar-switch w-full flex items-center justify-between gap-2 px-2.5 py-2 text-[10px] font-medium"><span className="flex items-center gap-2"><LogOut size={12} /> Sign out</span><ChevronRight size={11} /></button>
            </div>
          </div>
        </div>
      )}

      <div className="lg:pl-[268px] min-h-screen">
        <header className="scorm-topbar sticky top-0 z-30 min-h-[64px] border-b px-4 md:px-7 py-2.5 flex flex-wrap items-center gap-3 md:gap-4">
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open LMSGEN navigation" className="scorm-topbar-icon lg:hidden w-10 h-10 grid place-items-center shrink-0"><Menu size={18} /></button>
          <div className="scorm-topbar-search-area">
            <ScormWorkspaceSearch groups={navigationGroups({ isSuperAdmin, scormAccess, role })} scormAccess={scormAccess} />
            {demoAccess && <div className="hidden md:flex items-center gap-2 text-[10px] font-semibold text-[#93c5fd]"><LockKeyhole size={12} /> Interactive demo · Product operations are locked</div>}
            {analyticsOnly && <div className="hidden md:flex items-center gap-2 text-[10px] font-semibold text-[#93c5fd]"><BarChart3 size={12} /> Read-only analytics access</div>}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            {demoAccess ? (
              <>
                <Link to="/scorm/publica" className="scorm-button-secondary hidden sm:inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold"><BookOpenCheck size={14} /><span>Publica</span></Link>
                <Link to="/scorm/courses" className="scorm-button-primary inline-flex items-center gap-2 px-3.5 md:px-4 py-2.5 text-xs font-semibold"><BookOpen size={14} /><span>Open demo course</span></Link>
              </>
            ) : analyticsOnly ? (
              <>
                <Link to="/scorm/publica" className="scorm-button-secondary hidden sm:inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold"><BookOpenCheck size={14} /><span>Publica</span></Link>
                <Link to="/scorm/tracking" className="scorm-button-secondary hidden sm:inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold"><Activity size={14} /><span>Tracking</span></Link>
                <Link to="/scorm/reports" className="scorm-button-primary inline-flex items-center gap-2 px-3.5 md:px-4 py-2.5 text-xs font-semibold"><BarChart3 size={14} /><span>Reports</span></Link>
              </>
            ) : (
              <>
                <Link to="/scorm/publica" className="scorm-button-secondary hidden lg:inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold"><BookOpenCheck size={14} /><span>Publica</span></Link>
                <Link to="/scorm/quizmoto" className="scorm-button-secondary hidden sm:inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold"><Gamepad2 size={14} /><span>Quizmoto</span></Link>
                {isWorkspaceAdmin && <Link to="/scorm/team" className="scorm-button-secondary hidden xl:inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold"><Users size={14} /> Team</Link>}
                {isSuperAdmin && <Link to="/scorm/access" className="scorm-button-secondary hidden md:inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold"><ShieldCheck size={14} /> Tenants</Link>}
                <Link to="/scorm/library?upload=1" className="scorm-button-secondary hidden md:inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold"><Upload size={14} /> {scormAccess ? 'Upload' : 'Library'}</Link>
                <Link to="/scorm/author" className="scorm-button-primary inline-flex items-center gap-2 px-3.5 md:px-4 py-2.5 text-xs font-semibold">{scormAccess ? <Plus size={14} /> : <LockKeyhole size={14} />}<span className="hidden sm:inline">{scormAccess ? 'Create course' : 'Explore AI Author'}</span><span className="sm:hidden">{scormAccess ? 'Create' : 'AI'}</span></Link>
              </>
            )}
          </div>
        </header>
        <main className="scorm-main min-h-[calc(100vh-64px)] pb-24 lg:pb-0"><Outlet /></main>
      </div>
      {scormAccess && !analyticsOnly && <ScormGenerationNotifier />}
      <MobileTabBar scormAccess={scormAccess} role={role} />
      <GennyGuide key={`${role}-${scormAccess}-${isSuperAdmin}`} platform scormAccess={scormAccess} isSuperAdmin={isSuperAdmin}
        allowedRoutes={navigationGroups({ isSuperAdmin, scormAccess, role }).flatMap((group) => group.items.map((item) => item.to))}
        accountKey={gennyAccountKey(user)} suspended={mobileOpen} />
    </div>
  );
}

// Local tour preferences use an opaque per-account key, never an email address.
function gennyAccountKey(user) {
  const identity = `${user?.workspaceId || 'demo'}:${user?.email || user?.username || 'member'}`;
  let hash = 0;
  for (const char of identity) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  return `platform-${(hash >>> 0).toString(36)}`;
}
