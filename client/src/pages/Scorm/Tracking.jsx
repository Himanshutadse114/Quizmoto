import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Activity, Search, CheckCircle2, Clock3, CircleDashed, Users, MapPin, ExternalLink, Eye } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

function progressTone(value) {
  if (value >= 100) return 'bg-[#7b9285]';
  if (value >= 60) return 'bg-[#829daf]';
  if (value > 0) return 'bg-[#b39368]';
  return 'bg-[#dfe5e1]';
}

function statusLabel(row) {
  if (row.isPreview) {
    if (row.progressAvailable && row.progressPercent >= 100) return 'Preview complete';
    if (row.progressAvailable && row.progressPercent > 0) return 'Preview in progress';
    return 'Preview';
  }
  if (!row.progressAvailable) return row.status === 'active' ? 'In progress' : 'Unavailable';
  if (row.progressPercent >= 100) return 'Completed';
  if (row.progressPercent > 0) return 'In progress';
  return 'Not started';
}

const SummaryCard = ({ label, value, icon: Icon, tint, tone = '#607568' }) => (
  <div className={`rounded-2xl border border-[#e1e6e2] p-4 ${tint}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-2xl font-semibold tracking-[-0.04em] text-[#26312d]">{value}</div>
        <div className="mt-1 text-[10px] font-semibold text-[#78837d]">{label}</div>
      </div>
      <div className="w-8 h-8 rounded-lg bg-white/75 grid place-items-center border border-white" style={{ color: tone }}>
        <Icon size={15} />
      </div>
    </div>
  </div>
);

export default function ScormTracking() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState({ overview: {}, courses: [], learners: [], previews: [] });
  const [query, setQuery] = useState('');
  const [courseId, setCourseId] = useState('all');
  const [progressFilter, setProgressFilter] = useState('all');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return navigate('/login');
    const headers = { Authorization: `Bearer ${token}` };
    let mounted = true;
    const load = () => axios.get(apiUrl('/api/scorm/tracking/summary'), { headers })
      .then((res) => mounted && setData(res.data || { overview: {}, courses: [], learners: [], previews: [] }))
      .catch((err) => mounted && setError(err.response?.data?.message || err.message));
    load();
    const timer = setInterval(load, 12000);
    return () => { mounted = false; clearInterval(timer); };
  }, [token, navigate]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const combined = [...(data.learners || []), ...(data.previews || [])].sort((a, b) => {
      const at = new Date(a.lastCommitAt || a.updatedAt || 0).getTime();
      const bt = new Date(b.lastCommitAt || b.updatedAt || 0).getTime();
      return bt - at;
    });

    return combined.filter((row) => {
      if (courseId !== 'all' && String(row.courseId) !== String(courseId)) return false;
      if (progressFilter === 'preview' && !row.isPreview) return false;
      if (progressFilter === 'completed' && !(row.progressAvailable && row.progressPercent >= 100 && !row.isPreview)) return false;
      if (progressFilter === 'progress' && !(!row.isPreview && ((row.progressAvailable && row.progressPercent > 0 && row.progressPercent < 100) || (!row.progressAvailable && row.status === 'active')))) return false;
      if (progressFilter === 'not-started' && !(!row.isPreview && row.progressAvailable && row.progressPercent <= 0 && row.status !== 'active')) return false;
      if (progressFilter === 'unavailable' && (row.progressAvailable || row.isPreview)) return false;
      if (!q) return true;
      return `${row.learnerName || ''} ${row.learnerEmail || ''} ${row.courseTitle || ''} ${row.lastLocation || ''}`.toLowerCase().includes(q);
    });
  }, [data.learners, data.previews, query, courseId, progressFilter]);

  const overview = data.overview || {};

  return (
    <div className="p-4 md:p-7 lg:p-8 max-w-[1500px] mx-auto">
      <div className="mb-7 max-w-3xl">
        <div className="text-[11px] font-semibold text-[#829087]">Learning operations</div>
        <h2 className="text-3xl md:text-[36px] font-semibold tracking-[-0.04em] mt-1.5">Learner tracking</h2>
        <p className="text-sm mt-2 leading-relaxed">See completion, last known course location, score and activity. Preview sessions stay visible for QA but are kept out of learner statistics.</p>
      </div>

      {error && <div className="mb-5 p-4 rounded-xl border border-[#ead4d1] bg-[#f7eeee] text-[#9e625d] text-sm">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
        <SummaryCard label="Learners" value={overview.learners || 0} icon={Users} tint="bg-[#edf3ef]" />
        <SummaryCard label="Previews" value={overview.previewSessions || 0} icon={Eye} tint="bg-[#f2eff6]" tone="#81759a" />
        <SummaryCard label="Completed" value={overview.completed || 0} icon={CheckCircle2} tint="bg-[#edf3ef]" />
        <SummaryCard label="In progress" value={overview.inProgress || 0} icon={Clock3} tint="bg-[#eef3f7]" tone="#6f899b" />
        <SummaryCard label="Not started" value={overview.notStarted || 0} icon={CircleDashed} tint="bg-white" tone="#8c9691" />
        <SummaryCard label="Unavailable" value={overview.unavailable || 0} icon={CircleDashed} tint="bg-[#f7eeee]" tone="#a86963" />
        <SummaryCard label="Average progress" value={`${Number(overview.averageProgress || 0).toFixed(0)}%`} icon={Activity} tint="bg-[#f5f0e8]" tone="#987a52" />
      </div>

      <div className="scorm-soft-card overflow-hidden">
        <div className="p-4 md:p-5 border-b border-[#e1e6e2] grid grid-cols-1 xl:grid-cols-[1fr_auto_auto] gap-3 bg-[#fbfcfa]">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa39f]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search learner, preview, course or last location"
              className="w-full pl-9 pr-3 py-2.5 text-sm"
            />
          </div>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="px-3 py-2.5 text-xs font-medium min-w-[170px]">
            <option value="all">All courses</option>
            {(data.courses || []).map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
          </select>
          <select value={progressFilter} onChange={(e) => setProgressFilter(e.target.value)} className="px-3 py-2.5 text-xs font-medium min-w-[180px]">
            <option value="all">All sessions</option>
            <option value="preview">Host previews</option>
            <option value="completed">Completed learners</option>
            <option value="progress">Learners in progress</option>
            <option value="not-started">Not started</option>
            <option value="unavailable">Progress unavailable</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="text-left text-[10px] font-semibold text-[#7f8a84] border-b border-[#e1e6e2] bg-[#f7f9f6]">
                <th className="px-5 py-3.5">Learner / preview</th>
                <th className="px-5 py-3.5">Course</th>
                <th className="px-5 py-3.5 min-w-[220px]">Completion</th>
                <th className="px-5 py-3.5">Last location</th>
                <th className="px-5 py-3.5">Score</th>
                <th className="px-5 py-3.5">Time</th>
                <th className="px-5 py-3.5">Last activity</th>
                <th className="px-5 py-3.5"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-[#929c97]">No sessions match this view.</td></tr>}
              {rows.map((row) => (
                <tr key={row.id} className={`border-b border-[#edf0ee] ${row.isPreview ? 'bg-[#fbf9fd]' : 'bg-white'} hover:bg-[#fafbf9]`}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-[#34413b]">{row.learnerName || (row.isPreview ? 'Host Preview' : 'Learner')}</div>
                      {row.isPreview && <span className="rounded-full bg-[#f2eff6] border border-[#e3ddec] px-2 py-0.5 text-[8px] tracking-[0.08em] font-semibold text-[#81759a]">PREVIEW</span>}
                    </div>
                    <div className="text-[11px] text-[#929c97] mt-0.5">{row.learnerEmail || (row.isPreview ? 'Host QA session' : 'No email')}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-medium max-w-[220px] truncate text-[#405048]">{row.courseTitle || 'Course'}</div>
                    <div className="text-[10px] text-[#9aa39f] font-mono mt-0.5">{row.inviteCode || ''}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="text-[11px] font-semibold text-[#405048]">{row.progressAvailable ? `${Number(row.progressPercent).toFixed(0)}%` : '—'}</span>
                      <span className="text-[9px] font-medium text-[#8a948f]">{statusLabel(row)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#edf0ee] overflow-hidden">
                      {row.progressAvailable && <div className={`h-full rounded-full ${progressTone(row.progressPercent)}`} style={{ width: `${Math.max(0, Math.min(100, row.progressPercent || 0))}%` }} />}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-start gap-2 max-w-[260px]">
                      <MapPin size={13} className="text-[#9aa39f] mt-0.5 shrink-0" />
                      <span className="text-[11px] font-medium text-[#66716b]">{row.lastLocation || 'Not started'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-semibold text-[#536159]">{row.lastScoreRaw != null ? row.lastScoreRaw : '—'}</td>
                  <td className="px-5 py-4 font-mono text-[11px] text-[#707a75]">{row.lastTotalTime || '—'}</td>
                  <td className="px-5 py-4 text-[11px] text-[#7f8a84]">{row.lastCommitAt ? new Date(row.lastCommitAt).toLocaleString() : row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '—'}</td>
                  <td className="px-5 py-4">
                    <Link to={`/scorm/courses/${row.courseId}`} className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#6f899b] hover:text-[#506d7f]">Open <ExternalLink size={11} /></Link>
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
