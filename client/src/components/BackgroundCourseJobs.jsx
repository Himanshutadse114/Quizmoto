import { AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCourseGenerationJobs } from '../services/courseGenerationJobs';

export default function BackgroundCourseJobs() {
  const { token } = useAuth();
  const jobs = useCourseGenerationJobs(token, { poll: false });
  const active = jobs.filter((job) => job.status === 'running' || job.status === 'queued');
  const failed = jobs.filter((job) => job.status === 'failed').slice(0, 2);
  if (!active.length && !failed.length) return null;

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

      <div className="divide-y">
        {active.map((job) => {
          const percent = Math.max(1, Math.min(100, Number(job.percent) || 1));
          return (
            <div key={job.id} className="px-5 py-4 grid md:grid-cols-[1fr_220px] gap-4 items-center">
              <div className="min-w-0 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl border grid place-items-center shrink-0">
                  <Loader2 size={16} className="animate-spin" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{job.title || 'New course'}</div>
                  <div className="text-[11px] mt-1 opacity-70">{job.stage || 'Creating course'}</div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-[10px] mb-2">
                  <span className="font-semibold">{Math.round(percent)}%</span>
                  <span className="opacity-60">Running in background</span>
                </div>
                <div className="h-2 rounded-full bg-white/[.07] overflow-hidden">
                  <div className="h-full rounded-full bg-[#4FC9BF] transition-[width] duration-500" style={{ width: `${percent}%` }} />
                </div>
              </div>
            </div>
          );
        })}

        {failed.map((job) => (
          <div key={job.id} className="px-5 py-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl border grid place-items-center shrink-0 text-rose-400"><AlertCircle size={16} /></div>
            <div className="min-w-0">
              <div className="font-semibold text-sm">{job.title || 'Course generation'}</div>
              <div className="text-[11px] mt-1 text-rose-400">{job.error || 'Generation failed. Please try again.'}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
