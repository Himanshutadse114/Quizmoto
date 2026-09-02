import axios from 'axios';
import { apiUrl } from '../config';
import { setScormData } from './scormDataCache';

// Shared LMSGEN read cache.
//
// The platform is a client-side React app, so switching routes remounts page
// components. Without a shared data layer each remount repeats the same API and
// database reads. This cache gives LMSGEN a stale-while-revalidate behaviour:
// render cached admin data immediately, refresh it quietly in the background and
// invalidate it after mutations. Real-time learner/player endpoints are excluded.

const MAX_ENTRIES = 100;
const SESSION_PREFIX = 'lmsgen_api_cache_v2:';
const HARD_EXPIRE_MS = 10 * 60 * 1000;
const cache = new Map();
const revalidating = new Map();
let installed = false;

const REALTIME_FRAGMENTS = [
  '/author/progress/',
  '/session/',
  '/player/',
  '/play/',
  '/launch/',
  '/auth/',
  '/otp/',
  '/access/',
  '/public/',
  '/portal/'
];

const PERSISTABLE_PATHS = [
  '/api/scorm/courses',
  '/api/scorm/packages',
  '/api/scorm/tracking/summary',
  '/api/scorm/campaigns',
  '/api/scorm/roster',
  '/api/scorm/features',
  '/api/scorm/team'
];

const WARM_DATASETS = [
  { path: '/api/scorm/courses', dataKey: 'courses', priority: 1 },
  { path: '/api/scorm/packages', dataKey: 'packages', priority: 1 },
  { path: '/api/scorm/tracking/summary', dataKey: 'tracking-summary', priority: 1 },
  { path: '/api/scorm/campaigns', priority: 2 },
  { path: '/api/scorm/roster', priority: 2 },
  { path: '/api/scorm/features', dataKey: 'features', priority: 2 }
];

function methodOf(config) {
  return String(config?.method || 'get').toLowerCase();
}

function urlOf(config) {
  return String(config?.url || '');
}

function isScormUrl(url) {
  return url.includes('/api/scorm/');
}

function isRealtimeUrl(url) {
  const clean = String(url || '').toLowerCase();
  return REALTIME_FRAGMENTS.some((fragment) => clean.includes(fragment));
}

function authHeader(config) {
  return config?.headers?.Authorization || config?.headers?.authorization || '';
}

function isCacheable(config) {
  const url = urlOf(config);
  if (methodOf(config) !== 'get' || !isScormUrl(url) || isRealtimeUrl(url)) return false;
  if (config?.headers?.['X-LMSGEN-No-Cache'] || config?.headers?.['x-lmsgen-no-cache']) return false;
  return Boolean(authHeader(config));
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

function stableParams(params) {
  if (!params) return '';
  if (typeof params !== 'object') return String(params);
  return Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(JSON.stringify(params[key]))}`)
    .join('&');
}

function cacheKey(config) {
  return `${urlOf(config)}?${stableParams(config?.params)}|u:${hashText(authHeader(config))}`;
}

function freshFor(url) {
  const clean = String(url || '').toLowerCase();
  // Learner activity changes more frequently than library/configuration data.
  if (clean.includes('/tracking') || clean.includes('/analytics')) return 15_000;
  if (clean.includes('/reports')) return 30_000;
  if (clean.includes('/courses') || clean.includes('/campaigns') || clean.includes('/roster') || clean.includes('/packages') || clean.includes('/library')) return 60_000;
  if (clean.includes('/team') || clean.includes('/features')) return 2 * 60_000;
  return 45_000;
}

function persistable(url) {
  const clean = String(url || '').split('?')[0];
  return PERSISTABLE_PATHS.some((path) => clean.endsWith(path));
}

function sessionKey(key) {
  return `${SESSION_PREFIX}${hashText(key)}`;
}

function persist(key, entry, url) {
  if (typeof window === 'undefined' || !persistable(url)) return;
  try {
    window.sessionStorage.setItem(sessionKey(key), JSON.stringify({
      storedAt: entry.storedAt,
      freshUntil: entry.freshUntil,
      expiresAt: entry.expiresAt,
      data: entry.data,
      status: entry.status,
      statusText: entry.statusText
    }));
  } catch (_) {
    // Session storage is an optimisation only. Large tenants can exceed browser
    // quota, in which case the in-memory cache remains active.
  }
}

function restore(key) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(sessionKey(key));
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || Date.now() >= Number(entry.expiresAt || 0)) {
      window.sessionStorage.removeItem(sessionKey(key));
      return null;
    }
    return { ...entry, headers: {} };
  } catch (_) {
    return null;
  }
}

function prune() {
  if (cache.size <= MAX_ENTRIES) return;
  const entries = [...cache.entries()].sort((a, b) => Number(a[1]?.storedAt || 0) - Number(b[1]?.storedAt || 0));
  entries.slice(0, Math.max(1, cache.size - MAX_ENTRIES)).forEach(([key]) => cache.delete(key));
}

function read(config) {
  const key = cacheKey(config);
  let entry = cache.get(key);
  if (!entry && persistable(urlOf(config))) {
    entry = restore(key);
    if (entry) cache.set(key, entry);
  }
  if (!entry) return null;
  if (Date.now() >= Number(entry.expiresAt || 0)) {
    cache.delete(key);
    if (typeof window !== 'undefined') {
      try { window.sessionStorage.removeItem(sessionKey(key)); } catch (_) {}
    }
    return null;
  }
  return { key, entry, stale: Date.now() >= Number(entry.freshUntil || 0) };
}

function write(config, response) {
  const key = cacheKey(config);
  const storedAt = Date.now();
  const entry = {
    storedAt,
    freshUntil: storedAt + freshFor(urlOf(config)),
    expiresAt: storedAt + HARD_EXPIRE_MS,
    data: response.data,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers || {}
  };
  cache.set(key, entry);
  persist(key, entry, urlOf(config));
  prune();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lmsgen-api-cache-updated', {
      detail: { url: urlOf(config), storedAt }
    }));
  }
}

function cloneForRefresh(config) {
  const headers = { ...(config?.headers || {}) };
  delete headers['X-LMSGEN-No-Cache'];
  delete headers['x-lmsgen-no-cache'];
  return {
    ...config,
    headers,
    adapter: undefined,
    signal: undefined,
    cancelToken: undefined,
    __lmsgenCacheHit: false,
    __lmsgenForceRefresh: true,
    __lmsgenBackgroundRefresh: true
  };
}

function scheduleRevalidate(config) {
  const key = cacheKey(config);
  if (revalidating.has(key)) return revalidating.get(key);
  const request = Promise.resolve()
    .then(() => axios.request(cloneForRefresh(config)))
    .catch(() => null)
    .finally(() => revalidating.delete(key));
  revalidating.set(key, request);
  return request;
}

export function invalidateScormApiCache() {
  cache.clear();
  revalidating.clear();
  if (typeof window !== 'undefined') {
    try {
      const keys = [];
      for (let i = 0; i < window.sessionStorage.length; i += 1) {
        const key = window.sessionStorage.key(i);
        if (key?.startsWith(SESSION_PREFIX)) keys.push(key);
      }
      keys.forEach((key) => window.sessionStorage.removeItem(key));
    } catch (_) {}
  }
}

async function warmDataset(token, dataset, { force = false } = {}) {
  if (!token || !dataset?.path) return null;
  const headers = { Authorization: `Bearer ${token}` };
  try {
    const response = await axios.get(apiUrl(dataset.path), {
      headers,
      timeout: 20_000,
      __lmsgenForceRefresh: force,
      __lmsgenBackgroundRefresh: true
    });
    if (dataset.dataKey) setScormData(dataset.dataKey, token, response.data);
    return response.data;
  } catch (_) {
    return null;
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function warmScormPlatformData(token, options = {}) {
  if (!token) return;
  const {
    force = false,
    includeHeavy = false,
    role = ''
  } = options;

  const datasets = [...WARM_DATASETS];
  if (['admin', 'super_admin'].includes(String(role || '').toLowerCase())) {
    datasets.push({ path: '/api/scorm/team', priority: 3 });
  }
  if (includeHeavy) {
    datasets.push({ path: '/api/scorm/courses/reports/all', priority: 4 });
  }

  // Warm in small groups instead of firing every database query at once. This
  // keeps login/navigation responsive while the rest of the workspace becomes hot.
  const groups = new Map();
  datasets.forEach((dataset) => {
    const priority = Number(dataset.priority || 9);
    if (!groups.has(priority)) groups.set(priority, []);
    groups.get(priority).push(dataset);
  });

  for (const priority of [...groups.keys()].sort((a, b) => a - b)) {
    await Promise.all(groups.get(priority).map((dataset) => warmDataset(token, dataset, { force })));
    if (priority < 4) await wait(120);
  }
}

export function installScormApiCache() {
  if (installed) return;
  installed = true;

  axios.interceptors.request.use((config) => {
    const method = methodOf(config);
    const url = urlOf(config);

    // Writes invalidate cached admin reads. This guarantees that create, update,
    // start, stop, add/remove learner and delete operations cannot leave old data
    // visible simply because the user navigated to another cached page.
    if (method !== 'get' && isScormUrl(url)) invalidateScormApiCache();

    if (!isCacheable(config) || config.__lmsgenForceRefresh) return config;
    const cached = read(config);
    if (!cached) return config;

    // Stale-while-revalidate: return the old-but-valid response immediately and
    // refresh the same request in the background. The user never waits for the DB.
    if (cached.stale) scheduleRevalidate(config);

    config.__lmsgenCacheHit = true;
    config.adapter = async () => ({
      data: cached.entry.data,
      status: cached.entry.status,
      statusText: cached.entry.statusText,
      headers: cached.entry.headers,
      config,
      request: null
    });
    return config;
  });

  axios.interceptors.response.use(
    (response) => {
      const config = response?.config || {};
      const eligible = methodOf(config) === 'get'
        && isScormUrl(urlOf(config))
        && !isRealtimeUrl(urlOf(config))
        && Boolean(authHeader(config));
      if (eligible && !config.__lmsgenCacheHit && Number(response?.status || 0) >= 200 && Number(response?.status || 0) < 300) {
        write(config, response);
      }
      return response;
    },
    (error) => Promise.reject(error)
  );

  // A completed background generation creates new course/library data without
  // an admin mutation occurring in the current route. Clear cached lists so the
  // next warm/read picks up the generated course immediately.
  if (typeof window !== 'undefined') {
    window.addEventListener('quizmoto-course-generation-jobs', (event) => {
      const jobs = Array.isArray(event?.detail) ? event.detail : [];
      if (jobs.some((job) => job?.status === 'ready')) invalidateScormApiCache();
    });
  }
}

installScormApiCache();
