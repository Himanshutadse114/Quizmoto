import axios from 'axios';

// LMSGEN route components are intentionally mounted/unmounted by React Router.
// Without a shared cache every navigation remount repeats the same database GETs.
// This lightweight cache keeps admin navigation instant while preserving real-time
// behaviour for course players, generation progress, auth and learner portals.

const MAX_ENTRIES = 80;
const cache = new Map();
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

function isCacheable(config) {
  const url = urlOf(config);
  if (methodOf(config) !== 'get' || !isScormUrl(url) || isRealtimeUrl(url)) return false;
  if (config?.headers?.['X-LMSGEN-No-Cache'] || config?.headers?.['x-lmsgen-no-cache']) return false;
  return Boolean(config?.headers?.Authorization || config?.headers?.authorization);
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
  const auth = config?.headers?.Authorization || config?.headers?.authorization || '';
  return `${urlOf(config)}?${stableParams(config?.params)}|u:${hashText(auth)}`;
}

function ttlFor(url) {
  const clean = String(url || '').toLowerCase();
  // Analytics should feel current when a learner is actively completing work.
  if (clean.includes('/tracking') || clean.includes('/reports') || clean.includes('/analytics')) return 8_000;
  // Lists and configuration change much less often and are the main navigation cost.
  if (clean.includes('/courses') || clean.includes('/campaigns') || clean.includes('/roster') || clean.includes('/library')) return 30_000;
  return 15_000;
}

function prune() {
  if (cache.size <= MAX_ENTRIES) return;
  const entries = [...cache.entries()].sort((a, b) => Number(a[1]?.storedAt || 0) - Number(b[1]?.storedAt || 0));
  entries.slice(0, Math.max(1, cache.size - MAX_ENTRIES)).forEach(([key]) => cache.delete(key));
}

function read(config) {
  const key = cacheKey(config);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > entry.ttl) {
    cache.delete(key);
    return null;
  }
  return entry;
}

function write(config, response) {
  const key = cacheKey(config);
  cache.set(key, {
    storedAt: Date.now(),
    ttl: ttlFor(urlOf(config)),
    data: response.data,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
  prune();
}

export function invalidateScormApiCache() {
  cache.clear();
}

export function installScormApiCache() {
  if (installed) return;
  installed = true;

  axios.interceptors.request.use((config) => {
    const method = methodOf(config);
    const url = urlOf(config);

    // Any successful-looking write begins from a clean read cache. This is
    // intentionally broad: correctness after create/start/stop/add/remove is
    // more important than retaining a few extra cached list responses.
    if (method !== 'get' && isScormUrl(url)) invalidateScormApiCache();

    if (!isCacheable(config)) return config;
    const entry = read(config);
    if (!entry) return config;

    config.__lmsgenCacheHit = true;
    config.adapter = async () => ({
      data: entry.data,
      status: entry.status,
      statusText: entry.statusText,
      headers: entry.headers,
      config,
      request: null
    });
    return config;
  });

  axios.interceptors.response.use(
    (response) => {
      const config = response?.config || {};
      if (isCacheable(config) && !config.__lmsgenCacheHit && Number(response?.status || 0) >= 200 && Number(response?.status || 0) < 300) {
        write(config, response);
      }
      return response;
    },
    (error) => Promise.reject(error)
  );

  // A completed background generation creates new course/library data without
  // an admin mutation occurring in the current route. Clear cached lists when
  // the shared generation job event reports a ready course.
  if (typeof window !== 'undefined') {
    window.addEventListener('quizmoto-course-generation-jobs', (event) => {
      const jobs = Array.isArray(event?.detail) ? event.detail : [];
      if (jobs.some((job) => job?.status === 'ready')) invalidateScormApiCache();
    });
  }
}

installScormApiCache();
