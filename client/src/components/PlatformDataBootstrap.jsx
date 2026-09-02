import { useEffect } from 'react';
import { warmScormPlatformData } from '../services/scormApiCache';

const TOKEN_CHECK_MS = 1000;
const BACKGROUND_REFRESH_MS = 45_000;

function readSession() {
  let user = null;
  try { user = JSON.parse(window.localStorage.getItem('user') || 'null'); } catch (_) { user = null; }
  return {
    token: window.localStorage.getItem('token') || '',
    user
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

export default function PlatformDataBootstrap() {
  useEffect(() => {
    let disposed = false;
    let warmedToken = '';
    let heavyTimer = null;
    let warmPromise = null;

    const warm = async ({ force = false, includeHeavy = false } = {}) => {
      if (disposed || !platformRoute()) return;
      const { token, user } = readSession();
      if (!token) return;
      if (warmPromise && !force) return warmPromise;

      warmPromise = warmScormPlatformData(token, {
        force,
        includeHeavy,
        role: user?.role || ''
      }).finally(() => {
        warmPromise = null;
      });
      return warmPromise;
    };

    const ensureWarm = () => {
      if (disposed || !platformRoute()) return;
      const { token } = readSession();
      if (!token || token === warmedToken) return;
      warmedToken = token;

      // Common workspace data begins warming as soon as the authenticated shell
      // becomes visible. This work is deliberately not awaited by navigation.
      warm({ force: false, includeHeavy: false });

      // Reports can be considerably larger for established tenants. Warm them
      // later, during idle time, and skip that download on data-saver/slow links.
      if (connectionAllowsHeavyWarmup()) {
        window.clearTimeout(heavyTimer);
        heavyTimer = window.setTimeout(() => {
          if (!disposed && document.visibilityState === 'visible') {
            warm({ force: false, includeHeavy: true });
          }
        }, 5000);
      }
    };

    const refreshVisibleData = () => {
      if (disposed || document.visibilityState !== 'visible' || !platformRoute()) return;
      const { token } = readSession();
      if (!token) return;
      warm({ force: true, includeHeavy: false });
    };

    ensureWarm();

    // Login writes localStorage in the same browser tab, so the native `storage`
    // event does not fire there. This tiny token watcher stops doing useful work
    // once the session is warm and avoids coupling the cache to the auth provider.
    const tokenTimer = window.setInterval(ensureWarm, TOKEN_CHECK_MS);
    const refreshTimer = window.setInterval(refreshVisibleData, BACKGROUND_REFRESH_MS);

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

    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      window.clearInterval(tokenTimer);
      window.clearInterval(refreshTimer);
      window.clearTimeout(heavyTimer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return null;
}
