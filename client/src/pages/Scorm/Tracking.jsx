import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Activity, Search, CheckCircle2, Clock3, CircleDashed, Users, MapPin, ExternalLink, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import LearnerAuditDetail from './LearnerAuditDetail';
import { fetchScormData, peekScormData } from '../../services/scormDataCache';

function statusLabel(row) {
  if (!row.progressAvailable) return row.status === 'active' ? 'In progress' : 'Unavailable';
  if (row.progressPercent >= 100) return 'Completed';
  if (row.progressPercent > 0) return 'In progress';
  return 'Not started';
}

function initials(name, email) {
  const source = String(name || email || 'L').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

const SummaryCard = ({ label, value, icon: Icon, bg = '#FFFFFF', loading = false }) => (
  <div className="rounded-2xl border border-black p-4" style={{ background: bg }}>
    <div className="flex items-start justify-between gap-3">
      <div>
        {loading ? (
          <div className="h-7 w-12 rounded bg-black/10 animate-pulse" aria-label={`Loading ${label}`} />
        ) : (
          <div className="scorm-display text-2xl leading-none">{value}</div>
        )}
        <div className="scorm-micro mt-2 text-[8px] uppercase font-semibold text-[#667085]">{label}</div>
      </div>
      <div className="w-8 h-8 rounded-lg bg-[#F8FAFC] grid place-items-center border border-black text-black">
        <Icon size={15} />
      </div>
    </div>
  </div>
);

const TrackingSkeletonRow = () => (
  <tr className="border-b border-[#E4E7EC] bg-white animate-pulse" aria-hidden="true">
    <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-black/10" /><div className="w-36"><div className="h-3.5 rounded bg-black/10" /><div className="h-2.5 w-4/5 rounded bg-black/10 mt-2" /></div></div></td>
    <td className="px-5 py-4"><div className="h-3.5 w-36 rounded bg-black/10" /></td>
    <td className="px-5 py-4"><div className="h-7 w-20 rounded bg-black/10" /></td>
    <td className="px-5 py-4"><div className="h-3 w-12 rounded bg-black/10 mb-2" /><div className="h-2 w-36 rounded bg-black/10" /></td>
    <td className="px-5 py-4"><div className="h-3 w-24 rounded bg-black/10" /></td>
    <td className="px-5 py-4"><div className="h-3 w-8 rounded bg-black/10" /></td>
    <td className="px-5 py-4"><div className="h-3 w-16 rounded bg-black/10" /></td>
    <td className="px-5 py-4"><div className="h-3 w-24 rounded bg-black/10" /></td>
    <td className="px-5 py-4"><div className="h-7 w-16 rounded bg-black/10 ml-auto" /></td>
  </tr>
);

export default function ScormTracking() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState({ overview: {}, courses: [], learners: [] });
  const [query, setQuery] = useState('');
  const [courseId, setCourseId] = useState('all');
  const [progressFilter, setProgressFilter] = useState('all');
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const analyticsOnly = user?.role === 'analytics_viewer';

  useEffect(() => {
    if (!token) return navigate('/login');
    const headers = { Authorization: `Bearer ${token}` };
    let mounted = true;

    const cached = peekScormData('tracking-summary', token);
    if (cached) {
      setData(cached || { overview: {}, courses: [], learners: [] });
      setLoading(false);
    }

    const load = () => fetchScormData(
      'tracking-summary',
      token,
      () => axios.get(apiUrl('/api/scorm/tracking/summary'), { headers }).then((res) => res.data || { overview: {}, courses: [], learners: [] })
    )
      .then((next) => {
        if (!mounted) return;
        setData(next || { overview: {}, courses: [], learners: [] });
        setError(null);
      })
      .catch((err) => mounted && setError(err.response?.data?.message || err.message))
      .finally(() => mounted && setLoading(false));

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
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <h2 className="scorm-display text-[42px] md:text-[56px]">Learner tracking</h2>
          {analyticsOnly && <span className="inline-flex items-center gap-1.5 rounded-full border border-black bg-[#F8FAFC] px-2.5 py-1 text-[9px] uppercase tracking-[.08em] font-semibold text-[#475467]"><Eye size={11} /> Read only</span>}
        </div>
        <p className="text-sm mt-3 leading-relaxed max-w-3xl">See completion, attempts, last known course location, score and activity. Select a learner row to inspect attempt history and every captured quiz response.</p>
      </div>

      {error && <div className="mb-5 p-4 rounded-xl border border-black bg-[#FEF3F2] text-black text-sm">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <SummaryCard label="Learners" value={overview.learners || 0} icon={Users} loading={loading} />
        <SummaryCard label="Completed" value={overview.completed || 0} icon={CheckCircle2} bg="#ECFDF3" loading={loading} />
        <SummaryCard label="In progress" value={overview.inProgress || 0} icon={Clock3} bg="#ECFDFF" loading={loading} />
        <SummaryCard label="Not started" value={overview.notStarted || 0} icon={CircleDashed} loading={loading} />
        <SummaryCard label="Unavailable" value={overview.unavailable || 0} icon={CircleDashed} bg="#FEF3F2" loading={loading} />
        <SummaryCard label="Average progress" value={`${Number(overview.averageProgress || 0).toFixed(0)}%`} icon={Activity} bg="#F4F3FF" loading={loading} />
      </div>

      <div className="border border-black rounded-[22px] overflow-hidden bg-white">
        <div className="p-4 md:p-5 border-b border-black grid grid-cols-1 xl:grid-cols-[1fr_auto_auto] gap-3 bg-[#F8FAFC]">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#667085]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search learner, course or last location" className="w-full pl-9 pr-3 py-2.5 text-sm" />
          </div>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="px-3 py-2.5 text-xs font-medium min-w-[170px]">
            <option value="all">All courses</option>
            {(data.courses || []).map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
          </select>
          <select value={progressFilter} onChange={(e) => setProgressFilter(e.target.value)} className="px-3 py-2.5 text-xs font-medium min-w-[180px]">
            <option value="all">All learners</option><option value="completed">Completed</option><option value="progress">In progress</option><option value="not-started">Not started</option><option value="unavailable">Progress unavailable</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="text-left scorm-micro text-[9px] uppercase font-semibold text-[#667085] border-b border-black bg-[#F8FAFC]">
                <th className="px-5 py-3.5 min-w-[230px]">Learner</th><th className="px-5 py-3.5 min-w-[220px]">Course</th><th className="px-5 py-3.5">Attempts</th><th className="px-5 py-3.5 min-w-[190px]">Completion</th><th className="px-5 py-3.5 min-w-[150px]">Last location</th><th className="px-5 py-3.5">Score</th><th className="px-5 py-3.5">Time</th><th className="px-5 py-3.5 min-w-[135px]">Last activity</th><th className="px-5 py-3.5 text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && [0, 1, 2, 3].map((item) => <TrackingSkeletonRow key={item} />)}
              {!loading && rows.length === 0 && <tr><td colSpan={9} className="p-10 text-center text-[#667085]">No learners match this view.</td></tr>}
              {!loading && rows.map((row) => {
                const isExpanded = expandedRowId === row.id;
                return (
                  <React.Fragment key={row.id}>
                    <tr onClick={() => setExpandedRowId(isExpanded ? null : row.id)} className={`border-b border-[#E4E7EC] bg-white hover:bg-[#FAFAFF] cursor-pointer ${isExpanded ? 'bg-[#F7F8FF]' : ''}`}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl border border-[#D0D5DD] bg-[#EEF4FF] text-[#3538CD] grid place-items-center font-black text-xs shrink-0">{initials(row.learnerName, row.learnerEmail)}</div>
                          <div className="min-w-0"><div className="text-[8px] uppercase tracking-[0.1em] font-semibold text-[#98A2B3]">Learner name</div><div className="font-semibold text-black truncate">{row.learnerName || 'Learner'}</div><div className="text-[10px] text-[#667085] mt-0.5 truncate max-w-[190px]">{row.learnerEmail || 'No email'}</div></div>
                        </div>
                      </td>
                      <td className="px-5 py-4"><div className="font-medium max-w-[220px] truncate text-black">{row.courseTitle || 'Course'}</div>{!analyticsOnly && <Link to={`/scorm/courses/${row.courseId}`} onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-[#635BFF] hover:text-[#5145CD]">Open course <ExternalLink size={10} /></Link>}</td>
                      <td className="px-5 py-4"><span className="inline-flex items-center gap-2 rounded-lg border border-[#D0D5DD] bg-[#F8FAFC] px-2.5 py-1.5 text-[#344054]"><span className="text-[9px] uppercase tracking-[0.08em] font-semibold text-[#667085]">Attempts</span><strong className="text-xs text-[#101828]">{Math.max(1, Number(row.attemptCount || 1))}</strong></span></td>
                      <td className="px-5 py-4"><div className="flex items-center justify-between gap-3 mb-2"><span className="text-[12px] font-semibold text-black">{row.progressAvailable ? `${Number(row.progressPercent).toFixed(0)}%` : '—'}</span><span className="rounded-full border border-[#D0D5DD] bg-[#F8FAFC] px-2 py-1 text-[8px] uppercase tracking-[0.08em] font-semibold text-[#667085]">{statusLabel(row)}</span></div><div className="h-2 rounded-full bg-[#EAECF0] overflow-hidden">{row.progressAvailable && <div className="h-full bg-[#635BFF]" style={{ width: `${Math.max(0, Math.min(100, row.progressPercent || 0))}%` }} />}</div></td>
                      <td className="px-5 py-4"><div className="flex items-start gap-2 max-w-[180px]"><MapPin size={13} className="text-[#98A2B3] mt-0.5 shrink-0" /><span className="text-[11px] font-medium text-[#667085] break-words">{row.lastLocation || 'Not started'}</span></div></td>
                      <td className="px-5 py-4 font-semibold text-black">{row.lastScoreRaw != null ? row.lastScoreRaw : '—'}</td>
                      <td className="px-5 py-4 font-mono text-[11px] text-[#667085]">{row.lastTotalTime || '—'}</td>
                      <td className="px-5 py-4 text-[11px] leading-relaxed text-[#667085]">{row.lastCommitAt ? new Date(row.lastCommitAt).toLocaleString() : row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '—'}</td>
                      <td className="px-5 py-4 text-right"><button type="button" onClick={(event) => { event.stopPropagation(); setExpandedRowId(isExpanded ? null : row.id); }} className="inline-flex items-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-2.5 py-1.5 text-[10px] font-semibold text-[#344054] hover:bg-[#F9FAFB]" aria-expanded={isExpanded}>{isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}{isExpanded ? 'Hide' : 'View'}</button></td>
                    </tr>
                    {isExpanded && <tr className="bg-[#050B14] border-b border-[#243751]"><td colSpan={9} className="p-3 md:p-4"><LearnerAuditDetail learnerName={row.learnerName} learnerEmail={row.learnerEmail} entries={[row]} variant={analyticsOnly ? 'warm' : 'workspace'} /></td></tr>}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
