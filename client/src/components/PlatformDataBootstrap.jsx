import { useEffect } from 'react';
import { warmScormPlatformData } from '../services/scormApiCache';

const TOKEN_CHECK_MS = 1_000;
const BACKGROUND_REFRESH_MS = 2 * 60_000;
const INITIAL_WARM_DELAY_MS = 2_500;

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
    let warmTimer = null;
    let warmPromise = null;

    const runBackgroundWarm = async ({ force = false, essentialOnly = false } = {}) => {
      if (disposed || !platformRoute()) return null;

      const { token, user, scormAccess, quizmotoOnly } = readSession();
      if (!token) return null;

      // Keep one warm-up in flight. Focus, visibility and cache invalidation can
      // fire together, but they should never fan out duplicate platform reads.
      if (warmPromise) return warmPromise;

      const request = warmScormPlatformData(token, {
        force,
        includeHeavy: false,
        essentialOnly,
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

    const ensureWarm = () => {
      if (disposed || !platformRoute()) return;
      const { token } = readSession();
      if (!token || token === warmedToken) return;

      warmedToken = token;
      window.clearTimeout(warmTimer);
      // Let the active route populate its own data first. The shared cache then
      // turns this warm-up into cache hits instead of duplicate initial reads.
      warmTimer = window.setTimeout(() => {
        if (!disposed && platformRoute()) void runBackgroundWarm({ force: false });
      }, INITIAL_WARM_DELAY_MS);
    };

    const refreshVisibleData = () => {
      if (disposed || document.visibilityState !== 'visible' || !platformRoute()) return;
      const { token } = readSession();
      if (!token) return;
      // Focus and visibility events often arrive together. Cached responses are
      // immediate and only stale datasets revalidate in the background.
      void runBackgroundWarm({ force: false });
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
      window.clearTimeout(warmTimer);
      warmTimer = window.setTimeout(() => {
        if (!disposed && platformRoute()) void runBackgroundWarm({ essentialOnly: true });
      }, INITIAL_WARM_DELAY_MS);
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
      window.clearTimeout(warmTimer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('lmsgen-platform-cache-invalidated', onCacheInvalidated);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return null;
}
