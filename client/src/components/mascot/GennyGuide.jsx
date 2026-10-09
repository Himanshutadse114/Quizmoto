import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createAvatar } from '@bible-strong/avatar-web';
import definition from './genny.avatar.json';
import { mountGenny } from './genny-runtime.js';
import { searchTopics, topicForPath, topicsForAccess, tourForAccess } from './genny-knowledge.js';
import { demoGuidanceFor, demoTopics } from './genny-demo-guidance.js';
import { watchGuideViewport } from './genny-viewport.js';
import { GENNY_MOTION_KEY, readMotionPreference, motionEnabled } from './genny-motion.js';
import { GENNY_PERSONAS, GENNY_WEBSITE_TOPICS, GENNY_WEBSITE_TOUR } from './genny-personas.js';
import './mascot.css';
import './genny-guide.css';

function TopicWorkflow({ topic, compact, website = false }) {
  return <details className="genny-detail genny-workflow" open={!compact}><summary>{website ? 'Why it fits' : 'How it works'} · {topic.steps.length} {website ? 'pointers' : 'steps'}</summary><ol>{topic.steps.map(([title, detail]) => <li key={title}><strong>{title}</strong><span>{detail}</span></li>)}</ol></details>;
}

export default function GennyGuide({ platform = false, frameRef, pageSrc, allowedRoutes, isSuperAdmin = false, scormAccess = false, accountKey = 'website', suspended = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const lastFocus = useRef(null);
  const wasOpen = useRef(false);
  const mascotRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [restoreKey, setRestoreKey] = useState(0);
  const [selection, setSelection] = useState(null);
  const [tourIndex, setTourIndex] = useState(null);
  const [query, setQuery] = useState('');
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const [motionPreference, setMotionPreference] = useState(() => readMotionPreference(window));
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [hoverEnabled, setHoverEnabled] = useState(() => {
    try { return localStorage.getItem('lmsgen-genny-hover') !== 'off'; } catch { return true; }
  });
  const routesKey = allowedRoutes?.join('|');
  const persona = GENNY_PERSONAS[platform ? 'platform' : 'website'];
  const isDemo = platform && !scormAccess;
  const topics = useMemo(() => {
    if (!platform) return GENNY_WEBSITE_TOPICS;
    const available = topicsForAccess({ allowedRoutes: routesKey?.split('|'), isSuperAdmin });
    return isDemo ? demoTopics(available) : available;
  }, [routesKey, isSuperAdmin, isDemo, platform]);
  const tour = useMemo(() => platform ? tourForAccess({ allowedRoutes: routesKey?.split('|'), isSuperAdmin }) : GENNY_WEBSITE_TOUR, [routesKey, isSuperAdmin, platform]);
  const pageTopic = topics.find((topic) => topic.id === topicForPath(location.pathname)?.id);
  const selected = (tourIndex !== null ? tour[tourIndex] : topics.find((topic) => topic.id === selection)) || pageTopic || topics[0];
  const results = searchTopics(query, topics);
  const progressKey = `lmsgen-genny-tour-v1:${accountKey}`;
  const guidance = isDemo ? demoGuidanceFor(selected) : null;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setCompact(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!open || suspended) return undefined;
    return watchGuideViewport(panelRef.current);
  }, [open, suspended]);

  useEffect(() => {
    // Topic changes should never leave the explanation offscreen after a long FAQ.
    if (open) panelRef.current?.querySelector('.genny-guide-body')?.scrollTo({ top: 0 });
  }, [selected?.id, open]);

  const activate = useCallback(() => {
    lastFocus.current = document.activeElement;
    setOpen(true);
  }, []);
  const dismissMascot = useCallback(() => setHidden(true), []);
  const hovered = useCallback((topic) => { setSelection(topic.id); }, []);
  const close = () => setOpen(false);

  useEffect(() => {
    if (hidden || suspended) return undefined;
    const mascot = mountGenny({ document, container: containerRef.current, createAvatar, definition,
      onActivate: activate, onTopic: hovered, onDismiss: dismissMascot, topics, currentTopic: pageTopic, platform, hoverEnabled, motionPreference });
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
  }, [activate, hovered, dismissMascot, hidden, suspended, topics, pageTopic, platform, hoverEnabled, motionPreference, frameRef, pageSrc, restoreKey]);

  useEffect(() => {
    if (suspended) return undefined;
    const previouslyOpen = wasOpen.current;
    wasOpen.current = open;
    if (!open) {
      if (previouslyOpen) {
        const target = lastFocus.current?.isConnected && lastFocus.current !== document.body
          ? lastFocus.current : containerRef.current?.parentElement.querySelector('.genny-launcher');
        target?.focus?.();
      }
      return undefined;
    }
    closeRef.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
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
    wasOpen.current = false; // navigation supplies its own destination focus
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
    }}>{persona.launcher} <span aria-hidden="true">?</span></button>
    {open && <section ref={panelRef} id="genny-guide-panel" className="genny-guide" role="region" aria-label="Genny interactive guide">
      <header className="genny-guide-header"><div><span className="genny-eyebrow">{persona.eyebrow}</span><h2>{persona.title}</h2></div><button ref={closeRef} className="genny-close" type="button" onClick={close} aria-label="Close Genny guide"><span className="genny-close-icon" aria-hidden="true" /></button></header>
      <div className="genny-guide-body">
        <p className="genny-intro">{persona.intro}</p>
        <div className="genny-guide-toolbar"><button type="button" className="genny-primary" onClick={() => startTour()}>{persona.tour}</button>{platform && <button type="button" onClick={() => { setTourIndex(null); setSelection(pageTopic?.id || topics[0]?.id); setQuery(''); }}>Explain this page</button>}</div>
        <label className="genny-search">{persona.search}<input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setTourIndex(null); setSelection(searchTopics(event.target.value, topics)[0]?.id); }} placeholder={persona.placeholder} /></label>
        {tourIndex !== null && <div className="genny-tour-progress" aria-live="polite"><span>Tour · {tourIndex + 1} of {tour.length}</span><progress value={tourIndex + 1} max={tour.length} /></div>}
        {selected && <article key={selected.id} className="genny-topic-card" data-genny-card={selected.id}>
          <span className="genny-eyebrow">{selected.label}</span><h3>{selected.punch}</h3><p>{selected.explanation}</p>
          {guidance && <>
            <details className="genny-detail"><summary>What can I try in this demo?</summary><p className="genny-access-note">{guidance.available}</p></details>
          </>}
          {guidance ? <details className="genny-detail genny-demo-walkthrough"><summary>Detailed walkthrough & examples</summary>
            <p>{guidance.detail}</p>
            {selected.capabilities && <details className="genny-detail"><summary>Included capabilities</summary><ul>{selected.capabilities.map((item) => <li key={item}>{item}</li>)}</ul></details>}
            <TopicWorkflow topic={selected} compact={compact} />
            <details className="genny-detail"><summary>Example & advanced tips</summary><span className="genny-eyebrow">ILLUSTRATIVE SCENARIO</span><p>{guidance.example}</p><strong className="genny-detail-label">Genny’s tip</strong><p>{guidance.tip}</p></details>
            <details className="genny-detail"><summary>{guidance.question}</summary><p>{guidance.answer}</p></details>
          </details> : <TopicWorkflow topic={selected} compact={compact} website={!platform} />}
          {guidance && <details className="genny-detail genny-next"><summary>Where should I go next?</summary><div className="genny-topic-list">{guidance.next.map((id) => topics.find((topic) => topic.id === id)).filter(Boolean).map((topic) => <button type="button" key={topic.id} onClick={() => { setSelection(topic.id); setTourIndex(null); setQuery(''); }}>{topic.label}</button>)}</div></details>}
        </article>}
        {tourIndex !== null && <nav className="genny-tour-controls" aria-label="Genny tour steps"><button type="button" disabled={tourIndex === 0} onClick={() => recordStep(tourIndex - 1)}>Back</button><button type="button" className="genny-primary" onClick={() => {
          if (tourIndex + 1 < tour.length) recordStep(tourIndex + 1);
          else { try { localStorage.setItem(progressKey, 'complete'); } catch { /* optional storage */ } setTourIndex(null); mascotRef.current?.explain(persona.complete); }
        }}>{tourIndex + 1 === tour.length ? 'Finish tour' : 'Next'}</button><button type="button" onClick={() => { setTourIndex(null); }}>End tour</button></nav>}
        <details className="genny-detail genny-topics-disclosure" open={!!query || !compact}><summary>Browse features · {results.length}</summary><div className="genny-topic-list" aria-label="Genny topics">{results.map((topic) => <button key={topic.id} type="button" aria-pressed={selected?.id === topic.id} onClick={() => { setSelection(topic.id); setTourIndex(null); }}>{topic.label}</button>)}{!results.length && <><p>No matching feature yet. Try a module name.</p><button type="button" onClick={() => setQuery('')}>Show all topics</button></>}</div></details>
        <label className="genny-hover-toggle"><input type="checkbox" checked={hoverEnabled} onChange={toggleHover} /> Explain topics on hover or keyboard focus</label>
        <label className="genny-hover-toggle"><input type="checkbox" checked={motionEnabled(motionPreference, reducedMotion)} onChange={(event) => {
          const preference = event.target.checked ? 'on' : 'off';
          setMotionPreference(preference);
          try { localStorage.setItem(GENNY_MOTION_KEY, preference); } catch { /* optional storage */ }
        }} /> Move Genny’s eyes</label>
        {motionPreference === 'auto' && reducedMotion && <p className="genny-safety-note">Eye motion is off to follow your device setting. Enable it above if you prefer.</p>}
        <p className="genny-safety-note">Verified product guidance—not an AI chat. I explain and navigate; I never change your data.</p>
      </div>
      {selected && <footer className="genny-guide-footer"><button type="button" className="genny-primary" onClick={visit}>{platform ? `Show me ${selected.label}` : 'Explore the platform'} <span aria-hidden="true">→</span></button></footer>}
    </section>}
  </div>;
}
