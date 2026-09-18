import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Database, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { warmScormPlatformData } from '../services/scormApiCache';
import {
  isPlatformPreparationPending,
  markPlatformPreparationComplete
} from '../services/platformPreparationSession';
import { readScormPlatformTheme } from '../pages/Scorm/platformTheme';
import './PlatformStartupGate.css';

const MINIMUM_VISIBLE_MS = 850;
let activePreparation = null;

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function preloadInitialWorkspace({ quizmotoOnly, scormAccess, role }) {
  let routeImport = import('../pages/Scorm/PendingHome');
  if (quizmotoOnly) routeImport = import('../pages/Scorm/QuizmotoModule');
  else if (scormAccess && role === 'analytics_viewer') routeImport = import('../pages/Scorm/Tracking');
  else if (scormAccess) routeImport = import('../pages/Scorm/Home');

  return Promise.all([
    import('../pages/Scorm/ScormPlatformShell'),
    routeImport
  ]).catch(() => null);
}

function sharedPreparation(token, options, onProgress) {
  if (activePreparation?.token === token) {
    activePreparation.listeners.add(onProgress);
    return activePreparation.promise.finally(() => activePreparation?.listeners.delete(onProgress));
  }

  const listeners = new Set([onProgress]);
  const notify = (progress) => listeners.forEach((listener) => listener(progress));
  const promise = warmScormPlatformData(token, { ...options, onProgress: notify })
    .finally(() => {
      if (activePreparation?.promise === promise) activePreparation = null;
    });

  activePreparation = { token, listeners, promise };
  return promise.finally(() => listeners.delete(onProgress));
}

export default function PlatformStartupGate({ children }) {
  const { token, user, scormAccess } = useAuth();
  const shouldPrepare = useMemo(() => Boolean(token && isPlatformPreparationPending()), [token]);
  const [preparing, setPreparing] = useState(shouldPrepare);
  const [progress, setProgress] = useState({
    percent: 4,
    label: 'Connecting to your workspace',
    completed: 0,
    total: 0
  });
  const theme = readScormPlatformTheme();

  useEffect(() => {
    if (!shouldPrepare || !token) {
      return undefined;
    }

    let active = true;
    const startedAt = Date.now();

    const dataPreparation = sharedPreparation(token, {
      force: false,
      includeHeavy: false,
      maxPriority: 2,
      role: user?.role || '',
      scormAccess,
      quizmotoOnly: Boolean(user?.quizmotoOnly)
    }, (next) => {
      if (!active) return;
      setProgress((current) => ({
        ...next,
        percent: Math.max(current.percent || 0, Math.min(96, Number(next?.percent || 0)))
      }));
    });
    const interfacePreparation = preloadInitialWorkspace({
      quizmotoOnly: Boolean(user?.quizmotoOnly),
      scormAccess,
      role: user?.role || ''
    });

    Promise.all([dataPreparation, interfacePreparation])
      .catch(() => null)
      .then(async () => {
        const remaining = Math.max(0, MINIMUM_VISIBLE_MS - (Date.now() - startedAt));
        if (remaining) await wait(remaining);
        if (!active) return;
        setProgress((current) => ({ ...current, percent: 100, label: 'Workspace ready' }));
        markPlatformPreparationComplete();
        window.setTimeout(() => active && setPreparing(false), 180);
      });

    return () => { active = false; };
  }, [shouldPrepare, token, user?.role, user?.quizmotoOnly, scormAccess]);

  if (!preparing) return children;

  return (
    <div className={`platform-startup platform-startup-${theme}`} role="status" aria-live="polite" aria-label="Preparing LMSGEN workspace">
      <div className="platform-startup-glow" aria-hidden="true" />
      <section className="platform-startup-card">
        <img src={theme === 'light' ? '/branding/lmsgen-logo-light.png' : '/branding/lmsgen-logo-dark.png'} alt="LMSGEN" className="platform-startup-logo" />
        <div className="platform-startup-kicker"><ShieldCheck size={13} /> Secure workspace preparation</div>
        <h1>Getting everything ready</h1>
        <p>Preparing your courses, Publica library, Quizmoto and learning insights so the platform is ready when it opens.</p>

        <div className="platform-startup-progress-heading">
          <span>{progress.label}</span>
          <strong>{Math.round(progress.percent || 0)}%</strong>
        </div>
        <div className="platform-startup-track" aria-hidden="true"><span style={{ width: `${progress.percent || 0}%` }} /></div>

        <div className="platform-startup-status">
          <span><Database size={14} /> Preparing workspace data</span>
          <span><CheckCircle2 size={14} /> Your session stays ready on reload</span>
        </div>
      </section>
    </div>
  );
}
