import React, { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
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
  LockKeyhole,
  Gamepad2,
  LogOut,
  RefreshCw,
  Sun,
  Moon,
  UserCheck,
  Users
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ScormGenerationNotifier from '../../components/ScormGenerationNotifier';
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

const OPERATIONAL_NAV_GROUPS = [
  {
    label: 'Platform',
    items: [
      { to: '/scorm', end: true, label: 'Overview', icon: LayoutDashboard },
      { to: '/scorm/quizmoto', label: 'Quizmoto', icon: Gamepad2, unlocked: true }
    ]
  },
  {
    label: 'LMSGEN',
    items: [
      { to: '/scorm/author', label: 'AI Course Author', icon: Sparkles, requiresScorm: true },
      { to: '/scorm/courses', label: 'My Courses', icon: BookOpen, requiresScorm: true },
      { to: '/scorm/roster', label: 'Learner Roster', icon: UserCheck, requiresScorm: true },
      { to: '/scorm/assignments', label: 'Course Assignments', icon: BookOpen, requiresScorm: true },
      { to: '/scorm/visual-studio', label: 'Content Editor', icon: Palette, requiresScorm: true },
      { to: '/scorm/library', label: 'SCORM Library', icon: Library, requiresScorm: true },
      { to: '/scorm/tracking', label: 'Learner Tracking', icon: Activity, requiresScorm: true },
      { to: '/scorm/reports', label: 'Reports & Insights', icon: BarChart3, requiresScorm: true }
    ]
  }
];

const ANALYTICS_NAV_GROUPS = [
  {
    label: 'Analytics',
    items: [
      { to: '/scorm/tracking', label: 'Learner Tracking', icon: Activity, requiresScorm: true },
      { to: '/scorm/reports', label: 'Reports & Insights', icon: BarChart3, requiresScorm: true }
    ]
  }
];

const QUIZMOTO_ONLY_GROUPS = [
  {
    label: 'Quizmoto',
    items: [{ to: '/scorm/quizmoto', label: 'Quizmoto', icon: Gamepad2, unlocked: true }]
  }
];

function displayRole(role, isSuperAdmin, quizmotoOnly) {
  if (quizmotoOnly) return 'Quizmoto user';
  if (isSuperAdmin || role === 'super_admin') return 'Super Admin';
  if (role === 'admin') return 'Workspace Admin';
  if (role === 'co_admin') return 'Co-admin';
  if (role === 'analytics_viewer') return 'Analytics viewer';
  return 'LMSGEN member';
}

function Navigation({ onNavigate, isSuperAdmin, scormAccess, role, quizmotoOnly }) {
  const analyticsOnly = scormAccess && role === 'analytics_viewer';
  let groups = quizmotoOnly ? QUIZMOTO_ONLY_GROUPS : analyticsOnly ? ANALYTICS_NAV_GROUPS : OPERATIONAL_NAV_GROUPS;

  if (!quizmotoOnly && scormAccess && (role === 'admin' || isSuperAdmin)) {
    groups = [
      ...groups,
      {
        label: 'Administration',
        items: [
          { to: '/scorm/team', label: 'Team & Roles', icon: Users, requiresScorm: true },
          { to: '/scorm/learner-access', label: 'Learner Access & SSO', icon: LockKeyhole, requiresScorm: true }
        ]
      }
    ];
  }

  if (!quizmotoOnly && isSuperAdmin) {
    groups = [
      ...groups,
      {
        label: 'Platform Administration',
        items: [{ to: '/scorm/access', label: 'Access Control', icon: ShieldCheck, requiresScorm: true }]
      }
    ];
  }

  return (
    <nav className="scorm-nav flex-1 px-3 py-5 overflow-y-auto">
      {groups.map((group, groupIndex) => (
        <div key={group.label} className={groupIndex ? 'mt-6' : ''}>
          <div className="scorm-nav-section px-3 pb-2.5 text-[10px] uppercase font-semibold">{group.label}</div>
          <div className="space-y-1">
            {group.items.map(({ to, end, label, icon: Icon, requiresScorm, unlocked }) => {
              const locked = Boolean(requiresScorm && !scormAccess);
              return (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={onNavigate}
                  className={({ isActive }) => `scorm-nav-item ${isActive ? 'scorm-nav-active' : ''} ${locked ? 'is-locked' : ''} group flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium`}
                >
                  {({ isActive }) => (
                    <>
                      <span className="scorm-nav-icon w-8 h-8 rounded-lg grid place-items-center shrink-0"><Icon size={16} strokeWidth={isActive ? 2.2 : 1.9} /></span>
                      <span className="flex-1 truncate">{label}</span>
                      {unlocked && !scormAccess && !quizmotoOnly && <span className="text-[8px] uppercase tracking-[.08em] font-bold text-[#60a5fa]">Open</span>}
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

function MobileTabBar({ scormAccess, role, quizmotoOnly }) {
  const analyticsOnly = scormAccess && role === 'analytics_viewer';
  const items = quizmotoOnly
    ? [{ to: '/scorm/quizmoto', label: 'Quizmoto', icon: Gamepad2 }]
    : analyticsOnly
      ? [
          { to: '/scorm/tracking', label: 'Tracking', icon: Activity },
          { to: '/scorm/reports', label: 'Reports', icon: BarChart3 }
        ]
      : [
          { to: '/scorm', end: true, label: 'Home', icon: LayoutDashboard },
          { to: '/scorm/quizmoto', label: 'Quizmoto', icon: Gamepad2 },
          { to: '/scorm/author', label: scormAccess ? 'Create' : 'Locked', icon: scormAccess ? Sparkles : LockKeyhole },
          { to: '/scorm/reports', label: 'Reports', icon: BarChart3 }
        ];
  const gridClass = quizmotoOnly ? 'grid-cols-1' : analyticsOnly ? 'grid-cols-2' : 'grid-cols-4';
  return <div className={`scorm-mobile-tabbar lg:hidden fixed bottom-3 left-1/2 -translate-x-1/2 z-40 grid ${gridClass} p-1.5`}>{items.map(({ to, end, label, icon: Icon }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `scorm-mobile-tab ${isActive ? 'is-active' : ''} flex flex-col items-center justify-center gap-1 px-3 py-2`}><Icon size={17} strokeWidth={2} /><span>{label}</span></NavLink>)}</div>;
}

export default function ScormPlatformShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [theme, setTheme] = useState(readScormPlatformTheme);
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

  const refreshApproval = async () => {
    setCheckingAccess(true);
    try { await refreshScormAccess(); } finally { setCheckingAccess(false); }
  };

  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const toggleTheme = () => setTheme((current) => current === 'light' ? 'dark' : 'light');
  const quizmotoOnly = Boolean(user?.quizmotoOnly);
  const role = user?.role || (scormAccess ? 'admin' : quizmotoOnly ? 'quizmoto' : 'pending');
  const isSuperAdmin = Boolean(scormAccess && (user?.isSuperAdmin || role === 'super_admin'));
  const isWorkspaceAdmin = Boolean(scormAccess && (role === 'admin' || isSuperAdmin));
  const analyticsOnly = Boolean(scormAccess && role === 'analytics_viewer');
  const roleName = displayRole(role, isSuperAdmin, quizmotoOnly);

  return (
    <div className={`scorm-editorial scorm-theme-${theme} min-h-screen relative z-20`}>
      <aside className="scorm-sidebar fixed inset-y-0 left-0 z-40 hidden lg:flex w-[268px] flex-col border-r">
        <div className="scorm-brand-wrap h-[76px] px-5 flex items-center border-b"><Brand theme={theme} /></div>
        <Navigation isSuperAdmin={isSuperAdmin} scormAccess={scormAccess} role={role} quizmotoOnly={quizmotoOnly} />
        <div className="scorm-sidebar-footer p-3 border-t space-y-2.5">
          {(scormAccess || quizmotoOnly) && (
            <div className="rounded-xl px-3.5 py-3 border border-[#29405f] bg-[#081321]">
              <div className="flex items-center gap-2 text-[10px] font-semibold text-[#93c5fd]">
                {quizmotoOnly ? <Gamepad2 size={13} /> : analyticsOnly ? <BarChart3 size={13} /> : <ShieldCheck size={13} />} {roleName}
              </div>
              <div className="mt-1.5 text-[9px] leading-relaxed text-[#8295ae] break-all">{user?.email}</div>
            </div>
          )}

          {quizmotoOnly ? (
            <div className="scorm-status-card rounded-xl px-3.5 py-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold"><span className="scorm-status-dot" />Quizmoto access</div>
              <div className="mt-1.5 text-[10px] leading-relaxed">This Google session is limited to Quizmoto. Use password or Microsoft organisation sign-in for LMSGEN.</div>
            </div>
          ) : scormAccess ? (
            <div className="scorm-status-card rounded-xl px-3.5 py-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold"><span className="scorm-status-dot" />LMSGEN unlocked</div>
              <div className="mt-1.5 text-[10px] leading-relaxed">
                {analyticsOnly
                  ? 'Read-only learner tracking, analytics and reporting are active.'
                  : role === 'co_admin'
                    ? 'Course operations, learner management, assignments, tracking and reporting are active.'
                    : 'Authoring, learner management, assignments, tracking, reporting and SCORM operations are active.'}
              </div>
            </div>
          ) : (
            <div className="rounded-xl px-3.5 py-3 border border-[#29405f] bg-[#081321]">
              <div className="flex items-center gap-2 text-[10px] font-semibold text-[#93c5fd]"><LockKeyhole size={13} /> Approval pending</div>
              <div className="mt-1.5 text-[9px] leading-relaxed text-[#8295ae]">Quizmoto is unlocked. LMSGEN features unlock after administrator approval.</div>
              <button type="button" onClick={refreshApproval} disabled={checkingAccess} className="mt-2 inline-flex items-center gap-1.5 text-[9px] font-semibold text-[#60a5fa] disabled:opacity-50"><RefreshCw size={11} className={checkingAccess ? 'animate-spin' : ''} /> Refresh access</button>
            </div>
          )}
          <button type="button" onClick={signOut} className="scorm-sidebar-switch w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs font-medium"><span className="flex items-center gap-2"><LogOut size={14} /> Sign out</span><ChevronRight size={13} /></button>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Close navigation" className="absolute inset-0 bg-[#02050b]/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} /><div className="scorm-mobile-drawer absolute inset-y-0 left-0 w-[304px] max-w-[88vw] border-r flex flex-col"><div className="h-[72px] px-4 flex items-center justify-between border-b"><Brand theme={theme} /><button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="scorm-drawer-close w-9 h-9 grid place-items-center"><X size={17} /></button></div><Navigation isSuperAdmin={isSuperAdmin} scormAccess={scormAccess} role={role} quizmotoOnly={quizmotoOnly} onNavigate={() => setMobileOpen(false)} /><div className="p-3 border-t"><button type="button" onClick={signOut} className="scorm-sidebar-switch w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs font-medium"><span className="flex items-center gap-2"><LogOut size={14} /> Sign out</span><ChevronRight size={13} /></button></div></div></div>}

      <div className="lg:pl-[268px] min-h-screen">
        <header className="scorm-topbar sticky top-0 z-30 min-h-[64px] border-b px-4 md:px-7 py-2.5 flex items-center gap-3 md:gap-4">
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open LMSGEN navigation" className="scorm-topbar-icon lg:hidden w-10 h-10 grid place-items-center shrink-0"><Menu size={18} /></button>
          {!scormAccess && !quizmotoOnly && <div className="hidden md:flex items-center gap-2 text-[10px] font-semibold text-[#93c5fd]"><LockKeyhole size={12} /> LMSGEN approval pending · Quizmoto available</div>}
          {quizmotoOnly && <div className="hidden md:flex items-center gap-2 text-[10px] font-semibold text-[#93c5fd]"><Gamepad2 size={12} /> Google session · Quizmoto only</div>}
          {analyticsOnly && <div className="hidden md:flex items-center gap-2 text-[10px] font-semibold text-[#93c5fd]"><BarChart3 size={12} /> Read-only analytics access</div>}
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            {quizmotoOnly ? (
              <Link to="/scorm/quizmoto" className="scorm-button-primary inline-flex items-center gap-2 px-3.5 md:px-4 py-2.5 text-xs font-semibold"><Gamepad2 size={14} /><span>Quizmoto</span></Link>
            ) : analyticsOnly ? (
              <>
                <Link to="/scorm/tracking" className="scorm-button-secondary hidden sm:inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold"><Activity size={14} /><span>Tracking</span></Link>
                <Link to="/scorm/reports" className="scorm-button-primary inline-flex items-center gap-2 px-3.5 md:px-4 py-2.5 text-xs font-semibold"><BarChart3 size={14} /><span>Reports</span></Link>
              </>
            ) : (
              <>
                <Link to="/scorm/quizmoto" className="scorm-button-secondary hidden sm:inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold"><Gamepad2 size={14} /><span>Quizmoto</span></Link>
                {isWorkspaceAdmin && <Link to="/scorm/team" className="scorm-button-secondary hidden xl:inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold"><Users size={14} /> Team</Link>}
                {isSuperAdmin && <Link to="/scorm/access" className="scorm-button-secondary hidden md:inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold"><ShieldCheck size={14} /> Access</Link>}
                <Link to="/scorm/library?upload=1" className="scorm-button-secondary hidden md:inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold"><Upload size={14} /> {scormAccess ? 'Upload' : 'Library'}</Link>
                <Link to="/scorm/author" className="scorm-button-primary inline-flex items-center gap-2 px-3.5 md:px-4 py-2.5 text-xs font-semibold">{scormAccess ? <Plus size={14} /> : <LockKeyhole size={14} />}<span className="hidden sm:inline">{scormAccess ? 'Create course' : 'Explore AI Author'}</span><span className="sm:hidden">{scormAccess ? 'Create' : 'AI'}</span></Link>
              </>
            )}
          </div>
        </header>
        <main className="scorm-main min-h-[calc(100vh-64px)] pb-24 lg:pb-0"><Outlet /></main>
      </div>
      {!analyticsOnly && !quizmotoOnly && <ScormGenerationNotifier />}
      <MobileTabBar scormAccess={scormAccess} role={role} quizmotoOnly={quizmotoOnly} />
    </div>
  );
}
