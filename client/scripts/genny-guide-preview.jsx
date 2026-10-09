// Local component fixture, not an application entry or authentication bypass.
// Run Vite dev and open /scripts/genny-guide-preview.html. Never calls the API.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Link, useLocation } from 'react-router-dom';
import GennyGuide from '../src/components/mascot/GennyGuide.jsx';
import { GENNY_TOPICS } from '../src/components/mascot/genny-knowledge.js';
import '../src/pages/Scorm/scormEditorialTheme.css';
import '../src/pages/Scorm/scormDashboard.css';
import '../src/pages/Scorm/scormContrastPolish.css';
import '../src/pages/Scorm/scormModernDark.css';
import '../src/pages/Scorm/scormPlatformBluePolish.css';
import '../src/pages/Scorm/scormButtonTealOverride.css';
import '../src/pages/Scorm/scormLightTheme.css';
import '../src/pages/Scorm/scormLightContrastGuard.css';
import '../src/pages/Scorm/scormLightRoutePolish.css';
import '../src/pages/Scorm/courseGeneratorThemeFix.css';
import '../src/pages/Scorm/scormSearchControls.css';

export default function Fixture() {
  const [role, setRole] = useState('demo');
  const [light, setLight] = useState(false);
  const location = useLocation();
  const routes = GENNY_TOPICS.filter((topic) => role === 'super_admin' || (role === 'analytics' ? ['publica', 'tracking', 'reports', 'settings'].includes(topic.id) : !topic.adminOnly)).map((topic) => topic.route);
  return <main className={`scorm-editorial ${light ? 'scorm-theme-light' : ''}`} style={{ padding: 24 }}>
    <h1>Genny component QA</h1><p>Local fixture. No tenant data, API requests or authentication bypass.</p>
    <label>Fixture role <select value={role} onChange={(event) => setRole(event.target.value)}><option value="demo">Demo</option><option value="analytics">Analytics viewer</option><option value="super_admin">Super admin</option></select></label>
    <button onClick={() => setLight(!light)}>{light ? 'Use dark theme' : 'Use light theme'}</button>
    <p>Current route: {location.pathname}</p>
    <nav aria-label="Fixture routes">{GENNY_TOPICS.filter((topic) => routes.includes(topic.route)).map((topic) => <Link className="scorm-nav-item" data-genny-topic={topic.id} to={topic.route} key={topic.id} style={{ display: 'block', maxWidth: 220 }}>{topic.label}</Link>)}</nav>
    <GennyGuide key={role} platform allowedRoutes={routes} scormAccess={role !== 'demo'} isSuperAdmin={role === 'super_admin'} accountKey={`qa-${role}`} />
  </main>;
}
createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/scorm']}><Fixture /></MemoryRouter>);
