import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BarChart3, ChevronRight, Gamepad2, Home, LogOut, Menu, Plus, Sparkles, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  { to: '/scorm/live-quiz', end: true, label: 'Quiz Library', caption: 'Host and manage quizzes', icon: Home },
  { to: '/scorm/live-quiz/create', label: 'Create Quiz', caption: 'Build questions and rounds', icon: Plus },
  { to: '/scorm/live-quiz/reports', label: 'Reports', caption: 'Review past sessions', icon: BarChart3 }
];

function NavItems({ onNavigate }) {
  return (
    <nav className="lq-nav" aria-label="Live Quiz navigation">
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
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="live-quiz-shell min-h-screen relative z-20">
      <aside className="lq-sidebar hidden lg:flex">
        <div className="lq-brand">
          <div className="lq-brand-mark"><Gamepad2 size={20} /></div>
          <div>
            <div className="lq-brand-title">LIVE <span>QUIZ</span></div>
            <div className="lq-brand-subtitle">interactive game studio</div>
          </div>
        </div>

        <div className="lq-section-label">HOST WORKSPACE</div>
        <NavItems />

        <div className="lq-sidebar-footer">
          <button type="button" onClick={() => navigate('/scorm')} className="lq-platform-button">
            <Sparkles size={16} />
            <span><strong>SCORM WORLD</strong><small>Return to learning workbench</small></span>
            <ChevronRight size={14} />
          </button>
          <div className="lq-user-card">
            <div className="lq-user-avatar">{String(user?.username || user?.name || 'H').slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0 flex-1"><strong>{user?.username || user?.name || 'Host'}</strong><small>Host account</small></div>
            <button type="button" onClick={logout} className="lq-icon-button" aria-label="Log out"><LogOut size={16} /></button>
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
                <div><div className="lq-brand-title">LIVE <span>QUIZ</span></div><div className="lq-brand-subtitle">host menu</div></div>
              </div>
              <button className="lq-icon-button" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button>
            </div>
            <div className="lq-section-label">NAVIGATION</div>
            <NavItems onNavigate={() => setMobileOpen(false)} />
            <div className="lq-mobile-actions">
              <button type="button" onClick={() => { setMobileOpen(false); navigate('/scorm'); }} className="lq-platform-button">
                <Sparkles size={16} /><span><strong>SCORM WORLD</strong><small>Learning workbench</small></span><ChevronRight size={14} />
              </button>
              <button type="button" onClick={logout} className="lq-logout-button"><LogOut size={16} /> LOG OUT</button>
            </div>
          </aside>
        </div>
      )}

      <div className="lq-app-frame lg:pl-[250px] min-h-screen">
        <header className="lq-mobile-topbar lg:hidden">
          <button className="lq-icon-button" onClick={() => setMobileOpen(true)} aria-label="Open Live Quiz menu"><Menu size={19} /></button>
          <div className="min-w-0"><div className="lq-mobile-title">LIVE <span>QUIZ</span></div><div className="lq-mobile-subtitle">host workspace</div></div>
          <button className="lq-quick-create" onClick={() => navigate('/scorm/live-quiz/create')}><Plus size={15} /> CREATE</button>
        </header>
        <main className="lq-content"><Outlet /></main>
      </div>
    </div>
  );
}
