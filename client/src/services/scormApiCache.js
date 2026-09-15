import axios from 'axios';
import { apiUrl } from '../config';
import { setScormData } from './scormDataCache';

// Shared LMSGEN / Quizmoto read cache.
//
// Route changes remount page components and many of those pages perform the same
// authenticated reads again. This layer gives the platform stale-while-revalidate
// behaviour: serve prepared data immediately, refresh it quietly in the background
// and invalidate it after mutations. Real-time learner/player runtime endpoints are
// deliberately excluded.

const MAX_ENTRIES = 160;
const SESSION_PREFIX = 'lmsgen_api_cache_v3:';
const HARD_EXPIRE_MS = 10 * 60 * 1000;
const cache = new Map();
const revalidating = new Map();
let installed = false;

const REALTIME_FRAGMENTS = [
  '/author/progress/',
  '/preview/',
  '/session/',
  '/player/',
  '/play/',
  '/launch/',
  '/runtime',
  '/auth/',
  '/otp/',
  '/access/',
  '/public/',
  '/portal/'
];

// Most /access routes are authentication/permission checks and must remain live.
// Tenant administration is a normal list page, so it is the one safe exception.
const CACHEABLE_REALTIME_OVERRIDES = [
  '/api/scorm/access/tenants'
];

const PERSISTABLE_PATHS = [
  '/api/scorm/courses',
  '/api/scorm/packages',
  '/api/scorm/tracking/summary',
  '/api/scorm/campaigns',
  '/api/scorm/roster',
  '/api/scorm/features',
  '/api/scorm/team',
  '/api/scorm/learner-access',
  '/api/scorm/access/tenants',
  '/api/scorm/platform-users',
  '/api/scorm/flipbook-tenants',
  '/api/scorm/mail/templates',
  '/api/scorm/mail/status',
  '/api/scorm/flipbooks',
  '/api/scorm/courses/reports/all',
  '/api/quizzes',
  '/api/quizzes/active-sessions'
];

const FREE_TOOL_DATASETS = [
  { path: '/api/scorm/flipbooks', label: 'Preparing Flipbooks', priority: 1 },
  { path: '/api/quizzes', label: 'Preparing Quizmoto', priority: 1 },
  { path: '/api/quizzes/active-sessions', label: 'Checking live sessions', priority: 2 }
];

const SCORM_DATASETS = [
  { path: '/api/scorm/courses', dataKey: 'courses', label: 'Loading courses', priority: 1 },
  { path: '/api/scorm/packages', dataKey: 'packages', label: 'Loading SCORM library', priority: 1 },
  { path: '/api/scorm/tracking/summary', dataKey: 'tracking-summary', label: 'Preparing learner tracking', priority: 1 },
  { path: '/api/scorm/campaigns', label: 'Loading campaigns', priority: 2 },
  { path: '/api/scorm/roster', label: 'Loading learner roster', priority: 2 },
  { path: '/api/scorm/features', dataKey: 'features', label: 'Checking workspace features', priority: 2 }
];

const ANALYTICS_DATASETS = [
  { path: '/api/scorm/tracking/summary', dataKey: 'tracking-summary', label: 'Preparing learner tracking', priority: 1 },
  { path: '/api/scorm/campaigns', label: 'Loading campaigns', priority: 2 },
  { path: '/api/scorm/features', dataKey: 'features', label: 'Checking workspace features', priority: 2 }
];

const WORKSPACE_ADMIN_DATASETS = [
  { path: '/api/scorm/team', label: 'Preparing team access', priority: 3 },
  { path: '/api/scorm/learner-access', label: 'Preparing authentication settings', priority: 3 }
];

const SUPER_ADMIN_DATASETS = [
  { path: '/api/scorm/access/tenants', label: 'Loading tenant administration', priority: 3 },
  { path: '/api/scorm/platform-users', params: { q: undefined, scope: 'all' }, label: 'Preparing platform users', priority: 3 },
  { path: '/api/scorm/flipbook-tenants', label: 'Preparing Flipbook controls', priority: 3 },
  { path: '/api/scorm/mail/templates', label: 'Loading email templates', priority: 4 },
  { path: '/api/scorm/mail/status', label: 'Checking email service', priority: 4 }
];

const HEAVY_DATASETS = [
  { path: '/api/scorm/courses/reports/all', label: 'Preparing reports', priority: 4 }
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

function isQuizmotoUrl(url) {
  return url.includes('/api/quizzes');
}

function isPlatformCacheUrl(url) {
  return isScormUrl(url) || isQuizmotoUrl(url);
}

function isRealtimeUrl(url) {
  const clean = String(url || '').toLowerCase();
  return REALTIME_FRAGMENTS.some((fragment) => clean.includes(fragment));
}

function isRealtimeCacheOverride(url) {
  const clean = String(url || '').split('?')[0];
  return CACHEABLE_REALTIME_OVERRIDES.some((path) => clean.endsWith(path));
}

function isReadCacheEligibleUrl(url) {
  return isPlatformCacheUrl(url) && (!isRealtimeUrl(url) || isRealtimeCacheOverride(url));
}

function authHeader(config) {
  return config?.headers?.Authorization || config?.headers?.authorization || '';
}

function isCacheable(config) {
  const url = urlOf(config);
  if (methodOf(config) !== 'get' || !isReadCacheEligibleUrl(url)) return false;
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
  if (clean.includes('/tracking') || clean.includes('/analytics') || clean.includes('/active-sessions')) return 15_000;
  if (clean.includes('/reports')) return 30_000;
  if (
    clean.includes('/courses') ||
    clean.includes('/campaigns') ||
    clean.includes('/roster') ||
    clean.includes('/packages') ||
    clean.includes('/library') ||
    clean.includes('/flipbooks') ||
    clean.includes('/quizzes') ||
    clean.includes('/platform-users') ||
    clean.includes('/access/tenants')
  ) return 60_000;
  if (
    clean.includes('/team') ||
    clean.includes('/features') ||
    clean.includes('/learner-access') ||
    clean.includes('/mail/templates') ||
    clean.includes('/mail/status') ||
    clean.includes('/flipbook-tenants')
  ) return 2 * 60_000;
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
    // Session storage is an optimisation only. Large report datasets can exceed
    // browser quota; in that case the in-memory cache remains active.
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

function notifyInvalidated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lmsgen-platform-cache-invalidated'));
  }
}

export function invalidateScormApiCache({ notify = true } = {}) {
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
  if (notify) notifyInvalidated();
}

async function warmDataset(token, dataset, { force = false } = {}) {
  if (!token || !dataset?.path) return { ok: false, data: null };
  const headers = { Authorization: `Bearer ${token}` };
  try {
    const response = await axios.get(apiUrl(dataset.path), {
      headers,
      params: dataset.params || undefined,
      timeout: 25_000,
      __lmsgenForceRefresh: force,
      __lmsgenBackgroundRefresh: true
    });
    if (dataset.dataKey) setScormData(dataset.dataKey, token, response.data);
    return { ok: true, data: response.data };
  } catch (_) {
    return { ok: false, data: null };
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uniqueDatasets(datasets) {
  const seen = new Set();
  return datasets.filter((dataset) => {
    if (!dataset?.path) return false;
    const key = `${dataset.path}?${stableParams(dataset.params)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function warmScormPlatformData(token, options = {}) {
  if (!token) return { completed: 0, total: 0, failed: 0 };
  const {
    force = false,
    includeHeavy = false,
    essentialOnly = false,
    role = '',
    scormAccess = true,
    quizmotoOnly = false,
    onProgress = null
  } = options;

  const normalizedRole = String(role || '').toLowerCase();
  const analyticsOnly = normalizedRole === 'analytics_viewer';
  let datasets = [...FREE_TOOL_DATASETS];

  if (scormAccess && !quizmotoOnly) {
    datasets.push(...(analyticsOnly ? ANALYTICS_DATASETS : SCORM_DATASETS));
    if (['admin', 'super_admin'].includes(normalizedRole)) {
      datasets.push(...WORKSPACE_ADMIN_DATASETS);
    }
    if (normalizedRole === 'super_admin') {
      datasets.push(...SUPER_ADMIN_DATASETS);
    }
    if (includeHeavy) datasets.push(...HEAVY_DATASETS);
  }

  datasets = uniqueDatasets(datasets);
  if (essentialOnly) {
    // The visible startup loader only waits for the datasets needed by the main
    // workspace. Admin, email, access and report configuration is intentionally
    // left to the quiet background warm-up.
    datasets = datasets.filter((dataset) => Number(dataset.priority || 9) <= 1);
  }
  const total = datasets.length;
  let completed = 0;
  let failed = 0;

  const notify = (dataset, result) => {
    completed += 1;
    if (!result?.ok) failed += 1;
    if (typeof onProgress === 'function') {
      onProgress({
        completed,
        total,
        failed,
        percent: total ? Math.round((completed / total) * 100) : 100,
        label: dataset?.label || 'Preparing workspace',
        path: dataset?.path || ''
      });
    }
  };

  if (typeof onProgress === 'function') {
    onProgress({ completed: 0, total, failed: 0, percent: 0, label: 'Connecting to your workspace', path: '' });
  }

  const groups = new Map();
  datasets.forEach((dataset) => {
    const priority = Number(dataset.priority || 9);
    if (!groups.has(priority)) groups.set(priority, []);
    groups.get(priority).push(dataset);
  });

  for (const priority of [...groups.keys()].sort((a, b) => a - b)) {
    await Promise.all(groups.get(priority).map(async (dataset) => {
      const result = await warmDataset(token, dataset, { force });
      notify(dataset, result);
      return result;
    }));
    if (priority < 4) await wait(80);
  }

  return { completed, total, failed };
}

export function installScormApiCache() {
  if (installed) return;
  installed = true;

  axios.interceptors.request.use((config) => {
    const method = methodOf(config);
    const url = urlOf(config);

    // Clear prepared reads before a data-changing platform request, but never let
    // high-frequency learner runtime/auth traffic churn the whole admin cache.
    if (method !== 'get' && isReadCacheEligibleUrl(url)) invalidateScormApiCache({ notify: false });

    if (!isCacheable(config) || config.__lmsgenForceRefresh) return config;
    const cached = read(config);
    if (!cached) return config;

    // Stale-while-revalidate: return the valid cached response immediately and
    // refresh the same request in the background.
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
      const method = methodOf(config);
      const url = urlOf(config);
      const success = Number(response?.status || 0) >= 200 && Number(response?.status || 0) < 300;

      const eligible = method === 'get'
        && isReadCacheEligibleUrl(url)
        && Boolean(authHeader(config));
      if (eligible && !config.__lmsgenCacheHit && success) write(config, response);

      if (method !== 'get' && isReadCacheEligibleUrl(url) && success) notifyInvalidated();
      return response;
    },
    (error) => Promise.reject(error)
  );

  // Background course generation changes course/library data without a mutation
  // in the current route. Clear prepared lists so the next warm/read is current.
  if (typeof window !== 'undefined') {
    window.addEventListener('quizmoto-course-generation-jobs', (event) => {
      const jobs = Array.isArray(event?.detail) ? event.detail : [];
      if (jobs.some((job) => job?.status === 'ready')) invalidateScormApiCache();
    });
  }
}

installScormApiCache();
