import React, { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Activity,
  BarChart3,
  Library,
  Sparkles,
  Palette,
  ArrowLeft,
  Menu,
  X,
  ChevronRight,
  Plus,
  Upload,
  Layers3
} from 'lucide-react';
import './scormEditorialTheme.css';
import './scormDashboard.css';
import './scormContrastPolish.css';
import './scormModernDark.css';
import './scormWorkbenchTheme.css';
import './scormWorkbenchConsistency.css';

const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { to: '/scorm', end: true, label: 'Overview', icon: LayoutDashboard },
      { to: '/scorm/courses', label: 'Courses', icon: BookOpen },
      { to: '/scorm/tracking', label: 'Learner tracking', icon: Activity },
      { to: '/scorm/reports', label: 'Reports', icon: BarChart3 }
    ]
  },
  {
    label: 'Create & manage',
    items: [
      { to: '/scorm/author', label: 'AI author', icon: Sparkles },
      { to: '/scorm/visual-studio', label: 'Visual studio', icon: Palette },
      { to: '/scorm/library', label: 'Package library', icon: Library }
    ]
  }
];

const NAV = NAV_GROUPS.flatMap((group) => group.items);

function pageLabel(pathname) {
  if (pathname.startsWith('/scorm/courses/')) return 'Course workspace';
  const exact = NAV.find((item) => item.end && item.to === pathname);
  if (exact) return exact.label;
  const match = NAV.find((item) => !item.end && pathname.startsWith(item.to));
  if (match) return match.label;
  return 'SCORM World';
}

function Navigation({ onNavigate }) {
  return (
    <nav className="scorm-nav flex-1 px-3 py-5 overflow-y-auto">
      {NAV_GROUPS.map((group, groupIndex) => (
        <div key={group.label} className={groupIndex ? 'mt-6' : ''}>
          <div className="scorm-nav-section px-3 pb-2.5 text-[10px] uppercase font-semibold">{group.label}</div>
          <div className="space-y-1">
            {group.items.map(({ to, end, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) => `scorm-nav-item ${isActive ? 'scorm-nav-active' : ''} group flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium`}
              >
                {({ isActive }) => (
                  <>
                    <span className="scorm-nav-icon w-8 h-8 rounded-lg grid place-items-center shrink-0">
                      <Icon size={16} strokeWidth={isActive ? 2.2 : 1.9} />
                    </span>
                    <span className="flex-1 truncate">{label}</span>
                    {isActive && <ChevronRight size={14} className="scorm-nav-chevron" />}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <Link to="/scorm" className="scorm-brand flex items-center gap-3 min-w-0">
      <div className="scorm-brand-mark w-10 h-10 grid place-items-center shrink-0">
        <Layers3 size={19} strokeWidth={2.2} />
      </div>
      <div className="min-w-0">
        <div className="scorm-display scorm-brand-name text-[16px] leading-none truncate">
          <span>SCORM</span> <span className="wb-accent">WORLD</span>
        </div>
        <div className="scorm-brand-subtitle mt-1 text-[10px] truncate">learning workbench</div>
      </div>
    </Link>
  );
}

function MobileTabBar() {
  const items = [
    { to: '/scorm', end: true, label: 'Home', icon: LayoutDashboard },
    { to: '/scorm/courses', label: 'Courses', icon: BookOpen },
    { to: '/scorm/tracking', label: 'Tracking', icon: Activity },
    { to: '/scorm/author', label: 'Create', icon: Sparkles }
  ];

  return (
    <div className="scorm-mobile-tabbar lg:hidden fixed bottom-3 left-1/2 -translate-x-1/2 z-40 grid grid-cols-4 p-1.5">
      {items.map(({ to, end, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `scorm-mobile-tab ${isActive ? 'is-active' : ''} flex flex-col items-center justify-center gap-1 px-3 py-2`}
        >
          <Icon size={17} strokeWidth={2} />
          <span>{label}</span>
        </NavLink>
      ))}
    </div>
  );
}

export default function ScormPlatformShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const label = pageLabel(location.pathname);

  return (
    <div className="scorm-editorial scorm-workbench min-h-screen relative z-20">
      <aside className="scorm-sidebar fixed inset-y-0 left-0 z-40 hidden lg:flex w-[268px] flex-col border-r">
        <div className="scorm-brand-wrap h-[76px] px-5 flex items-center border-b">
          <Brand />
        </div>

        <Navigation />

        <div className="scorm-sidebar-footer p-3 border-t space-y-2.5">
          <div className="scorm-status-card rounded-xl px-3.5 py-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold">
              <span className="scorm-status-dot" />
              Learning tracking online
            </div>
            <div className="mt-1.5 text-[10px] leading-relaxed">SCORM progress, score and resume state are being captured.</div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/scorm/live-quiz')}
            className="scorm-sidebar-switch w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs font-medium"
          >
            <span className="flex items-center gap-2"><ArrowLeft size={14} /> Live Quiz</span>
            <ChevronRight size={13} />
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-[#090D18]/55 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="scorm-mobile-drawer absolute inset-y-0 left-0 w-[304px] max-w-[88vw] border-r flex flex-col">
            <div className="h-[72px] px-4 flex items-center justify-between border-b">
              <Brand />
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
                className="scorm-drawer-close w-9 h-9 grid place-items-center"
              >
                <X size={17} />
              </button>
            </div>
            <Navigation onNavigate={() => setMobileOpen(false)} />
            <div className="p-3 border-t">
              <button
                type="button"
                onClick={() => { setMobileOpen(false); navigate('/scorm/live-quiz'); }}
                className="scorm-sidebar-switch w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs font-medium"
              >
                <span className="flex items-center gap-2"><ArrowLeft size={14} /> Live Quiz</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="lg:pl-[268px] min-h-screen">
        <header className="scorm-topbar sticky top-0 z-30 min-h-[72px] border-b px-4 md:px-7 py-3 flex items-center gap-3 md:gap-4">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open SCORM navigation"
            className="scorm-topbar-icon lg:hidden w-10 h-10 grid place-items-center shrink-0"
          >
            <Menu size={18} />
          </button>

          <div className="min-w-0">
            <div className="scorm-breadcrumb text-[10px] font-medium">SCORM WORLD <span>·</span> WORKBENCH</div>
            <h1 className="scorm-page-title text-[18px] md:text-[20px] truncate mt-0.5">{label}</h1>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/scorm/live-quiz')}
              aria-label="Return to Live Quiz"
              className="scorm-button-secondary hidden sm:inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold"
            >
              <ArrowLeft size={14} />
              <span>Live Quiz</span>
            </button>
            <Link
              to="/scorm/library?upload=1"
              className="scorm-button-secondary hidden md:inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold"
            >
              <Upload size={14} /> Upload
            </Link>
            <Link
              to="/scorm/author"
              className="scorm-button-primary inline-flex items-center gap-2 px-3.5 md:px-4 py-2.5 text-xs font-semibold"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">Create course</span>
              <span className="sm:hidden">Create</span>
            </Link>
          </div>
        </header>

        <main className="scorm-main min-h-[calc(100vh-72px)] pb-24 lg:pb-0">
          <Outlet />
        </main>
      </div>

      <MobileTabBar />
    </div>
  );
}
