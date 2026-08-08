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

export default function ScormPlatformShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const label = pageLabel(location.pathname);

  return (
    <div className="min-h-screen bg-[#18213f] text-white relative z-20">
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:flex w-[272px] flex-col border-r border-white/15 bg-[linear-gradient(180deg,#222d55_0%,#1b2548_100%)] shadow-[18px_0_50px_rgba(10,20,55,.16)]">
        <div className="h-20 px-6 flex items-center border-b border-white/12 bg-white/[0.025]">
          <Link to="/scorm" className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-quizmoto-yellow text-[#171126] grid place-items-center font-black text-lg shadow-lg shadow-yellow-400/20">Q</div>
            <div className="min-w-0">
              <div className="font-black tracking-tight text-lg">SCORM World</div>
              <div className="text-[10px] text-white/50 uppercase tracking-[0.18em] font-black">Learning Platform</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="px-3 pt-2 pb-3 text-[10px] uppercase tracking-[0.18em] font-black text-white/40">Workspace</div>
          {NAV.map(({ to, end, label: navLabel, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `group flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold transition-all ${
                isActive
                  ? 'bg-white/15 text-white shadow-[0_8px_24px_rgba(20,30,80,.18)] border border-white/10'
                  : 'text-white/70 hover:text-white hover:bg-white/8'
              }`}
            >
              {({ isActive }) => (
                <>
                  <span className={`w-9 h-9 rounded-xl grid place-items-center transition-all ${isActive ? 'bg-quizmoto-yellow text-[#171126] shadow-md shadow-yellow-400/15' : 'bg-white/8 text-white/65 group-hover:bg-white/12 group-hover:text-white'}`}>
                    <Icon size={17} strokeWidth={2.2} />
                  </span>
                  <span className="flex-1">{navLabel}</span>
                  {isActive && <ChevronRight size={14} className="text-white/50" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/12">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold text-white/65 hover:text-white hover:bg-white/8 transition-all"
          >
            <ArrowLeft size={17} />
            Live Quiz Dashboard
          </button>
          <div className="mt-3 rounded-2xl border border-white/12 bg-white/[0.07] px-4 py-3 shadow-inner shadow-white/[0.025]">
            <div className="text-[10px] uppercase tracking-[0.16em] font-black text-white/45">SCORM Runtime</div>
            <div className="mt-1 flex items-center gap-2 text-xs font-bold text-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,.65)]" />
              Tracking enabled
            </div>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close navigation" className="absolute inset-0 bg-[#10162e]/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[290px] bg-[linear-gradient(180deg,#26315d,#1d274b)] border-r border-white/15 p-4 shadow-2xl">
            <div className="flex items-center justify-between px-2 h-14 mb-3">
              <div>
                <div className="font-black text-lg">SCORM World</div>
                <div className="text-[9px] uppercase tracking-[0.18em] text-white/50 font-black">Learning Platform</div>
              </div>
              <button onClick={() => setMobileOpen(false)} className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 grid place-items-center"><X size={18} /></button>
            </div>
            <nav className="space-y-1">
              {NAV.map(({ to, end, label: navLabel, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold transition-all ${isActive ? 'bg-white/15 border border-white/10 text-white' : 'text-white/70 hover:bg-white/8 hover:text-white'}`}
                >
                  <Icon size={17} /> {navLabel}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}

      <div className="lg:pl-[272px] min-h-screen">
        <header className="sticky top-0 z-30 h-16 md:h-20 border-b border-white/12 bg-[#1b2548]/88 backdrop-blur-xl px-4 md:px-8 flex items-center gap-4 shadow-[0_8px_30px_rgba(15,25,70,.10)]">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden w-10 h-10 rounded-xl bg-white/10 border border-white/10 grid place-items-center">
            <Menu size={19} />
          </button>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] font-black text-white/45">SCORM World</div>
            <h1 className="text-lg md:text-xl font-black tracking-tight truncate">{label}</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/scorm/author" className="hidden sm:inline-flex px-4 py-2.5 rounded-xl bg-quizmoto-yellow text-[#171126] text-xs font-black hover:brightness-105 shadow-md shadow-yellow-400/10 transition-all">Create course</Link>
            <Link to="/scorm/library?upload=1" className="px-4 py-2.5 rounded-xl border border-white/15 bg-white/10 text-xs font-bold text-white/90 hover:bg-white/15 transition-all">Upload</Link>
          </div>
        </header>

        <main className="min-h-[calc(100vh-80px)] bg-[radial-gradient(circle_at_82%_2%,rgba(99,102,241,.28),transparent_30%),radial-gradient(circle_at_12%_14%,rgba(56,189,248,.12),transparent_25%),linear-gradient(180deg,#1d2850_0%,#18213f_55%,#16203d_100%)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}