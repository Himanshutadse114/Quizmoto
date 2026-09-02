import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  markCourseGenerationJobNotified,
  publicGenerationError,
  useCourseGenerationJobs
} from '../services/courseGenerationJobs';

function schedulePlatformPrefetch() {
  let cancelled = false;
  let idleId = null;
  let timerId = null;
  let index = 0;

  const loaders = [
    () => import('../pages/Scorm/CourseGenerator'),
    () => import('../pages/Scorm/Courses'),
    () => import('../pages/Scorm/Assignments'),
    () => import('../pages/Scorm/Tracking'),
    () => import('../pages/Scorm/CourseDetail'),
    () => import('../pages/Scorm/Reports'),
    () => import('../pages/Scorm/Library')
  ];

  const scheduleNext = () => {
    if (cancelled || index >= loaders.length) return;
    const run = () => {
      if (cancelled || index >= loaders.length) return;
      const loader = loaders[index++];
      Promise.resolve()
        .then(loader)
        .catch(() => {})
        .finally(() => {
          if (!cancelled) timerId = window.setTimeout(scheduleNext, 180);
        });
    };

    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(run, { timeout: index === 0 ? 2200 : 3500 });
    } else {
      timerId = window.setTimeout(run, index === 0 ? 1200 : 320);
    }
  };

  // Warm high-use LMSGEN route chunks after the current screen has painted, one
  // at a time. Sequential idle prefetch avoids a burst of downloads/parsing that
  // can itself make the dashboard feel sluggish on lower-powered devices.
  scheduleNext();

  return () => {
    cancelled = true;
    if (idleId != null && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleId);
    if (timerId != null) window.clearTimeout(timerId);
  };
}

export default function ScormGenerationNotifier() {
  const { token } = useAuth();
  const jobs = useCourseGenerationJobs(token, { poll: true });
  const [visibleId, setVisibleId] = useState(null);

  const pendingNotice = useMemo(
    () => jobs.find((job) => (job.status === 'ready' || job.status === 'failed') && !job.notifiedAt),
    [jobs]
  );

  useEffect(() => schedulePlatformPrefetch(), []);

  useEffect(() => {
    if (!pendingNotice) return;
    setVisibleId(pendingNotice.id);
    markCourseGenerationJobNotified(pendingNotice.id);
  }, [pendingNotice]);

  const job = jobs.find((item) => item.id === visibleId);
  if (!job || !['ready', 'failed'].includes(job.status)) return null;

  const ready = job.status === 'ready';
  return (
    <div className="scorm-panel fixed bottom-5 right-5 z-[120] w-[min(390px,calc(100vw-2rem))] rounded-2xl border shadow-2xl p-4">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${ready ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}>
          {ready ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{ready ? 'Your course is ready' : 'Course generation failed'}</div>
          <div className="mt-1 text-xs opacity-70 truncate">{job.title || 'Course'}</div>
          {!ready && job.error && <div className="mt-2 text-[11px] leading-relaxed text-rose-400">{publicGenerationError(job.error)}</div>}
          {ready && (
            <div className="mt-3 flex items-center gap-2">
              {job.courseId ? (
                <Link to={`/scorm/courses/${job.courseId}`} className="scorm-button-primary px-3 py-2 text-[11px] font-semibold" onClick={() => setVisibleId(null)}>
                  Open course
                </Link>
              ) : (
                <Link to="/scorm/courses" className="scorm-button-primary px-3 py-2 text-[11px] font-semibold" onClick={() => setVisibleId(null)}>
                  View courses
                </Link>
              )}
            </div>
          )}
        </div>
        <button type="button" className="w-8 h-8 grid place-items-center rounded-lg opacity-60 hover:opacity-100" aria-label="Dismiss notification" onClick={() => setVisibleId(null)}>
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
