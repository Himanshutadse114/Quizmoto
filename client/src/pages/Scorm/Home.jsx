import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

export default function ScormHome() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState(null);
  const [aiEnabled, setAiEnabled] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      axios.get(apiUrl('/api/scorm/packages'), { headers }),
      axios.get(apiUrl('/api/scorm/courses'), { headers }),
      axios.get(apiUrl('/api/scorm/features')).catch(() => ({ data: {} }))
    ])
      .then(([p, c, f]) => {
        setPackages(p.data || []);
        setCourses(c.data || []);
        setAiEnabled(!!f.data?.scormAiAuthor);
      })
      .catch((err) => {
        setError(err.response?.data?.message || err.message);
      });
  }, [token, navigate]);

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-5xl mx-auto relative z-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <button onClick={() => navigate('/dashboard')} className="text-sm text-white/60 hover:text-white mb-2">
            ← Back to Live Quiz dashboard
          </button>
          <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter">SCORM World</h1>
          <p className="text-white/60 text-sm font-bold uppercase tracking-widest mt-1">
            Courses · Packages · Invites · Tracking
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/scorm/library"
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 font-bold text-sm border border-white/10"
          >
            Package library
          </Link>
          <Link
            to="/scorm/reports"
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 font-bold text-sm border border-white/10"
          >
            Reports
          </Link>
          <Link
            to="/scorm/author"
            className="px-4 py-2 rounded-xl bg-quizmoto-yellow text-black font-black text-sm shadow-[0_3px_0_0_#b8860b] hover:shadow-none hover:translate-y-0.5 transition-all"
          >
            Create from policy
          </Link>
          <Link
            to="/scorm/library?upload=1"
            className="px-4 py-2 rounded-xl bg-quizmoto-blue font-black text-sm shadow-[0_3px_0_0_#0e4b94] hover:shadow-none hover:translate-y-0.5 transition-all"
          >
            Upload SCORM
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-400/40 text-sm">
          {error}
          {String(error).toLowerCase().includes('not enabled') && (
            <p className="mt-2 opacity-80">Set SCORM_LMS=true on the backend to enable this feature.</p>
          )}
        </div>
      )}

      {!aiEnabled && !error && (
        <div className="mb-6 p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white/50">
          AI author needs <code className="text-white/70">SCORM_AI_AUTHOR=true</code> and{' '}
          <code className="text-white/70">GEMINI_API_KEY</code> on the backend. Upload SCORM still works without AI.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
        <div className="rounded-2xl bg-white/5 p-5 border border-white/10">
          <div className="text-3xl font-black">{packages.length}</div>
          <div className="text-[10px] font-black uppercase tracking-widest text-white/50 mt-1">Packages</div>
        </div>
        <div className="rounded-2xl bg-white/5 p-5 border border-white/10">
          <div className="text-3xl font-black">
            {courses.filter((c) => c.status === 'published').length}
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-white/50 mt-1">Published</div>
        </div>
        <div className="rounded-2xl bg-white/5 p-5 border border-white/10 col-span-2 md:col-span-1">
          <div className="text-3xl font-black">{courses.length}</div>
          <div className="text-[10px] font-black uppercase tracking-widest text-white/50 mt-1">Total courses</div>
        </div>
      </div>

      <h2 className="text-lg font-black mb-3 uppercase tracking-tight">Recent courses</h2>
      <div className="space-y-3 mb-10">
        {courses.length === 0 && (
          <p className="text-white/40 text-sm">No courses yet — upload a package or create from policy.</p>
        )}
        {courses.slice(0, 10).map((c) => (
          <Link
            key={c.id}
            to={`/scorm/courses/${c.id}`}
            className="block rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 p-4 transition-all"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-black text-white">{c.title}</div>
                <div className="text-xs text-white/50 mt-1">
                  Invite: <span className="font-mono text-quizmoto-yellow">{c.inviteCode}</span>
                </div>
              </div>
              <span
                className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                  c.status === 'published'
                    ? 'bg-quizmoto-green/20 text-quizmoto-green'
                    : 'bg-white/10 text-white/50'
                }`}
              >
                {c.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
