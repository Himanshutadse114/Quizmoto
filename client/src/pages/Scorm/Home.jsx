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

const StatCard = ({ label, value, icon: Icon, bg = '#FFFFFF' }) => (
  <div className="border border-black rounded-2xl p-4 md:p-5" style={{ background: bg }}>
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="scorm-display text-[30px] md:text-[36px] leading-none">{value}</div>
        <div className="scorm-micro mt-3 text-[9px] uppercase font-bold text-[#5A5A4F]">{label}</div>
      </div>
      <div className="w-9 h-9 rounded-xl border border-black bg-[#F8F9EB] grid place-items-center text-black">
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
    <div className="p-4 md:p-7 lg:p-9 max-w-[1440px] mx-auto">
      <section className="border-b border-black pb-7 md:pb-9 mb-6 md:mb-8">
        <div className="scorm-micro text-[10px] uppercase font-bold text-[#5A5A4F] mb-4">Learning operations / Overview</div>
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-7">
          <div className="max-w-4xl">
            <h2 className="scorm-display uppercase text-[44px] sm:text-[56px] lg:text-[68px] xl:text-[76px] leading-[.9]">
              Your learning<br />workspace.
            </h2>
            <p className="mt-5 text-sm md:text-base max-w-2xl text-[#5A5A4F]">
              Create, publish and track learning experiences from one clear operating view.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 xl:pb-1">
            <Link to="/scorm/tracking" className="scorm-button-secondary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold">
              <Activity size={15} /> Learner progress
            </Link>
            <Link to="/scorm/author" className="scorm-button-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold">
              <Sparkles size={15} /> Create course
            </Link>
          </div>
        </div>
      </section>

      {error && (
        <div className="mb-5 p-4 rounded-xl border border-black bg-[#FFC0E6] text-black text-sm">{error}</div>
      )}
      {!aiEnabled && !error && (
        <div className="mb-5 p-4 rounded-xl border border-black bg-[#D3BEFF] text-black text-xs">
          AI Author is currently unavailable. Package upload, delivery and learner tracking are still available.
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-6">
        <StatCard label="Courses" value={courses.length} icon={BookOpen} />
        <StatCard label="Packages" value={packages.length} icon={Package} bg="#AAFDC0" />
        <StatCard label="Learners" value={overview.learners || 0} icon={Users} bg="#D3BEFF" />
        <StatCard label="In progress" value={overview.inProgress || 0} icon={Clock3} bg="#B0F4FF" />
        <StatCard label="Completed" value={overview.completed || 0} icon={CheckCircle2} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.12fr_.88fr] gap-5">
        <section className="border border-black rounded-[22px] bg-white overflow-hidden">
          <div className="px-5 md:px-6 py-5 border-b border-black flex items-center justify-between gap-4 bg-[#F8F9EB]">
            <div>
              <div className="scorm-micro text-[9px] uppercase font-bold text-[#5A5A4F]">Course portfolio</div>
              <h3 className="text-[22px] mt-1">Recent courses</h3>
            </div>
            <Link to="/scorm/courses" className="text-xs font-bold text-black flex items-center gap-1.5 hover:text-[#003D21]">
              View all <ArrowUpRight size={13} />
            </Link>
          </div>

          <div className="divide-y divide-[#EDEEE1]">
            {courses.length === 0 && (
              <div className="p-10 text-center">
                <BookOpen size={24} className="mx-auto text-[#5A5A4F] mb-3" />
                <div className="text-sm font-bold text-black">No courses yet</div>
                <div className="text-xs text-[#5A5A4F] mt-1">Create your first course when you're ready.</div>
              </div>
            )}
            {courses.slice(0, 6).map((course) => {
              const stats = (tracking.courses || []).find((row) => String(row.id) === String(course.id)) || {};
              const progress = Number(stats.averageProgress || 0);
              return (
                <Link
                  key={course.id}
                  to={`/scorm/courses/${course.id}`}
                  className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_92px_140px_auto] gap-4 items-center px-5 md:px-6 py-4 hover:bg-[#AAFDC0] transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-[13px] text-black truncate">{course.title}</div>
                    <div className="scorm-micro text-[9px] text-[#5A5A4F] mt-1">{course.inviteCode || 'No invite code'}</div>
                  </div>
                  <div className="hidden md:block">
                    <div className="font-bold text-sm text-black">{stats.learners || 0}</div>
                    <div className="scorm-micro text-[8px] uppercase text-[#5A5A4F] mt-1">Learners</div>
                  </div>
                  <div className="hidden md:block">
                    <div className="flex items-center justify-between gap-2 text-[10px] text-[#5A5A4F] mb-1.5">
                      <span>Progress</span><span className="font-bold text-black">{progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#EDEEE1] border border-[#C0C2A9] overflow-hidden">
                      <div className="h-full bg-[#003D21]" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
                    </div>
                  </div>
                  <ArrowUpRight size={14} className="text-black" />
                </Link>
              );
            })}
          </div>
        </section>

        <div className="space-y-5">
          <section className="scorm-inverted border border-black rounded-[22px] p-6 md:p-7 min-h-[285px] flex flex-col justify-between">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="scorm-micro text-[9px] uppercase font-bold">Learner pulse</div>
                <h3 className="text-[26px] mt-1">Overall progress</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#AAFDC0] border border-black grid place-items-center text-black"><Activity size={18} /></div>
            </div>
            <div>
              <div className="scorm-display text-[64px] md:text-[76px] leading-none">{averageProgress.toFixed(0)}%</div>
              <div className="mt-2 text-xs">Average completion across active learner sessions.</div>
              <div className="mt-5 h-2.5 rounded-full bg-[#F8F9EB]/30 border border-[#F8F9EB] overflow-hidden">
                <div className="h-full bg-[#AAFDC0]" style={{ width: `${Math.max(0, Math.min(100, averageProgress))}%` }} />
              </div>
            </div>
          </section>

          <section className="border border-black rounded-[22px] bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-black flex items-center justify-between gap-3 bg-[#F8F9EB]">
              <div className="font-bold text-sm text-black">Recent learner activity</div>
              <Link to="/scorm/tracking" className="text-[11px] font-bold text-[#003D21]">Open tracking</Link>
            </div>
            <div className="divide-y divide-[#EDEEE1]">
              {recentLearners.length === 0 && <div className="p-6 text-center text-[#5A5A4F] text-xs">No learner activity yet.</div>}
              {recentLearners.map((row) => (
                <div key={row.id} className="px-5 py-3.5 hover:bg-[#B0F4FF] transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-[12px] text-black truncate">{row.learnerName || 'Learner'}</div>
                      <div className="text-[10px] text-[#5A5A4F] mt-0.5 truncate">{row.courseTitle || 'Course'} · {row.lastLocation || 'Not started'}</div>
                    </div>
                    <div className="text-[12px] font-black text-[#003D21]">{Number(row.progressPercent || 0).toFixed(0)}%</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Link to="/scorm/author" className="border border-black rounded-[22px] bg-[#AAFDC0] p-5 hover:-translate-y-0.5 transition-transform">
          <div className="w-9 h-9 rounded-xl bg-[#F8F9EB] border border-black grid place-items-center text-black"><Sparkles size={17} /></div>
          <div className="font-black text-base mt-5 text-black">AI Author</div>
          <div className="text-xs text-[#5A5A4F] mt-1.5 leading-relaxed">Turn documents into structured learning while keeping editorial control.</div>
        </Link>
        <Link to="/scorm/visual-studio" className="border border-black rounded-[22px] bg-[#D3BEFF] p-5 hover:-translate-y-0.5 transition-transform">
          <div className="w-9 h-9 rounded-xl bg-[#F8F9EB] border border-black grid place-items-center text-black"><Palette size={17} /></div>
          <div className="font-black text-base mt-5 text-black">Visual studio</div>
          <div className="text-xs text-[#5A5A4F] mt-1.5 leading-relaxed">Refine layout, hierarchy and presentation before publishing.</div>
        </Link>
        <Link to="/scorm/reports" className="border border-black rounded-[22px] bg-[#B0F4FF] p-5 hover:-translate-y-0.5 transition-transform">
          <div className="w-9 h-9 rounded-xl bg-[#F8F9EB] border border-black grid place-items-center text-black"><BarChart3 size={17} /></div>
          <div className="font-black text-base mt-5 text-black">Reports</div>
          <div className="text-xs text-[#5A5A4F] mt-1.5 leading-relaxed">Review completion and performance without digging through raw data.</div>
        </Link>
      </div>
    </div>
  );
}
