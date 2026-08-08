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

const SOLID_PLATFORM_CSS = `
.scorm-solid-platform [class*="bg-white/"]{background-color:#5b2aa4!important}
.scorm-solid-platform [class*="bg-black/"]{background-color:#25076b!important}
.scorm-solid-platform [class*="backdrop-blur"]{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
.scorm-solid-platform input[class*="bg-black/"],
.scorm-solid-platform textarea[class*="bg-black/"],
.scorm-solid-platform select[class*="bg-black/"]{background-color:#32106e!important}
.scorm-solid-platform [class*="hover:bg-white/"]:hover{background-color:#6b35b2!important}
.scorm-solid-platform [class*="bg-[#344a7b]"]{background-color:#5b2aa4!important}
.scorm-solid-platform [class*="bg-[#304573]"]{background-color:#57279e!important}
.scorm-solid-platform [class*="bg-[#2f4472]"]{background-color:#3b147d!important}
.scorm-solid-platform [class*="bg-[#344b7b]"]{background-color:#5f30a7!important}
.scorm-solid-platform [class*="bg-[#3a5080]"]{background-color:#6b35b2!important}
.scorm-solid-platform [class*="bg-[#425887]"]{background-color:#5f30a7!important}
.scorm-solid-platform [class*="bg-[#24335f]"]{background-color:#25076b!important}
.scorm-solid-platform [class*="border-[#506596]"],
.scorm-solid-platform [class*="border-[#52679b]"],
.scorm-solid-platform [class*="border-[#465d8e]"],
.scorm-solid-platform [class*="border-[#5f73a2]"]{border-color:#864cbf!important}
.scorm-solid-platform [class*="divide-[#465d8e]"]>*+*{border-color:#6b35b2!important}
`;

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
    <div className="scorm-solid-platform min-h-screen bg-[#46178f] text-white relative z-20">
      <style>{SOLID_PLATFORM_CSS}</style>

      <div className="fixed inset-y-0 left-0 z-40 hidden lg:flex w-[272px] flex-col border-r border-[#6d38ad] bg-[#25076b] shadow-[18px_0_40px_rgba(20,4,65,.20)]">
        <div className="h-20 px-6 flex items-center border-b border-[#5f2aa2] bg-[#2f0b73]">
          <Link to="/scorm" className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-quizmoto-yellow text-[#171126] grid place-items-center font-black text-lg shadow-lg shadow-yellow-400/20">Q</div>
            <div className="min-w-0">
              <div className="font-black tracking-tight text-lg">SCORM World</div>
              <div className="text-[10px] text-white/70 uppercase tracking-[0.18em] font-black">Learning Platform</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto bg-[#25076b]">
          <div className="px-3 pt-2 pb-3 text-[10px] uppercase tracking-[0.18em] font-black text-white/55">Workspace</div>
          {NAV.map(({ to, end, label: navLabel, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `group flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold transition-all border ${
                isActive
                  ? 'bg-[#864cbf] border-[#a971dd] text-white shadow-[0_8px_20px_rgba(20,4,65,.20)]'
                  : 'bg-[#25076b] border-transparent text-white/80 hover:text-white hover:bg-[#46178f]'
              }`}
            >
              {({ isActive }) => (
                <>
                  <span className={`w-9 h-9 rounded-xl grid place-items-center transition-all ${isActive ? 'bg-quizmoto-yellow text-[#171126] shadow-md shadow-yellow-400/15' : 'bg-[#3a147c] text-white/80 group-hover:bg-[#5b2aa4] group-hover:text-white'}`}>
                    <Icon size={17} strokeWidth={2.2} />
                  </span>
                  <span className="flex-1">{navLabel}</span>
                  {isActive && <ChevronRight size={14} className="text-white/70" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-[#5f2aa2] bg-[#25076b]">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold text-white/80 bg-[#32106e] border border-[#5f2aa2] hover:text-white hover:bg-[#46178f] transition-all"
          >
            <ArrowLeft size={17} />
            Return to Live Quiz
          </button>
          <div className="mt-3 rounded-2xl border border-[#864cbf] bg-[#46178f] px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.16em] font-black text-white/60">SCORM Runtime</div>
            <div className="mt-1 flex items-center gap-2 text-xs font-bold text-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-300" />
              Tracking enabled
            </div>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden bg-[#190447]">
          <button aria-label="Close navigation" className="absolute inset-0 bg-[#190447]" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[290px] bg-[#25076b] border-r border-[#6d38ad] p-4 shadow-2xl">
            <div className="flex items-center justify-between px-2 h-14 mb-3">
              <div>
                <div className="font-black text-lg">SCORM World</div>
                <div className="text-[9px] uppercase tracking-[0.18em] text-white/65 font-black">Learning Platform</div>
              </div>
              <button onClick={() => setMobileOpen(false)} className="w-10 h-10 rounded-xl bg-[#46178f] border border-[#864cbf] grid place-items-center"><X size={18} /></button>
            </div>
            <nav className="space-y-1">
              {NAV.map(({ to, end, label: navLabel, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold border transition-all ${isActive ? 'bg-[#864cbf] border-[#a971dd] text-white' : 'bg-[#25076b] border-transparent text-white/80 hover:bg-[#46178f] hover:text-white'}`}
                >
                  <Icon size={17} /> {navLabel}
                </NavLink>
              ))}
            </nav>
            <button
              onClick={() => { setMobileOpen(false); navigate('/dashboard'); }}
              className="mt-4 w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-black bg-quizmoto-yellow text-[#25076b]"
            >
              <ArrowLeft size={17} /> Return to Live Quiz
            </button>
          </div>
        </div>
      )}

      <div className="lg:pl-[272px] min-h-screen bg-[#46178f]">
        <header className="sticky top-0 z-30 h-16 md:h-20 border-b border-[#864cbf] bg-[#46178f] px-4 md:px-8 flex items-center gap-3 md:gap-4 shadow-[0_8px_24px_rgba(37,7,107,.18)]">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden w-10 h-10 rounded-xl bg-[#5b2aa4] border border-[#864cbf] grid place-items-center">
            <Menu size={19} />
          </button>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] font-black text-white/60">SCORM World</div>
            <h1 className="text-lg md:text-xl font-black tracking-tight truncate">{label}</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              aria-label="Return to Live Quiz"
              className="inline-flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-xl border border-[#864cbf] bg-[#25076b] text-xs font-black text-white hover:bg-[#32106e] transition-all"
            >
              <ArrowLeft size={15} />
              <span className="hidden md:inline">Live Quiz</span>
            </button>
            <Link to="/scorm/author" className="hidden sm:inline-flex px-4 py-2.5 rounded-xl bg-quizmoto-yellow text-[#171126] text-xs font-black hover:brightness-105 shadow-md shadow-yellow-400/10 transition-all">Create course</Link>
            <Link to="/scorm/library?upload=1" className="hidden sm:inline-flex px-4 py-2.5 rounded-xl border border-[#a971dd] bg-[#864cbf] text-xs font-bold text-white hover:bg-[#955ed0] transition-all">Upload</Link>
          </div>
        </header>

        <main className="min-h-[calc(100vh-80px)] bg-[#46178f]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}