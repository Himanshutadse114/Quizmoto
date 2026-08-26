import { useState } from 'react';
import { AlertCircle, Loader2, Square, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  cancelCourseGenerationJob,
  publicGenerationError,
  removeCourseGenerationJob,
  useCourseGenerationJobs
} from '../services/courseGenerationJobs';

export default function BackgroundCourseJobs() {
  const { token } = useAuth();
  const jobs = useCourseGenerationJobs(token, { poll: false });
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [actionError, setActionError] = useState('');
  const active = jobs.filter((job) => ['running', 'queued', 'cancelling'].includes(job.status));
  const failed = jobs.filter((job) => job.status === 'failed').slice(0, 4);
  if (!active.length && !failed.length) return null;

  const setBusy = (id, busy) => {
    setBusyIds((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const stopJob = async (job) => {
    if (!token || !job?.id || busyIds.has(job.id)) return;
    setActionError('');
    setBusy(job.id, true);
    try {
      await cancelCourseGenerationJob(token, job);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not stop this generation. Please try again.');
    } finally {
      setBusy(job.id, false);
    }
  };

  return (
    <section className="scorm-panel rounded-2xl border mb-6 overflow-hidden">
      <div className="px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="scorm-micro text-[9px] uppercase font-semibold">Background creation</div>
          <h3 className="text-[18px] font-semibold mt-1">Creating courses</h3>
          <p className="text-xs mt-1">Course creation continues while you explore other parts of the platform.</p>
        </div>
        {active.length > 0 && <div className="text-[10px] font-semibold text-[#7BDCD3]">{active.length} in progress</div>}
      </div>

      {actionError && (
        <div className="px-5 py-2.5 border-b text-[11px] text-rose-400 bg-rose-500/[.06]">{actionError}</div>
      )}

      <div className="divide-y">
        {active.map((job) => {
          const percent = Math.max(1, Math.min(100, Number(job.percent) || 1));
          const stopping = job.status === 'cancelling' || busyIds.has(job.id);
          return (
            <div key={job.id} className="px-5 py-4 grid md:grid-cols-[1fr_220px_auto] gap-4 items-center">
              <div className="min-w-0 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl border grid place-items-center shrink-0">
                  <Loader2 size={16} className="animate-spin" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{job.title || 'New course'}</div>
                  <div className="text-[11px] mt-1 opacity-70">{stopping ? 'Stopping generation' : (job.stage || 'Creating course')}</div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-[10px] mb-2">
                  <span className="font-semibold">{Math.round(percent)}%</span>
                  <span className="opacity-60">{stopping ? 'Stopping' : 'Running in background'}</span>
                </div>
                <div className="h-2 rounded-full bg-white/[.07] overflow-hidden">
                  <div className="h-full rounded-full bg-[#4FC9BF] transition-[width] duration-500" style={{ width: `${percent}%` }} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => stopJob(job)}
                disabled={stopping}
                className="inline-flex items-center justify-center gap-1.5 min-h-9 px-3 rounded-lg border border-rose-400/30 text-rose-300 hover:bg-rose-500/10 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-semibold"
                title="Stop course generation"
              >
                {stopping ? <Loader2 size={13} className="animate-spin" /> : <Square size={12} />}
                {stopping ? 'Stopping' : 'Stop'}
              </button>
            </div>
          );
        })}

        {failed.map((job) => (
          <div key={job.id} className="px-5 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl border grid place-items-center shrink-0 text-rose-400"><AlertCircle size={16} /></div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm truncate">{job.title || 'Course generation'}</div>
              <div className="text-[11px] mt-1 text-rose-400">{publicGenerationError(job.error)}</div>
            </div>
            <button
              type="button"
              onClick={() => removeCourseGenerationJob(job.id)}
              className="inline-flex items-center justify-center gap-1.5 min-h-9 px-3 rounded-lg border opacity-75 hover:opacity-100 text-[10px] font-semibold"
              title="Remove failed generation"
            >
              <Trash2 size={13} /> Remove
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
