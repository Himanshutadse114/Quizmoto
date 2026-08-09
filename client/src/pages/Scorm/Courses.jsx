import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BookOpen, Search, Users, CheckCircle2, Clock3, ChevronRight, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

const Metric = ({ label, value, icon: Icon, bg = '#FFFFFF' }) => (
  <div className="rounded-2xl border border-black p-4 md:p-5" style={{ background: bg }}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="scorm-display text-2xl md:text-[30px] leading-none">{value}</div>
        <div className="scorm-micro mt-2 text-[9px] uppercase font-bold text-[#667085]">{label}</div>
      </div>
      <div className="w-9 h-9 rounded-xl bg-[#F8FAFC] border border-black grid place-items-center text-black">
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
    <div className="p-4 md:p-7 lg:p-9 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-7 pb-7 border-b border-black">
        <div className="max-w-3xl">
          <div className="scorm-micro text-[10px] uppercase font-semibold text-[#667085]">Course management</div>
          <h2 className="scorm-display text-[42px] md:text-[56px] mt-2">Courses</h2>
          <p className="text-sm mt-3 leading-relaxed max-w-2xl">Publish, monitor and manage every learning experience from one place.</p>
        </div>
        <Link to="/scorm/author" className="scorm-button-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold">
          <Plus size={15} /> Create course
        </Link>
      </div>

      {error && <div className="mb-5 p-4 rounded-xl border border-black bg-[#FEF3F2] text-black text-sm">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Metric label="Total courses" value={courses.length} icon={BookOpen} />
        <Metric label="Published" value={courses.filter((c) => c.status === 'published').length} icon={CheckCircle2} bg="#ECFDF3" />
        <Metric label="Draft" value={courses.filter((c) => c.status === 'draft').length} icon={Clock3} bg="#F4F3FF" />
        <Metric label="Learners" value={tracking.courses?.reduce((sum, c) => sum + Number(c.learners || 0), 0) || 0} icon={Users} bg="#ECFDFF" />
      </div>

      <div className="border border-black rounded-[22px] overflow-hidden bg-white">
        <div className="p-4 md:p-5 border-b border-black flex flex-col md:flex-row gap-3 md:items-center justify-between bg-[#F8FAFC]">
          <div className="relative flex-1 max-w-xl">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#667085]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search courses or invite code"
              className="w-full pl-9 pr-3 py-2.5 text-sm"
            />
          </div>
          <div className="flex gap-1 rounded-xl bg-[#F2F4F7] p-1 border border-black">
            {['all', 'published', 'draft'].map((item) => (
              <button
                key={item}
                onClick={() => setStatus(item)}
                className={`px-3 py-2 rounded-lg text-[11px] font-semibold capitalize border ${status === item ? 'bg-black text-white border-black' : 'bg-white text-black border-transparent hover:bg-[#F4F3FF]'}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-[#E4E7EC]">
          {filtered.length === 0 && (
            <div className="p-10 text-center">
              <BookOpen size={23} className="mx-auto text-[#667085] mb-3" />
              <div className="text-sm font-semibold text-black">No courses match this view</div>
              <div className="text-xs text-[#667085] mt-1">Try a different search or filter.</div>
            </div>
          )}
          {filtered.map((course) => {
            const stats = trackingById.get(String(course.id)) || {};
            return (
              <Link
                key={course.id}
                to={`/scorm/courses/${course.id}`}
                className="grid grid-cols-1 lg:grid-cols-[1.5fr_.65fr_.65fr_.75fr_auto] gap-4 items-center px-5 md:px-6 py-5 bg-white hover:bg-[#FAFAFF] transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-semibold text-[14px] truncate text-black">{course.title}</h3>
                    <span className={`scorm-micro shrink-0 px-2 py-1 rounded-full text-[8px] uppercase font-semibold border border-black ${course.status === 'published' ? 'bg-[#ECFDF3] text-black' : 'bg-[#F4F3FF] text-black'}`}>{course.status}</span>
                  </div>
                  <div className="scorm-micro text-[9px] text-[#667085] mt-1">{course.inviteCode || 'No invite code'} · {course.package?.standard || 'SCORM'}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-black">{stats.learners || 0}</div>
                  <div className="scorm-micro text-[8px] uppercase text-[#667085] mt-1">Learners</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#12B76A]">{stats.completed || 0}</div>
                  <div className="scorm-micro text-[8px] uppercase text-[#667085] mt-1">Completed</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#635BFF]">{Number(stats.averageProgress || 0).toFixed(0)}%</div>
                  <div className="scorm-micro text-[8px] uppercase text-[#667085] mt-1">Avg progress</div>
                </div>
                <ChevronRight size={17} className="text-[#98A2B3]" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
