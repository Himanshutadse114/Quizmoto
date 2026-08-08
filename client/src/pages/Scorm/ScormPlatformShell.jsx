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
  CircleCheck
} from 'lucide-react';
import './scormEditorialTheme.css';

const NAV = [
  { to: '/scorm', end: true, label: 'Overview', icon: LayoutDashboard },
  { to: '/scorm/courses', label: 'Courses', icon: BookOpen },
  { to: '/scorm/tracking', label: 'Learner tracking', icon: Activity },
  { to: '/scorm/reports', label: 'Reports', icon: BarChart3 },
  { to: '/scorm/library', label: 'Package library', icon: Library },
  { to: '/scorm/author', label: 'AI author', icon: Sparkles },
  { to: '/scorm/visual-studio', label: 'Visual studio', icon: Palette }
];

function pageLabel(pathname) {
  const exact = NAV.find((item) => item.end && item.to === pathname);
  if (exact) return exact.label;
  const match = NAV.find((item) => !item.end && pathname.startsWith(item.to));
  if (match) return match.label;
  if (pathname.startsWith('/scorm/courses/')) return 'Course workspace';
  return 'SCORM World';
}

function Navigation({ onNavigate }) {
  return (
    <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
      <div className="scorm-micro px-3 pb-3 text-[10px] uppercase font-bold text-[#5A5A4F]">Workspace</div>
      {NAV.map(({ to, end, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) => `scorm-nav-item ${isActive ? 'scorm-nav-active' : ''} group flex items-center gap-3 px-3 py-2.5 text-[13px] font-semibold`}
        >
          {({ isActive }) => (
            <>
              <span className={`scorm-nav-icon w-8 h-8 rounded-lg grid place-items-center ${isActive ? '' : 'text-[#202020]'}`}>
                <Icon size={16} strokeWidth={2} />
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
      <aside className="scorm-sidebar fixed inset-y-0 left-0 z-40 hidden lg:flex w-[260px] flex-col border-r">
        <div className="h-[78px] px-5 flex items-center border-b border-[#000000]">
          <Link to="/scorm" className="flex items-center gap-3 min-w-0">
            <div className="scorm-brand-mark w-10 h-10 grid place-items-center font-black text-base">Q</div>
            <div className="min-w-0">
              <div className="scorm-display font-black tracking-[-0.05em] text-[18px] leading-none text-black">SCORM World</div>
              <div className="scorm-micro mt-1 text-[9px] uppercase text-[#5A5A4F]">Learning workspace</div>
            </div>
          </Link>
        </div>

        <Navigation />

        <div className="p-3 border-t border-[#000000] space-y-2.5">
          <div className="rounded-xl bg-[#AAFDC0] border border-black px-3.5 py-3">
            <div className="flex items-center gap-2 text-[11px] font-bold text-black">
              <CircleCheck size={15} />
              Tracking is active
            </div>
            <div className="mt-1 text-[10px] leading-relaxed text-[#5A5A4F]">Learner progress is saved automatically.</div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="scorm-button-secondary w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold"
          >
            <ArrowLeft size={15} />
            Back to Live Quiz
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
          />
          <div className="scorm-mobile-drawer absolute inset-y-0 left-0 w-[294px] max-w-[88vw] border-r flex flex-col">
            <div className="h-[72px] px-4 flex items-center justify-between border-b border-black">
              <div className="flex items-center gap-2.5">
                <div className="scorm-brand-mark w-9 h-9 grid place-items-center font-black">Q</div>
                <div>
                  <div className="scorm-display font-black text-[16px] leading-none">SCORM World</div>
                  <div className="scorm-micro mt-1 text-[9px] uppercase text-[#5A5A4F]">Learning workspace</div>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
                className="scorm-button-secondary w-9 h-9 grid place-items-center"
              >
                <X size={17} />
              </button>
            </div>
            <Navigation onNavigate={() => setMobileOpen(false)} />
            <div className="p-3 border-t border-black">
              <button
                type="button"
                onClick={() => { setMobileOpen(false); navigate('/dashboard'); }}
                className="scorm-button-secondary w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold"
              >
                <ArrowLeft size={15} /> Back to Live Quiz
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="lg:pl-[260px] min-h-screen">
        <header className="scorm-topbar sticky top-0 z-30 min-h-[72px] border-b px-4 md:px-7 py-3 flex items-center gap-3 md:gap-4">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open SCORM navigation"
            className="scorm-button-secondary lg:hidden w-10 h-10 grid place-items-center shrink-0"
          >
            <Menu size={18} />
          </button>

          <div className="min-w-0">
            <div className="scorm-micro text-[9px] uppercase text-[#5A5A4F] font-medium">SCORM World</div>
            <h1 className="text-[20px] md:text-[22px] truncate mt-1">{label}</h1>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              aria-label="Return to Live Quiz"
              className="scorm-button-secondary inline-flex items-center gap-2 px-3 md:px-3.5 py-2.5 text-xs font-bold"
            >
              <ArrowLeft size={14} />
              <span className="hidden md:inline">Live Quiz</span>
            </button>
            <Link
              to="/scorm/author"
              className="scorm-button-primary hidden sm:inline-flex items-center px-4 py-2.5 text-xs font-bold"
            >
              Create course
            </Link>
            <Link
              to="/scorm/library?upload=1"
              className="scorm-button-secondary hidden md:inline-flex items-center px-4 py-2.5 text-xs font-bold"
            >
              Upload package
            </Link>
          </div>
        </header>

        <main className="min-h-[calc(100vh-72px)] bg-[#F8F9EB]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
