import { useEffect, useState } from 'react';
import { FileUp, Loader2, Sparkles } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { startBackgroundCourseGeneration } from '../../services/courseGenerationJobs';
import AuthorVisual from './AuthorVisual';

const EDITORIAL_THEME_ID = 1;

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      resolve(value.includes(',') ? value.split(',')[1] : value);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function createProgressId() {
  let random = '';
  try {
    random = globalThis.crypto?.randomUUID?.() || '';
  } catch (_) {}
  if (!random) random = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `scorm-course-${random}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 96);
}

export default function CourseGenerator() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit') || '';
  const token = localStorage.getItem('token');

  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [detailLevel, setDetailLevel] = useState('detailed');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) navigate('/');
  }, [token, navigate]);

  const hasSource = Boolean(file || topic.trim() || description.trim());
  const displayTitle = topic.trim() || file?.name || 'New course';

  if (editId) return <AuthorVisual />;

  const generateCourse = async () => {
    if (!hasSource || busy || !token) return;
    setError('');
    setBusy(true);

    try {
      const progressId = createProgressId();
      const fileBase64 = file ? await toBase64(file) : '';
      startBackgroundCourseGeneration({
        token,
        title: displayTitle,
        payload: {
          progressId,
          topic: topic.trim(),
          description: description.trim(),
          fileBase64,
          mimeType: file?.type || '',
          detailLevel,
          templateId: EDITORIAL_THEME_ID
        }
      });

      navigate('/scorm/courses', {
        state: {
          generationStarted: true,
          progressId,
          title: displayTitle
        }
      });
    } catch (err) {
      setError(err.message || 'Unable to start course generation. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen max-w-[1100px] mx-auto p-4 md:p-7 pb-24 relative">
      <div className="mb-7">
        <div className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">Course Builder</div>
        <h1 className="text-2xl md:text-3xl font-semibold text-white mt-1">Create a course</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-2xl">
          Add a topic, learning goal or source file. Course generation continues in the background, so you can keep using the platform while it is being prepared.
        </p>
      </div>

      {error && <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}

      <section className="scorm-panel rounded-3xl border p-5 md:p-7 max-w-3xl">
        <div className="text-sm font-semibold text-white mb-5">Course source</div>
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[.11em] text-slate-500 font-semibold mb-2">Topic</label>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Phishing Awareness" className="w-full p-3 text-sm rounded-xl" />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[.11em] text-slate-500 font-semibold mb-2">Description or learning goals</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} placeholder="Describe what learners should understand and be able to do after completing the course." className="w-full p-3 text-sm rounded-xl" />
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.025] px-4 py-4 text-sm text-slate-400 cursor-pointer hover:bg-white/[.04] transition-colors">
            <FileUp size={18} className="text-[#7BDCD3]" />
            <div className="min-w-0">
              <div className="font-semibold text-slate-300 truncate">{file ? file.name : 'Upload source file (optional)'}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Use a policy, PDF, presentation or other supported source material.</div>
            </div>
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>

          <div>
            <div className="text-[10px] uppercase tracking-[.11em] text-slate-500 font-semibold mb-2">Course depth</div>
            <div className="flex gap-2 flex-wrap">
              {[
                ['concise', 'Concise'],
                ['detailed', 'Detailed'],
                ['comprehensive', 'Comprehensive']
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDetailLevel(value)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${detailLevel === value ? 'bg-white text-black border-white' : 'border-white/15 text-white/60 hover:text-white'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button type="button" onClick={generateCourse} disabled={busy || !hasSource} className="scorm-button-primary inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold disabled:opacity-50">
              {busy ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
              {busy ? 'Starting…' : 'Generate course'}
            </button>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500 max-w-xl">
              After generation starts, you can browse other areas of the platform. The Courses page will show live progress and you will be notified when the course is ready.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
