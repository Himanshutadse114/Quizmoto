import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BarChart3, ChevronRight, Gamepad2, Home, LogOut, Menu, Plus, Sparkles, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  { to: '/host', end: true, label: 'Quiz Library', caption: 'Host and manage quizzes', icon: Home },
  { to: '/host/create', label: 'Create Quiz', caption: 'Build questions and rounds', icon: Plus },
  { to: '/host/reports', label: 'Reports', caption: 'Review past sessions', icon: BarChart3 }
];

function NavItems({ onNavigate }) {
  return (
    <nav className="lq-nav" aria-label="Quizmoto host navigation">
      {NAV.map(({ to, end, label, caption, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) => `lq-nav-item ${isActive ? 'is-active' : ''}`}
        >
          <span className="lq-nav-icon"><Icon size={18} /></span>
          <span className="min-w-0 flex-1">
            <span className="lq-nav-label">{label}</span>
            <span className="lq-nav-caption">{caption}</span>
          </span>
          <ChevronRight size={14} className="lq-nav-chevron" />
        </NavLink>
      ))}
    </nav>
  );
}

export default function LiveQuizShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout, prepareScormLogin } = useAuth();
  const navigate = useNavigate();

  const openScormAi = () => {
    prepareScormLogin();
    setMobileOpen(false);
    navigate('/scorm/login');
  };

  const signOut = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="live-quiz-shell min-h-screen relative z-20">
      <aside className="lq-sidebar hidden lg:flex">
        <button type="button" onClick={() => navigate('/host')} className="lq-brand text-left">
          <div className="lq-brand-mark"><Gamepad2 size={20} /></div>
          <div>
            <div className="lq-brand-title">Quizmoto<span>!</span></div>
            <div className="lq-brand-subtitle">live quiz host</div>
          </div>
        </button>

        <div className="lq-section-label">HOST WORKSPACE</div>
        <NavItems />

        <div className="lq-sidebar-footer">
          <button type="button" onClick={openScormAi} className="lq-platform-button">
            <Sparkles size={16} />
            <span><strong>SCORM AI</strong><small>AI course creation workspace</small></span>
            <ChevronRight size={14} />
          </button>
          <div className="lq-user-card">
            <div className="lq-user-avatar">{String(user?.username || user?.name || 'H').slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0 flex-1"><strong>{user?.username || user?.name || 'Host'}</strong><small>Quizmoto host</small></div>
            <button type="button" onClick={signOut} className="lq-icon-button" aria-label="Log out"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div className="lq-mobile-layer lg:hidden">
          <button className="lq-mobile-backdrop" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
          <aside className="lq-mobile-drawer">
            <div className="lq-mobile-drawer-head">
              <div className="lq-brand">
                <div className="lq-brand-mark"><Gamepad2 size={18} /></div>
                <div><div className="lq-brand-title">Quizmoto<span>!</span></div><div className="lq-brand-subtitle">host menu</div></div>
              </div>
              <button className="lq-icon-button" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button>
            </div>
            <div className="lq-section-label">NAVIGATION</div>
            <NavItems onNavigate={() => setMobileOpen(false)} />
            <div className="lq-mobile-actions">
              <button type="button" onClick={openScormAi} className="lq-platform-button">
                <Sparkles size={16} /><span><strong>SCORM AI</strong><small>AI course workspace</small></span><ChevronRight size={14} />
              </button>
              <button type="button" onClick={signOut} className="lq-logout-button"><LogOut size={16} /> LOG OUT</button>
            </div>
          </aside>
        </div>
      )}

      <div className="lq-app-frame lg:pl-[250px] min-h-screen">
        <header className="lq-mobile-topbar lg:hidden">
          <button className="lq-icon-button" onClick={() => setMobileOpen(true)} aria-label="Open Quizmoto menu"><Menu size={19} /></button>
          <div className="min-w-0"><div className="lq-mobile-title">Quizmoto<span>!</span></div><div className="lq-mobile-subtitle">host workspace</div></div>
          <button className="lq-quick-create" onClick={() => navigate('/host/create')}><Plus size={15} /> CREATE</button>
        </header>
        <main className="lq-content"><Outlet /></main>
      </div>
    </div>
  );
}
