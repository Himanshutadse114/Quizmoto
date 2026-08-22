import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BookOpen, Search, Users, CheckCircle2, Clock3, ChevronRight, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

const Metric = ({ label, value, icon: Icon }) => (
  <div className="scorm-course-metric rounded-xl border p-4 md:p-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="scorm-display text-2xl md:text-[30px] leading-none">{value}</div>
        <div className="scorm-micro mt-2 text-[9px] uppercase font-bold">{label}</div>
      </div>
      <div className="scorm-course-metric-icon w-9 h-9 rounded-lg border grid place-items-center">
        <Icon size={16} />
      </div>
    </div>
  </div>
);

export default function ScormCourses() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [tracking, setTracking] = useState({ courses: [] });
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return navigate('/login');
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      axios.get(apiUrl('/api/scorm/courses'), { headers }),
      axios.get(apiUrl('/api/scorm/tracking/summary'), { headers }).catch(() => ({ data: { courses: [] } }))
    ])
      .then(([courseRes, trackingRes]) => {
        setCourses(courseRes.data || []);
        setTracking(trackingRes.data || { courses: [] });
      })
      .catch((err) => setError(err.response?.data?.message || err.message));
  }, [token, navigate]);

  const trackingById = useMemo(
    () => new Map((tracking.courses || []).map((row) => [String(row.id), row])),
    [tracking]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses.filter((course) => {
      if (status !== 'all' && course.status !== status) return false;
      if (!q) return true;
      return `${course.title || ''} ${course.description || ''} ${course.inviteCode || ''}`.toLowerCase().includes(q);
    });
  }, [courses, query, status]);

  return (
    <div className="min-h-screen p-4 md:p-7 max-w-[1400px] mx-auto relative z-10 pb-24">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-7">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[.13em] text-slate-500">SCORM AI</div>
          <h1 className="text-3xl md:text-[38px] font-semibold tracking-[-.04em] mt-1">My Courses</h1>
          <p className="text-sm mt-2 max-w-xl text-slate-400">Manage generated and uploaded learning experiences, launch previews and review learner participation.</p>
        </div>
        <Link to="/scorm/author" className="scorm-button-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold"><Plus size={14} /> Create course</Link>
      </div>

      {error && <div className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}

      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        <Metric label="Total courses" value={courses.length} icon={BookOpen} />
        <Metric label="Learners" value={(tracking.courses || []).reduce((sum, row) => sum + Number(row.learners || 0), 0)} icon={Users} />
        <Metric label="Completed" value={(tracking.courses || []).reduce((sum, row) => sum + Number(row.completed || 0), 0)} icon={CheckCircle2} />
      </div>

      <section className="scorm-course-list-shell scorm-panel rounded-3xl border overflow-hidden">
        <div className="scorm-course-toolbar p-4 md:p-5 border-b border-white/10 flex flex-col md:flex-row md:items-center gap-3">
          <label className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search courses" className="scorm-course-search w-full pl-9 pr-3 py-2.5 text-sm rounded-xl" />
          </label>
          <div className="scorm-course-filters flex items-center gap-1 rounded-xl border border-white/10 p-1">
            {['all', 'draft', 'published'].map((value) => (
              <button key={value} type="button" onClick={() => setStatus(value)} className={`scorm-course-filter px-3 py-2 text-xs font-semibold rounded-lg border ${status === value ? 'is-active' : ''}`}>{value[0].toUpperCase() + value.slice(1)}</button>
            ))}
          </div>
        </div>

        <div className="scorm-course-rows divide-y divide-white/10">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">No courses match your current filters.</div>
          ) : filtered.map((course) => {
            const summary = trackingById.get(String(course.id)) || {};
            const completed = Number(summary.completed || 0);
            const learners = Number(summary.learners || 0);
            return (
              <Link key={course.id} to={`/scorm/courses/${course.id}`} className="scorm-course-row grid lg:grid-cols-[minmax(0,1fr)_120px_120px_120px_auto] gap-4 items-center px-4 md:px-5 py-4 transition-colors">
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-white truncate">{course.title || 'Untitled course'}</div>
                  <div className="text-[10px] text-slate-500 mt-1 truncate">{course.description || 'No description'}</div>
                </div>
                <div><div className="text-[9px] uppercase tracking-[.1em] text-slate-600">Learners</div><div className="text-sm font-semibold mt-1">{learners}</div></div>
                <div><div className="text-[9px] uppercase tracking-[.1em] text-slate-600">Completed</div><div className="text-sm font-semibold mt-1">{completed}</div></div>
                <div><div className="text-[9px] uppercase tracking-[.1em] text-slate-600">Status</div><span className={`scorm-course-status mt-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-semibold ${course.status === 'published' ? 'is-published' : 'is-draft'}`}>{course.status === 'published' ? <CheckCircle2 size={10} /> : <Clock3 size={10} />}{course.status || 'draft'}</span></div>
                <ChevronRight size={16} className="text-slate-600" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
