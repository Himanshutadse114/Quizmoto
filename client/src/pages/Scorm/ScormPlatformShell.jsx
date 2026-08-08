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
      <div className="px-3 pb-2 text-[10px] uppercase tracking-[0.16em] font-bold text-[#8b9690]">Workspace</div>
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
              <span className={`scorm-nav-icon w-8 h-8 rounded-lg grid place-items-center ${isActive ? 'bg-[#e4ece7] text-[#607568]' : 'text-[#7b8781]'}`}>
                <Icon size={16} strokeWidth={2} />
              </span>
              <span className="flex-1">{label}</span>
              {isActive && <ChevronRight size={14} className="text-[#9aa49f]" />}
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
        <div className="h-[78px] px-5 flex items-center border-b border-[#dfe5e1]">
          <Link to="/scorm" className="flex items-center gap-3 min-w-0">
            <div className="scorm-brand-mark w-10 h-10 grid place-items-center font-bold text-base">Q</div>
            <div className="min-w-0">
              <div className="font-semibold tracking-[-0.025em] text-[17px] leading-tight text-[#26312d]">SCORM World</div>
              <div className="mt-0.5 text-[10px] text-[#88938d]">Learning workspace</div>
            </div>
          </Link>
        </div>

        <Navigation />

        <div className="p-3 border-t border-[#dfe5e1] space-y-2.5">
          <div className="rounded-xl bg-white border border-[#e1e6e2] px-3.5 py-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-[#536159]">
              <CircleCheck size={15} className="text-[#718c7c]" />
              Tracking is active
            </div>
            <div className="mt-1 text-[10px] leading-relaxed text-[#8c9691]">Learner progress is saved automatically.</div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="scorm-button-secondary w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold"
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
            className="absolute inset-0 bg-[#26312d]/25"
            onClick={() => setMobileOpen(false)}
          />
          <div className="scorm-mobile-drawer absolute inset-y-0 left-0 w-[294px] max-w-[88vw] border-r shadow-2xl flex flex-col">
            <div className="h-[72px] px-4 flex items-center justify-between border-b border-[#dfe5e1]">
              <div className="flex items-center gap-2.5">
                <div className="scorm-brand-mark w-9 h-9 grid place-items-center font-bold">Q</div>
                <div>
                  <div className="font-semibold text-[15px] text-[#26312d]">SCORM World</div>
                  <div className="text-[9px] text-[#88938d]">Learning workspace</div>
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
            <div className="p-3 border-t border-[#dfe5e1]">
              <button
                type="button"
                onClick={() => { setMobileOpen(false); navigate('/dashboard'); }}
                className="scorm-button-secondary w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold"
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
            <div className="text-[10px] text-[#8b9690] font-medium">SCORM World</div>
            <h1 className="text-[19px] md:text-[21px] font-semibold tracking-[-0.025em] truncate leading-tight mt-0.5">{label}</h1>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              aria-label="Return to Live Quiz"
              className="scorm-button-secondary inline-flex items-center gap-2 px-3 md:px-3.5 py-2.5 text-xs font-semibold"
            >
              <ArrowLeft size={14} />
              <span className="hidden md:inline">Live Quiz</span>
            </button>
            <Link
              to="/scorm/author"
              className="scorm-button-primary hidden sm:inline-flex items-center px-4 py-2.5 text-xs font-semibold"
            >
              Create course
            </Link>
            <Link
              to="/scorm/library?upload=1"
              className="scorm-button-secondary hidden md:inline-flex items-center px-4 py-2.5 text-xs font-semibold"
            >
              Upload package
            </Link>
          </div>
        </header>

        <main className="min-h-[calc(100vh-72px)] bg-[#f6f7f4]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
