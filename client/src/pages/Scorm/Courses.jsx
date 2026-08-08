import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BookOpen, Search, Users, CheckCircle2, Clock3, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

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
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-5 mb-8">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/35 font-black">Course Management</div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mt-2">Courses</h2>
          <p className="text-white/45 text-sm mt-2 max-w-2xl">Publish, monitor and manage every learning experience from one workspace.</p>
        </div>
        <Link to="/scorm/author" className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-quizmoto-yellow text-[#171126] font-black text-sm">Create new course</Link>
      </div>

      {error && <div className="mb-5 p-4 rounded-2xl border border-red-400/30 bg-red-500/10 text-red-200 text-sm">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          ['Total courses', courses.length, BookOpen, 'text-white'],
          ['Published', courses.filter((c) => c.status === 'published').length, CheckCircle2, 'text-emerald-300'],
          ['Draft', courses.filter((c) => c.status === 'draft').length, Clock3, 'text-amber-300'],
          ['Learners', tracking.courses?.reduce((sum, c) => sum + Number(c.learners || 0), 0) || 0, Users, 'text-blue-300']
        ].map(([label, value, Icon, cls]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 md:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={`text-2xl md:text-3xl font-black ${cls}`}>{value}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.14em] font-black text-white/35">{label}</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/5 grid place-items-center text-white/45"><Icon size={18} /></div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <div className="p-4 border-b border-white/10 flex flex-col md:flex-row gap-3 md:items-center justify-between">
          <div className="relative flex-1 max-w-xl">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search courses or invite code" className="w-full rounded-xl border border-white/10 bg-black/20 pl-9 pr-3 py-2.5 text-sm outline-none focus:border-white/25" />
          </div>
          <div className="flex gap-2">
            {['all', 'published', 'draft'].map((item) => (
              <button key={item} onClick={() => setStatus(item)} className={`px-3 py-2 rounded-xl text-xs font-black capitalize ${status === item ? 'bg-white text-[#111827]' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}>{item}</button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {filtered.length === 0 && <div className="p-10 text-center text-white/35 text-sm">No courses match this view.</div>}
          {filtered.map((course) => {
            const stats = trackingById.get(String(course.id)) || {};
            return (
              <Link key={course.id} to={`/scorm/courses/${course.id}`} className="grid grid-cols-1 lg:grid-cols-[1.5fr_.7fr_.7fr_.7fr_auto] gap-4 items-center p-4 md:p-5 hover:bg-white/[0.035] transition-colors">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-black truncate">{course.title}</h3>
                    <span className={`shrink-0 px-2 py-1 rounded-full text-[9px] uppercase tracking-[0.12em] font-black ${course.status === 'published' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-200'}`}>{course.status}</span>
                  </div>
                  <div className="text-xs text-white/35 mt-1 font-mono">{course.inviteCode || 'No invite code'} · {course.package?.standard || 'SCORM'}</div>
                </div>
                <div>
                  <div className="text-lg font-black">{stats.learners || 0}</div>
                  <div className="text-[9px] uppercase tracking-[0.12em] font-black text-white/30">Learners</div>
                </div>
                <div>
                  <div className="text-lg font-black text-emerald-300">{stats.completed || 0}</div>
                  <div className="text-[9px] uppercase tracking-[0.12em] font-black text-white/30">Completed</div>
                </div>
                <div>
                  <div className="text-lg font-black text-blue-300">{Number(stats.averageProgress || 0).toFixed(0)}%</div>
                  <div className="text-[9px] uppercase tracking-[0.12em] font-black text-white/30">Avg progress</div>
                </div>
                <ChevronRight size={18} className="text-white/25" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}