import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createAvatar } from '@bible-strong/avatar-web';
import definition from './genny.avatar.json';
import { mountGenny } from './genny-runtime.js';
import { searchTopics, topicForPath, topicsForAccess, tourForAccess } from './genny-knowledge.js';
import './mascot.css';
import './genny-guide.css';

export default function GennyGuide({ platform = false, frameRef, pageSrc, allowedRoutes, isSuperAdmin = false, scormAccess = false, accountKey = 'website', suspended = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const lastFocus = useRef(null);
  const mascotRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [restoreKey, setRestoreKey] = useState(0);
  const [selection, setSelection] = useState(null);
  const [tourIndex, setTourIndex] = useState(null);
  const [query, setQuery] = useState('');
  const [hoverEnabled, setHoverEnabled] = useState(() => {
    try { return localStorage.getItem('lmsgen-genny-hover') !== 'off'; } catch { return true; }
  });
  const routesKey = allowedRoutes?.join('|');
  const topics = useMemo(() => topicsForAccess({ allowedRoutes: routesKey?.split('|'), isSuperAdmin }), [routesKey, isSuperAdmin]);
  const tour = useMemo(() => tourForAccess({ allowedRoutes: routesKey?.split('|'), isSuperAdmin }), [routesKey, isSuperAdmin]);
  const pageTopic = topics.find((topic) => topic.id === topicForPath(location.pathname)?.id);
  const selected = (tourIndex !== null ? tour[tourIndex] : topics.find((topic) => topic.id === selection)) || pageTopic || topics[0];
  const results = searchTopics(query, topics);
  const progressKey = `lmsgen-genny-tour-v1:${accountKey}`;

  const activate = useCallback(() => {
    lastFocus.current = document.activeElement;
    setOpen(true);
  }, []);
  const dismissMascot = useCallback(() => setHidden(true), []);
  const hovered = useCallback((topic) => { setSelection(topic.id); }, []);
  const close = () => { setOpen(false); lastFocus.current?.focus?.(); };

  useEffect(() => {
    if (hidden || suspended) return undefined;
    const mascot = mountGenny({ document, container: containerRef.current, createAvatar, definition,
      onActivate: activate, onTopic: hovered, onDismiss: dismissMascot, topics, currentTopic: pageTopic, platform, hoverEnabled });
    mascotRef.current = mascot;
    if (platform) mascot.bindDocument(document);
    const frame = frameRef?.current;
    let boundDocument = null;
    const wireFrame = () => {
      try {
        const doc = frame?.contentDocument;
        if (!doc || doc.URL === 'about:blank' || doc === boundDocument) return;
        boundDocument = doc;
        mascot.bindDocument(doc);
      } catch { /* cross-origin frame: the guide remains available */ }
    };
    frame?.addEventListener('load', wireFrame);
    wireFrame();
    return () => { frame?.removeEventListener('load', wireFrame); mascot.destroy(); mascotRef.current = null; };
  }, [activate, hovered, dismissMascot, hidden, suspended, topics, pageTopic, platform, hoverEnabled, frameRef, pageSrc, restoreKey]);

  useEffect(() => {
    if (!open || suspended) return undefined;
    closeRef.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') { setOpen(false); lastFocus.current?.focus?.(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, suspended]);

  const recordStep = (index) => {
    setTourIndex(index);
    setSelection(null);
    setQuery('');
    try { localStorage.setItem(progressKey, tour[index]?.id || 'complete'); } catch { /* optional storage */ }
  };
  const startTour = (restart = false) => {
    let index = 0;
    try { if (!restart) index = Math.max(0, tour.findIndex((topic) => topic.id === localStorage.getItem(progressKey))); } catch { /* optional storage */ }
    recordStep(index);
  };
  const visit = () => {
    if (!selected) return;
    // Navigation only. Never activate a form, live session, upload or deletion.
    if (platform) navigate(selected.route);
    else navigate('/login');
    const target = document.querySelector(`.scorm-nav-item[data-genny-topic="${selected.id}"]`);
    target?.scrollIntoView({ block: 'nearest' });
    setOpen(false);
    if (target?.getClientRects().length) target.focus();
    else document.querySelector('.genny-platform .genny-launcher')?.focus();
  };
  const toggleHover = (event) => {
    setHoverEnabled(event.target.checked);
    try { localStorage.setItem('lmsgen-genny-hover', event.target.checked ? 'on' : 'off'); } catch { /* optional storage */ }
  };

  return <div className={`${platform ? 'genny-platform' : 'genny-website'} ${open ? 'genny-is-open' : ''}`} hidden={suspended}>
    <div ref={containerRef} />
    <button type="button" className={`genny-launcher ${hidden ? 'is-alone' : ''}`} aria-expanded={open} aria-controls="genny-guide-panel" onClick={() => {
      try { sessionStorage.removeItem('lmsgen-mascot-dismissed'); } catch { /* optional storage */ }
      setHidden(false); setRestoreKey((key) => key + 1); activate();
    }}>Genny guide <span aria-hidden="true">?</span></button>
    {open && <section ref={panelRef} id="genny-guide-panel" className="genny-guide" role="region" aria-label="Genny interactive guide">
      <header className="genny-guide-header"><div><span className="genny-eyebrow">YOUR LEARNING SIDEKICK</span><h2>Ask Genny</h2></div><button ref={closeRef} type="button" onClick={close} aria-label="Close Genny guide">×</button></header>
      <div className="genny-guide-body">
        <p className="genny-intro">Big platform. Simple next steps. Choose a topic, ask about a feature, or let me show you around.</p>
        <div className="genny-guide-toolbar"><button type="button" className="genny-primary" onClick={() => startTour()}>Start / resume tour</button><button type="button" onClick={() => { setTourIndex(null); setSelection(pageTopic?.id || topics[0]?.id); setQuery(''); }}>Explain this page</button></div>
        <label className="genny-search">Find an answer<input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setTourIndex(null); setSelection(searchTopics(event.target.value, topics)[0]?.id); }} placeholder="Try: CSV, publish, quizzes, reports…" /></label>
        {tourIndex !== null && <div className="genny-tour-progress" aria-live="polite"><span>Tour · {tourIndex + 1} of {tour.length}</span><progress value={tourIndex + 1} max={tour.length} /></div>}
        {selected && <article className="genny-topic-card" data-genny-card={selected.id}>
          <span className="genny-eyebrow">{selected.label}</span><h3>{selected.punch}</h3><p>{selected.explanation}</p>
          {platform && !scormAccess && !['overview', 'publica', 'courses', 'settings'].includes(selected.id) && <p className="genny-access-note">You can explore this module’s preview. Operations stay locked until your tenant is activated.</p>}
          {platform && !scormAccess && selected.id === 'courses' && <p className="genny-access-note">Try the platform demo course. This is a private demonstration, not a tenant learner assignment.</p>}
          <ol>{selected.steps.map(([title, detail]) => <li key={title}><strong>{title}</strong><span>{detail}</span></li>)}</ol>
          <button type="button" className="genny-primary" onClick={visit}>{platform ? `Show me ${selected.label}` : 'Explore the platform'} <span aria-hidden="true">→</span></button>
        </article>}
        {tourIndex !== null && <nav className="genny-tour-controls" aria-label="Genny tour steps"><button type="button" disabled={tourIndex === 0} onClick={() => recordStep(tourIndex - 1)}>Back</button><button type="button" className="genny-primary" onClick={() => {
          if (tourIndex + 1 < tour.length) recordStep(tourIndex + 1);
          else { try { localStorage.setItem(progressKey, 'complete'); } catch { /* optional storage */ } setTourIndex(null); mascotRef.current?.explain('Tour complete! Pick a module and put your next step into action.'); }
        }}>{tourIndex + 1 === tour.length ? 'Finish tour' : 'Next'}</button><button type="button" onClick={() => { setTourIndex(null); }}>End tour</button></nav>}
        <div className="genny-topic-list" aria-label="Genny topics">{results.map((topic) => <button key={topic.id} type="button" aria-pressed={selected?.id === topic.id} onClick={() => { setSelection(topic.id); setTourIndex(null); }}>{topic.label}</button>)}{!results.length && <><p>No matching feature yet. Try a module name.</p><button type="button" onClick={() => setQuery('')}>Show all topics</button></>}</div>
        <label className="genny-hover-toggle"><input type="checkbox" checked={hoverEnabled} onChange={toggleHover} /> Explain topics on hover or keyboard focus</label>
        <p className="genny-safety-note">Verified product guidance—not an AI chat. I explain and navigate; I never change your data.</p>
      </div>
    </section>}
  </div>;
}
