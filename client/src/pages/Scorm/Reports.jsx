import React, { useEffect, useState } from 'react';
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
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

function statusTextClass(result) {
  const key = String(result || '').toLowerCase();
  if (key === 'passed' || key === 'completed') return 'text-green-400';
  if (key === 'failed') return 'text-red-400';
  if (key === 'in progress') return 'text-quizmoto-yellow';
  return 'text-white/40';
}

function formatDate(value) {
  if (!value) return 'No activity yet';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function ScormReports() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedLearnerId, setExpandedLearnerId] = useState(null);
  const [downloadingKey, setDownloadingKey] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    axios
      .get(apiUrl('/api/scorm/courses/reports/all'), {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((r) => setReports(r.data || []))
      .catch((err) => setMsg(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  }, [token, navigate]);

  const downloadReport = async (course, format) => {
    if (!course?.id || downloadingKey) return;
    const key = `${course.id}-${format}`;
    setDownloadingKey(key);
    setMsg(null);

    try {
      const res = await axios.get(
        apiUrl(`/api/scorm/courses/${course.id}/report?format=${format}`),
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
          validateStatus: () => true
        }
      );

      if (res.status !== 200) {
        let message = 'Failed to generate report';
        try {
          const textBody = await res.data.text();
          const data = JSON.parse(textBody);
          if (data.message) message = data.message;
        } catch (_) {
          // Keep generic error if response is not JSON.
        }
        setMsg(message);
        return;
      }

      const ext = format === 'pdf' ? 'pdf' : 'xlsx';
      const url = window.URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      const safe = String(course.title || 'SCORM_Course')
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .slice(0, 60);
      link.setAttribute('download', `Quizmoto_SCORM_${safe}.${ext}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setMsg(err.message || 'Report download failed');
    } finally {
      setDownloadingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <p className="text-white/50 text-sm font-medium">Loading SCORM reports...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto relative z-10">
      <header className="flex items-center justify-between gap-4 mb-8 pb-4 border-b border-white/10">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/scorm')}
            className="p-2 bg-white/8 hover:bg-white/15 rounded-lg transition-all shrink-0"
            aria-label="Back to SCORM World"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">SCORM Reports</h1>
            <p className="text-white/40 text-xs mt-0.5">
              Review learner progress and download branded learning audit reports
            </p>
          </div>
        </div>
        <Link
          to="/reports"
          className="hidden sm:inline text-xs font-bold text-white/40 hover:text-white/70 underline shrink-0"
        >
          Live quiz reports →
        </Link>
      </header>

      {msg && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-400/30 text-sm">
          {msg}
        </div>
      )}

      {reports.length > 0 ? (
        <div className="space-y-3">
          {reports.map((course, idx) => {
            const isExpanded = expandedId === course.id;
            const date = formatDate(course.publishedAt || course.updatedAt);
            const learners = course.learners || [];

            return (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 sm:p-5 gap-3 sm:gap-4">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="bg-quizmoto-purple/20 p-3 rounded-xl shrink-0">
                      <GraduationCap size={20} className="text-quizmoto-yellow" />
                    </div>
                    <div className="min-w-0">
                      <Link
                        to={`/scorm/courses/${course.id}`}
                        className="font-semibold text-white text-base hover:text-quizmoto-yellow transition-colors block truncate"
                      >
                        {course.title || 'Untitled SCORM Course'}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-xs text-white/40">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} /> {date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={11} /> {course.learnerCount ?? 0} learners
                        </span>
                        {course.scormStandard && (
                          <span className="flex items-center gap-1">
                            <BookOpenCheck size={11} /> {course.scormStandard}
                          </span>
                        )}
                        {course.completionRate != null && (
                          <span className="flex items-center gap-1">
                            <CheckCircle size={11} className="text-green-400" /> {course.completionRate}% complete
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={() => downloadReport(course, 'pdf')}
                      disabled={!!downloadingKey}
                      title="Download PDF"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-50"
                    >
                      <Download size={13} />
                      {downloadingKey === `${course.id}-pdf` ? '…' : 'PDF'}
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadReport(course, 'excel')}
                      disabled={!!downloadingKey}
                      title="Download Excel"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-all disabled:opacity-50"
                    >
                      <Download size={13} />
                      {downloadingKey === `${course.id}-excel` ? '…' : 'Excel'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : course.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/8 border border-white/10 hover:bg-white/15 transition-all"
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {isExpanded ? 'Hide' : 'Details'}
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-white/10 p-4">
                        <div className="mt-2 mb-8">
                          <div className="flex items-center gap-2 mb-6">
                            <div className="w-1.5 h-6 rounded-full bg-quizmoto-blue" />
                            <h3 className="text-xl font-bold">Learning Analytics Report</h3>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                              <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">
                                Completion
                              </span>
                              <span className={`text-2xl font-black ${(course.completionRate || 0) >= 70 ? 'text-green-400' : 'text-quizmoto-yellow'}`}>
                                {course.completionRate != null ? `${course.completionRate}%` : '—'}
                              </span>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                              <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">
                                Avg Score
                              </span>
                              <span className="text-2xl font-black text-white">
                                {course.averageScore != null ? course.averageScore : '—'}
                              </span>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                              <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">
                                Completed
                              </span>
                              <span className="text-2xl font-black text-green-400">
                                {course.completedCount ?? 0}
                              </span>
                              <span className="text-[8px] text-white/30 uppercase mt-0.5">Learners</span>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                              <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">
                                In Progress
                              </span>
                              <span className="text-2xl font-black text-quizmoto-yellow">
                                {course.inProgressCount ?? 0}
                              </span>
                              <span className="text-[8px] text-white/30 uppercase mt-0.5">Learners</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 mb-4">
                          <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest">
                            Learner Audit Log
                          </h4>
                          {course.packageTitle && (
                            <span className="text-[10px] text-white/30 truncate max-w-[45%]">
                              {course.packageTitle}
                            </span>
                          )}
                        </div>

                        {learners.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[660px]">
                              <thead>
                                <tr className="text-white/40 text-xs uppercase tracking-wider">
                                  <th className="text-left py-2 px-3 font-medium">Learner</th>
                                  <th className="text-left py-2 px-3 font-medium">Result</th>
                                  <th className="text-right py-2 px-3 font-medium">Score</th>
                                  <th className="text-right py-2 px-3 font-medium">Time</th>
                                  <th className="text-right py-2 px-3 font-medium">Activity</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {learners.map((learner) => {
                                  const learnerKey = learner.id || `${course.id}-${learner.learnerEmail || learner.learnerName}`;
                                  const isLearnerExpanded = expandedLearnerId === learnerKey;
                                  return (
                                    <React.Fragment key={learnerKey}>
                                      <tr
                                        onClick={() => setExpandedLearnerId(isLearnerExpanded ? null : learnerKey)}
                                        className="cursor-pointer hover:bg-white/5 transition-colors"
                                      >
                                        <td className="py-2.5 px-3">
                                          <div className="font-semibold text-white">
                                            {learner.learnerName || 'Learner'}
                                          </div>
                                          {learner.learnerEmail && (
                                            <div className="text-[11px] text-white/30 mt-0.5">
                                              {learner.learnerEmail}
                                            </div>
                                          )}
                                        </td>
                                        <td className={`py-2.5 px-3 font-bold ${statusTextClass(learner.result)}`}>
                                          {learner.result || 'Not Attempted'}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-bold tabular-nums">
                                          {learner.score != null ? learner.score : '—'}
                                        </td>
                                        <td className="py-2.5 px-3 text-right text-white/60 tabular-nums">
                                          {learner.totalTime || '—'}
                                        </td>
                                        <td className="py-2.5 px-3 text-right text-white/40 text-xs">
                                          {learner.lastActivity ? formatDate(learner.lastActivity) : '—'}
                                        </td>
                                      </tr>
                                      {isLearnerExpanded && (
                                        <tr className="bg-white/[0.025]">
                                          <td colSpan={5} className="px-3 py-3">
                                            <div className="grid sm:grid-cols-3 gap-2 text-xs">
                                              <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                                                <div className="flex items-center gap-1.5 text-white/35 uppercase tracking-wider text-[9px] font-bold mb-1">
                                                  <Mail size={11} /> Registration
                                                </div>
                                                <div className="text-white/70">{learner.status || '—'}</div>
                                              </div>
                                              <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                                                <div className="flex items-center gap-1.5 text-white/35 uppercase tracking-wider text-[9px] font-bold mb-1">
                                                  <FileSpreadsheet size={11} /> Lesson Status
                                                </div>
                                                <div className="text-white/70">{learner.lessonStatus || '—'}</div>
                                              </div>
                                              <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                                                <div className="flex items-center gap-1.5 text-white/35 uppercase tracking-wider text-[9px] font-bold mb-1">
                                                  <Clock size={11} /> Learning Time
                                                </div>
                                                <div className="text-white/70">{learner.totalTime || '—'}</div>
                                              </div>
                                            </div>
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
                          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-white/30 text-sm">
                            No learner activity recorded yet.
                          </div>
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
        <div className="text-center py-20 bg-white/3 rounded-2xl border border-dashed border-white/10">
          <GraduationCap size={40} className="mx-auto text-white/15 mb-4" />
          <h2 className="text-lg font-semibold text-white/30">No SCORM courses yet</h2>
          <p className="text-white/20 text-sm mt-1">
            Publish a course from SCORM World to see learning reports here.
          </p>
          <Link
            to="/scorm"
            className="inline-block mt-4 px-4 py-2 rounded-xl bg-quizmoto-yellow text-black text-xs font-black"
          >
            Open SCORM World
          </Link>
        </div>
      )}
    </div>
  );
}
