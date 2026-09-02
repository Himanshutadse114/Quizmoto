import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Activity,
  Search,
  CheckCircle2,
  Clock3,
  CircleDashed,
  Users,
  MapPin,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Eye,
  Megaphone,
  TimerReset
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import LearnerAuditDetail from './LearnerAuditDetail';
import { fetchScormData, peekScormData } from '../../services/scormDataCache';

function statusLabel(row) {
  if (!row.progressAvailable) return row.status === 'active' ? 'In progress' : 'Unavailable';
  if (Number(row.progressPercent) >= 100) return 'Completed';
  if (Number(row.progressPercent) > 0) return 'In progress';
  return 'Not started';
}

function statusTone(row) {
  const label = statusLabel(row);
  if (label === 'Completed') return { color: '#86efac', borderColor: 'rgba(74,222,128,.28)', background: 'rgba(74,222,128,.07)' };
  if (label === 'In progress') return { color: '#72D6CD', borderColor: 'rgba(79,201,191,.30)', background: 'rgba(79,201,191,.08)' };
  if (label === 'Unavailable') return { color: '#fda4af', borderColor: 'rgba(251,113,133,.28)', background: 'rgba(251,113,133,.07)' };
  return { color: 'var(--scorm-muted)', borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' };
}

function initials(name, email) {
  const source = String(name || email || 'L').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function shortDate(value) {
  if (!value) return 'No activity';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No activity';
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

const SummaryCard = ({ label, value, icon: Icon, loading = false, accent = false }) => (
  <div className="scorm-panel rounded-xl border p-3.5 md:p-4" style={{ borderColor: 'var(--scorm-line)' }}>
    <div className="flex items-start justify-between gap-3">
      <div>
        {loading ? (
          <div className="h-7 w-12 rounded bg-current/10 animate-pulse" aria-label={`Loading ${label}`} />
        ) : (
          <div className="text-xl md:text-2xl font-semibold tracking-[-.02em]">{value}</div>
        )}
        <div className="scorm-micro mt-1.5 text-[8px] uppercase font-semibold">{label}</div>
      </div>
      <div
        className="w-8 h-8 rounded-lg grid place-items-center border shrink-0"
        style={{
          borderColor: accent ? 'rgba(79,201,191,.28)' : 'var(--scorm-line)',
          background: accent ? 'rgba(79,201,191,.08)' : 'var(--scorm-surface-soft)',
          color: accent ? '#4FC9BF' : 'var(--scorm-ink-soft)'
        }}
      >
        <Icon size={14} />
      </div>
    </div>
  </div>
);

const TrackingSkeletonRow = () => (
  <div className="px-4 py-4 md:px-5 grid lg:grid-cols-[minmax(210px,1.2fr)_minmax(210px,1.15fr)_minmax(210px,.95fr)_80px_135px_40px] gap-4 lg:items-center animate-pulse border-b" style={{ borderColor: 'var(--scorm-line)' }} aria-hidden="true">
    <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-current/10" /><div className="flex-1"><div className="h-3.5 max-w-32 rounded bg-current/10" /><div className="h-2.5 max-w-44 rounded bg-current/10 mt-2" /></div></div>
    <div><div className="h-3.5 max-w-40 rounded bg-current/10" /><div className="h-2.5 max-w-32 rounded bg-current/10 mt-2" /></div>
    <div><div className="h-3 w-14 rounded bg-current/10" /><div className="h-1.5 rounded bg-current/10 mt-2" /></div>
    <div className="h-3 w-8 rounded bg-current/10" />
    <div className="h-3 w-24 rounded bg-current/10" />
    <div className="h-8 w-8 rounded bg-current/10" />
  </div>
);

export default function ScormTracking() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState({ overview: {}, courses: [], learners: [], scope: 'direct_learning' });
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
      setData(cached || { overview: {}, courses: [], learners: [], scope: 'direct_learning' });
      setLoading(false);
    }

    const load = () => fetchScormData(
      'tracking-summary',
      token,
      () => axios.get(apiUrl('/api/scorm/tracking/summary'), { headers }).then((res) => res.data || { overview: {}, courses: [], learners: [], scope: 'direct_learning' })
    )
      .then((next) => {
        if (!mounted) return;
        setData(next || { overview: {}, courses: [], learners: [], scope: 'direct_learning' });
        setError(null);
      })
      .catch((err) => mounted && setError(err.response?.data?.message || err.message))
      .finally(() => mounted && setLoading(false));

    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 15000);
    return () => { mounted = false; window.clearInterval(timer); };
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
      if (progressFilter === 'completed' && !(row.progressAvailable && Number(row.progressPercent) >= 100)) return false;
      if (progressFilter === 'progress' && !((row.progressAvailable && Number(row.progressPercent) > 0 && Number(row.progressPercent) < 100) || (!row.progressAvailable && row.status === 'active'))) return false;
      if (progressFilter === 'not-started' && !(row.progressAvailable && Number(row.progressPercent) <= 0 && row.status !== 'active')) return false;
      if (progressFilter === 'unavailable' && row.progressAvailable) return false;
      if (!q) return true;
      return `${row.learnerName || ''} ${row.learnerEmail || ''} ${row.courseTitle || ''} ${row.lastLocation || ''}`.toLowerCase().includes(q);
    });
  }, [data.learners, query, courseId, progressFilter]);

  const overview = data.overview || {};

  return (
    <div className="scorm-direct-tracking-page p-4 md:p-7 lg:p-8 w-full max-w-none">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-5 mb-5 pb-5 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
        <div className="max-w-3xl">
          <div className="scorm-micro text-[9px] uppercase font-semibold">Learning operations</div>
          <div className="flex flex-wrap items-center gap-3 mt-1.5">
            <h1 className="text-[28px] md:text-[34px] font-semibold tracking-[-.03em]">Learner tracking</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[8px] uppercase tracking-[.08em] font-semibold" style={{ borderColor: 'rgba(79,201,191,.28)', background: 'rgba(79,201,191,.07)', color: '#72D6CD' }}>
              Direct learning only
            </span>
            {analyticsOnly && <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[8px] uppercase tracking-[.08em] font-semibold" style={{ borderColor: 'var(--scorm-line)', color: 'var(--scorm-muted)' }}><Eye size={10} /> Read only</span>}
          </div>
          <p className="text-xs md:text-sm mt-2 leading-relaxed" style={{ color: 'var(--scorm-ink-soft)' }}>
            Track learners who open a published course link or receive a direct course assignment. Campaign learner activity is intentionally kept out of this view and belongs in Campaign Analytics.
          </p>
        </div>
        {!analyticsOnly && (
          <Link to="/scorm/assignments" className="scorm-button-secondary h-10 px-3.5 inline-flex items-center justify-center gap-2 text-xs font-semibold shrink-0">
            <Megaphone size={14} /> Open campaigns
          </Link>
        )}
      </div>

      {error && <div className="mb-5 p-4 rounded-xl border text-sm" style={{ borderColor: 'rgba(251,113,133,.3)', background: 'rgba(251,113,133,.08)', color: '#fda4af' }}>{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        <SummaryCard label="Direct learners" value={overview.learners || 0} icon={Users} loading={loading} accent />
        <SummaryCard label="Completed" value={overview.completed || 0} icon={CheckCircle2} loading={loading} />
        <SummaryCard label="In progress" value={overview.inProgress || 0} icon={Clock3} loading={loading} />
        <SummaryCard label="Not started" value={overview.notStarted || 0} icon={CircleDashed} loading={loading} />
        <SummaryCard label="Unavailable" value={overview.unavailable || 0} icon={CircleDashed} loading={loading} />
        <SummaryCard label="Average progress" value={`${Number(overview.averageProgress || 0).toFixed(0)}%`} icon={Activity} loading={loading} accent />
      </div>

      <section className="scorm-panel rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--scorm-line)' }}>
        <div className="p-4 md:p-5 border-b grid grid-cols-1 xl:grid-cols-[1fr_auto_auto] gap-3" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--scorm-muted)' }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search learner, course or last location" className="w-full pl-9 pr-3 py-2.5 text-xs" />
          </div>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="px-3 py-2.5 text-xs font-medium min-w-[180px]">
            <option value="all">All direct courses</option>
            {(data.courses || []).map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
          </select>
          <select value={progressFilter} onChange={(e) => setProgressFilter(e.target.value)} className="px-3 py-2.5 text-xs font-medium min-w-[180px]">
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="progress">In progress</option>
            <option value="not-started">Not started</option>
            <option value="unavailable">Progress unavailable</option>
          </select>
        </div>

        <div className="hidden lg:grid grid-cols-[minmax(210px,1.2fr)_minmax(210px,1.15fr)_minmax(210px,.95fr)_80px_135px_40px] gap-4 px-5 py-3 border-b scorm-micro text-[8px] uppercase font-semibold" style={{ borderColor: 'var(--scorm-line)', color: 'var(--scorm-muted)' }}>
          <div>Learner</div><div>Course</div><div>Progress</div><div>Score</div><div>Last activity</div><div />
        </div>

        {loading && [0, 1, 2, 3].map((item) => <TrackingSkeletonRow key={item} />)}

        {!loading && rows.length === 0 && (
          <div className="p-10 md:p-12 text-center">
            <Users size={23} className="mx-auto mb-3" style={{ color: 'var(--scorm-muted)' }} />
            <div className="text-sm font-semibold">No direct learner activity in this view</div>
            <div className="text-xs mt-1.5 max-w-xl mx-auto" style={{ color: 'var(--scorm-muted)' }}>
              Campaign learners are not repeated here. Publish a course and share its learner link to see direct activity appear in Learner Tracking.
            </div>
          </div>
        )}

        {!loading && rows.map((row) => {
          const isExpanded = expandedRowId === row.id;
          const attempts = Math.max(0, Number(row.attemptCount || 0));
          const progress = row.progressAvailable ? Math.max(0, Math.min(100, Number(row.progressPercent || 0))) : null;
          const tone = statusTone(row);
          return (
            <React.Fragment key={row.id}>
              <button
                type="button"
                onClick={() => setExpandedRowId(isExpanded ? null : row.id)}
                className="w-full text-left px-4 py-4 md:px-5 grid lg:grid-cols-[minmax(210px,1.2fr)_minmax(210px,1.15fr)_minmax(210px,.95fr)_80px_135px_40px] gap-4 lg:items-center border-b transition hover:bg-[rgba(79,201,191,.035)]"
                style={{ borderColor: 'var(--scorm-line)', background: isExpanded ? 'rgba(79,201,191,.035)' : undefined }}
                aria-expanded={isExpanded}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl border grid place-items-center font-semibold text-xs shrink-0" style={{ borderColor: 'rgba(79,201,191,.22)', background: 'rgba(79,201,191,.07)', color: '#72D6CD' }}>{initials(row.learnerName, row.learnerEmail)}</div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{row.learnerName || 'Learner'}</div>
                    <div className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--scorm-muted)' }}>{row.learnerEmail || 'No email'}</div>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="font-semibold text-[13px] truncate">{row.courseTitle || 'Course'}</div>
                  <div className="mt-1 flex items-start gap-1.5 text-[9px] min-w-0" style={{ color: 'var(--scorm-muted)' }}>
                    <MapPin size={11} className="shrink-0 mt-0.5" />
                    <span className="truncate">{row.lastLocation || 'Not started'}</span>
                  </div>
                  {!analyticsOnly && <Link to={`/scorm/courses/${row.courseId}`} onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-1 mt-1.5 text-[9px] font-semibold" style={{ color: '#72D6CD' }}>Open course <ExternalLink size={9} /></Link>}
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <span className="text-xs font-semibold">{progress == null ? '—' : `${progress.toFixed(0)}%`}</span>
                    <span className="rounded-full border px-2 py-1 text-[7px] uppercase tracking-[.08em] font-semibold" style={tone}>{statusLabel(row)}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--scorm-line)' }}>
                    {progress != null && <div className="h-full rounded-full" style={{ width: `${progress}%`, background: '#4FC9BF' }} />}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px]" style={{ color: 'var(--scorm-muted)' }}>
                    <span className="inline-flex items-center gap-1"><TimerReset size={10} /> {attempts} attempt{attempts === 1 ? '' : 's'}</span>
                    <span>{row.lastTotalTime || 'No learning time'}</span>
                  </div>
                </div>

                <div className="lg:text-center">
                  <div className="scorm-micro lg:hidden text-[8px] uppercase mb-1">Score</div>
                  <div className="text-sm font-semibold">{row.lastScoreRaw != null ? row.lastScoreRaw : '—'}</div>
                </div>

                <div>
                  <div className="scorm-micro lg:hidden text-[8px] uppercase mb-1">Last activity</div>
                  <div className="text-[10px] leading-relaxed" style={{ color: 'var(--scorm-ink-soft)' }}>{shortDate(row.lastCommitAt || row.updatedAt)}</div>
                </div>

                <div className="w-9 h-9 rounded-lg border grid place-items-center lg:justify-self-end" style={{ borderColor: 'var(--scorm-line)', color: 'var(--scorm-ink-soft)' }}>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </button>

              {isExpanded && (
                <div className="p-3 md:p-4 border-b" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>
                  <LearnerAuditDetail learnerName={row.learnerName} learnerEmail={row.learnerEmail} entries={[row]} variant={analyticsOnly ? 'warm' : 'workspace'} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </section>
    </div>
  );
}
