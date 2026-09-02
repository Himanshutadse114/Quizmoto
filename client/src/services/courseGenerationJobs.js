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

function safeParse(value, fallback) {
  try { return JSON.parse(value); } catch (_) { return fallback; }
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

async function prepareGenerationPayload({ token, id, payload, file, signal }) {
  if (!file) {
    return {
      ...payload,
      fileBase64: String(payload.fileBase64 || ''),
      mimeType: payload.mimeType || ''
    };
  }

  try {
    const upload = await axios.post(
      apiUrl(`/api/scorm/author/source/${encodeURIComponent(id)}`),
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
    return {
      ...payload,
      fileBase64: '',
      sourceKey: upload.data?.sourceKey || '',
      sourceMimeType: upload.data?.mimeType || file.type || 'application/octet-stream',
      mimeType: file.type || payload.mimeType || ''
    };
  } catch (err) {
    // Rolling deployments can briefly serve a newer frontend against an older
    // API instance. Only in that compatibility window fall back to Base64.
    if (![404, 405].includes(Number(err.response?.status || 0))) throw err;
    const fileBase64 = await fileToBase64(file);
    return {
      ...payload,
      fileBase64,
      mimeType: file.type || payload.mimeType || ''
    };
  }
}

export function readCourseGenerationJobs() {
  if (typeof window === 'undefined') return [];
  const now = Date.now();
  const jobs = safeParse(window.localStorage.getItem(STORAGE_KEY) || '[]', []);
  if (!Array.isArray(jobs)) return [];
  return jobs
    .filter((job) => job && job.id)
    .filter((job) => ['running', 'queued', 'cancelling'].includes(job.status) || now - Number(job.updatedAt || job.createdAt || now) < KEEP_MS)
    .slice(0, MAX_JOBS);
}

function writeJobs(jobs) {
  if (typeof window === 'undefined') return;
  const next = Array.isArray(jobs) ? jobs.slice(0, MAX_JOBS) : [];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
}

export function upsertCourseGenerationJob(id, patch = {}) {
  const jobs = readCourseGenerationJobs();
  const index = jobs.findIndex((job) => job.id === id);
  const now = Date.now();
  const current = index >= 0 ? jobs[index] : { id, createdAt: now, notifiedAt: 0 };
  const nextJob = { ...current, ...patch, id, updatedAt: now };
  const next = index >= 0
    ? jobs.map((job, i) => (i === index ? nextJob : job))
    : [nextJob, ...jobs];
  writeJobs(next);
  return nextJob;
}

export function removeCourseGenerationJob(id) {
  const next = readCourseGenerationJobs().filter((job) => job.id !== id);
  writeJobs(next);
  return next;
}

export function markCourseGenerationJobNotified(id) {
  return upsertCourseGenerationJob(id, { notifiedAt: Date.now() });
}

export function publicGenerationError(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'Course generation failed. Please try again.';
  if (/gemini|replicate|flux|model\s*=|api\s*error/i.test(raw)) {
    return 'Course generation failed while preparing the course. Please try again.';
  }
  return raw;
}

function publicStage(progress = {}, floorPercent = 1) {
  const reported = Math.max(1, Math.min(100, Math.round(Number(progress.percent) || 1)));
  const percent = Math.max(Math.max(1, Number(floorPercent) || 1), reported);
  if (percent >= 100) return { percent, stage: 'Course ready' };
  if (percent >= 92) return { percent, stage: 'Finalising course' };
  if (percent >= 80) return { percent, stage: 'Building course' };
  if (percent >= 36) return { percent, stage: 'Creating course visuals' };
  if (percent >= 28) return { percent, stage: 'Planning course visuals' };
  if (percent >= 8) return { percent, stage: 'Creating course content' };
  return { percent, stage: 'Preparing source material' };
}

export function startBackgroundCourseGeneration({ token, payload, title, file = null }) {
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
    stage: file ? 'Uploading source material' : 'Preparing source material',
    detail: file ? 'Uploading the source file in the background.' : 'Course generation has started. You can continue using the platform.',
    courseId: null,
    packageId: null,
    error: '',
    notifiedAt: 0,
    progressUpdatedAt: now,
    missingProgressCount: 0,
    serverStatus: 'running'
  });

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
          percent: Math.max(1, Number(readCourseGenerationJobs().find((job) => job.id === id)?.percent || 1)),
          stage: data.status === 'queued' ? 'Queued for generation' : 'Starting generation',
          detail: 'Course generation is running in the background. You can continue using the platform.',
          missingProgressCount: 0,
          serverStatus: data.status || 'queued'
        });
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
      });
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
        });
        return;
      }
      if (!err.response) {
        upsertCourseGenerationJob(id, {
          status: 'running',
          detail: 'Checking the background course generation process.'
        });
        return;
      }
      upsertCourseGenerationJob(id, {
        status: 'failed',
        stage: 'Generation failed',
        error: publicGenerationError(err.response?.data?.message || err.message),
        progressUpdatedAt: Date.now(),
        serverStatus: 'error'
      });
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
  const existing = readCourseGenerationJobs().find((job) => job.id === id);
  if (existing) {
    upsertCourseGenerationJob(id, {
      status: 'cancelling',
      stage: 'Stopping generation',
      detail: 'Stopping this course generation process.'
    });
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
    if (stopped) removeCourseGenerationJob(id);
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
      removeCourseGenerationJob(job.id);
      return { ...job, status: 'cancelled' };
    }

    const visible = publicStage(progress, job.percent);
    const result = progress.result || {};
    const previousPercent = Math.max(1, Number(job.percent) || 1);
    const serverStatus = String(progress.status || 'running');
    const progressed = visible.percent > previousPercent || serverStatus !== String(job.serverStatus || 'running');
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
      });
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
      });
    }

    if (now - progressUpdatedAt > STALE_PROGRESS_MS) {
      return upsertCourseGenerationJob(job.id, {
        status: 'failed',
        stage: 'Generation interrupted',
        error: 'Course generation stopped responding. Please remove this attempt and try again.',
        progressUpdatedAt: now,
        missingProgressCount: 0,
        serverStatus
      });
    }

    return upsertCourseGenerationJob(job.id, {
      status: 'running',
      percent: visible.percent,
      stage: visible.stage,
      detail: 'Course generation continues in the background.',
      progressUpdatedAt,
      missingProgressCount: 0,
      serverStatus
    });
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
        });
      }
      return upsertCourseGenerationJob(job.id, { missingProgressCount });
    }

    if (now - Number(job.progressUpdatedAt || job.createdAt || now) > STALE_PROGRESS_MS) {
      return upsertCourseGenerationJob(job.id, {
        status: 'failed',
        stage: 'Generation interrupted',
        error: 'Course generation could not be reached. Please remove this attempt and try again.',
        progressUpdatedAt: now
      });
    }
    return job;
  }
}

export function useCourseGenerationJobs(token, { poll = true } = {}) {
  const [jobs, setJobs] = useState(() => readCourseGenerationJobs());

  useEffect(() => {
    const sync = () => setJobs(readCourseGenerationJobs());
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    if (!poll || !token) return undefined;
    let cancelled = false;
    const tick = async () => {
      const active = readCourseGenerationJobs().filter((job) => ['running', 'queued'].includes(job.status));
      if (!active.length) return;
      await Promise.all(active.map((job) => refreshCourseGenerationJob(token, job)));
      if (!cancelled) setJobs(readCourseGenerationJobs());
    };
    tick();
    const timer = window.setInterval(tick, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [token, poll]);

  return jobs;
}
