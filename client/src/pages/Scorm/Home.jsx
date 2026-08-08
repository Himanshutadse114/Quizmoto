import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BookOpen, Package, Users, Activity, ArrowUpRight, Sparkles, Palette, BarChart3, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

export default function ScormHome() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [courses, setCourses] = useState([]);
  const [tracking, setTracking] = useState({ overview: {}, courses: [], learners: [] });
  const [error, setError] = useState(null);
  const [aiEnabled, setAiEnabled] = useState(false);

  useEffect(() => {
    if (!token) return navigate('/login');
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      axios.get(apiUrl('/api/scorm/packages'), { headers }),
      axios.get(apiUrl('/api/scorm/courses'), { headers }),
      axios.get(apiUrl('/api/scorm/tracking/summary'), { headers }).catch(() => ({ data: { overview: {}, courses: [], learners: [] } })),
      axios.get(apiUrl('/api/scorm/features')).catch(() => ({ data: {} }))
    ])
      .then(([p, c, t, f]) => {
        setPackages(p.data || []);
        setCourses(c.data || []);
        setTracking(t.data || { overview: {}, courses: [], learners: [] });
        setAiEnabled(!!f.data?.scormAiAuthor);
      })
      .catch((err) => setError(err.response?.data?.message || err.message));
  }, [token, navigate]);

  const overview = tracking.overview || {};
  const recentLearners = (tracking.learners || []).slice(0, 5);

  return (
    <div className="p-4 md:p-8 max-w-[1500px] mx-auto">
      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_.65fr] gap-5 mb-6">
        <section className="rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,.07),rgba(255,255,255,.025))] p-6 md:p-8 overflow-hidden relative">
          <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full border-[32px] border-quizmoto-yellow/10" />
          <div className="relative max-w-3xl">
            <div className="text-[10px] uppercase tracking-[0.2em] text-quizmoto-yellow font-black">Learning operations</div>
            <h2 className="text-3xl md:text-5xl font-black tracking-[-0.04em] mt-3 leading-[1.02]">Build, deliver and track SCORM learning from one platform.</h2>
            <p className="mt-4 text-white/50 text-sm md:text-base leading-relaxed max-w-2xl">Create visual courses with AI, manage packages, publish learning journeys and monitor exactly where every learner stops.</p>
            <div className="flex flex-wrap gap-3 mt-6">
              <Link to="/scorm/author" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-quizmoto-yellow text-[#171126] font-black text-sm"><Sparkles size={16} /> Create course</Link>
              <Link to="/scorm/tracking" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/8 border border-white/10 text-white font-bold text-sm"><Activity size={16} /> View learner progress</Link>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 flex flex-col justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/30 font-black">Platform health</div>
            <div className="mt-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-400/10 grid place-items-center text-emerald-300"><CheckCircle2 size={20} /></div>
              <div>
                <div className="font-black">Tracking active</div>
                <div className="text-xs text-white/40 mt-0.5">Score, completion, time and location</div>
              </div>
            </div>
          </div>
          <div className="mt-6 pt-5 border-t border-white/10">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-4xl font-black text-quizmoto-yellow">{Number(overview.averageProgress || 0).toFixed(0)}%</div>
                <div className="text-[10px] uppercase tracking-[0.15em] text-white/35 font-black mt-1">Average learner progress</div>
              </div>
              <Activity size={28} className="text-white/15" />
            </div>
          </div>
        </section>
      </div>

      {error && <div className="mb-5 p-4 rounded-2xl border border-red-400/30 bg-red-500/10 text-red-200 text-sm">{error}</div>}
      {!aiEnabled && !error && <div className="mb-5 p-4 rounded-2xl border border-amber-300/20 bg-amber-400/5 text-amber-100/70 text-xs">AI Author is disabled on the backend. Package upload, delivery and tracking remain available.</div>}

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-6">
        {[
          ['Courses', courses.length, BookOpen, 'text-white'],
          ['Packages', packages.length, Package, 'text-white'],
          ['Learners', overview.learners || 0, Users, 'text-blue-300'],
          ['In progress', overview.inProgress || 0, Activity, 'text-amber-300'],
          ['Completed', overview.completed || 0, CheckCircle2, 'text-emerald-300']
        ].map(([label, value, Icon, cls]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={`text-2xl md:text-3xl font-black ${cls}`}>{value}</div>
                <div className="mt-1 text-[9px] uppercase tracking-[0.14em] text-white/35 font-black">{label}</div>
              </div>
              <Icon size={19} className="text-white/20" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_.85fr] gap-5">
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <div className="p-5 border-b border-white/10 flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-black">Course portfolio</div>
              <h3 className="font-black text-lg mt-1">Recent courses</h3>
            </div>
            <Link to="/scorm/courses" className="text-xs font-black text-blue-300 hover:text-blue-200 flex items-center gap-1">View all <ArrowUpRight size={13} /></Link>
          </div>
          <div className="divide-y divide-white/5">
            {courses.length === 0 && <div className="p-8 text-center text-white/35 text-sm">No courses yet.</div>}
            {courses.slice(0, 6).map((course) => {
              const stats = (tracking.courses || []).find((row) => String(row.id) === String(course.id)) || {};
              return (
                <Link key={course.id} to={`/scorm/courses/${course.id}`} className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_100px_100px_auto] gap-4 items-center p-4 md:p-5 hover:bg-white/[0.035] transition-colors">
                  <div className="min-w-0">
                    <div className="font-black truncate">{course.title}</div>
                    <div className="text-[10px] text-white/30 mt-1 font-mono">{course.inviteCode || 'No invite code'}</div>
                  </div>
                  <div className="hidden md:block"><div className="font-black">{stats.learners || 0}</div><div className="text-[9px] uppercase text-white/30 font-black">Learners</div></div>
                  <div className="hidden md:block"><div className="font-black text-blue-300">{Number(stats.averageProgress || 0).toFixed(0)}%</div><div className="text-[9px] uppercase text-white/30 font-black">Progress</div></div>
                  <ArrowUpRight size={15} className="text-white/25" />
                </Link>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <div className="p-5 border-b border-white/10 flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-black">Latest activity</div>
              <h3 className="font-black text-lg mt-1">Learner progress</h3>
            </div>
            <Link to="/scorm/tracking" className="text-xs font-black text-blue-300 hover:text-blue-200">Open tracking</Link>
          </div>
          <div className="divide-y divide-white/5">
            {recentLearners.length === 0 && <div className="p-8 text-center text-white/35 text-sm">No learner activity yet.</div>}
            {recentLearners.map((row) => (
              <div key={row.id} className="p-4 md:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0"><div className="font-black text-sm truncate">{row.learnerName || 'Learner'}</div><div className="text-xs text-white/35 mt-0.5 truncate">{row.courseTitle || 'Course'} · {row.lastLocation || 'Not started'}</div></div>
                  <div className="font-black text-sm text-blue-300">{Number(row.progressPercent || 0).toFixed(0)}%</div>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-blue-400" style={{ width: `${Math.max(0, Math.min(100, row.progressPercent || 0))}%` }} /></div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Link to="/scorm/author" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.06] transition-colors"><Sparkles size={20} className="text-quizmoto-yellow" /><div className="font-black mt-4">AI Author</div><div className="text-xs text-white/40 mt-1">Turn policies and documents into visual SCORM learning.</div></Link>
        <Link to="/scorm/visual-studio" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.06] transition-colors"><Palette size={20} className="text-pink-300" /><div className="font-black mt-4">Visual Studio</div><div className="text-xs text-white/40 mt-1">Refine layouts, visual hierarchy and course presentation.</div></Link>
        <Link to="/scorm/reports" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.06] transition-colors"><BarChart3 size={20} className="text-blue-300" /><div className="font-black mt-4">Reports</div><div className="text-xs text-white/40 mt-1">Export learning performance and completion data.</div></Link>
      </div>
    </div>
  );
}