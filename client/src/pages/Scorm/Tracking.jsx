import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Activity, Search, CheckCircle2, Clock3, CircleDashed, Users, MapPin, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

function statusLabel(row) {
  if (!row.progressAvailable) return row.status === 'active' ? 'In progress' : 'Unavailable';
  if (row.progressPercent >= 100) return 'Completed';
  if (row.progressPercent > 0) return 'In progress';
  return 'Not started';
}

const SummaryCard = ({ label, value, icon: Icon, bg = '#FFFFFF' }) => (
  <div className="rounded-2xl border border-black p-4" style={{ background: bg }}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="scorm-display text-2xl leading-none">{value}</div>
        <div className="scorm-micro mt-2 text-[8px] uppercase font-semibold text-[#667085]">{label}</div>
      </div>
      <div className="w-8 h-8 rounded-lg bg-[#F8FAFC] grid place-items-center border border-black text-black">
        <Icon size={15} />
      </div>
    </div>
  </div>
);

export default function ScormTracking() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState({ overview: {}, courses: [], learners: [] });
  const [query, setQuery] = useState('');
  const [courseId, setCourseId] = useState('all');
  const [progressFilter, setProgressFilter] = useState('all');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return navigate('/login');
    const headers = { Authorization: `Bearer ${token}` };
    let mounted = true;
    const load = () => axios.get(apiUrl('/api/scorm/tracking/summary'), { headers })
      .then((res) => mounted && setData(res.data || { overview: {}, courses: [], learners: [] }))
      .catch((err) => mounted && setError(err.response?.data?.message || err.message));
    load();
    const timer = setInterval(load, 12000);
    return () => { mounted = false; clearInterval(timer); };
  }, [token, navigate]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const learners = [...(data.learners || [])].sort((a, b) => {
      const at = new Date(a.lastCommitAt || a.updatedAt || 0).getTime();
      const bt = new Date(b.lastCommitAt || b.updatedAt || 0).getTime();
      return bt - at;
    });

    return learners.filter((row) => {
      if (courseId !== 'all' && String(row.courseId) !== String(courseId)) return false;
      if (progressFilter === 'completed' && !(row.progressAvailable && row.progressPercent >= 100)) return false;
      if (progressFilter === 'progress' && !((row.progressAvailable && row.progressPercent > 0 && row.progressPercent < 100) || (!row.progressAvailable && row.status === 'active'))) return false;
      if (progressFilter === 'not-started' && !(row.progressAvailable && row.progressPercent <= 0 && row.status !== 'active')) return false;
      if (progressFilter === 'unavailable' && row.progressAvailable) return false;
      if (!q) return true;
      return `${row.learnerName || ''} ${row.learnerEmail || ''} ${row.courseTitle || ''} ${row.lastLocation || ''}`.toLowerCase().includes(q);
    });
  }, [data.learners, query, courseId, progressFilter]);

  const overview = data.overview || {};

  return (
    <div className="p-4 md:p-7 lg:p-9 max-w-[1500px] mx-auto">
      <div className="mb-7 pb-7 border-b border-black max-w-4xl">
        <div className="scorm-micro text-[10px] uppercase font-semibold text-[#667085]">Learning operations</div>
        <h2 className="scorm-display text-[42px] md:text-[56px] mt-2">Learner tracking</h2>
        <p className="text-sm mt-3 leading-relaxed max-w-3xl">See completion, attempts, last known course location, score and activity. Admin QA previews are isolated and never appear as learner activity.</p>
      </div>

      {error && <div className="mb-5 p-4 rounded-xl border border-black bg-[#FEF3F2] text-black text-sm">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <SummaryCard label="Learners" value={overview.learners || 0} icon={Users} />
        <SummaryCard label="Completed" value={overview.completed || 0} icon={CheckCircle2} bg="#ECFDF3" />
        <SummaryCard label="In progress" value={overview.inProgress || 0} icon={Clock3} bg="#ECFDFF" />
        <SummaryCard label="Not started" value={overview.notStarted || 0} icon={CircleDashed} />
        <SummaryCard label="Unavailable" value={overview.unavailable || 0} icon={CircleDashed} bg="#FEF3F2" />
        <SummaryCard label="Average progress" value={`${Number(overview.averageProgress || 0).toFixed(0)}%`} icon={Activity} bg="#F4F3FF" />
      </div>

      <div className="border border-black rounded-[22px] overflow-hidden bg-white">
        <div className="p-4 md:p-5 border-b border-black grid grid-cols-1 xl:grid-cols-[1fr_auto_auto] gap-3 bg-[#F8FAFC]">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#667085]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search learner, course or last location"
              className="w-full pl-9 pr-3 py-2.5 text-sm"
            />
          </div>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="px-3 py-2.5 text-xs font-medium min-w-[170px]">
            <option value="all">All courses</option>
            {(data.courses || []).map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
          </select>
          <select value={progressFilter} onChange={(e) => setProgressFilter(e.target.value)} className="px-3 py-2.5 text-xs font-medium min-w-[180px]">
            <option value="all">All learners</option>
            <option value="completed">Completed</option>
            <option value="progress">In progress</option>
            <option value="not-started">Not started</option>
            <option value="unavailable">Progress unavailable</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead>
              <tr className="text-left scorm-micro text-[9px] uppercase font-semibold text-[#667085] border-b border-black bg-[#F8FAFC]">
                <th className="px-5 py-3.5">Learner</th>
                <th className="px-5 py-3.5">Course</th>
                <th className="px-5 py-3.5">Attempts</th>
                <th className="px-5 py-3.5 min-w-[220px]">Completion</th>
                <th className="px-5 py-3.5">Last location</th>
                <th className="px-5 py-3.5">Score</th>
                <th className="px-5 py-3.5">Time</th>
                <th className="px-5 py-3.5">Last activity</th>
                <th className="px-5 py-3.5"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={9} className="p-10 text-center text-[#667085]">No learners match this view.</td></tr>}
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[#E4E7EC] bg-white hover:bg-[#FAFAFF]">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-black">{row.learnerName || 'Learner'}</div>
                    <div className="text-[11px] text-[#667085] mt-0.5">{row.learnerEmail || 'No email'}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-medium max-w-[220px] truncate text-black">{row.courseTitle || 'Course'}</div>
                    <div className="scorm-micro text-[9px] text-[#667085] mt-1">{row.inviteCode || ''}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex min-w-8 h-8 px-2 items-center justify-center rounded-full border border-black bg-[#F4F3FF] text-xs font-black text-black">
                      {Math.max(1, Number(row.attemptCount || 1))}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="text-[11px] font-semibold text-black">{row.progressAvailable ? `${Number(row.progressPercent).toFixed(0)}%` : '—'}</span>
                      <span className="scorm-micro text-[8px] uppercase font-semibold text-[#667085]">{statusLabel(row)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#EAECF0] overflow-hidden">
                      {row.progressAvailable && <div className="h-full bg-[#635BFF]" style={{ width: `${Math.max(0, Math.min(100, row.progressPercent || 0))}%` }} />}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-start gap-2 max-w-[260px]">
                      <MapPin size={13} className="text-[#98A2B3] mt-0.5 shrink-0" />
                      <span className="text-[11px] font-medium text-[#667085]">{row.lastLocation || 'Not started'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-semibold text-black">{row.lastScoreRaw != null ? row.lastScoreRaw : '—'}</td>
                  <td className="px-5 py-4 font-mono text-[11px] text-[#667085]">{row.lastTotalTime || '—'}</td>
                  <td className="px-5 py-4 text-[11px] text-[#667085]">{row.lastCommitAt ? new Date(row.lastCommitAt).toLocaleString() : row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '—'}</td>
                  <td className="px-5 py-4">
                    <Link to={`/scorm/courses/${row.courseId}`} className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#635BFF] hover:text-[#5145CD]">Open <ExternalLink size={11} /></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
