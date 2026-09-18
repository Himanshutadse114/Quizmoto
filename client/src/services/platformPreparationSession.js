const PREPARATION_PENDING_KEY = 'lmsgenPlatformPreparationPending';

export function markPlatformPreparationPending() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PREPARATION_PENDING_KEY, '1');
  } catch {
    // Session storage is an optimisation; authentication must still succeed.
  }
}

export function markPlatformPreparationComplete() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PREPARATION_PENDING_KEY);
  } catch {
    // A browser can disable storage. The platform remains usable in that case.
  }
  window.dispatchEvent(new CustomEvent('lmsgen-platform-prepared'));
}

export function clearPlatformPreparationState() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PREPARATION_PENDING_KEY);
  } catch {
    // A browser can disable storage.
  }
}

export function isPlatformPreparationPending() {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(PREPARATION_PENDING_KEY) === '1';
  } catch {
    return false;
  }
}
