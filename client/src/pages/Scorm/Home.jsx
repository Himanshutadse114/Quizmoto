import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  BookOpen,
  Package,
  Users,
  Activity,
  ArrowUpRight,
  Sparkles,
  Palette,
  BarChart3,
  CheckCircle2,
  Clock3
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

const StatCard = ({ label, value, icon: Icon, tint, note }) => (
  <div className={`rounded-2xl border border-[#e1e6e2] p-4 md:p-5 ${tint}`}>
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-[26px] md:text-[30px] leading-none font-semibold tracking-[-0.04em] text-[#26312d]">{value}</div>
        <div className="mt-2 text-[11px] font-semibold text-[#536159]">{label}</div>
        {note && <div className="mt-1 text-[10px] text-[#8a948f]">{note}</div>}
      </div>
      <div className="w-9 h-9 rounded-xl bg-white/70 border border-white grid place-items-center text-[#6e8176]">
        <Icon size={17} strokeWidth={2} />
      </div>
    </div>
  </div>
);

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
  const averageProgress = Number(overview.averageProgress || 0);

  return (
    <div className="p-4 md:p-7 lg:p-8 max-w-[1440px] mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-7">
        <div className="max-w-2xl">
          <div className="text-[11px] font-semibold text-[#829087]">Learning overview</div>
          <h2 className="text-3xl md:text-[38px] font-semibold tracking-[-0.045em] mt-1.5 text-[#26312d]">Your learning workspace</h2>
          <p className="mt-2 text-sm md:text-[15px] leading-relaxed text-[#707a75]">
            Create courses, manage delivery and see learner progress without leaving one workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link to="/scorm/tracking" className="scorm-button-secondary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold">
            <Activity size={15} /> Learner progress
          </Link>
          <Link to="/scorm/author" className="scorm-button-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold">
            <Sparkles size={15} /> Create course
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-5 p-4 rounded-xl border border-[#ead4d1] bg-[#f7eeee] text-[#9e625d] text-sm">{error}</div>
      )}
      {!aiEnabled && !error && (
        <div className="mb-5 p-4 rounded-xl border border-[#e8dcc9] bg-[#f5f0e8] text-[#8e744f] text-xs">
          AI Author is currently unavailable. Package upload, delivery and learner tracking are still available.
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-6">
        <StatCard label="Courses" value={courses.length} icon={BookOpen} tint="bg-[#edf3ef]" note="Learning experiences" />
        <StatCard label="Packages" value={packages.length} icon={Package} tint="bg-[#eef3f7]" note="Ready to deliver" />
        <StatCard label="Learners" value={overview.learners || 0} icon={Users} tint="bg-[#f2eff6]" note="Tracked learners" />
        <StatCard label="In progress" value={overview.inProgress || 0} icon={Clock3} tint="bg-[#f5f0e8]" note="Currently learning" />
        <StatCard label="Completed" value={overview.completed || 0} icon={CheckCircle2} tint="bg-[#edf3ef]" note="Finished courses" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.18fr_.82fr] gap-5">
        <section className="scorm-soft-card overflow-hidden">
          <div className="px-5 md:px-6 py-5 border-b border-[#e1e6e2] flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold text-[#829087]">Course portfolio</div>
              <h3 className="text-[18px] font-semibold mt-0.5 text-[#26312d]">Recent courses</h3>
            </div>
            <Link to="/scorm/courses" className="text-xs font-semibold text-[#607568] hover:text-[#46584e] flex items-center gap-1.5">
              View all <ArrowUpRight size={13} />
            </Link>
          </div>

          <div className="divide-y divide-[#e8ece9]">
            {courses.length === 0 && (
              <div className="p-10 text-center">
                <BookOpen size={24} className="mx-auto text-[#9ba59f] mb-3" />
                <div className="text-sm font-semibold text-[#536159]">No courses yet</div>
                <div className="text-xs text-[#8a948f] mt-1">Create your first course when you're ready.</div>
              </div>
            )}
            {courses.slice(0, 6).map((course) => {
              const stats = (tracking.courses || []).find((row) => String(row.id) === String(course.id)) || {};
              const progress = Number(stats.averageProgress || 0);
              return (
                <Link
                  key={course.id}
                  to={`/scorm/courses/${course.id}`}
                  className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_92px_130px_auto] gap-4 items-center px-5 md:px-6 py-4 hover:bg-[#fafbf9] transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-[13px] text-[#34413b] truncate">{course.title}</div>
                    <div className="text-[10px] text-[#929c97] mt-1 font-mono">{course.inviteCode || 'No invite code'}</div>
                  </div>
                  <div className="hidden md:block">
                    <div className="font-semibold text-sm text-[#405048]">{stats.learners || 0}</div>
                    <div className="text-[9px] text-[#99a29e] mt-0.5">Learners</div>
                  </div>
                  <div className="hidden md:block">
                    <div className="flex items-center justify-between gap-2 text-[10px] text-[#7f8b85] mb-1.5">
                      <span>Progress</span><span className="font-semibold">{progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#edf0ee] overflow-hidden">
                      <div className="h-full rounded-full bg-[#82998c]" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
                    </div>
                  </div>
                  <ArrowUpRight size={14} className="text-[#a1aaa5]" />
                </Link>
              );
            })}
          </div>
        </section>

        <div className="space-y-5">
          <section className="scorm-soft-card p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold text-[#829087]">Learner pulse</div>
                <h3 className="text-[18px] font-semibold mt-0.5">Overall progress</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#edf3ef] grid place-items-center text-[#6d8577]"><Activity size={18} /></div>
            </div>
            <div className="mt-6 flex items-end justify-between gap-4">
              <div className="text-[42px] leading-none font-semibold tracking-[-0.055em] text-[#4d6257]">{averageProgress.toFixed(0)}%</div>
              <div className="text-[11px] text-[#8a948f] pb-1">Average completion</div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-[#edf0ee] overflow-hidden">
              <div className="h-full rounded-full bg-[#7b9285]" style={{ width: `${Math.max(0, Math.min(100, averageProgress))}%` }} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#f5f0e8] px-4 py-3">
                <div className="text-lg font-semibold text-[#7e684a]">{overview.inProgress || 0}</div>
                <div className="text-[10px] text-[#98866d]">In progress</div>
              </div>
              <div className="rounded-xl bg-[#edf3ef] px-4 py-3">
                <div className="text-lg font-semibold text-[#607568]">{overview.completed || 0}</div>
                <div className="text-[10px] text-[#7d8e84]">Completed</div>
              </div>
            </div>
          </section>

          <section className="scorm-soft-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[#e1e6e2] flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-[#34413b]">Recent learner activity</div>
              <Link to="/scorm/tracking" className="text-[11px] font-semibold text-[#6c8276]">Open tracking</Link>
            </div>
            <div className="divide-y divide-[#e8ece9]">
              {recentLearners.length === 0 && <div className="p-6 text-center text-[#929c97] text-xs">No learner activity yet.</div>}
              {recentLearners.map((row) => (
                <div key={row.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-[12px] text-[#405048] truncate">{row.learnerName || 'Learner'}</div>
                      <div className="text-[10px] text-[#929c97] mt-0.5 truncate">{row.courseTitle || 'Course'} · {row.lastLocation || 'Not started'}</div>
                    </div>
                    <div className="text-[12px] font-semibold text-[#6f899b]">{Number(row.progressPercent || 0).toFixed(0)}%</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Link to="/scorm/author" className="scorm-soft-card p-5 hover:border-[#cfd8d2]">
          <div className="w-9 h-9 rounded-xl bg-[#edf3ef] grid place-items-center text-[#6b8275]"><Sparkles size={17} /></div>
          <div className="font-semibold text-sm mt-4 text-[#34413b]">AI Author</div>
          <div className="text-xs text-[#7d8882] mt-1 leading-relaxed">Turn documents into structured learning while keeping full editorial control.</div>
        </Link>
        <Link to="/scorm/visual-studio" className="scorm-soft-card p-5 hover:border-[#d8d1e2]">
          <div className="w-9 h-9 rounded-xl bg-[#f2eff6] grid place-items-center text-[#81759a]"><Palette size={17} /></div>
          <div className="font-semibold text-sm mt-4 text-[#34413b]">Visual studio</div>
          <div className="text-xs text-[#7d8882] mt-1 leading-relaxed">Refine layout, hierarchy and presentation before publishing.</div>
        </Link>
        <Link to="/scorm/reports" className="scorm-soft-card p-5 hover:border-[#d4e0e7]">
          <div className="w-9 h-9 rounded-xl bg-[#eef3f7] grid place-items-center text-[#6f899b]"><BarChart3 size={17} /></div>
          <div className="font-semibold text-sm mt-4 text-[#34413b]">Reports</div>
          <div className="text-xs text-[#7d8882] mt-1 leading-relaxed">Review completion and performance without digging through raw data.</div>
        </Link>
      </div>
    </div>
  );
}
