import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { warmScormPlatformData } from '../services/scormApiCache';

const TOKEN_CHECK_MS = 250;
const BACKGROUND_REFRESH_MS = 45_000;
const MAX_PREPARATION_BLOCK_MS = 30_000;
const MIN_PREPARATION_VISIBLE_MS = 900;
const READY_HOLD_MS = 550;
const FINALISING_HOLD_MS = 140;
const INITIAL_PROGRESS_PERCENT = 5;
const DATA_PROGRESS_START = 8;
const DATA_PROGRESS_END = 96;
const PROGRESS_TICK_MS = 38;
const PREPARED_PREFIX = 'lmsgen_platform_prepared_v1:';

function readSession() {
  let user = null;
  try { user = JSON.parse(window.localStorage.getItem('user') || 'null'); } catch (_) { user = null; }
  return {
    token: window.localStorage.getItem('token') || '',
    user,
    scormAccess: window.localStorage.getItem('scormAccessGranted') === '1' || Boolean(user?.scormAccess),
    quizmotoOnly: Boolean(user?.quizmotoOnly)
  };
}

function platformRoute() {
  return window.location.pathname === '/scorm' || window.location.pathname.startsWith('/scorm/');
}

function connectionAllowsHeavyWarmup() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!connection) return true;
  if (connection.saveData) return false;
  return !['slow-2g', '2g'].includes(String(connection.effectiveType || '').toLowerCase());
}

function hashText(value) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function preparedKey(token) {
  return `${PREPARED_PREFIX}${hashText(token)}`;
}

function wasPrepared(token) {
  if (!token) return false;
  try { return window.sessionStorage.getItem(preparedKey(token)) === '1'; } catch (_) { return false; }
}

function markPrepared(token) {
  if (!token) return;
  try { window.sessionStorage.setItem(preparedKey(token), '1'); } catch (_) {}
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function datasetProgressPercent(completed, total) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeCompleted = Math.max(0, Math.min(safeTotal, Number(completed) || 0));
  if (!safeTotal) return DATA_PROGRESS_START;
  const ratio = safeCompleted / safeTotal;
  return Math.min(DATA_PROGRESS_END, DATA_PROGRESS_START + Math.round(ratio * (DATA_PROGRESS_END - DATA_PROGRESS_START)));
}

const INITIAL_STATE = {
  active: false,
  percent: INITIAL_PROGRESS_PERCENT,
  completed: 0,
  total: 0,
  failed: 0,
  label: 'Preparing your workspace',
  background: false
};

export default function PlatformDataBootstrap() {
  const [preparation, setPreparation] = useState(INITIAL_STATE);
  const [displayPercent, setDisplayPercent] = useState(INITIAL_PROGRESS_PERCENT);

  useEffect(() => {
    if (!preparation.active) return undefined;
    const target = clampPercent(preparation.percent);
    const timer = window.setInterval(() => {
      setDisplayPercent((current) => {
        const safeCurrent = clampPercent(current);
        if (safeCurrent >= target) return safeCurrent;
        const gap = target - safeCurrent;
        const step = Math.max(1, Math.ceil(gap * 0.18));
        return Math.min(target, safeCurrent + step);
      });
    }, PROGRESS_TICK_MS);
    return () => window.clearInterval(timer);
  }, [preparation.active, preparation.percent]);

  useEffect(() => {
    let disposed = false;
    let warmedToken = '';
    let preparingToken = '';
    let heavyTimer = null;
    let maxBlockTimer = null;
    let warmPromise = null;

    const runWarm = async ({ force = false, includeHeavy = false, onProgress = null } = {}) => {
      if (disposed || !platformRoute()) return null;
      const { token, user, scormAccess, quizmotoOnly } = readSession();
      if (!token) return null;
      if (warmPromise && !force) return warmPromise;

      warmPromise = warmScormPlatformData(token, {
        force,
        includeHeavy,
        role: user?.role || '',
        scormAccess,
        quizmotoOnly,
        onProgress
      }).finally(() => {
        warmPromise = null;
      });
      return warmPromise;
    };

    const prepareWorkspace = async (token) => {
      if (!token || preparingToken === token || disposed) return;
      preparingToken = token;
      const startedAt = Date.now();
      let releasedToBackground = false;
      let completedSuccessfully = false;

      setDisplayPercent(INITIAL_PROGRESS_PERCENT);
      setPreparation({
        ...INITIAL_STATE,
        active: true,
        percent: INITIAL_PROGRESS_PERCENT,
        label: 'Connecting to your workspace'
      });

      window.clearTimeout(maxBlockTimer);
      maxBlockTimer = window.setTimeout(() => {
        if (disposed || preparingToken !== token) return;
        releasedToBackground = true;
        setPreparation((current) => ({
          ...current,
          active: false,
          background: true,
          label: 'Finishing preparation in the background'
        }));
      }, MAX_PREPARATION_BLOCK_MS);

      try {
        await runWarm({
          force: false,
          includeHeavy: connectionAllowsHeavyWarmup(),
          onProgress: (progress) => {
            if (disposed || preparingToken !== token) return;
            const mappedPercent = datasetProgressPercent(progress?.completed, progress?.total);
            setPreparation((current) => ({
              ...current,
              ...progress,
              active: !releasedToBackground,
              background: releasedToBackground,
              percent: Math.max(clampPercent(current.percent), mappedPercent)
            }));
          }
        });

        if (!releasedToBackground && !disposed && preparingToken === token) {
          setPreparation((current) => ({
            ...current,
            active: true,
            background: false,
            percent: Math.max(clampPercent(current.percent), 98),
            label: 'Finalising your workspace'
          }));
          await wait(FINALISING_HOLD_MS);
        }

        markPrepared(token);
        completedSuccessfully = true;

        const elapsed = Date.now() - startedAt;
        if (elapsed < MIN_PREPARATION_VISIBLE_MS) {
          await wait(MIN_PREPARATION_VISIBLE_MS - elapsed);
        }

        if (!releasedToBackground && !disposed && preparingToken === token) {
          setPreparation((current) => ({
            ...current,
            active: true,
            background: false,
            percent: 100,
            label: 'Workspace ready'
          }));
          await wait(READY_HOLD_MS);
        }
      } finally {
        window.clearTimeout(maxBlockTimer);
        if (!disposed && preparingToken === token) {
          setPreparation((current) => ({
            ...current,
            active: false,
            background: releasedToBackground && !completedSuccessfully,
            percent: completedSuccessfully ? 100 : current.percent,
            label: completedSuccessfully ? 'Workspace ready' : current.label
          }));
        }
        preparingToken = '';
      }
    };

    const scheduleHeavyWarm = () => {
      if (!connectionAllowsHeavyWarmup()) return;
      window.clearTimeout(heavyTimer);
      heavyTimer = window.setTimeout(() => {
        if (!disposed && document.visibilityState === 'visible' && platformRoute()) {
          runWarm({ force: false, includeHeavy: true });
        }
      }, 2500);
    };

    const ensureWarm = () => {
      if (disposed || !platformRoute()) return;
      const { token } = readSession();
      if (!token || token === warmedToken) return;
      warmedToken = token;

      if (wasPrepared(token)) {
        // Session storage already contains the prepared read cache. Open the app
        // immediately, then refresh quietly behind the visible UI.
        runWarm({ force: false, includeHeavy: false });
        scheduleHeavyWarm();
        return;
      }

      prepareWorkspace(token);
    };

    const refreshVisibleData = () => {
      if (disposed || document.visibilityState !== 'visible' || !platformRoute()) return;
      const { token } = readSession();
      if (!token || preparingToken === token) return;
      runWarm({ force: true, includeHeavy: false });
    };

    const onFocus = () => {
      ensureWarm();
      refreshVisibleData();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        ensureWarm();
        refreshVisibleData();
      }
    };

    const onStorage = () => {
      warmedToken = '';
      ensureWarm();
    };

    const onCacheInvalidated = () => {
      if (!disposed && platformRoute()) {
        runWarm({ force: true, includeHeavy: false });
      }
    };

    ensureWarm();

    // Login writes localStorage in the same browser tab, so the native `storage`
    // event does not fire there. A short token watcher detects the authenticated
    // session and route transition without coupling this component to AuthContext.
    const tokenTimer = window.setInterval(ensureWarm, TOKEN_CHECK_MS);
    const refreshTimer = window.setInterval(refreshVisibleData, BACKGROUND_REFRESH_MS);

    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
    window.addEventListener('lmsgen-platform-cache-invalidated', onCacheInvalidated);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      window.clearInterval(tokenTimer);
      window.clearInterval(refreshTimer);
      window.clearTimeout(heavyTimer);
      window.clearTimeout(maxBlockTimer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('lmsgen-platform-cache-invalidated', onCacheInvalidated);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  if (!preparation.active || !platformRoute()) return null;

  const percent = clampPercent(displayPercent);
  const ready = percent >= 100 && preparation.percent >= 100;

  return (
    <div className="fixed inset-0 z-[100000] grid place-items-center bg-[#050b12] px-5" role="status" aria-live="polite">
      <div className="w-full max-w-[560px] rounded-[26px] border border-white/10 bg-[#0b1521] p-6 md:p-8 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
            {ready ? <CheckCircle2 size={22} /> : <Sparkles size={21} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[.16em] text-cyan-200/80">LMSGEN Workspace</div>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-[-.03em] text-white">Preparing your platform</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">We are loading the data you use most so Dashboard, Courses, Learners, Campaigns, Reports, Flipbooks and Quizmoto can open without waiting for fresh database reads.</p>
          </div>
        </div>

        <div className="mt-7">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs">
            <span className="inline-flex min-w-0 items-center gap-2 font-medium text-slate-200">
              {ready ? <CheckCircle2 size={14} className="shrink-0 text-cyan-300" /> : <Loader2 size={14} className="shrink-0 animate-spin text-cyan-300" />}
              <span className="truncate">{preparation.label}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-cyan-200">{percent}%</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-white/8"
            role="progressbar"
            aria-label="Workspace preparation progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div className="h-full rounded-full bg-cyan-300" style={{ width: `${percent}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
            <span>{preparation.total ? `${preparation.completed} of ${preparation.total} data sets prepared` : 'Starting workspace preparation'}</span>
            <span>{preparation.failed ? `${preparation.failed} will refresh in background` : ready ? 'Preparation complete' : 'Secure cache enabled'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
