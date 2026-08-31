import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  GraduationCap,
  Search,
  Trophy,
  UserRound,
  Users,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import LearnerAuditDetail from './LearnerAuditDetail';
import './scormCampaignReporting.css';

function formatDate(value, fallback = 'No activity yet') {
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

function safeFilePart(value, fallback = 'learner') {
  return String(value || fallback).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 70);
}

function uniqueLearners(reports) {
  const map = new Map();
  (reports || []).forEach((course) => {
    (course.learners || []).forEach((learner) => {
      const email = String(learner.learnerEmail || '').trim();
      if (!email) return;
      const key = email.toLowerCase();
      const previous = map.get(key) || {
        email,
        name: learner.learnerName || 'Learner',
        courseIds: new Set(),
        latestActivity: null
      };
      previous.courseIds.add(course.id);
      if ((!previous.name || previous.name === 'Learner') && learner.learnerName) previous.name = learner.learnerName;
      const next = learner.lastActivity ? new Date(learner.lastActivity).getTime() : 0;
      const current = previous.latestActivity ? new Date(previous.latestActivity).getTime() : 0;
      if (next > current) previous.latestActivity = learner.lastActivity;
      map.set(key, previous);
    });
  });
  return Array.from(map.values())
    .map((item) => ({
      email: item.email,
      name: item.name,
      courseCount: item.courseIds.size,
      latestActivity: item.latestActivity
    }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

function learnerEntry(course, learner) {
  return {
    ...learner,
    registrationId: learner.id,
    courseId: course.id,
    courseTitle: course.title || 'Course',
    scormStandard: course.scormStandard || learner.scormStandard,
    attemptCount: Math.max(1, Number(learner.attemptCount || 1)),
    lastScoreRaw: learner.score,
    lastTotalTime: learner.totalTime,
    lastLessonStatus: learner.lessonStatus,
    lastCommitAt: learner.lastActivity
  };
}

function completionTone(value) {
  const result = String(value || '').toLowerCase();
  if (['passed', 'completed'].includes(result)) return '#46D6A0';
  if (result === 'failed') return '#FB7185';
  if (result === 'in progress') return '#FBBF24';
  return 'var(--scorm-muted)';
}

async function blobErrorMessage(blob, fallback) {
  try {
    const text = await blob.text();
    const parsed = JSON.parse(text);
    return parsed.message || fallback;
  } catch (_) {
    return fallback;
  }
}

function downloadBlob(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="reports-soft-card rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="scorm-micro text-[8px] uppercase">{label}</div>
          <div className="mt-1.5 text-xl font-semibold">{value}</div>
          {hint && <div className="reports-muted mt-1 text-[10px]">{hint}</div>}
        </div>
        <div className="w-8 h-8 rounded-lg grid place-items-center reports-accent" style={{ background: 'rgba(79,201,191,.10)' }}><Icon size={14} /></div>
      </div>
    </div>
  );
}

export default function ScormReports() {
  const { token, scormAccess } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCourseId, setExpandedCourseId] = useState(null);
  const [expandedCourseLearnerId, setExpandedCourseLearnerId] = useState(null);
  const [downloadingKey, setDownloadingKey] = useState(null);
  const [message, setMessage] = useState('');
  const [learnerQuery, setLearnerQuery] = useState('');
  const [selectedLearner, setSelectedLearner] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!token || !scormAccess) {
      navigate('/login');
      return;
    }
    setLoading(true);
    setMessage('');
    Promise.all([
      axios.get(apiUrl('/api/scorm/courses/reports/all'), { headers: { Authorization: `Bearer ${token}` } }),
      axios.get(apiUrl('/api/scorm/campaigns'), { headers: { Authorization: `Bearer ${token}` } })
    ])
      .then(([courseResponse, campaignResponse]) => {
        setReports(courseResponse.data || []);
        setCampaigns(campaignResponse.data?.campaigns || []);
      })
      .catch((err) => setMessage(err.response?.data?.message || err.message || 'Unable to load reports.'))
      .finally(() => setLoading(false));
  }, [token, scormAccess, navigate]);

  const learners = useMemo(() => uniqueLearners(reports), [reports]);
  const matchingLearners = useMemo(() => {
    const query = learnerQuery.trim().toLowerCase();
    if (!query) return learners.slice(0, 8);
    return learners
      .filter((learner) => learner.email.toLowerCase().includes(query) || String(learner.name || '').toLowerCase().includes(query))
      .slice(0, 8);
  }, [learners, learnerQuery]);

  const selectedLearnerEntries = useMemo(() => {
    if (!selectedLearner?.email) return [];
    const email = selectedLearner.email.trim().toLowerCase();
    return reports.flatMap((course) => (course.learners || [])
      .filter((learner) => String(learner.learnerEmail || '').trim().toLowerCase() === email)
      .map((learner) => learnerEntry(course, learner)));
  }, [reports, selectedLearner]);

  const reportSummary = useMemo(() => {
    const registrations = reports.reduce((sum, course) => sum + Number(course.learnerCount || 0), 0);
    const completed = reports.reduce((sum, course) => sum + Number(course.completedCount || 0), 0);
    const scored = reports.map((course) => Number(course.averageScore)).filter(Number.isFinite);
    return {
      courseCount: reports.length,
      learnerCount: learners.length,
      registrationCount: registrations,
      completionRate: registrations ? Math.round((completed / registrations) * 1000) / 10 : 0,
      averageScore: scored.length ? Math.round((scored.reduce((sum, value) => sum + value, 0) / scored.length) * 100) / 100 : null
    };
  }, [reports, learners]);

  const downloadCourseReport = async (course, format) => {
    if (!course?.id || downloadingKey) return;
    const key = `course-${course.id}-${format}`;
    setDownloadingKey(key);
    setMessage('');
    try {
      const response = await axios.get(apiUrl(`/api/scorm/courses/${course.id}/report?format=${format}`), {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
        validateStatus: () => true
      });
      if (response.status !== 200) {
        setMessage(await blobErrorMessage(response.data, 'Failed to generate course report.'));
        return;
      }
      const extension = format === 'pdf' ? 'pdf' : 'xlsx';
      downloadBlob(response.data, `LMSGEN_${safeFilePart(course.title, 'Course')}.${extension}`);
    } catch (err) {
      setMessage(err.message || 'Course report download failed.');
    } finally {
      setDownloadingKey(null);
    }
  };

  const downloadLearnerReport = async (format) => {
    if (!selectedLearner?.email || downloadingKey) return;
    const key = `learner-${selectedLearner.email}-${format}`;
    setDownloadingKey(key);
    setMessage('');
    try {
      const params = new URLSearchParams({ email: selectedLearner.email, format });
      const response = await axios.get(apiUrl(`/api/scorm/courses/reports/learner?${params.toString()}`), {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
        validateStatus: () => true
      });
      if (response.status !== 200) {
        setMessage(await blobErrorMessage(response.data, 'Failed to generate learner report.'));
        return;
      }
      const extension = format === 'pdf' ? 'pdf' : 'xlsx';
      downloadBlob(response.data, `LMSGEN_Learner_${safeFilePart(selectedLearner.email)}.${extension}`);
    } catch (err) {
      setMessage(err.message || 'Individual learner report download failed.');
    } finally {
      setDownloadingKey(null);
    }
  };

  const chooseLearner = (learner) => {
    setSelectedLearner(learner);
    setLearnerQuery(learner.email);
    setShowSuggestions(false);
  };

  if (loading) {
    return (
      <div className="min-h-[65vh] grid place-items-center">
        <div className="text-center">
          <div className="w-9 h-9 border-2 rounded-full animate-spin mx-auto" style={{ borderColor: 'rgba(79,201,191,.20)', borderTopColor: '#4FC9BF' }} />
          <div className="mt-3 text-xs" style={{ color: 'var(--scorm-muted)' }}>Loading reports…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="scorm-reports-page p-4 md:p-7 lg:p-9 max-w-7xl mx-auto relative z-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 pb-6 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
        <div className="flex items-start gap-3 min-w-0">
          <button type="button" onClick={() => navigate('/scorm')} className="scorm-button-secondary w-10 h-10 grid place-items-center shrink-0" aria-label="Back to dashboard"><ArrowLeft size={16} /></button>
          <div className="min-w-0">
            <div className="scorm-micro reports-accent text-[9px] uppercase font-semibold">Learning evidence</div>
            <h1 className="scorm-display reports-title mt-1">Reports & analytics</h1>
            <p className="reports-muted text-xs mt-2 max-w-2xl">Campaign, course and learner reporting with progress, score, completion, learning time and captured knowledge-check evidence.</p>
          </div>
        </div>
      </header>

      {message && (
        <div className="mb-5 rounded-xl border px-4 py-3 text-sm flex items-start justify-between gap-3" style={{ borderColor: 'rgba(251,113,133,.30)', background: 'rgba(251,113,133,.08)', color: '#FDA4AF' }}>
          <span>{message}</span>
          <button type="button" onClick={() => setMessage('')}><X size={14} /></button>
        </div>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <StatCard icon={BookOpen} label="Courses" value={reportSummary.courseCount} />
        <StatCard icon={Users} label="Learners" value={reportSummary.learnerCount} />
        <StatCard icon={BarChart3} label="Course instances" value={reportSummary.registrationCount} />
        <StatCard icon={CheckCircle2} label="Completion" value={`${reportSummary.completionRate}%`} />
        <StatCard icon={Trophy} label="Average score" value={reportSummary.averageScore ?? '—'} />
      </section>

      <section className="reports-section rounded-2xl border overflow-hidden mb-6">
        <div className="reports-section-header p-4 md:p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="scorm-micro reports-accent text-[9px] uppercase">Campaign reports</div>
            <h2 className="reports-section-title font-semibold mt-1">Campaign performance</h2>
            <p className="reports-muted text-[11px] mt-1">Open a campaign report to see course-level performance and detailed learner analytics.</p>
          </div>
          <div className="reports-muted text-[10px]">{campaigns.length} campaign{campaigns.length === 1 ? '' : 's'}</div>
        </div>
        {campaigns.length ? (
          <div className="divide-y" style={{ borderColor: 'rgba(79,201,191,.10)' }}>
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="p-4 md:p-5 grid lg:grid-cols-[1.2fr_.5fr_.5fr_.65fr_auto] gap-4 lg:items-center">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{campaign.name}</div>
                  <div className="reports-muted text-[10px] mt-1 capitalize">{campaign.status} · {formatDate(campaign.startedAt || campaign.createdAt, 'Not started')}</div>
                </div>
                <div><div className="scorm-micro text-[8px] uppercase">Learners</div><div className="mt-1 text-sm font-semibold">{campaign.learnerCount ?? 0}</div></div>
                <div><div className="scorm-micro text-[8px] uppercase">Courses</div><div className="mt-1 text-sm font-semibold">{campaign.courseCount ?? 0}</div></div>
                <div>
                  <div className="flex items-center justify-between gap-2 text-[9px]"><span className="scorm-micro uppercase">Completion</span><strong>{campaign.completionPercent ?? 0}%</strong></div>
                  <div className="campaign-analytics-progress mt-1.5"><span style={{ width: `${Math.max(0, Math.min(100, Number(campaign.completionPercent || 0)))}%` }} /></div>
                </div>
                <Link to={`/scorm/campaigns/${campaign.id}/analytics`} className="scorm-button-secondary px-4 py-2.5 text-xs font-semibold inline-flex items-center justify-center gap-2"><BarChart3 size={13} /> Open report</Link>
              </div>
            ))}
          </div>
        ) : <div className="p-8 text-center reports-muted text-sm">No campaigns have been created yet.</div>}
      </section>

      <section className="reports-section rounded-2xl border overflow-visible relative z-20 mb-6">
        <div className="reports-section-header p-4 md:p-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl grid place-items-center reports-accent shrink-0" style={{ background: 'rgba(79,201,191,.10)' }}><UserRound size={17} /></div>
            <div>
              <div className="scorm-micro reports-accent text-[9px] uppercase">Individual report</div>
              <h2 className="reports-section-title font-semibold mt-1">Learner analytics</h2>
              <p className="reports-muted text-[11px] mt-1 max-w-2xl">Search a learner to inspect all course results and captured answers, then export the same evidence to PDF or Excel.</p>
            </div>
          </div>
          <div className="reports-muted text-[10px]">{learners.length} reportable learners</div>
        </div>

        <div className="p-4 md:p-5 grid lg:grid-cols-[1fr_auto] gap-3 lg:items-end">
          <div className="relative">
            <label htmlFor="learner-report-search" className="scorm-micro block text-[9px] uppercase font-semibold mb-1.5">Learner name or email</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 reports-muted" />
              <input
                id="learner-report-search"
                type="text"
                value={learnerQuery}
                onFocus={() => setShowSuggestions(true)}
                onChange={(event) => {
                  setLearnerQuery(event.target.value);
                  setSelectedLearner(null);
                  setShowSuggestions(true);
                }}
                placeholder="Search learner@company.com"
                autoComplete="off"
                className="w-full min-h-[42px] pl-9 pr-9 text-xs"
              />
              {learnerQuery && <button type="button" onClick={() => { setLearnerQuery(''); setSelectedLearner(null); setShowSuggestions(true); }} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center"><X size={13} /></button>}
            </div>
            {showSuggestions && (
              <div className="reports-section absolute left-0 right-0 top-full mt-2 rounded-xl border shadow-2xl overflow-hidden z-50 max-h-72 overflow-y-auto">
                {matchingLearners.length ? matchingLearners.map((learner) => (
                  <button type="button" key={learner.email.toLowerCase()} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseLearner(learner)} className="w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-[rgba(79,201,191,.06)] flex items-center justify-between gap-3" style={{ borderColor: 'rgba(79,201,191,.10)' }}>
                    <span className="min-w-0"><span className="block text-xs font-semibold truncate">{learner.name || 'Learner'}</span><span className="reports-muted block mt-0.5 text-[10px] truncate">{learner.email} · {learner.courseCount} course{learner.courseCount === 1 ? '' : 's'}</span></span>
                    <span className="reports-accent text-[9px] font-semibold shrink-0">View</span>
                  </button>
                )) : <div className="p-5 text-center reports-muted text-xs">No learner matches this search.</div>}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={!selectedLearner || !!downloadingKey} onClick={() => downloadLearnerReport('pdf')} className="scorm-button-secondary min-h-[42px] px-4 text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-40"><Download size={13} /> PDF</button>
            <button type="button" disabled={!selectedLearner || !!downloadingKey} onClick={() => downloadLearnerReport('excel')} className="scorm-button-primary min-h-[42px] px-4 text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-40"><FileSpreadsheet size={13} /> Excel</button>
          </div>
        </div>

        {selectedLearner && (
          <div className="px-4 md:px-5 pb-4 md:pb-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><div className="scorm-micro text-[9px] uppercase">Learner detail</div><div className="reports-muted mt-1 text-[10px]">Latest activity {formatDate(selectedLearner.latestActivity)}</div></div>
              <button type="button" onClick={() => { setSelectedLearner(null); setLearnerQuery(''); }} className="scorm-button-secondary px-3 py-2 text-[10px] font-semibold">Close</button>
            </div>
            <LearnerAuditDetail learnerName={selectedLearner.name} learnerEmail={selectedLearner.email} entries={selectedLearnerEntries} variant="warm" />
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="scorm-micro reports-accent text-[9px] uppercase">Course reports</div>
            <h2 className="reports-section-title font-semibold mt-1">Course analytics</h2>
          </div>
          <div className="reports-muted text-[10px]">{reports.length} course{reports.length === 1 ? '' : 's'}</div>
        </div>

        {reports.length ? (
          <div className="space-y-3">
            {reports.map((course) => {
              const expanded = expandedCourseId === course.id;
              const courseLearners = course.learners || [];
              return (
                <article key={course.id} className="reports-course-card rounded-2xl border overflow-hidden">
                  <div className="p-4 md:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl grid place-items-center reports-accent shrink-0" style={{ background: 'rgba(79,201,191,.10)' }}><GraduationCap size={17} /></div>
                      <div className="min-w-0">
                        <Link to={`/scorm/courses/${course.id}`} className="font-semibold text-sm md:text-base truncate block">{course.title || 'Untitled course'}</Link>
                        <div className="reports-muted mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
                          <span className="inline-flex items-center gap-1"><Calendar size={10} />{formatDate(course.publishedAt || course.updatedAt)}</span>
                          <span className="inline-flex items-center gap-1"><Users size={10} />{course.learnerCount ?? 0} learners</span>
                          <span>{course.completionRate != null ? `${course.completionRate}% complete` : 'No completions yet'}</span>
                          {course.averageScore != null && <span>Avg score {course.averageScore}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => downloadCourseReport(course, 'pdf')} disabled={!!downloadingKey} className="scorm-button-secondary px-3 py-2 text-[10px] font-semibold inline-flex items-center gap-1.5"><Download size={12} /> PDF</button>
                      <button type="button" onClick={() => downloadCourseReport(course, 'excel')} disabled={!!downloadingKey} className="scorm-button-secondary px-3 py-2 text-[10px] font-semibold inline-flex items-center gap-1.5"><FileSpreadsheet size={12} /> Excel</button>
                      <button type="button" onClick={() => setExpandedCourseId(expanded ? null : course.id)} className="scorm-button-primary px-3 py-2 text-[10px] font-semibold inline-flex items-center gap-1.5">{expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}{expanded ? 'Hide details' : 'View details'}</button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t p-4 md:p-5" style={{ borderColor: 'rgba(79,201,191,.11)' }}>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                        <StatCard icon={CheckCircle2} label="Completion" value={course.completionRate != null ? `${course.completionRate}%` : '—'} />
                        <StatCard icon={Trophy} label="Average score" value={course.averageScore ?? '—'} />
                        <StatCard icon={CheckCircle2} label="Completed" value={course.completedCount ?? 0} />
                        <StatCard icon={BarChart3} label="In progress" value={course.inProgressCount ?? 0} />
                      </div>

                      <div className="reports-section-title font-semibold mb-3">Learner results</div>
                      {courseLearners.length ? (
                        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'rgba(79,201,191,.12)' }}>
                          <table className="reports-table w-full min-w-[760px] text-xs">
                            <thead className="reports-table-head">
                              <tr className="border-b" style={{ borderColor: 'rgba(79,201,191,.12)' }}>
                                <th className="px-3 py-2.5 text-left">Learner</th>
                                <th className="px-3 py-2.5 text-left">Result</th>
                                <th className="px-3 py-2.5 text-right">Score</th>
                                <th className="px-3 py-2.5 text-right">Progress</th>
                                <th className="px-3 py-2.5 text-right">Time</th>
                                <th className="px-3 py-2.5 text-right">Detail</th>
                              </tr>
                            </thead>
                            <tbody>
                              {courseLearners.map((learner) => {
                                const learnerKey = learner.id || `${course.id}-${learner.learnerEmail || learner.learnerName}`;
                                const open = expandedCourseLearnerId === learnerKey;
                                return (
                                  <React.Fragment key={learnerKey}>
                                    <tr className="border-b last:border-b-0" style={{ borderColor: 'rgba(79,201,191,.09)' }}>
                                      <td className="px-3 py-3"><div className="font-semibold">{learner.learnerName || 'Learner'}</div><div className="reports-muted text-[10px] mt-0.5">{learner.learnerEmail || 'No email'}</div></td>
                                      <td className="px-3 py-3 font-semibold" style={{ color: completionTone(learner.result) }}>{learner.result || 'Not Attempted'}</td>
                                      <td className="px-3 py-3 text-right font-semibold">{learner.score ?? '—'}</td>
                                      <td className="px-3 py-3 text-right">{learner.progressPercent != null ? `${learner.progressPercent}%` : '—'}</td>
                                      <td className="px-3 py-3 text-right">{learner.totalTime || '—'}</td>
                                      <td className="px-3 py-3 text-right"><button type="button" onClick={() => setExpandedCourseLearnerId(open ? null : learnerKey)} className="scorm-button-secondary px-3 py-1.5 text-[9px] font-semibold">{open ? 'Close' : 'View learner'}</button></td>
                                    </tr>
                                    {open && (
                                      <tr><td colSpan={6} className="p-3 md:p-4"><LearnerAuditDetail learnerName={learner.learnerName} learnerEmail={learner.learnerEmail} entries={[learnerEntry(course, learner)]} variant="warm" showIdentity={false} /></td></tr>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : <div className="reports-soft-card rounded-xl border border-dashed p-7 text-center reports-muted text-sm">No learner activity recorded for this course yet.</div>}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="reports-section rounded-2xl border border-dashed p-12 text-center">
            <BookOpen size={30} className="reports-accent mx-auto mb-3" />
            <div className="font-semibold">No course reports yet</div>
            <div className="reports-muted text-xs mt-1">Publish a course and assign learners to see learning evidence here.</div>
          </div>
        )}
      </section>
    </div>
  );
}
