import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BookOpen, Search, Users, CheckCircle2, Clock3, ChevronRight, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

const Metric = ({ label, value, icon: Icon, tint, tone }) => (
  <div className={`rounded-2xl border border-[#e1e6e2] p-4 md:p-5 ${tint}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-2xl md:text-[28px] font-semibold tracking-[-0.04em] text-[#26312d]">{value}</div>
        <div className="mt-1 text-[10px] font-semibold text-[#7d8882]">{label}</div>
      </div>
      <div className="w-9 h-9 rounded-xl bg-white/75 border border-white grid place-items-center" style={{ color: tone }}>
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
    <div className="p-4 md:p-7 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-7">
        <div className="max-w-2xl">
          <div className="text-[11px] font-semibold text-[#829087]">Course management</div>
          <h2 className="text-3xl md:text-[36px] font-semibold tracking-[-0.04em] mt-1.5">Courses</h2>
          <p className="text-sm mt-2 leading-relaxed">Publish, monitor and manage every learning experience from one place.</p>
        </div>
        <Link to="/scorm/author" className="scorm-button-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold">
          <Plus size={15} /> Create course
        </Link>
      </div>

      {error && <div className="mb-5 p-4 rounded-xl border border-[#ead4d1] bg-[#f7eeee] text-[#9e625d] text-sm">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Metric label="Total courses" value={courses.length} icon={BookOpen} tint="bg-[#edf3ef]" tone="#607568" />
        <Metric label="Published" value={courses.filter((c) => c.status === 'published').length} icon={CheckCircle2} tint="bg-[#eef3f7]" tone="#6f899b" />
        <Metric label="Draft" value={courses.filter((c) => c.status === 'draft').length} icon={Clock3} tint="bg-[#f5f0e8]" tone="#987a52" />
        <Metric label="Learners" value={tracking.courses?.reduce((sum, c) => sum + Number(c.learners || 0), 0) || 0} icon={Users} tint="bg-[#f2eff6]" tone="#81759a" />
      </div>

      <div className="scorm-soft-card overflow-hidden">
        <div className="p-4 md:p-5 border-b border-[#e1e6e2] flex flex-col md:flex-row gap-3 md:items-center justify-between bg-[#fbfcfa]">
          <div className="relative flex-1 max-w-xl">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa39f]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search courses or invite code"
              className="w-full pl-9 pr-3 py-2.5 text-sm"
            />
          </div>
          <div className="flex gap-1.5 rounded-xl bg-[#f0f3f0] p-1 border border-[#e4e8e5]">
            {['all', 'published', 'draft'].map((item) => (
              <button
                key={item}
                onClick={() => setStatus(item)}
                className={`px-3 py-2 rounded-lg text-[11px] font-semibold capitalize ${status === item ? 'bg-white text-[#405048] shadow-sm' : 'text-[#7f8a84] hover:text-[#536159]'}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-[#e8ece9]">
          {filtered.length === 0 && (
            <div className="p-10 text-center">
              <BookOpen size={23} className="mx-auto text-[#9ba59f] mb-3" />
              <div className="text-sm font-semibold text-[#536159]">No courses match this view</div>
              <div className="text-xs text-[#929c97] mt-1">Try a different search or filter.</div>
            </div>
          )}
          {filtered.map((course) => {
            const stats = trackingById.get(String(course.id)) || {};
            return (
              <Link
                key={course.id}
                to={`/scorm/courses/${course.id}`}
                className="grid grid-cols-1 lg:grid-cols-[1.5fr_.65fr_.65fr_.75fr_auto] gap-4 items-center px-5 md:px-6 py-4.5 md:py-5 bg-white hover:bg-[#fafbf9] transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-semibold text-[13px] truncate text-[#34413b]">{course.title}</h3>
                    <span className={`shrink-0 px-2 py-1 rounded-full text-[9px] font-semibold ${course.status === 'published' ? 'bg-[#edf3ef] text-[#607568] border border-[#dce8e0]' : 'bg-[#f5f0e8] text-[#987a52] border border-[#e9decc]'}`}>{course.status}</span>
                  </div>
                  <div className="text-[10px] text-[#9aa39f] mt-1 font-mono">{course.inviteCode || 'No invite code'} · {course.package?.standard || 'SCORM'}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#405048]">{stats.learners || 0}</div>
                  <div className="text-[9px] text-[#99a29e] mt-0.5">Learners</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#607568]">{stats.completed || 0}</div>
                  <div className="text-[9px] text-[#99a29e] mt-0.5">Completed</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#6f899b]">{Number(stats.averageProgress || 0).toFixed(0)}%</div>
                  <div className="text-[9px] text-[#99a29e] mt-0.5">Avg progress</div>
                </div>
                <ChevronRight size={17} className="text-[#a6afaa]" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
