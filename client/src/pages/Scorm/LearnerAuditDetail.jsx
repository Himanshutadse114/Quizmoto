import React, { useState } from 'react';
import axios from 'axios';
import { BookOpenCheck, CheckCircle2, Clock3, Mail, MapPin, Trophy, Trash2, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function initials(name, email) {
  const source = String(name || email || 'L').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function resultTone(value) {
  const key = String(value || '').toLowerCase();
  if (key === 'correct' || key === 'passed' || key === 'completed') return 'text-[#32D583]';
  if (key === 'incorrect' || key === 'failed' || key === 'wrong') return 'text-[#FDA29B]';
  if (key.includes('progress')) return 'text-[#FDB022]';
  return 'text-[#A9B8CB]';
}

function normalizeEntry(entry) {
  const interactions = Array.isArray(entry?.interactions) ? entry.interactions : [];
  const attempts = Array.isArray(entry?.attempts) ? entry.attempts : [];
  return {
    ...entry,
    interactions,
    attempts,
    attemptCount: Math.max(1, Number(entry?.attemptCount || attempts.length || 1))
  };
}

const Metric = ({ icon: Icon, label, value, palette }) => (
  <div className={`rounded-xl border p-3.5 min-w-0 ${palette.card}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className={`text-[9px] uppercase tracking-[0.11em] font-bold ${palette.muted}`}>{label}</div>
        <div className={`mt-1.5 text-[15px] font-semibold break-words ${palette.text}`}>{value ?? '—'}</div>
      </div>
      {Icon && <div className={`w-8 h-8 rounded-lg border grid place-items-center shrink-0 ${palette.icon}`}><Icon size={14} /></div>}
    </div>
  </div>
);

export default function LearnerAuditDetail({ learnerName, learnerEmail, entries = [], variant = 'workspace', showIdentity = true }) {
  const { token } = useAuth();
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const rows = entries.map(normalizeEntry);
  const palette = variant === 'warm'
    ? {
      shell: 'border-[#4b3f33] bg-[#12100e]',
      card: 'border-[#3e352c] bg-[#191611]',
      soft: 'border-[#3b3229] bg-[#17140f]',
      text: 'text-[#F1E8D4]',
      muted: 'text-[#9D8568]',
      accent: 'text-[#FF9A37]',
      icon: 'border-[#5b4937] bg-[#251d15] text-[#FF9A37]',
      line: 'border-[#332C24]'
    }
    : {
      shell: 'border-[#243751] bg-[#07111F]',
      card: 'border-[#2B405D] bg-[#0B1728]',
      soft: 'border-[#263A55] bg-[#091423]',
      text: 'text-[#F8FAFC]',
      muted: 'text-[#91A3BA]',
      accent: 'text-[#22D3EE]',
      icon: 'border-[#315174] bg-[#0D2038] text-[#22D3EE]',
      line: 'border-[#243751]'
    };

  const totalAttempts = rows.reduce((sum, row) => sum + row.attemptCount, 0);
  const latest = rows[0] || {};
  const completion = latest.progressPercent != null ? `${Number(latest.progressPercent).toFixed(0)}%` : '—';
  const score = latest.lastScoreRaw ?? latest.score ?? '—';
  const time = latest.lastTotalTime || latest.totalTime || '—';

  const deleteLearner = async (entry) => {
    if (variant !== 'workspace' || !token || deletingId) return;
    const registrationId = entry.registrationId || entry.id;
    if (!registrationId) return;
    const courseTitle = entry.courseTitle || 'this course';
    const identity = learnerEmail || learnerName || 'this learner';
    const confirmed = window.confirm(
      `Permanently delete ${identity} from ${courseTitle}?\n\nThis removes the learner registration, attempts, progress, quiz answers and SCORM tracking data for this course. This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(registrationId);
    setDeleteError(null);
    try {
      await axios.delete(apiUrl(`/api/scorm/registrations/${registrationId}`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Reload so every host view (metrics, roster, reports and tracking) is
      // immediately rebuilt from the authoritative backend state.
      window.location.reload();
    } catch (err) {
      setDeleteError(err.response?.data?.message || err.message || 'Unable to delete learner');
      setDeletingId(null);
    }
  };

  return (
    <div className={`rounded-2xl border overflow-hidden ${palette.shell}`}>
      {showIdentity && (
        <div className={`p-4 md:p-5 border-b ${palette.line}`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-11 h-11 rounded-xl border grid place-items-center font-black text-sm shrink-0 ${palette.icon}`}>
                {initials(learnerName, learnerEmail)}
              </div>
              <div className="min-w-0">
                <div className={`text-[9px] uppercase tracking-[0.12em] font-bold ${palette.muted}`}>Learner identity</div>
                <div className={`mt-1 font-semibold text-base truncate ${palette.text}`}>{learnerName || 'Learner'}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:min-w-[420px]">
              <div className={`rounded-lg border px-3 py-2.5 ${palette.soft}`}>
                <div className={`text-[8px] uppercase tracking-[0.11em] font-bold ${palette.muted}`}>Learner name</div>
                <div className={`mt-1 text-xs font-semibold break-words ${palette.text}`}>{learnerName || 'Learner'}</div>
              </div>
              <div className={`rounded-lg border px-3 py-2.5 ${palette.soft}`}>
                <div className={`text-[8px] uppercase tracking-[0.11em] font-bold ${palette.muted}`}>Email address</div>
                <div className={`mt-1 text-xs font-medium break-all ${palette.text}`}>{learnerEmail || 'No email'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 md:p-5">
        {deleteError && (
          <div className="mb-4 rounded-xl border border-[#7F1D1D] bg-[#2A1113] px-3.5 py-3 text-xs text-[#FECACA]">
            {deleteError}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 mb-5">
          <Metric icon={BookOpenCheck} label="Courses" value={rows.length || 0} palette={palette} />
          <Metric icon={UserRound} label="Attempts" value={totalAttempts || 0} palette={palette} />
          <Metric icon={CheckCircle2} label="Completion" value={completion} palette={palette} />
          <Metric icon={Trophy} label="Score" value={score} palette={palette} />
          <Metric icon={Clock3} label="Learning time" value={time} palette={palette} />
        </div>

        {!rows.length ? (
          <div className={`rounded-xl border border-dashed p-5 text-sm ${palette.soft} ${palette.muted}`}>No learner activity is available for this selection.</div>
        ) : (
          <div className="space-y-4">
            {rows.map((entry, entryIndex) => {
              const result = entry.result || entry.lastLessonStatus || entry.lessonStatus || entry.status || 'Recorded';
              const interactions = entry.interactions || [];
              const registrationId = entry.registrationId || entry.id;
              return (
                <section key={registrationId || `${entry.courseId || 'course'}-${entryIndex}`} className={`rounded-xl border overflow-hidden ${palette.card}`}>
                  <div className={`p-4 border-b ${palette.line}`}>
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                      <div className="min-w-0">
                        <div className={`text-[9px] uppercase tracking-[0.11em] font-bold ${palette.accent}`}>Course activity {entryIndex + 1}</div>
                        <h4 className={`mt-1.5 text-sm md:text-base font-semibold break-words ${palette.text}`}>{entry.courseTitle || 'Course'}</h4>
                        <div className={`mt-1 text-[10px] ${palette.muted}`}>{entry.scormStandard || entry.standard || 'SCORM'} · {entry.attemptCount} attempt{entry.attemptCount === 1 ? '' : 's'}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <span className={`text-[10px] uppercase tracking-[0.1em] font-bold ${resultTone(result)}`}>{String(result).replace(/_/g, ' ')}</span>
                        {variant === 'workspace' && registrationId && (
                          <button
                            type="button"
                            onClick={() => deleteLearner(entry)}
                            disabled={!!deletingId}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#7F1D1D] bg-[#2A1113] px-2.5 py-1.5 text-[10px] font-bold text-[#FCA5A5] hover:bg-[#3A1518] hover:border-[#B91C1C] disabled:opacity-50 disabled:cursor-wait"
                          >
                            <Trash2 size={12} />
                            {deletingId === registrationId ? 'Deleting…' : 'Delete learner'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-px bg-white/5">
                    {[
                      ['Progress', entry.progressPercent != null ? `${Number(entry.progressPercent).toFixed(0)}%` : '—'],
                      ['Score', entry.lastScoreRaw ?? entry.score ?? '—'],
                      ['Lesson status', entry.lastLessonStatus || entry.lessonStatus || '—'],
                      ['Total time', entry.lastTotalTime || entry.totalTime || '—'],
                      ['Last location', entry.lastLocation || 'Not started'],
                      ['Last activity', formatDate(entry.lastCommitAt || entry.lastActivity || entry.updatedAt)]
                    ].map(([label, value]) => (
                      <div key={label} className={`p-3.5 ${palette.soft}`}>
                        <div className={`text-[8px] uppercase tracking-[0.1em] font-bold ${palette.muted}`}>{label}</div>
                        <div className={`mt-1.5 text-[11px] font-semibold break-words ${palette.text}`}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {entry.attempts.length > 0 && (
                    <div className={`p-4 border-t ${palette.line}`}>
                      <div className={`text-[9px] uppercase tracking-[0.12em] font-bold mb-2.5 ${palette.muted}`}>Attempt history</div>
                      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
                        {entry.attempts.map((attempt, attemptIndex) => (
                          <div key={attempt.id || attemptIndex} className={`rounded-lg border px-3 py-2.5 ${palette.soft}`}>
                            <div className={`text-xs font-semibold ${palette.text}`}>Attempt {attempt.attemptNo || attemptIndex + 1}</div>
                            <div className={`mt-1 text-[10px] leading-relaxed ${palette.muted}`}>Started: {formatDate(attempt.startedAt)}</div>
                            <div className={`text-[10px] leading-relaxed ${palette.muted}`}>Finished: {formatDate(attempt.finishedAt)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className={`p-4 border-t ${palette.line}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div>
                        <div className={`text-[9px] uppercase tracking-[0.12em] font-bold ${palette.muted}`}>Quiz & interaction evidence</div>
                        <div className={`mt-1 text-[11px] ${palette.text}`}>
                          {entry.answerSummary?.captured ?? interactions.length} captured · {entry.answerSummary?.correct ?? 0} correct
                          {entry.answerSummary?.accuracy != null ? ` · ${entry.answerSummary.accuracy}% accuracy` : ''}
                        </div>
                      </div>
                    </div>

                    {!interactions.length ? (
                      <div className={`rounded-lg border border-dashed p-3 text-[11px] leading-relaxed ${palette.soft} ${palette.muted}`}>
                        Question-level answers were not captured for this attempt. Score, completion, time and location remain available above.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-white/10">
                        <table className="w-full min-w-[860px] text-[11px]">
                          <thead>
                            <tr className={`text-left border-b ${palette.line} ${palette.soft}`}>
                              <th className={`px-3 py-2.5 w-10 ${palette.muted}`}>#</th>
                              <th className={`px-3 py-2.5 min-w-[240px] ${palette.muted}`}>Question</th>
                              <th className={`px-3 py-2.5 min-w-[150px] ${palette.muted}`}>Learner answer</th>
                              <th className={`px-3 py-2.5 min-w-[150px] ${palette.muted}`}>Correct answer</th>
                              <th className={`px-3 py-2.5 min-w-[90px] ${palette.muted}`}>Result</th>
                              <th className={`px-3 py-2.5 min-w-[220px] ${palette.muted}`}>Explanation</th>
                            </tr>
                          </thead>
                          <tbody>
                            {interactions.map((item, index) => (
                              <tr key={`${entry.id || entryIndex}-interaction-${index}`} className={`border-b last:border-b-0 ${palette.line}`}>
                                <td className={`px-3 py-3 font-bold ${palette.accent}`}>{String(index + 1).padStart(2, '0')}</td>
                                <td className={`px-3 py-3 font-semibold ${palette.text}`}>{item.question || `Question ${index + 1}`}</td>
                                <td className={`px-3 py-3 ${palette.text}`}>{item.selectedAnswer || '—'}</td>
                                <td className={`px-3 py-3 ${palette.text}`}>{item.correctAnswer || '—'}</td>
                                <td className={`px-3 py-3 font-bold ${resultTone(item.result)}`}>{item.result || 'Recorded'}</td>
                                <td className={`px-3 py-3 leading-relaxed ${palette.muted}`}>{item.explanation || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
