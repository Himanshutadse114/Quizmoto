import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft,
  BookOpenCheck,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FileSpreadsheet,
  GraduationCap,
  Mail,
  Search,
  UserRound,
  Users,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

function statusTextClass(result) {
  const key = String(result || '').toLowerCase();
  if (key === 'passed' || key === 'completed' || key === 'correct') return 'text-green-400';
  if (key === 'failed' || key === 'incorrect') return 'text-red-400';
  if (key === 'in progress') return 'text-quizmoto-yellow';
  return 'text-white/45';
}

function formatDate(value) {
  if (!value) return 'No activity yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
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

function AnswerEvidence({ learner }) {
  const rows = Array.isArray(learner.interactions) ? learner.interactions : [];
  const summary = learner.answerSummary || {};

  if (!rows.length) {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-[#514437] bg-[#151310] px-3 py-3 text-[11px] leading-relaxed text-[#947e63]">
        Question-level answers were not captured for this attempt. Historical attempts can still show score, status, progress and learning time.
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-[#4b3f33] bg-[#14120f] overflow-hidden">
      <div className="px-3 py-2.5 border-b border-[#40362c] flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-[#b59a76]">Knowledge-check evidence</div>
          <div className="mt-1 text-xs text-[#eee4cf]">
            {summary.captured ?? rows.length} captured · {summary.correct ?? 0} correct
            {summary.accuracy != null ? ` · ${summary.accuracy}% accuracy` : ''}
          </div>
        </div>
      </div>
      <div className="divide-y divide-[#332c24]">
        {rows.map((item, index) => (
          <div key={`${learner.id || 'learner'}-answer-${index}`} className="px-3 py-3 grid gap-2">
            <div className="text-xs font-semibold text-[#f1e8d4]">
              <span className="text-[#ff8a1f] mr-1.5">{String(index + 1).padStart(2, '0')}</span>
              {item.question || `Question ${index + 1}`}
            </div>
            <div className="grid md:grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg border border-[#3e352c] bg-[#1b1814] p-2.5">
                <div className="text-[9px] uppercase tracking-wider text-[#8c765d] mb-1">Learner answer</div>
                <div className={`font-semibold ${statusTextClass(item.result)}`}>{item.selectedAnswer || '—'}</div>
              </div>
              <div className="rounded-lg border border-[#3e352c] bg-[#1b1814] p-2.5">
                <div className="text-[9px] uppercase tracking-wider text-[#8c765d] mb-1">Correct answer</div>
                <div className="font-semibold text-[#d8cfbc]">{item.correctAnswer || '—'}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className={`font-bold uppercase tracking-wider ${statusTextClass(item.result)}`}>{item.result || 'Recorded'}</span>
              {item.explanation && <span className="text-[#8f7b61] leading-relaxed">· {item.explanation}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ScormReports() {
  const { token, scormAccess } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedLearnerId, setExpandedLearnerId] = useState(null);
  const [downloadingKey, setDownloadingKey] = useState(null);
  const [msg, setMsg] = useState(null);
  const [learnerQuery, setLearnerQuery] = useState('');
  const [selectedLearner, setSelectedLearner] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!token || !scormAccess) {
      navigate('/scorm/login');
      return;
    }

    axios
      .get(apiUrl('/api/scorm/courses/reports/all'), {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((r) => setReports(r.data || []))
      .catch((err) => setMsg(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  }, [token, scormAccess, navigate]);

  const learners = useMemo(() => uniqueLearners(reports), [reports]);
  const matchingLearners = useMemo(() => {
    const q = learnerQuery.trim().toLowerCase();
    if (!q) return learners.slice(0, 8);
    return learners
      .filter((learner) => learner.email.toLowerCase().includes(q) || String(learner.name || '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [learners, learnerQuery]);

  const downloadCourseReport = async (course, format) => {
    if (!course?.id || downloadingKey) return;
    const key = `course-${course.id}-${format}`;
    setDownloadingKey(key);
    setMsg(null);
    try {
      const res = await axios.get(apiUrl(`/api/scorm/courses/${course.id}/report?format=${format}`), {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
        validateStatus: () => true
      });
      if (res.status !== 200) {
        setMsg(await blobErrorMessage(res.data, 'Failed to generate course report'));
        return;
      }
      const ext = format === 'pdf' ? 'pdf' : 'xlsx';
      downloadBlob(res.data, `SCORM_AI_${safeFilePart(course.title, 'Course')}.${ext}`);
    } catch (err) {
      setMsg(err.message || 'Course report download failed');
    } finally {
      setDownloadingKey(null);
    }
  };

  const downloadLearnerReport = async (format) => {
    if (!selectedLearner?.email || downloadingKey) return;
    const key = `learner-${selectedLearner.email}-${format}`;
    setDownloadingKey(key);
    setMsg(null);
    try {
      const params = new URLSearchParams({ email: selectedLearner.email, format });
      const res = await axios.get(apiUrl(`/api/scorm/courses/reports/learner?${params.toString()}`), {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
        validateStatus: () => true
      });
      if (res.status !== 200) {
        setMsg(await blobErrorMessage(res.data, 'Failed to generate individual learner report'));
        return;
      }
      const ext = format === 'pdf' ? 'pdf' : 'xlsx';
      downloadBlob(res.data, `SCORM_AI_Learner_${safeFilePart(selectedLearner.email)}.${ext}`);
    } catch (err) {
      setMsg(err.message || 'Individual learner report download failed');
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
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <div className="w-10 h-10 border-2 border-[#4a4035] border-t-[#ff8a1f] rounded-full animate-spin" />
        <p className="text-[#a28b6e] text-sm font-medium">Loading SCORM AI reports...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto relative z-10">
      <header className="flex items-center gap-4 mb-7 pb-4 border-b border-[#3f362d]">
        <button
          type="button"
          onClick={() => navigate('/scorm')}
          className="w-10 h-10 grid place-items-center bg-[#1d1a16] hover:bg-[#28231d] border border-[#43382e] rounded-lg transition-all shrink-0"
          aria-label="Back to SCORM AI"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.17em] font-bold text-[#ff8a1f]">Learning evidence</div>
          <h1 className="scorm-display text-3xl md:text-4xl font-bold tracking-tight text-[#f2e8d3]">REPORTS</h1>
          <p className="text-[#9f8769] text-xs mt-1">Course analytics, learner-level exports and captured knowledge-check answers.</p>
        </div>
      </header>

      {msg && (
        <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-400/25 text-sm text-red-200 flex items-start justify-between gap-3">
          <span>{msg}</span>
          <button type="button" onClick={() => setMsg(null)} className="text-red-200/60 hover:text-red-100" aria-label="Dismiss message"><X size={15} /></button>
        </div>
      )}

      <section className="mb-8 rounded-xl border border-[#4b3f33] bg-[#1a1713] overflow-visible relative z-20">
        <div className="p-5 md:p-6 border-b border-[#40362c] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-lg border border-[#70512d] bg-[#2a2015] text-[#ff8a1f] grid place-items-center shrink-0"><UserRound size={20} /></div>
            <div>
              <h2 className="scorm-display text-xl md:text-2xl text-[#f2e8d3]">INDIVIDUAL LEARNER REPORT</h2>
              <p className="mt-1 text-xs leading-relaxed text-[#9d8568] max-w-2xl">Search a learner by email or name, then export one report containing that learner’s SCORM AI course results and every captured question response.</p>
            </div>
          </div>
          <div className="text-[10px] uppercase tracking-wider text-[#77644f]">{learners.length} reportable learners</div>
        </div>

        <div className="p-5 md:p-6 grid lg:grid-cols-[1fr_auto] gap-4 lg:items-end">
          <div className="relative">
            <label htmlFor="learner-report-search" className="block text-[10px] uppercase tracking-[0.14em] font-bold text-[#a98f6c] mb-2">Learner email or name</label>
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#806d57]" />
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
                placeholder="Search example@company.com"
                autoComplete="off"
                className="w-full min-h-12 rounded-lg border border-[#524537] bg-[#100f0d] pl-10 pr-10 text-sm text-[#f1e7d3] placeholder:text-[#6e5d4a] outline-none focus:border-[#ff8a1f] focus:ring-2 focus:ring-[#ff8a1f]/10"
              />
              {learnerQuery && (
                <button
                  type="button"
                  onClick={() => { setLearnerQuery(''); setSelectedLearner(null); setShowSuggestions(true); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center text-[#7f6d58] hover:text-[#eadfc8]"
                  aria-label="Clear learner search"
                ><X size={14} /></button>
              )}
            </div>

            {showSuggestions && (
              <div className="absolute left-0 right-0 top-full mt-2 rounded-lg border border-[#554737] bg-[#16130f] shadow-2xl overflow-hidden z-50 max-h-72 overflow-y-auto">
                {matchingLearners.length ? matchingLearners.map((learner) => (
                  <button
                    type="button"
                    key={learner.email.toLowerCase()}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => chooseLearner(learner)}
                    className="w-full text-left px-4 py-3 border-b last:border-b-0 border-[#342c24] hover:bg-[#211c17] transition-colors flex items-center justify-between gap-4"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[#eee4cf] truncate">{learner.email}</span>
                      <span className="block mt-0.5 text-[11px] text-[#8f785e] truncate">{learner.name || 'Learner'} · {learner.courseCount} course{learner.courseCount === 1 ? '' : 's'}</span>
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-[#705f4c] shrink-0">Select</span>
                  </button>
                )) : (
                  <div className="px-4 py-5 text-center text-xs text-[#806c56]">No learner matches this search.</div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              disabled={!selectedLearner || !!downloadingKey}
              onClick={() => downloadLearnerReport('pdf')}
              className="min-h-12 px-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-35 disabled:cursor-not-allowed text-xs font-bold inline-flex items-center justify-center gap-2"
            >
              <Download size={14} /> {downloadingKey?.startsWith('learner-') && downloadingKey.endsWith('-pdf') ? 'Generating…' : 'PDF'}
            </button>
            <button
              type="button"
              disabled={!selectedLearner || !!downloadingKey}
              onClick={() => downloadLearnerReport('excel')}
              className="min-h-12 px-4 rounded-lg border border-green-500/30 bg-green-500/10 text-green-300 hover:bg-green-500/20 disabled:opacity-35 disabled:cursor-not-allowed text-xs font-bold inline-flex items-center justify-center gap-2"
            >
              <FileSpreadsheet size={14} /> {downloadingKey?.startsWith('learner-') && downloadingKey.endsWith('-excel') ? 'Generating…' : 'Excel'}
            </button>
          </div>
        </div>

        {selectedLearner && (
          <div className="mx-5 md:mx-6 mb-5 md:mb-6 rounded-lg border border-[#5b4937] bg-[#12100e] px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-[#f1e7d2]">{selectedLearner.name || 'Learner'}</div>
              <div className="mt-0.5 text-xs text-[#b39774]">{selectedLearner.email}</div>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-[#77634e]">{selectedLearner.courseCount} course{selectedLearner.courseCount === 1 ? '' : 's'} · latest {formatDate(selectedLearner.latestActivity)}</div>
          </div>
        )}
      </section>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-[#a88e6b]">Course reports</div>
          <h2 className="scorm-display text-2xl text-[#f0e6d1]">COURSE ANALYTICS</h2>
        </div>
        <span className="text-[10px] text-[#77644f]">{reports.length} courses</span>
      </div>

      {reports.length > 0 ? (
        <div className="space-y-3">
          {reports.map((course, idx) => {
            const isExpanded = expandedId === course.id;
            const date = formatDate(course.publishedAt || course.updatedAt);
            const courseLearners = course.learners || [];

            return (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.04, 0.2) }}
                className="bg-[#1a1713] border border-[#44392f] rounded-xl overflow-hidden"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 sm:p-5 gap-3 sm:gap-4">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="bg-[#2a2118] border border-[#57442f] p-3 rounded-lg shrink-0">
                      <GraduationCap size={20} className="text-[#ff8a1f]" />
                    </div>
                    <div className="min-w-0">
                      <Link to={`/scorm/courses/${course.id}`} className="font-semibold text-[#f2e8d4] text-base hover:text-[#ff9a37] transition-colors block truncate">
                        {course.title || 'Untitled SCORM AI Course'}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-xs text-[#8e785f]">
                        <span className="flex items-center gap-1"><Calendar size={11} /> {date}</span>
                        <span className="flex items-center gap-1"><Users size={11} /> {course.learnerCount ?? 0} learners</span>
                        {course.scormStandard && <span className="flex items-center gap-1"><BookOpenCheck size={11} /> {course.scormStandard}</span>}
                        {course.completionRate != null && <span className="flex items-center gap-1"><CheckCircle size={11} className="text-green-400" /> {course.completionRate}% complete</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={() => downloadCourseReport(course, 'pdf')}
                      disabled={!!downloadingKey}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-red-500/10 text-red-300 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50"
                    ><Download size={13} />{downloadingKey === `course-${course.id}-pdf` ? '…' : 'PDF'}</button>
                    <button
                      type="button"
                      onClick={() => downloadCourseReport(course, 'excel')}
                      disabled={!!downloadingKey}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-green-500/10 text-green-300 border border-green-500/20 hover:bg-green-500/20 disabled:opacity-50"
                    ><Download size={13} />{downloadingKey === `course-${course.id}-excel` ? '…' : 'Excel'}</button>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : course.id)}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-[#242019] border border-[#493d31] hover:bg-[#2d271f]"
                    >{isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}{isExpanded ? 'Hide' : 'Details'}</button>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <div className="border-t border-[#3d332a] p-4 md:p-5">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
                          {[
                            ['Completion', course.completionRate != null ? `${course.completionRate}%` : '—', (course.completionRate || 0) >= 70 ? 'text-green-400' : 'text-[#ff9a37]'],
                            ['Avg Score', course.averageScore != null ? course.averageScore : '—', 'text-[#f0e6d1]'],
                            ['Completed', course.completedCount ?? 0, 'text-green-400'],
                            ['In Progress', course.inProgressCount ?? 0, 'text-[#ff9a37]']
                          ].map(([label, value, color]) => (
                            <div key={label} className="bg-[#14120f] border border-[#3e352c] rounded-lg p-4 text-center">
                              <span className="text-[9px] text-[#806c56] uppercase tracking-widest font-bold block mb-1">{label}</span>
                              <span className={`text-2xl font-black ${color}`}>{value}</span>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between gap-3 mb-3">
                          <h4 className="text-[10px] font-bold text-[#9d8567] uppercase tracking-widest">Learner audit log</h4>
                          {course.packageTitle && <span className="text-[10px] text-[#6f5e4b] truncate max-w-[45%]">{course.packageTitle}</span>}
                        </div>

                        {courseLearners.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[700px]">
                              <thead>
                                <tr className="text-[#806d58] text-[10px] uppercase tracking-wider border-b border-[#3c332a]">
                                  <th className="text-left py-2 px-3 font-medium">Learner</th>
                                  <th className="text-left py-2 px-3 font-medium">Result</th>
                                  <th className="text-right py-2 px-3 font-medium">Score</th>
                                  <th className="text-right py-2 px-3 font-medium">Progress</th>
                                  <th className="text-right py-2 px-3 font-medium">Time</th>
                                  <th className="text-right py-2 px-3 font-medium">Activity</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#302921]">
                                {courseLearners.map((learner) => {
                                  const learnerKey = learner.id || `${course.id}-${learner.learnerEmail || learner.learnerName}`;
                                  const isLearnerExpanded = expandedLearnerId === learnerKey;
                                  return (
                                    <React.Fragment key={learnerKey}>
                                      <tr onClick={() => setExpandedLearnerId(isLearnerExpanded ? null : learnerKey)} className="cursor-pointer hover:bg-[#211d18] transition-colors">
                                        <td className="py-2.5 px-3">
                                          <div className="font-semibold text-[#eee4cf]">{learner.learnerName || 'Learner'}</div>
                                          {learner.learnerEmail && <div className="text-[11px] text-[#806c56] mt-0.5">{learner.learnerEmail}</div>}
                                        </td>
                                        <td className={`py-2.5 px-3 font-bold ${statusTextClass(learner.result)}`}>{learner.result || 'Not Attempted'}</td>
                                        <td className="py-2.5 px-3 text-right font-bold tabular-nums text-[#eee4cf]">{learner.score != null ? learner.score : '—'}</td>
                                        <td className="py-2.5 px-3 text-right text-[#ad9575] tabular-nums">{learner.progressPercent != null ? `${learner.progressPercent}%` : '—'}</td>
                                        <td className="py-2.5 px-3 text-right text-[#ad9575] tabular-nums">{learner.totalTime || '—'}</td>
                                        <td className="py-2.5 px-3 text-right text-[#806c56] text-xs">{learner.lastActivity ? formatDate(learner.lastActivity) : '—'}</td>
                                      </tr>
                                      {isLearnerExpanded && (
                                        <tr className="bg-[#12100e]">
                                          <td colSpan={6} className="px-3 py-4">
                                            <div className="grid sm:grid-cols-3 gap-2 text-xs">
                                              <div className="rounded-lg bg-[#191611] border border-[#3b3229] p-3">
                                                <div className="flex items-center gap-1.5 text-[#806b55] uppercase tracking-wider text-[9px] font-bold mb-1"><Mail size={11} /> Registration</div>
                                                <div className="text-[#d9cfbd]">{learner.status || '—'}</div>
                                              </div>
                                              <div className="rounded-lg bg-[#191611] border border-[#3b3229] p-3">
                                                <div className="flex items-center gap-1.5 text-[#806b55] uppercase tracking-wider text-[9px] font-bold mb-1"><FileSpreadsheet size={11} /> Lesson Status</div>
                                                <div className="text-[#d9cfbd]">{learner.lessonStatus || '—'}</div>
                                              </div>
                                              <div className="rounded-lg bg-[#191611] border border-[#3b3229] p-3">
                                                <div className="flex items-center gap-1.5 text-[#806b55] uppercase tracking-wider text-[9px] font-bold mb-1"><Clock size={11} /> Learning Time</div>
                                                <div className="text-[#d9cfbd]">{learner.totalTime || '—'}</div>
                                              </div>
                                            </div>
                                            <AnswerEvidence learner={learner} />
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-[#42372d] bg-[#14120f] p-8 text-center text-[#7c6953] text-sm">No learner activity recorded yet.</div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 bg-[#181510] rounded-xl border border-dashed border-[#40362c]">
          <GraduationCap size={40} className="mx-auto text-[#5f5040] mb-4" />
          <h2 className="text-lg font-semibold text-[#9d8568]">No SCORM AI courses yet</h2>
          <p className="text-[#755f49] text-sm mt-1">Publish a course to see learning reports here.</p>
          <Link to="/scorm/author" className="inline-block mt-4 px-4 py-2.5 rounded-lg bg-[#ff8a1f] text-[#17110b] text-xs font-black">Create course</Link>
        </div>
      )}
    </div>
  );
}
