import { useEffect } from 'react';
import { warmScormPlatformData } from '../services/scormApiCache';

const TOKEN_CHECK_MS = 250;
const BACKGROUND_REFRESH_MS = 45_000;
const HEAVY_WARM_DELAY_MS = 1_500;

function readSession() {
  let user = null;
  try {
    user = JSON.parse(window.localStorage.getItem('user') || 'null');
  } catch {
    user = null;
  }

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

/**
 * Warms commonly used platform reads without gating the application UI.
 *
 * Every LMSGEN page owns its loading, empty and error states. A cache request is
 * therefore an optimisation only and must never place a full-screen barrier in
 * front of navigation. Slow or unavailable endpoints simply finish later in the
 * background while the user can continue using the platform.
 */
export default function PlatformDataBootstrap() {
  useEffect(() => {
    let disposed = false;
    let warmedToken = '';
    let heavyTimer = null;
    let warmPromise = null;

    const runBackgroundWarm = async ({ force = false, includeHeavy = false } = {}) => {
      if (disposed || !platformRoute()) return null;

      const { token, user, scormAccess, quizmotoOnly } = readSession();
      if (!token) return null;

      // Keep one warm-up in flight. Focus, visibility and cache invalidation can
      // fire together, but they should never fan out duplicate platform reads.
      if (warmPromise) return warmPromise;

      const request = warmScormPlatformData(token, {
        force,
        includeHeavy,
        role: user?.role || '',
        scormAccess,
        quizmotoOnly
      })
        .catch(() => null)
        .finally(() => {
          if (warmPromise === request) warmPromise = null;
        });

      warmPromise = request;
      return request;
    };

    const scheduleHeavyWarm = () => {
      if (!connectionAllowsHeavyWarmup()) return;
      window.clearTimeout(heavyTimer);
      heavyTimer = window.setTimeout(() => {
        if (!disposed && document.visibilityState === 'visible' && platformRoute()) {
          void runBackgroundWarm({ force: false, includeHeavy: true });
        }
      }, HEAVY_WARM_DELAY_MS);
    };

    const ensureWarm = () => {
      if (disposed || !platformRoute()) return;
      const { token } = readSession();
      if (!token || token === warmedToken) return;

      warmedToken = token;
      void runBackgroundWarm({ force: false, includeHeavy: false })
        .finally(() => {
          if (!disposed) scheduleHeavyWarm();
        });
    };

    const refreshVisibleData = () => {
      if (disposed || document.visibilityState !== 'visible' || !platformRoute()) return;
      const { token } = readSession();
      if (!token) return;
      void runBackgroundWarm({ force: true, includeHeavy: false });
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
      if (disposed || !platformRoute()) return;
      refreshVisibleData();
    };

    ensureWarm();

    // Login writes localStorage in the current tab, where the native storage
    // event does not fire. This lightweight watcher detects that token once.
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
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('lmsgen-platform-cache-invalidated', onCacheInvalidated);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return null;
}
