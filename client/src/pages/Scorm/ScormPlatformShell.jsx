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
  ChevronRight
} from 'lucide-react';
import './scormEditorialTheme.css';

const NAV = [
  { to: '/scorm', end: true, label: 'Overview', icon: LayoutDashboard },
  { to: '/scorm/courses', label: 'Courses', icon: BookOpen },
  { to: '/scorm/tracking', label: 'Learner Tracking', icon: Activity },
  { to: '/scorm/reports', label: 'Reports', icon: BarChart3 },
  { to: '/scorm/library', label: 'Package Library', icon: Library },
  { to: '/scorm/author', label: 'AI Author', icon: Sparkles },
  { to: '/scorm/visual-studio', label: 'Visual Studio', icon: Palette }
];

function pageLabel(pathname) {
  const exact = NAV.find((item) => item.end && item.to === pathname);
  if (exact) return exact.label;
  const match = NAV.find((item) => !item.end && pathname.startsWith(item.to));
  if (match) return match.label;
  if (pathname.startsWith('/scorm/courses/')) return 'Course Workspace';
  return 'SCORM World';
}

function Navigation({ onNavigate }) {
  return (
    <nav className="flex-1 px-4 py-5 space-y-1 overflow-y-auto">
      <div className="px-3 pt-1 pb-3 text-[10px] uppercase tracking-[0.22em] font-black">Workspace</div>
      {NAV.map(({ to, end, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) => `scorm-nav-item ${isActive ? 'scorm-nav-active' : ''} group flex items-center gap-3 px-3 py-3.5 text-sm font-black uppercase tracking-[0.04em] transition-none`}
        >
          {({ isActive }) => (
            <>
              <span className="w-8 h-8 grid place-items-center border border-current">
                <Icon size={16} strokeWidth={2.35} />
              </span>
              <span className="flex-1">{label}</span>
              {isActive && <ChevronRight size={14} />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export default function ScormPlatformShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const label = pageLabel(location.pathname);

  return (
    <div className="scorm-editorial min-h-screen relative z-20">
      <aside className="scorm-sidebar fixed inset-y-0 left-0 z-40 hidden lg:flex w-[272px] flex-col border-r-2 border-[#F4F0E6]">
        <div className="h-24 px-6 flex items-center border-b-2 border-[#F4F0E6]">
          <Link to="/scorm" className="flex items-center gap-3 min-w-0">
            <div className="scorm-brand-mark w-11 h-11 grid place-items-center font-black text-lg">Q</div>
            <div className="min-w-0">
              <div className="font-black tracking-[-0.04em] text-xl uppercase leading-none">SCORM World</div>
              <div className="mt-1 text-[9px] uppercase tracking-[0.22em] font-black">Learning Platform</div>
            </div>
          </Link>
        </div>

        <Navigation />

        <div className="p-4 border-t-2 border-[#F4F0E6] space-y-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center gap-3 px-3 py-3 border-2 border-[#F4F0E6] text-sm font-black uppercase tracking-[0.04em]"
          >
            <ArrowLeft size={17} />
            Return to Live Quiz
          </button>
          <div className="border-2 border-[#F4F0E6] px-4 py-3">
            <div className="text-[9px] uppercase tracking-[0.2em] font-black">Runtime status</div>
            <div className="mt-2 text-xs font-black uppercase tracking-[0.08em]">■ Tracking enabled</div>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden bg-[#111111]">
          <button aria-label="Close navigation" className="absolute inset-0 bg-[#111111]" onClick={() => setMobileOpen(false)} />
          <div className="scorm-mobile-drawer absolute inset-y-0 left-0 w-[300px] max-w-[88vw] border-r-2 border-[#F4F0E6]">
            <div className="h-20 px-5 flex items-center justify-between border-b-2 border-[#F4F0E6]">
              <div>
                <div className="font-black text-lg uppercase tracking-[-0.03em]">SCORM World</div>
                <div className="text-[9px] uppercase tracking-[0.2em] font-black mt-1">Learning Platform</div>
              </div>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
                className="w-10 h-10 border-2 border-[#F4F0E6] grid place-items-center"
              >
                <X size={18} />
              </button>
            </div>
            <Navigation onNavigate={() => setMobileOpen(false)} />
            <div className="p-4 border-t-2 border-[#F4F0E6]">
              <button
                type="button"
                onClick={() => { setMobileOpen(false); navigate('/dashboard'); }}
                className="w-full flex items-center gap-3 px-3 py-3 border-2 border-[#F4F0E6] text-sm font-black uppercase tracking-[0.04em]"
              >
                <ArrowLeft size={17} /> Return to Live Quiz
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="lg:pl-[272px] min-h-screen">
        <header className="scorm-topbar sticky top-0 z-30 min-h-20 border-b-2 px-4 md:px-8 py-3 flex items-center gap-3 md:gap-5">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open SCORM navigation"
            className="scorm-button-secondary lg:hidden w-10 h-10 grid place-items-center shrink-0"
          >
            <Menu size={19} />
          </button>

          <div className="min-w-0">
            <div className="text-[9px] uppercase tracking-[0.24em] font-black">SCORM World / Workspace</div>
            <h1 className="text-xl md:text-2xl font-black uppercase tracking-[-0.04em] truncate leading-none mt-1">{label}</h1>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              aria-label="Return to Live Quiz"
              className="scorm-button-secondary inline-flex items-center gap-2 px-3 md:px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.08em]"
            >
              <ArrowLeft size={15} />
              <span className="hidden md:inline">Live Quiz</span>
            </button>
            <Link
              to="/scorm/author"
              className="scorm-button-primary hidden sm:inline-flex px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.08em]"
            >
              Create course
            </Link>
            <Link
              to="/scorm/library?upload=1"
              className="scorm-button-secondary hidden md:inline-flex px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.08em]"
            >
              Upload
            </Link>
          </div>
        </header>

        <main className="min-h-[calc(100vh-80px)] bg-[#F4F0E6]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
