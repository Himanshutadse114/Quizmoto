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
    <div className="min-h-screen bg-[#090f1f] text-white relative z-20">
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:flex w-[272px] flex-col border-r border-white/10 bg-[#0c1326]">
        <div className="h-20 px-6 flex items-center border-b border-white/10">
          <Link to="/scorm" className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-quizmoto-yellow text-[#171126] grid place-items-center font-black text-lg shadow-lg shadow-yellow-500/10">Q</div>
            <div className="min-w-0">
              <div className="font-black tracking-tight text-lg">SCORM World</div>
              <div className="text-[10px] text-white/35 uppercase tracking-[0.18em] font-black">Learning Platform</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="px-3 pt-2 pb-3 text-[10px] uppercase tracking-[0.18em] font-black text-white/30">Workspace</div>
          {NAV.map(({ to, end, label: navLabel, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `group flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold transition-all ${
                isActive
                  ? 'bg-white/10 text-white shadow-inner shadow-white/5'
                  : 'text-white/55 hover:text-white hover:bg-white/5'
              }`}
            >
              {({ isActive }) => (
                <>
                  <span className={`w-9 h-9 rounded-xl grid place-items-center ${isActive ? 'bg-quizmoto-yellow text-[#171126]' : 'bg-white/5 text-white/50 group-hover:text-white'}`}>
                    <Icon size={17} strokeWidth={2.2} />
                  </span>
                  <span className="flex-1">{navLabel}</span>
                  {isActive && <ChevronRight size={14} className="text-white/35" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold text-white/50 hover:text-white hover:bg-white/5 transition-all"
          >
            <ArrowLeft size={17} />
            Live Quiz Dashboard
          </button>
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.16em] font-black text-white/35">SCORM Runtime</div>
            <div className="mt-1 flex items-center gap-2 text-xs font-bold text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Tracking enabled
            </div>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close navigation" className="absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[290px] bg-[#0c1326] border-r border-white/10 p-4 shadow-2xl">
            <div className="flex items-center justify-between px-2 h-14 mb-3">
              <div>
                <div className="font-black text-lg">SCORM World</div>
                <div className="text-[9px] uppercase tracking-[0.18em] text-white/35 font-black">Learning Platform</div>
              </div>
              <button onClick={() => setMobileOpen(false)} className="w-10 h-10 rounded-xl bg-white/5 grid place-items-center"><X size={18} /></button>
            </div>
            <nav className="space-y-1">
              {NAV.map(({ to, end, label: navLabel, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold ${isActive ? 'bg-white/10' : 'text-white/55'}`}
                >
                  <Icon size={17} /> {navLabel}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}

      <div className="lg:pl-[272px] min-h-screen">
        <header className="sticky top-0 z-30 h-16 md:h-20 border-b border-white/10 bg-[#090f1f]/90 backdrop-blur-xl px-4 md:px-8 flex items-center gap-4">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden w-10 h-10 rounded-xl bg-white/5 grid place-items-center">
            <Menu size={19} />
          </button>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] font-black text-white/30">SCORM World</div>
            <h1 className="text-lg md:text-xl font-black tracking-tight truncate">{label}</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/scorm/author" className="hidden sm:inline-flex px-4 py-2.5 rounded-xl bg-quizmoto-yellow text-[#171126] text-xs font-black hover:brightness-105 transition-all">Create course</Link>
            <Link to="/scorm/library?upload=1" className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-xs font-bold text-white/75 hover:bg-white/10">Upload</Link>
          </div>
        </header>

        <main className="min-h-[calc(100vh-80px)] bg-[radial-gradient(circle_at_80%_0%,rgba(70,23,143,.16),transparent_34%),linear-gradient(180deg,#090f1f,#0a1020)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}