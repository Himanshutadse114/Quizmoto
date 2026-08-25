const memory = new Map();
const inflight = new Map();
const STORAGE_PREFIX = 'quizmoto_scorm_page_cache_v1:';
const MAX_CACHE_AGE_MS = 10 * 60 * 1000;

function safeParse(value) {
  try { return JSON.parse(value); } catch (_) { return null; }
}

function tokenScope(token) {
  try {
    const payload = String(token || '').split('.')[1];
    if (!payload) return 'session';
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(normalized));
    return String(decoded.userId || decoded.id || decoded.sub || decoded.email || 'session').replace(/[^A-Za-z0-9_.@-]/g, '_');
  } catch (_) {
    return 'session';
  }
}

function scopedKey(key, token) {
  return `${tokenScope(token)}:${String(key || 'data')}`;
}

function storageKey(key, token) {
  return `${STORAGE_PREFIX}${scopedKey(key, token)}`;
}

export function peekScormData(key, token) {
  const id = scopedKey(key, token);
  const cached = memory.get(id);
  if (cached && Date.now() - Number(cached.savedAt || 0) <= MAX_CACHE_AGE_MS) return cached.data;

  if (typeof window === 'undefined') return null;
  const stored = safeParse(window.sessionStorage.getItem(storageKey(key, token)) || '');
  if (!stored || Date.now() - Number(stored.savedAt || 0) > MAX_CACHE_AGE_MS) return null;
  memory.set(id, stored);
  return stored.data;
}

export function setScormData(key, token, data) {
  const entry = { data, savedAt: Date.now() };
  memory.set(scopedKey(key, token), entry);
  if (typeof window !== 'undefined') {
    try { window.sessionStorage.setItem(storageKey(key, token), JSON.stringify(entry)); } catch (_) {}
  }
  return data;
}

export async function fetchScormData(key, token, loader) {
  const id = scopedKey(key, token);
  if (inflight.has(id)) return inflight.get(id);

  const request = Promise.resolve()
    .then(loader)
    .then((data) => setScormData(key, token, data))
    .finally(() => inflight.delete(id));

  inflight.set(id, request);
  return request;
}

export function invalidateScormData(key, token) {
  const id = scopedKey(key, token);
  memory.delete(id);
  if (typeof window !== 'undefined') {
    try { window.sessionStorage.removeItem(storageKey(key, token)); } catch (_) {}
  }
}
