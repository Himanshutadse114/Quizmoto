import { useEffect, useState } from 'react';
import axios from 'axios';
import { apiUrl } from '../config';

const STORAGE_KEY = 'quizmoto_scorm_generation_jobs_v1';
const EVENT_NAME = 'quizmoto-course-generation-jobs';
const MAX_JOBS = 12;
const KEEP_MS = 24 * 60 * 60 * 1000;
const requestControllers = new Map();
const cancelledJobs = new Set();

function safeParse(value, fallback) {
  try { return JSON.parse(value); } catch (_) { return fallback; }
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

function publicStage(progress = {}) {
  const percent = Math.max(1, Math.min(100, Math.round(Number(progress.percent) || 1)));
  if (percent >= 100) return { percent, stage: 'Course ready' };
  if (percent >= 92) return { percent, stage: 'Finalising course' };
  if (percent >= 80) return { percent, stage: 'Building course' };
  if (percent >= 55) return { percent, stage: 'Creating visuals' };
  if (percent >= 20) return { percent, stage: 'Creating course content' };
  return { percent, stage: 'Preparing source material' };
}

export function startBackgroundCourseGeneration({ token, payload, title }) {
  const id = payload.progressId;
  const displayTitle = String(title || payload.topic || 'New course').trim() || 'New course';
  cancelledJobs.delete(id);
  const previousController = requestControllers.get(id);
  if (previousController) previousController.abort();
  const controller = new AbortController();
  requestControllers.set(id, controller);

  upsertCourseGenerationJob(id, {
    title: displayTitle,
    status: 'running',
    percent: 1,
    stage: 'Preparing source material',
    detail: 'Course generation has started. You can continue using the platform.',
    courseId: null,
    packageId: null,
    error: '',
    notifiedAt: 0
  });

  axios.post(apiUrl('/api/scorm/author/generate'), payload, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 600000,
    signal: controller.signal
  }).then((res) => {
    if (cancelledJobs.has(id)) return;
    const data = res.data || {};
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
      error: ''
    });
  }).catch((err) => {
    if (cancelledJobs.has(id) || err?.code === 'ERR_CANCELED' || axios.isCancel?.(err)) return;
    // A browser/network timeout does not necessarily stop server-side generation.
    // Keep the job alive and let progress polling resolve the final state.
    if (!err.response) {
      upsertCourseGenerationJob(id, {
        status: 'running',
        detail: 'Course generation is still running in the background.'
      });
      return;
    }
    upsertCourseGenerationJob(id, {
      status: 'failed',
      stage: 'Generation failed',
      error: publicGenerationError(err.response?.data?.message || err.message)
    });
  }).finally(() => {
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
    // If the server no longer knows this job, there is no live process left on
    // that server instance, so it is safe to clear the stale browser entry.
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
    const visible = publicStage(progress);
    const result = progress.result || {};
    if (progress.status === 'error') {
      return upsertCourseGenerationJob(job.id, {
        status: 'failed',
        percent: visible.percent,
        stage: 'Generation failed',
        error: publicGenerationError(progress.detail)
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
        error: ''
      });
    }
    return upsertCourseGenerationJob(job.id, {
      status: 'running',
      percent: visible.percent,
      stage: visible.stage,
      detail: 'Course generation continues in the background.'
    });
  } catch (err) {
    // 404 can happen briefly before the server registers the progress record.
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
    const timer = window.setInterval(tick, 1800);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [token, poll]);

  return jobs;
}
