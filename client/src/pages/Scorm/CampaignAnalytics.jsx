import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock3,
  Download,
  Search,
  Target,
  Trophy,
  Users,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import LearnerAuditDetail from './LearnerAuditDetail';
import './scormCampaignReporting.css';

function formatDate(value, fallback = '—') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function pct(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number * 10) / 10}%` : '—';
}

function score(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : '—';
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function Metric({ icon: Icon, label, value, hint }) {
  return (
    <div className="campaign-analytics-metric">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="scorm-micro text-[9px] uppercase font-semibold">{label}</div>
          <div className="mt-2 text-xl md:text-2xl font-semibold">{value}</div>
          {hint && <div className="mt-1 text-[10px]" style={{ color: 'var(--scorm-muted)' }}>{hint}</div>}
        </div>
        <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: 'rgba(79,201,191,.10)', color: '#4FC9BF' }}><Icon size={16} /></div>
      </div>
    </div>
  );
}

export default function CampaignAnalytics() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedLearnerEmail, setSelectedLearnerEmail] = useState(null);

  const load = async () => {
    if (!token || !campaignId) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(apiUrl(`/api/scorm/campaigns/${campaignId}/analytics`), { headers });
      setData(res.data || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load campaign analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token, campaignId]);

  const campaign = data?.campaign || null;
  const learners = data?.learners || [];
  const courses = data?.courses || [];
  const filteredLearners = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return learners;
    return learners.filter((learner) => `${learner.learnerName || ''} ${learner.email || ''}`.toLowerCase().includes(q));
  }, [learners, query]);
  const selectedLearner = learners.find((learner) => String(learner.email || '').toLowerCase() === String(selectedLearnerEmail || '').toLowerCase()) || null;

  const exportCsv = () => {
    if (!campaign) return;
    const rows = [[
      'Campaign', 'Learner Name', 'Email', 'Course', 'Result', 'Progress %', 'Score', 'Learning Time', 'Last Activity', 'Questions Captured', 'Correct Answers', 'Answer Accuracy %'
    ]];
    learners.forEach((learner) => {
      if (!learner.entries?.length) {
        rows.push([campaign.name, learner.learnerName, learner.email, '', 'Not Started', 0, '', '', '', 0, 0, '']);
        return;
      }
      learner.entries.forEach((entry) => rows.push([
        campaign.name,
        learner.learnerName,
        learner.email,
        entry.courseTitle,
        entry.result,
        entry.progressPercent ?? '',
        entry.lastScoreRaw ?? '',
        entry.lastTotalTime ?? '',
        entry.lastCommitAt ?? '',
        entry.answerSummary?.captured ?? 0,
        entry.answerSummary?.correct ?? 0,
        entry.answerSummary?.accuracy ?? ''
      ]));
    });
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${String(campaign.name || 'campaign').replace(/[^a-z0-9_-]+/gi, '_')}_analytics.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !data) {
    return <div className="p-12 text-center text-sm" style={{ color: 'var(--scorm-muted)' }}>Loading campaign analytics…</div>;
  }

  return (
    <div className="scorm-campaign-analytics-page p-4 md:p-7 lg:p-9 max-w-7xl mx-auto">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6 pb-6 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
        <div className="flex items-start gap-3 min-w-0">
          <button type="button" onClick={() => navigate('/scorm/assignments')} className="scorm-button-secondary w-10 h-10 grid place-items-center shrink-0" aria-label="Back to campaigns"><ArrowLeft size={16} /></button>
          <div className="min-w-0">
            <div className="scorm-micro text-[9px] uppercase font-semibold">Campaign analytics</div>
            <h1 className="scorm-display text-[28px] md:text-[36px] mt-1 break-words">{campaign?.name || 'Campaign'}</h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: 'var(--scorm-muted)' }}>
              <span>Status: <strong className="capitalize">{campaign?.status || '—'}</strong></span>
              <span>Started: {formatDate(campaign?.startedAt, 'Not started')}</span>
              <span>Due: {formatDate(campaign?.dueAt, 'No due date')}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/scorm/reports" className="scorm-button-secondary px-4 py-2.5 text-xs font-semibold inline-flex items-center gap-2"><BarChart3 size={13} /> All reports</Link>
          <button type="button" onClick={exportCsv} disabled={!campaign} className="scorm-button-primary px-4 py-2.5 text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50"><Download size={13} /> Export CSV</button>
        </div>
      </header>

      {error && <div className="mb-5 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(251,113,133,.35)', background: 'rgba(251,113,133,.08)', color: '#FDA4AF' }}>{error}</div>}

      {campaign?.status === 'draft' && (
        <div className="mb-5 rounded-xl border px-4 py-3 text-xs leading-relaxed" style={{ borderColor: 'rgba(79,201,191,.24)', background: 'rgba(79,201,191,.07)' }}>
          This campaign is still a draft. The CSV learner and course structure is visible now; progress, scores and learner activity will start appearing after the campaign is started.
        </div>
      )}

      {campaign && (
        <>
          <section className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
            <Metric icon={Users} label="Learners" value={campaign.learnerCount ?? 0} hint={`${campaign.learnerStartedCount ?? 0} started`} />
            <Metric icon={BookOpen} label="Courses" value={campaign.courseCount ?? 0} />
            <Metric icon={Target} label="Instances" value={campaign.assignmentCount ?? 0} hint={`${campaign.inProgressCount ?? 0} in progress`} />
            <Metric icon={CheckCircle2} label="Completion" value={pct(campaign.completionRate)} hint={`${campaign.completedCount ?? 0} completed`} />
            <Metric icon={Trophy} label="Average score" value={score(campaign.averageScore)} />
            <Metric icon={BarChart3} label="Answer accuracy" value={pct(campaign.answerAccuracy)} hint={`${campaign.questionsCaptured ?? 0} answers captured`} />
          </section>

          <section className="campaign-analytics-panel mb-6">
            <div className="p-4 md:p-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-3" style={{ borderColor: 'rgba(79,201,191,.12)' }}>
              <div>
                <div className="scorm-micro text-[9px] uppercase">Course breakdown</div>
                <h2 className="text-lg font-semibold mt-1">Performance by course</h2>
              </div>
              <div className="text-[11px]" style={{ color: 'var(--scorm-muted)' }}>{courses.length} selected course{courses.length === 1 ? '' : 's'}</div>
            </div>
            <div className="p-4 md:p-5 grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {courses.length ? courses.map((course) => (
                <div key={course.id} className="campaign-analytics-metric">
                  <div className="text-sm font-semibold line-clamp-2 min-h-[40px]">{course.title}</div>
                  <div className="mt-4 flex items-center justify-between text-[10px]"><span style={{ color: 'var(--scorm-muted)' }}>Completion</span><strong>{pct(course.completionRate)}</strong></div>
                  <div className="campaign-analytics-progress mt-1.5"><span style={{ width: `${Math.max(0, Math.min(100, Number(course.completionRate || 0)))}%` }} /></div>
                  <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                    <div><div className="scorm-micro text-[8px] uppercase">Complete</div><div className="mt-1 text-sm font-semibold">{course.completedCount ?? 0}</div></div>
                    <div><div className="scorm-micro text-[8px] uppercase">In progress</div><div className="mt-1 text-sm font-semibold">{course.inProgressCount ?? 0}</div></div>
                    <div><div className="scorm-micro text-[8px] uppercase">Avg score</div><div className="mt-1 text-sm font-semibold">{score(course.averageScore)}</div></div>
                  </div>
                </div>
              )) : <div className="text-sm" style={{ color: 'var(--scorm-muted)' }}>No courses are attached to this campaign.</div>}
            </div>
          </section>

          <section className="campaign-analytics-table">
            <div className="p-4 md:p-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-3" style={{ borderColor: 'rgba(79,201,191,.12)' }}>
              <div>
                <div className="scorm-micro text-[9px] uppercase">Learner analytics</div>
                <h2 className="text-lg font-semibold mt-1">Learner-level performance</h2>
              </div>
              <div className="relative w-full md:w-[310px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--scorm-muted)' }} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full pl-9 pr-9 py-2.5 text-xs" placeholder="Search learner name or email" />
                {query && <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center"><X size={13} /></button>}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[920px] text-xs reports-table">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left">Learner</th>
                    <th className="px-4 py-3 text-left">Courses</th>
                    <th className="px-4 py-3 text-left">Completion</th>
                    <th className="px-4 py-3 text-left">Average score</th>
                    <th className="px-4 py-3 text-left">Quiz accuracy</th>
                    <th className="px-4 py-3 text-left">Last activity</th>
                    <th className="px-4 py-3 text-right">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLearners.map((learner) => (
                    <tr key={learner.email} className="border-b last:border-b-0">
                      <td className="px-4 py-3.5"><div className="font-semibold">{learner.learnerName || 'Learner'}</div><div className="mt-0.5 text-[10px]" style={{ color: 'var(--scorm-muted)' }}>{learner.email}</div></td>
                      <td className="px-4 py-3.5">{learner.courseCount ?? 0}</td>
                      <td className="px-4 py-3.5 min-w-[150px]"><div className="flex items-center justify-between gap-2"><span>{pct(learner.completionRate)}</span><span className="text-[9px]" style={{ color: 'var(--scorm-muted)' }}>{learner.completedCount}/{learner.assignmentCount}</span></div><div className="campaign-analytics-progress mt-1.5"><span style={{ width: `${Math.max(0, Math.min(100, Number(learner.completionRate || 0)))}%` }} /></div></td>
                      <td className="px-4 py-3.5 font-semibold">{score(learner.averageScore)}</td>
                      <td className="px-4 py-3.5">{pct(learner.answerAccuracy)}</td>
                      <td className="px-4 py-3.5 text-[10px]">{formatDate(learner.latestActivity, 'Not started')}</td>
                      <td className="px-4 py-3.5 text-right"><button type="button" onClick={() => setSelectedLearnerEmail(learner.email)} className="scorm-button-secondary px-3 py-2 text-[10px] font-semibold">View learner</button></td>
                    </tr>
                  ))}
                  {!filteredLearners.length && <tr><td colSpan={7} className="px-4 py-10 text-center" style={{ color: 'var(--scorm-muted)' }}>No learners match this search.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          {selectedLearner && (
            <section className="campaign-analytics-learner-detail mt-6">
              <div className="p-4 md:p-5 border-b flex items-center justify-between gap-3" style={{ borderColor: 'rgba(79,201,191,.12)' }}>
                <div><div className="scorm-micro text-[9px] uppercase">Learner detail</div><h2 className="text-lg font-semibold mt-1">{selectedLearner.learnerName || selectedLearner.email}</h2></div>
                <button type="button" onClick={() => setSelectedLearnerEmail(null)} className="scorm-button-secondary w-9 h-9 grid place-items-center" aria-label="Close learner detail"><X size={14} /></button>
              </div>
              <div className="p-4 md:p-5">
                <LearnerAuditDetail
                  learnerName={selectedLearner.learnerName}
                  learnerEmail={selectedLearner.email}
                  entries={selectedLearner.entries || []}
                  variant="warm"
                />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
