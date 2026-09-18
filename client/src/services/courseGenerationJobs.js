import { useEffect, useState } from 'react';
import axios from 'axios';
import { apiUrl } from '../config';

const STORAGE_KEY = 'quizmoto_scorm_generation_jobs_v1';
const EVENT_NAME = 'quizmoto-course-generation-jobs';
const MAX_JOBS = 12;
const KEEP_MS = 24 * 60 * 60 * 1000;
const STALE_PROGRESS_MS = 4 * 60 * 1000;
const MISSING_PROGRESS_LIMIT = 12;
const MISSING_PROGRESS_GRACE_MS = 30 * 1000;
const requestControllers = new Map();
const cancelledJobs = new Set();

function tokenOwnerKey(token) {
  try {
    const value = String(token || '').split('.')[1] || '';
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(window.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
    const id = payload.userId ?? payload.id ?? payload.sub;
    return id == null ? '' : `user:${String(id)}`;
  } catch {
    return '';
  }
}

function activeOwnerKey(token = '') {
  if (typeof window === 'undefined') return '';
  return tokenOwnerKey(token || window.localStorage.getItem('token'));
}

function readAllStoredJobs() {
  if (typeof window === 'undefined') return [];
  const jobs = safeParse(window.localStorage.getItem(STORAGE_KEY) || '[]', []);
  return Array.isArray(jobs) ? jobs : [];
}

function safeParse(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function fileToBase64(file) {
  if (!file) return Promise.resolve('');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      resolve(value.includes(',') ? value.split(',')[1] : value);
    };
    reader.onerror = () => {
      const error = reader.error || new Error('Unable to read the selected source file.');
      error.code = 'COURSE_SOURCE_READ_FAILED';
      reject(error);
    };
    reader.readAsDataURL(file);
  });
}

async function uploadSourceFile({ token, id, file, signal, visual = false }) {
  const suffix = visual ? '/visual-pdf' : '';
  let ticket = null;
  try {
    const ticketResponse = await axios.post(
      apiUrl(`/api/scorm/author/source/${encodeURIComponent(id)}${suffix}/upload-ticket`),
      { mimeType: visual ? 'application/pdf' : (file.type || 'application/octet-stream'), byteSize: file.size },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 30000, signal }
    );
    ticket = ticketResponse.data || {};
  } catch (err) {
    if (![404, 405].includes(Number(err.response?.status || 0))) throw err;
  }

  if (ticket?.direct && ticket.uploadUrl) {
    try {
      await axios.put(ticket.uploadUrl, file, {
        headers: ticket.headers || { 'Content-Type': visual ? 'application/pdf' : (file.type || 'application/octet-stream') },
        timeout: 120000,
        signal
      });
    } catch (err) {
      const directError = new Error('The secure source upload could not start. Please retry or contact support.');
      directError.code = 'DIRECT_STORAGE_UPLOAD_FAILED';
      directError.cause = err;
      throw directError;
    }
    const complete = await axios.post(
      apiUrl(`/api/scorm/author/source/${encodeURIComponent(id)}${suffix}/upload-complete`),
      { mimeType: ticket.mimeType || file.type || 'application/octet-stream', byteSize: file.size },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 30000, signal }
    );
    return complete.data || {};
  }

  const upload = await axios.post(
    apiUrl(`/api/scorm/author/source/${encodeURIComponent(id)}${suffix}`),
    file,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'X-Source-Mime': file.type || 'application/octet-stream'
      },
      timeout: 120000,
      signal
    }
  );
  return upload.data || {};
}

async function prepareGenerationPayload({ token, id, payload, file, visualPdfFile, signal }) {
  let prepared = {
    ...payload,
    fileBase64: String(payload.fileBase64 || ''),
    mimeType: payload.mimeType || '',
    sourceFileName: payload.sourceFileName || ''
  };

  if (file) {
    try {
      const upload = await uploadSourceFile({ token, id, file, signal });
      prepared = {
        ...prepared,
        fileBase64: '',
        sourceKey: upload.sourceKey || '',
        sourceMimeType: upload.mimeType || file.type || 'application/octet-stream',
        mimeType: file.type || payload.mimeType || '',
        sourceFileName: file.name || payload.sourceFileName || ''
      };
    } catch (err) {
      // Rolling deployments can briefly serve a newer frontend against an older
      // API instance. Only in that compatibility window fall back to Base64.
      if (![404, 405].includes(Number(err.response?.status || 0))) throw err;
      const fileBase64 = await fileToBase64(file);
      prepared = {
        ...prepared,
        fileBase64,
        mimeType: file.type || payload.mimeType || '',
        sourceFileName: file.name || payload.sourceFileName || ''
      };
    }
  }

  if (visualPdfFile) {
    try {
      const upload = await uploadSourceFile({ token, id, file: visualPdfFile, signal, visual: true });
      prepared = {
        ...prepared,
        visualSourceKey: upload.sourceKey || '',
        visualSourceMimeType: 'application/pdf',
        visualSourceFileName: visualPdfFile.name || 'presentation-visuals.pdf'
      };
    } catch (err) {
      if (err?.code === 'ERR_CANCELED' || axios.isCancel?.(err)) throw err;
      // The exact PDF is an enhancement. If it cannot be uploaded during a
      // rolling deployment or is malformed, keep generation moving with the
      // primary PPTX/PDF and the automatic renderer.
      prepared = {
        ...prepared,
        visualSourceKey: '',
        visualSourceMimeType: '',
        visualSourceFileName: ''
      };
    }
  }

  return prepared;
}

export function readCourseGenerationJobs(token = '') {
  if (typeof window === 'undefined') return [];
  const now = Date.now();
  const ownerKey = activeOwnerKey(token);
  if (!ownerKey) return [];
  return readAllStoredJobs()
    .filter((job) => job && job.id)
    .filter((job) => job.ownerKey === ownerKey)
    .filter((job) => ['running', 'queued', 'cancelling'].includes(job.status) || now - Number(job.updatedAt || job.createdAt || now) < KEEP_MS)
    .slice(0, MAX_JOBS);
}

function writeJobs(ownerKey, jobs) {
  if (typeof window === 'undefined') return;
  const next = Array.isArray(jobs) ? jobs.slice(0, MAX_JOBS) : [];
  const otherOwners = readAllStoredJobs().filter((job) => job?.ownerKey && job.ownerKey !== ownerKey);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next, ...otherOwners].slice(0, MAX_JOBS * 4)));
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
}

export function upsertCourseGenerationJob(id, patch = {}, token = '') {
  const ownerKey = activeOwnerKey(token);
  if (!ownerKey) return null;
  const jobs = readCourseGenerationJobs(token);
  const index = jobs.findIndex((job) => job.id === id);
  const now = Date.now();
  const current = index >= 0 ? jobs[index] : { id, ownerKey, createdAt: now, notifiedAt: 0 };
  const nextJob = { ...current, ...patch, id, ownerKey, updatedAt: now };
  const next = index >= 0
    ? jobs.map((job, i) => (i === index ? nextJob : job))
    : [nextJob, ...jobs];
  writeJobs(ownerKey, next);
  return nextJob;
}

export function removeCourseGenerationJob(id, token = '') {
  const ownerKey = activeOwnerKey(token);
  if (!ownerKey) return [];
  const next = readCourseGenerationJobs(token).filter((job) => job.id !== id);
  writeJobs(ownerKey, next);
  return next;
}

export function markCourseGenerationJobNotified(id, token = '') {
  return upsertCourseGenerationJob(id, { notifiedAt: Date.now() }, token);
}

export function publicGenerationError(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'Course generation failed. Please try again.';
  const safe = raw
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED]')
    .replace(/([?&](?:key|api_key|apikey|token)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/((?:OPENAI_API_KEY|GEMINI_API_KEY|GOOGLE_API_KEY|REPLICATE_API_TOKEN)\s*=\s*)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/(["']?(?:api[_-]?key|access[_-]?token|token|authorization)["']?\s*[:=]\s*["'])[^"']+(["'])/gi, '$1[REDACTED]$2')
    .replace(/data:[^;\s]+;base64,[A-Za-z0-9+/=]+/gi, '[REDACTED_DATA_URL]')
    .replace(/\s+/g, ' ')
    .trim();

  if (/rate.?limit|quota|too many requests|\b429\b/i.test(safe)) {
    return 'The course service is busy right now. Please wait a moment and try again.';
  }
  if (/timed? out|timeout|network error|socket|econn|fetch failed/i.test(safe)) {
    return 'Course creation took longer than expected. Please try again.';
  }
  if (/pdf/i.test(safe) && /invalid|malformed|corrupt|could not|unable|failed|unsupported/i.test(safe)) {
    return 'The selected PDF could not be read. Please export it again and retry.';
  }
  if (/selected (?:source )?file/i.test(safe) && /read|open|upload/i.test(safe)) {
    return 'The selected file could not be read. Please choose it again and retry.';
  }
  if (
    /backend|smtp|configuration|credentials?|api[_ -]?key|service account|openai|replicate|gemini|vertex|fal\.ai|flux|renderer|rendering model|webp|base64|redis|database|sequelize|stack trace|node_modules|http\/?[123]|status code|environment variable|deploy|model=/i.test(safe)
  ) {
    return 'Course generation could not be completed. Please try again.';
  }
  return safe.slice(0, 280) || 'Course generation failed. Please try again.';
}

const FRIENDLY_PROGRESS = {
  queued: {
    stage: 'Course queued',
    detail: 'Your course will start shortly. You can continue using the platform.'
  },
  source: {
    stage: 'Reading your source',
    detail: 'Reviewing the material you provided for the course.'
  },
  content: {
    stage: 'Creating course content',
    detail: 'Organising the material into clear learning sections.'
  },
  visuals: {
    stage: 'Preparing course visuals',
    detail: 'Creating and optimising the visuals for fast loading.'
  },
  design: {
    stage: 'Designing the learning experience',
    detail: 'Arranging the course so it is clear and easy to follow.'
  },
  quiz: {
    stage: 'Preparing the knowledge check',
    detail: 'Creating and checking the course questions and answers.'
  },
  tracking: {
    stage: 'Adding course progress tracking',
    detail: 'Preparing completion, score and progress tracking.'
  },
  finishing: {
    stage: 'Finishing your course',
    detail: 'Completing the final checks before your course is ready.'
  },
  ready: {
    stage: 'Course ready',
    detail: 'Your course is ready to open.'
  }
};

function progressPhase(progress = {}, percent = 1) {
  const text = `${progress.stage || ''} ${progress.detail || ''}`.toLowerCase();
  if (percent >= 100 || /\bcomplete(?:d)?\b|\bcourse ready\b/.test(text)) return 'ready';
  if (/\bqueue|waiting to start/.test(text)) return 'queued';
  if (/upload|source|document|extract|reading|presentation|slide pages?/.test(text) && percent < 35) return 'source';
  if (/quiz|question|answer|knowledge check/.test(text)) return 'quiz';
  if (/visual|image|media|cover|illustration|photo/.test(text)) return 'visuals';
  if (/layout|format|design|theme|responsive/.test(text)) return 'design';
  if (/track|scorm|package|build|assemble/.test(text)) return 'tracking';
  if (/save|unpack|workspace|final|publish|learner files|ready/.test(text)) return 'finishing';
  if (/content|writ|analys|structur|outline|lesson|section/.test(text)) return 'content';
  if (percent >= 92) return 'finishing';
  if (percent >= 80) return 'tracking';
  if (percent >= 36) return 'visuals';
  if (percent >= 8) return 'content';
  return 'source';
}

export function publicCourseGenerationProgress(progress = {}, floorPercent = 1) {
  const reported = Math.max(1, Math.min(100, Math.round(Number(progress.percent) || 1)));
  const percent = Math.max(Math.max(1, Number(floorPercent) || 1), reported);
  const phase = progressPhase(progress, percent);
  return { percent, ...FRIENDLY_PROGRESS[phase] };
}

export function startBackgroundCourseGeneration({ token, payload, title, file = null, visualPdfFile = null }) {
  const id = payload.progressId;
  const displayTitle = String(title || payload.topic || 'New course').trim() || 'New course';
  cancelledJobs.delete(id);
  const previousController = requestControllers.get(id);
  if (previousController) previousController.abort();
  const controller = new AbortController();
  requestControllers.set(id, controller);
  const now = Date.now();

  upsertCourseGenerationJob(id, {
    title: displayTitle,
    status: 'running',
    percent: 1,
    stage: file || visualPdfFile ? 'Uploading source material' : 'Preparing source material',
    detail: visualPdfFile
      ? 'Uploading the editable presentation and exact visual PDF in the background.'
      : file ? 'Uploading the source file in the background.' : 'Course generation has started. You can continue using the platform.',
    courseId: null,
    packageId: null,
    error: '',
    notifiedAt: 0,
    progressUpdatedAt: now,
    missingProgressCount: 0,
    serverStatus: 'running'
  }, token);

  // The page can navigate immediately. Source files are uploaded as raw binary
  // data after the job is registered, avoiding Base64 conversion and huge JSON
  // bodies on the browser/main API process.
  Promise.resolve()
    .then(async () => {
      if (cancelledJobs.has(id)) return null;
      const requestPayload = await prepareGenerationPayload({
        token,
        id,
        payload,
        file,
        visualPdfFile,
        signal: controller.signal
      });
      if (cancelledJobs.has(id)) return null;
      return axios.post(apiUrl('/api/scorm/author/generate'), requestPayload, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 60000,
        signal: controller.signal
      });
    })
    .then((res) => {
      if (!res || cancelledJobs.has(id)) return;
      const data = res.data || {};

      if (res.status === 202 || data.accepted) {
        upsertCourseGenerationJob(id, {
          status: 'running',
          percent: Math.max(1, Number(readCourseGenerationJobs(token).find((job) => job.id === id)?.percent || 1)),
          stage: data.status === 'queued' ? 'Queued for generation' : 'Starting generation',
          detail: 'Course generation is running in the background. You can continue using the platform.',
          missingProgressCount: 0,
          serverStatus: data.status || 'queued'
        }, token);
        return;
      }

      // Backward compatibility for an older backend that still waits for the
      // generation result in the original HTTP request.
      if (data.errorMessage || (data.status && data.status !== 'ready')) {
        throw new Error(data.errorMessage || `Course generation finished with status: ${data.status}.`);
      }
      upsertCourseGenerationJob(id, {
        status: 'ready',
        percent: 100,
        stage: 'Course ready',
        detail: 'Your course is ready to open.',
        title: data.title || displayTitle,
        courseId: data.courseId || null,
        packageId: data.packageId || null,
        error: '',
        progressUpdatedAt: Date.now(),
        missingProgressCount: 0,
        serverStatus: 'complete'
      }, token);
    })
    .catch((err) => {
      if (cancelledJobs.has(id) || err?.code === 'ERR_CANCELED' || axios.isCancel?.(err)) return;
      if (err?.code === 'COURSE_SOURCE_READ_FAILED') {
        upsertCourseGenerationJob(id, {
          status: 'failed',
          stage: 'Generation failed',
          error: 'The selected source file could not be read. Please choose the file again and retry.',
          progressUpdatedAt: Date.now(),
          serverStatus: 'error'
        }, token);
        return;
      }
      if (!err.response) {
        upsertCourseGenerationJob(id, {
          status: 'running',
          detail: 'Checking course creation progress.'
        }, token);
        return;
      }
      upsertCourseGenerationJob(id, {
        status: 'failed',
        stage: 'Generation failed',
        error: publicGenerationError(err.response?.data?.message || err.message),
        progressUpdatedAt: Date.now(),
        serverStatus: 'error'
      }, token);
    })
    .finally(() => {
      if (requestControllers.get(id) === controller) requestControllers.delete(id);
    });

  return id;
}

export async function cancelCourseGenerationJob(token, jobOrId) {
  const id = typeof jobOrId === 'string' ? jobOrId : jobOrId?.id;
  if (!token || !id) return false;

  cancelledJobs.add(id);
  const existing = readCourseGenerationJobs(token).find((job) => job.id === id);
  if (existing) {
    upsertCourseGenerationJob(id, {
      status: 'cancelling',
      stage: 'Stopping generation',
      detail: 'Stopping this course generation process.'
    }, token);
  }

  let stopped = false;
  try {
    await axios.post(apiUrl(`/api/scorm/author/progress/${encodeURIComponent(id)}/cancel`), {}, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000
    });
    stopped = true;
  } catch (err) {
    if ([404, 409].includes(Number(err.response?.status || 0))) stopped = true;
    else throw err;
  } finally {
    const controller = requestControllers.get(id);
    if (controller) controller.abort();
    requestControllers.delete(id);
    if (stopped) removeCourseGenerationJob(id, token);
  }
  return stopped;
}

export async function refreshCourseGenerationJob(token, job) {
  if (!token || !job?.id || !['running', 'queued'].includes(job.status)) return job;
  const now = Date.now();
  try {
    const res = await axios.get(apiUrl(`/api/scorm/author/progress/${encodeURIComponent(job.id)}`), {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000
    });
    const progress = res.data?.progress;
    if (!progress) return job;
    if (progress.status === 'cancelled') {
      cancelledJobs.add(job.id);
      removeCourseGenerationJob(job.id, token);
      return { ...job, status: 'cancelled' };
    }

    const visible = publicCourseGenerationProgress(progress, job.percent);
    const detail = visible.detail;
    const result = progress.result || {};
    const previousPercent = Math.max(1, Number(job.percent) || 1);
    const serverStatus = String(progress.status || 'running');
    const progressed = visible.percent > previousPercent
      || serverStatus !== String(job.serverStatus || 'running')
      || visible.stage !== String(job.stage || '')
      || detail !== String(job.detail || '');
    const progressUpdatedAt = progressed ? now : Number(job.progressUpdatedAt || job.createdAt || now);

    if (progress.status === 'error') {
      return upsertCourseGenerationJob(job.id, {
        status: 'failed',
        percent: visible.percent,
        stage: 'Generation failed',
        error: publicGenerationError(progress.detail),
        progressUpdatedAt: now,
        missingProgressCount: 0,
        serverStatus: 'error'
      }, token);
    }
    if (progress.status === 'complete' || visible.percent >= 100) {
      return upsertCourseGenerationJob(job.id, {
        status: 'ready',
        percent: 100,
        stage: 'Course ready',
        detail: 'Your course is ready to open.',
        title: result.title || job.title,
        courseId: result.courseId || job.courseId || null,
        packageId: result.packageId || job.packageId || null,
        error: '',
        progressUpdatedAt: now,
        missingProgressCount: 0,
        serverStatus: 'complete'
      }, token);
    }

    if (now - progressUpdatedAt > STALE_PROGRESS_MS) {
      return upsertCourseGenerationJob(job.id, {
        status: 'failed',
        stage: 'Generation interrupted',
        error: 'Course generation stopped responding. Please remove this attempt and try again.',
        progressUpdatedAt: now,
        missingProgressCount: 0,
        serverStatus
      }, token);
    }

    return upsertCourseGenerationJob(job.id, {
      status: 'running',
      percent: visible.percent,
      stage: visible.stage,
      detail,
      progressUpdatedAt,
      missingProgressCount: 0,
      serverStatus
    }, token);
  } catch (err) {
    const status = Number(err.response?.status || 0);
    if (status === 404) {
      const missingProgressCount = Number(job.missingProgressCount || 0) + 1;
      const ageMs = now - Number(job.createdAt || now);
      if (missingProgressCount >= MISSING_PROGRESS_LIMIT && ageMs >= MISSING_PROGRESS_GRACE_MS) {
        return upsertCourseGenerationJob(job.id, {
          status: 'failed',
          stage: 'Generation interrupted',
          error: 'The background generation session was interrupted. Please remove this attempt and start again.',
          missingProgressCount,
          progressUpdatedAt: now,
          serverStatus: 'missing'
        }, token);
      }
      return upsertCourseGenerationJob(job.id, { missingProgressCount }, token);
    }

    if (now - Number(job.progressUpdatedAt || job.createdAt || now) > STALE_PROGRESS_MS) {
      return upsertCourseGenerationJob(job.id, {
        status: 'failed',
        stage: 'Generation interrupted',
        error: 'Course generation could not be reached. Please remove this attempt and try again.',
        progressUpdatedAt: now
      }, token);
    }
    return job;
  }
}

export function useCourseGenerationJobs(token, { poll = true } = {}) {
  const [jobs, setJobs] = useState(() => readCourseGenerationJobs(token));

  useEffect(() => {
    const sync = () => setJobs(readCourseGenerationJobs(token));
    sync();
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener('storage', sync);
    };
  }, [token]);

  useEffect(() => {
    if (!poll || !token) return undefined;
    let cancelled = false;
    const tick = async () => {
      const active = readCourseGenerationJobs(token).filter((job) => ['running', 'queued'].includes(job.status));
      if (!active.length) return;
      await Promise.all(active.map((job) => refreshCourseGenerationJob(token, job)));
      if (!cancelled) setJobs(readCourseGenerationJobs(token));
    };
    tick();
    const timer = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [token, poll]);

  return jobs;
}
