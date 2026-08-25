import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  markCourseGenerationJobNotified,
  useCourseGenerationJobs
} from '../services/courseGenerationJobs';

export default function ScormGenerationNotifier() {
  const { token } = useAuth();
  const jobs = useCourseGenerationJobs(token, { poll: true });
  const [visibleId, setVisibleId] = useState(null);

  const pendingNotice = useMemo(
    () => jobs.find((job) => (job.status === 'ready' || job.status === 'failed') && !job.notifiedAt),
    [jobs]
  );

  useEffect(() => {
    if (!pendingNotice) return;
    setVisibleId(pendingNotice.id);
    markCourseGenerationJobNotified(pendingNotice.id);
  }, [pendingNotice]);

  const job = jobs.find((item) => item.id === visibleId);
  if (!job || !['ready', 'failed'].includes(job.status)) return null;

  const ready = job.status === 'ready';
  return (
    <div className="fixed bottom-5 right-5 z-[120] w-[min(390px,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-[#07111f] shadow-2xl p-4 text-white">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${ready ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}>
          {ready ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{ready ? 'Your course is ready' : 'Course generation failed'}</div>
          <div className="mt-1 text-xs text-slate-400 truncate">{job.title || 'Course'}</div>
          {!ready && job.error && <div className="mt-2 text-[11px] leading-relaxed text-rose-200/80">{job.error}</div>}
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
        <button type="button" className="w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5" aria-label="Dismiss notification" onClick={() => setVisibleId(null)}>
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
