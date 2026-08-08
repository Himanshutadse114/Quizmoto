import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Activity, Search, CheckCircle2, Clock3, CircleDashed, Users, MapPin, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

function progressTone(value) {
  if (value >= 100) return 'bg-emerald-400';
  if (value >= 60) return 'bg-blue-400';
  if (value > 0) return 'bg-amber-400';
  return 'bg-white/15';
}

function statusLabel(row) {
  if (row.progressPercent >= 100) return 'Completed';
  if (row.progressPercent > 0) return 'In progress';
  return 'Not started';
}

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
    const timer = setInterval(load, 20000);
    return () => { mounted = false; clearInterval(timer); };
  }, [token, navigate]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data.learners || []).filter((row) => {
      if (courseId !== 'all' && String(row.courseId) !== String(courseId)) return false;
      if (progressFilter === 'completed' && row.progressPercent < 100) return false;
      if (progressFilter === 'progress' && !(row.progressPercent > 0 && row.progressPercent < 100)) return false;
      if (progressFilter === 'not-started' && row.progressPercent > 0) return false;
      if (!q) return true;
      return `${row.learnerName || ''} ${row.learnerEmail || ''} ${row.courseTitle || ''} ${row.lastLocation || ''}`.toLowerCase().includes(q);
    });
  }, [data.learners, query, courseId, progressFilter]);

  const overview = data.overview || {};

  return (
    <div className="p-4 md:p-8 max-w-[1500px] mx-auto">
      <div className="mb-8">
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/35 font-black">Learning Operations</div>
        <h2 className="text-3xl md:text-4xl font-black tracking-tight mt-2">Learner Tracking</h2>
        <p className="text-white/45 text-sm mt-2 max-w-3xl">See completion percentage, last known course location, score and activity time so you know exactly where a learner stopped.</p>
      </div>

      {error && <div className="mb-5 p-4 rounded-2xl border border-red-400/30 bg-red-500/10 text-red-200 text-sm">{error}</div>}

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-6">
        {[
          ['Learners', overview.learners || 0, Users, 'text-white'],
          ['Completed', overview.completed || 0, CheckCircle2, 'text-emerald-300'],
          ['In progress', overview.inProgress || 0, Clock3, 'text-blue-300'],
          ['Not started', overview.notStarted || 0, CircleDashed, 'text-white/70'],
          ['Avg progress', `${Number(overview.averageProgress || 0).toFixed(0)}%`, Activity, 'text-quizmoto-yellow']
        ].map(([label, value, Icon, cls]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 md:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={`text-2xl md:text-3xl font-black ${cls}`}>{value}</div>
                <div className="mt-1 text-[9px] uppercase tracking-[0.14em] font-black text-white/35">{label}</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/5 grid place-items-center text-white/40"><Icon size={18} /></div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <div className="p-4 border-b border-white/10 grid grid-cols-1 xl:grid-cols-[1fr_auto_auto] gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search learner, course or last location" className="w-full rounded-xl border border-white/10 bg-black/20 pl-9 pr-3 py-2.5 text-sm outline-none focus:border-white/25" />
          </div>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="rounded-xl border border-white/10 bg-[#10182c] px-3 py-2.5 text-xs font-bold text-white/75 outline-none">
            <option value="all">All courses</option>
            {(data.courses || []).map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
          </select>
          <select value={progressFilter} onChange={(e) => setProgressFilter(e.target.value)} className="rounded-xl border border-white/10 bg-[#10182c] px-3 py-2.5 text-xs font-bold text-white/75 outline-none">
            <option value="all">All progress</option>
            <option value="completed">Completed</option>
            <option value="progress">In progress</option>
            <option value="not-started">Not started</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="text-left text-[9px] uppercase tracking-[0.14em] font-black text-white/35 border-b border-white/10">
                <th className="px-4 py-3">Learner</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3 min-w-[220px]">Completion</th>
                <th className="px-4 py-3">Last location</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Last activity</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-white/35">No learners match this view.</td></tr>}
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.025]">
                  <td className="px-4 py-4">
                    <div className="font-black">{row.learnerName || 'Learner'}</div>
                    <div className="text-xs text-white/35 mt-0.5">{row.learnerEmail || 'No email'}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-bold max-w-[220px] truncate">{row.courseTitle || 'Course'}</div>
                    <div className="text-[10px] text-white/30 font-mono mt-0.5">{row.inviteCode || ''}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="text-xs font-black">{Number(row.progressPercent || 0).toFixed(0)}%</span>
                      <span className="text-[9px] uppercase tracking-[0.1em] font-black text-white/35">{statusLabel(row)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className={`h-full rounded-full ${progressTone(row.progressPercent)}`} style={{ width: `${Math.max(0, Math.min(100, row.progressPercent || 0))}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-start gap-2 max-w-[260px]">
                      <MapPin size={14} className="text-white/25 mt-0.5 shrink-0" />
                      <span className="text-xs font-bold text-white/65">{row.lastLocation || 'Not started'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 font-black">{row.lastScoreRaw != null ? row.lastScoreRaw : '—'}</td>
                  <td className="px-4 py-4 font-mono text-xs text-white/55">{row.lastTotalTime || '—'}</td>
                  <td className="px-4 py-4 text-xs text-white/40">{row.lastCommitAt ? new Date(row.lastCommitAt).toLocaleString() : row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '—'}</td>
                  <td className="px-4 py-4">
                    <Link to={`/scorm/courses/${row.courseId}`} className="inline-flex items-center gap-1 text-[10px] font-black text-blue-300 hover:text-blue-200">Open <ExternalLink size={11} /></Link>
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