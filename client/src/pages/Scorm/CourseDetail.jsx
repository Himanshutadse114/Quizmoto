import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  Copy,
  Eye,
  Users,
  CheckCircle2,
  Clock3,
  CircleDashed,
  Trophy,
  Gauge,
  Timer,
  MapPin,
  RefreshCw,
  ShieldCheck,
  MousePointerClick,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import { useSocket } from '../../context/SocketContext';
import LearnerAuditDetail from './LearnerAuditDetail';

function openPlayerPopup(registrationId, token, packageId, entryHref) {
  const q = new URLSearchParams({
    token: token || '',
    packageId: packageId || '',
    entryHref: entryHref || ''
  });
  const url = apiUrl(`/api/scorm/play/${registrationId}?${q.toString()}`);
  const features =
    'popup=yes,width=1280,height=800,left=80,top=40,menubar=no,toolbar=no,location=yes,status=yes,resizable=yes,scrollbars=yes';
  const win = window.open(url, `quizmoto_scorm_${registrationId}`, features);
  if (!win || win.closed) {
    window.location.href = url;
    return null;
  }
  try { win.focus(); } catch (_) {}
  return win;
}

function progressLabel(row) {
  if (!row.progressAvailable) return row.status === 'active' ? 'In progress' : 'Unavailable';
  if (row.progressPercent >= 100) return 'Completed';
  if (row.progressPercent > 0) return 'In progress';
  return 'Not started';
}

function learnerInitials(name, email) {
  const source = String(name || email || 'L').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function previewStatusLabel(value) {
  const key = String(value || '').toLowerCase();
  if (key === 'passed') return 'Passed';
  if (key === 'failed') return 'Failed';
  if (key === 'completed') return 'Completed';
  if (key === 'in progress') return 'In progress';
  return 'Ready for QA';
}

function scoreLabel(stats) {
  if (!stats || stats.scoreRaw == null) return '—';
  if (stats.scoreMax != null) return `${stats.scoreRaw} / ${stats.scoreMax}`;
  return String(stats.scoreRaw);
}

function activityLabel(value) {
  if (!value) return 'Waiting for preview activity';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleString();
}

const Metric = ({ label, value, icon: Icon, bg = '#FFFFFF' }) => (
  <div className="rounded-2xl border border-black p-4" style={{ background: bg }}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="scorm-display text-2xl leading-none">{value}</div>
        <div className="scorm-micro mt-2 text-[8px] uppercase font-semibold text-[#667085]">{label}</div>
      </div>
      {Icon && <div className="w-8 h-8 rounded-lg bg-[#F8FAFC] border border-black grid place-items-center text-[#344054]"><Icon size={15} /></div>}
    </div>
  </div>
);

const PreviewStat = ({ label, value, icon: Icon, detail }) => (
  <div className="scorm-preview-stat p-3.5 md:p-4 min-w-0">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="scorm-preview-stat-label text-[9px] uppercase tracking-[0.08em] font-semibold">{label}</div>
        <div className="scorm-preview-stat-value text-[20px] md:text-[23px] leading-none font-semibold mt-2 truncate">{value}</div>
        {detail && <div className="scorm-preview-muted text-[10px] mt-2 truncate">{detail}</div>}
      </div>
      <div className="scorm-preview-icon w-8 h-8 rounded-lg grid place-items-center shrink-0">
        <Icon size={15} />
      </div>
    </div>
  </div>
);

export default function ScormCourseDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [regs, setRegs] = useState([]);
  const [trackingSummary, setTrackingSummary] = useState(null);
  const [msg, setMsg] = useState(null);
  const [inviteUrl, setInviteUrl] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [previewStats, setPreviewStats] = useState(null);
  const [previewStatsLoaded, setPreviewStatsLoaded] = useState(false);
  const [previewStatsLoading, setPreviewStatsLoading] = useState(false);
  const [expandedRegId, setExpandedRegId] = useState(null);
  const socket = useSocket();
  const [live, setLive] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const loadCourse = useCallback(() => {
    return axios.get(apiUrl(`/api/scorm/courses/${id}`), { headers }).then((r) => {
      setCourse(r.data);
      const origin = window.location.origin;
      const base = import.meta.env.VITE_APP_BASENAME || '';
      setInviteUrl(`${origin}${base}/scorm/learn/${r.data.inviteCode}`);
    });
  }, [id, token]);

  const loadRoster = useCallback(() => {
    return axios.get(apiUrl(`/api/scorm/tracking/course/${id}`), { headers }).then((r) => {
      setRegs(r.data?.registrations || []);
      setTrackingSummary(r.data?.course || null);
    });
  }, [id, token]);

  const loadPreviewStats = useCallback(async ({ silent = true } = {}) => {
    if (!silent) setPreviewStatsLoading(true);
    try {
      const res = await axios.get(apiUrl(`/api/scorm/preview/course/${id}`), { headers });
      setPreviewStats(res.data?.available ? res.data.preview : null);
      setPreviewStatsLoaded(true);
    } catch (err) {
      if (!silent) setMsg(err.response?.data?.message || err.message);
    } finally {
      if (!silent) setPreviewStatsLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    if (!token) return navigate('/login');
    loadCourse().catch((e) => setMsg(e.response?.data?.message || e.message));
    loadRoster().catch(() => {});
    loadPreviewStats({ silent: true });
    const rosterTimer = setInterval(() => loadRoster().catch(() => {}), 12000);
    const previewTimer = setInterval(() => loadPreviewStats({ silent: true }), 5000);
    return () => {
      clearInterval(rosterTimer);
      clearInterval(previewTimer);
    };
  }, [token, id, navigate, loadCourse, loadRoster, loadPreviewStats]);

  useEffect(() => {
    if (!socket || !token || !id) return;
    const onUpdate = (payload) => {
      if (!payload || String(payload.courseId) !== String(id)) return;
      setLive(true);
      const isPreviewUpdate = payload.isPreview === true || payload.registration?.isPreview === true;
      if (isPreviewUpdate) {
        loadPreviewStats({ silent: true });
        return;
      }
      loadRoster().catch(() => {});
    };
    const onJoined = () => setLive(true);
    socket.emit('join_scorm_course', { courseId: id, token });
    socket.on('scorm_registration_update', onUpdate);
    socket.on('scorm_course_joined', onJoined);
    return () => {
      socket.emit('leave_scorm_course', { courseId: id });
      socket.off('scorm_registration_update', onUpdate);
      socket.off('scorm_course_joined', onJoined);
    };
  }, [socket, token, id, loadRoster, loadPreviewStats]);

  useEffect(() => {
    const onPlayerMessage = (event) => {
      const type = event?.data?.type;
      if (type !== 'quizmoto-scorm-exit' && type !== 'quizmoto-scorm-progress') return;
      loadPreviewStats({ silent: true });
    };
    window.addEventListener('message', onPlayerMessage);
    return () => window.removeEventListener('message', onPlayerMessage);
  }, [loadPreviewStats]);

  const publish = async () => {
    try {
      const res = await axios.patch(apiUrl(`/api/scorm/courses/${id}`), { status: 'published' }, { headers });
      setCourse(res.data);
      setMsg('Course published. The learner invite link is ready to share.');
    } catch (err) { setMsg(err.response?.data?.message || err.message); }
  };

  const unpublish = async () => {
    try {
      const res = await axios.patch(apiUrl(`/api/scorm/courses/${id}`), { status: 'draft' }, { headers });
      setCourse(res.data);
    } catch (err) { setMsg(err.response?.data?.message || err.message); }
  };

  const preview = async () => {
    if (previewing) return;
    setPreviewing(true);
    try {
      const res = await axios.post(apiUrl(`/api/scorm/courses/${id}/preview`), {}, { headers });
      openPlayerPopup(res.data.registrationId, res.data.token, res.data.packageId, res.data.entryHref);
      await loadPreviewStats({ silent: true });
      setMsg('QA preview opened. The private Admin Preview Results panel updates live with score, progress, status, time and location. This QA data stays outside learner tracking and reports.');
    } catch (err) {
      setMsg(err.response?.data?.message || err.message);
    } finally {
      setPreviewing(false);
    }
  };

  const revoke = async (regId) => {
    if (!window.confirm('Revoke this learner registration?')) return;
    try {
      await axios.post(apiUrl(`/api/scorm/registrations/${regId}/revoke`), {}, { headers });
      await loadRoster();
    } catch (err) { setMsg(err.response?.data?.message || err.message); }
  };

  const copyInvite = () => {
    navigator.clipboard?.writeText(inviteUrl);
    setMsg('Invite link copied');
  };

  if (!course) return <div className="p-8 text-[#667085]">{msg || 'Loading course…'}</div>;

  const completed = trackingSummary?.completed ?? regs.filter((r) => r.progressAvailable && r.progressPercent >= 100).length;
  const active = trackingSummary?.active ?? regs.filter((r) => (r.progressAvailable && r.progressPercent > 0 && r.progressPercent < 100) || (!r.progressAvailable && r.status === 'active')).length;
  const avgProgress = Number(trackingSummary?.averageProgress || 0);
  const unavailable = Number(trackingSummary?.unavailable || 0);
  const previewProgress = previewStats?.progressAvailable ? Math.max(0, Math.min(100, Number(previewStats.progressPercent || 0))) : 0;

  return (
    <div className="p-4 md:p-7 lg:p-9 max-w-[1500px] mx-auto">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-6 pb-7 border-b border-black">
        <div className="min-w-0 max-w-4xl">
          <div className="scorm-micro text-[10px] uppercase font-semibold text-[#667085]">Course workspace</div>
          <h2 className="scorm-display text-[36px] md:text-[48px] mt-2 break-words">{course.title}</h2>
          <p className="text-sm mt-3 leading-relaxed max-w-3xl">{course.description || 'Manage publishing, learner access and progress for this course.'}</p>
          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <span className={`scorm-micro text-[8px] uppercase font-semibold px-2.5 py-1 rounded-full border ${course.status === 'published' ? 'bg-[#ECFDF3] text-[#027A48] border-[#ABEFC6]' : 'bg-[#F2F4F7] text-[#344054] border-[#D0D5DD]'}`}>{course.status}</span>
            <span className="scorm-micro text-[9px] text-[#667085]">Invite {course.inviteCode}</span>
            <span className="scorm-micro text-[9px] text-[#667085]">{course.package?.standard || 'SCORM'}</span>
            {previewStats && (
              <span className="scorm-micro text-[8px] uppercase font-semibold px-2.5 py-1 rounded-full border bg-[#EEF4FF] text-[#3538CD] border-[#C7D7FE]">
                QA preview available
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {course.status !== 'published' ? (
            <button onClick={publish} className="scorm-button-primary px-4 py-2.5 text-xs font-semibold">Publish</button>
          ) : (
            <button onClick={unpublish} className="scorm-button-secondary px-4 py-2.5 text-xs font-semibold">Unpublish</button>
          )}
          <button disabled={previewing} onClick={preview} className="scorm-button-secondary px-4 py-2.5 text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-wait">
            <Eye size={14} /> {previewing ? 'Opening preview…' : 'Preview course'}
          </button>
        </div>
      </div>

      {msg && <div className="mb-5 p-3.5 rounded-xl bg-[#EEF4FF] text-[#253B80] text-sm border border-[#B2CCFF]">{msg}</div>}

      <section className="scorm-preview-panel p-4 md:p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-5">
          <div className="max-w-2xl">
            <div className="scorm-preview-kicker text-[9px] uppercase tracking-[0.12em] font-semibold flex items-center gap-2">
              <ShieldCheck size={13} /> Private QA only
            </div>
            <h3 className="text-[22px] md:text-[25px] font-semibold mt-2">Admin Preview Results</h3>
            <p className="scorm-preview-muted text-xs md:text-[13px] leading-relaxed mt-2">
              Test the course exactly like a learner, then verify the captured SCORM result here. Preview data is intentionally excluded from learner counts, tracking and report exports.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => loadPreviewStats({ silent: false })}
              disabled={previewStatsLoading}
              className="scorm-preview-refresh rounded-lg px-3 py-2 text-[11px] font-semibold inline-flex items-center gap-2 disabled:opacity-60"
            >
              <RefreshCw size={13} className={previewStatsLoading ? 'animate-spin' : ''} /> Refresh results
            </button>
            <button
              type="button"
              onClick={preview}
              disabled={previewing}
              className="scorm-preview-refresh rounded-lg px-3 py-2 text-[11px] font-semibold inline-flex items-center gap-2 disabled:opacity-60"
            >
              <Eye size={13} /> {previewing ? 'Opening…' : previewStats ? 'Run again' : 'Run preview'}
            </button>
          </div>
        </div>

        {!previewStatsLoaded ? (
          <div className="scorm-preview-location rounded-xl p-5 scorm-preview-muted text-sm">Loading QA preview state…</div>
        ) : !previewStats ? (
          <div className="scorm-preview-location rounded-xl p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4">
            <div className="scorm-preview-icon w-10 h-10 rounded-xl grid place-items-center shrink-0"><Eye size={18} /></div>
            <div className="flex-1">
              <div className="font-semibold text-sm">No admin preview has been run yet.</div>
              <div className="scorm-preview-muted text-xs mt-1.5">Open Preview course, complete a few screens or the full assessment, and the QA result will appear here automatically.</div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="scorm-preview-badge rounded-full px-2.5 py-1 text-[9px] uppercase tracking-[0.08em] font-semibold">{previewStatusLabel(previewStats.qaState)}</span>
              <span className="scorm-preview-muted text-[10px]">Live updates · 5-second fallback refresh</span>
              {previewStats.lastActivityAt && <span className="scorm-preview-muted text-[10px]">• Last activity {activityLabel(previewStats.lastActivityAt)}</span>}
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-5 gap-2.5 md:gap-3">
              <PreviewStat
                label="Score"
                value={scoreLabel(previewStats)}
                icon={Trophy}
                detail={previewStats.scorePercent != null ? `${Number(previewStats.scorePercent).toFixed(0)}% normalized` : 'Awaiting score'}
              />
              <PreviewStat
                label="Completion"
                value={previewStats.progressAvailable ? `${Number(previewStats.progressPercent || 0).toFixed(0)}%` : '—'}
                icon={Gauge}
                detail={previewStatusLabel(previewStats.qaState)}
              />
              <PreviewStat
                label="Total time"
                value={previewStats.totalTime || '—'}
                icon={Timer}
                detail={previewStats.sessionTime ? `Session ${previewStats.sessionTime}` : 'Awaiting time data'}
              />
              <PreviewStat
                label="Interactions"
                value={previewStats.interactionCount ?? 0}
                icon={MousePointerClick}
                detail="Captured in this QA run"
              />
              <PreviewStat
                label="SCORM state"
                value={previewStats.lessonStatus || '—'}
                icon={CheckCircle2}
                detail={previewStats.initialized ? `State v${previewStats.stateVersion ?? 0}` : 'Waiting for initialize'}
              />
            </div>

            <div className="mt-3 grid grid-cols-1 lg:grid-cols-[1.4fr_.6fr] gap-3">
              <div className="scorm-preview-location rounded-xl p-4">
                <div className="flex items-center gap-2 scorm-preview-stat-label text-[9px] uppercase tracking-[0.08em] font-semibold">
                  <MapPin size={13} /> Last location
                </div>
                <div className="text-sm font-semibold mt-2 break-words">{previewStats.lastLocation || 'Not started'}</div>
                {previewStats.lastLocationRaw && previewStats.lastLocationRaw !== previewStats.lastLocation && (
                  <div className="scorm-preview-muted text-[10px] mt-1 font-mono break-all">Raw: {previewStats.lastLocationRaw}</div>
                )}
              </div>
              <div className="scorm-preview-location rounded-xl p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="scorm-preview-stat-label text-[9px] uppercase tracking-[0.08em] font-semibold">Preview progress</span>
                  <span className="text-xs font-semibold">{previewStats.progressAvailable ? `${previewProgress.toFixed(0)}%` : '—'}</span>
                </div>
                <div className="scorm-preview-progress-track h-2.5 rounded-full overflow-hidden">
                  <div className="scorm-preview-progress-fill h-full rounded-full transition-[width] duration-500" style={{ width: `${previewProgress}%` }} />
                </div>
                <div className="scorm-preview-muted text-[10px] mt-2">This result belongs only to the reusable admin QA registration.</div>
              </div>
            </div>
          </>
        )}
      </section>

      {course.status === 'published' && (
        <div className="rounded-[18px] bg-[#101828] border border-[#344054] p-4 md:p-5 mb-6 text-white">
          <div className="scorm-micro text-[9px] uppercase font-semibold text-[#A5B4FC] mb-2">Learner invite link</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input readOnly value={inviteUrl} className="flex-1 px-3 py-2.5 text-xs font-mono" />
            <button onClick={copyInvite} className="scorm-button-secondary px-4 py-2.5 font-semibold text-xs inline-flex items-center justify-center gap-2">
              <Copy size={13} /> Copy link
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Metric label="Learners" value={regs.length} icon={Users} />
        <Metric label="In progress" value={active} icon={Clock3} bg="#ECFDFF" />
        <Metric label="Completed" value={completed} icon={CheckCircle2} bg="#ECFDF3" />
        <Metric label="Average progress" value={`${avgProgress.toFixed(0)}%`} bg="#F4F3FF" />
        <Metric label="Unavailable" value={unavailable} icon={CircleDashed} bg="#FEF3F2" />
      </div>

      <div className="border border-black rounded-[18px] bg-white overflow-hidden">
        <div className="px-5 md:px-6 py-4 border-b border-black flex items-center justify-between gap-3 bg-[#F8FAFC]">
          <div>
            <div className="scorm-micro text-[9px] uppercase font-semibold text-[#667085]">Learning operations</div>
            <h3 className="text-[19px] mt-1">Learner progress</h3>
            <p className="text-[11px] text-[#667085] mt-1">Select any learner to review course status, attempt history and captured quiz answers.</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#667085]">
            <span className={`w-2 h-2 rounded-full ${live ? 'bg-[#12B76A]' : 'bg-[#98A2B3]'}`} />
            {live ? 'Live updates' : 'Refreshes every 12s'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="text-left scorm-micro text-[9px] uppercase font-semibold text-[#475467] border-b border-black bg-[#F2F4F7]">
                <th className="p-4 min-w-[230px]">Learner</th>
                <th className="p-4">Attempts</th>
                <th className="p-4 min-w-[190px]">Completion</th>
                <th className="p-4 min-w-[150px]">Last location</th>
                <th className="p-4">Lesson status</th>
                <th className="p-4">Score</th>
                <th className="p-4">Time</th>
                <th className="p-4 min-w-[135px]">Last activity</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {regs.length === 0 && <tr><td colSpan={9} className="p-10 text-center text-[#667085]">No learners have started this course yet.</td></tr>}
              {regs.map((r) => {
                const isExpanded = expandedRegId === r.id;
                return (
                  <React.Fragment key={r.id}>
                    <tr
                      onClick={() => setExpandedRegId(isExpanded ? null : r.id)}
                      className={`border-b border-[#E4E7EC] bg-white hover:bg-[#F7F8FF] cursor-pointer ${isExpanded ? 'bg-[#F7F8FF]' : ''}`}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl border border-[#D0D5DD] bg-[#EEF4FF] text-[#3538CD] grid place-items-center font-black text-xs shrink-0">
                            {learnerInitials(r.learnerName, r.learnerEmail)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[8px] uppercase tracking-[0.1em] font-semibold text-[#98A2B3]">Learner name</div>
                            <div className="font-semibold text-[#101828] truncate">{r.learnerName || 'Learner'}</div>
                            <div className="text-[10px] text-[#667085] mt-0.5 truncate max-w-[190px]">{r.learnerEmail || 'No email'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-2 rounded-lg border border-[#D0D5DD] bg-[#F8FAFC] px-2.5 py-1.5 text-[#344054]">
                          <span className="text-[9px] uppercase tracking-[0.08em] font-semibold text-[#667085]">Attempts</span>
                          <strong className="text-xs text-[#101828]">{Math.max(1, Number(r.attemptCount || 1))}</strong>
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-between items-center gap-3 mb-2">
                          <span className="font-semibold text-[12px] text-[#101828]">{r.progressAvailable ? `${Number(r.progressPercent).toFixed(0)}%` : '—'}</span>
                          <span className="rounded-full border border-[#D0D5DD] bg-[#F8FAFC] px-2 py-1 text-[8px] uppercase tracking-[0.08em] font-semibold text-[#667085]">{progressLabel(r)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-[#EAECF0] overflow-hidden">
                          {r.progressAvailable && <div className="h-full bg-[#635BFF]" style={{ width: `${Math.max(0, Math.min(100, r.progressPercent || 0))}%` }} />}
                        </div>
                      </td>
                      <td className="p-4 text-[11px] font-medium text-[#475467] max-w-[180px] break-words">{r.lastLocation || 'Not started'}</td>
                      <td className="p-4 text-[11px] font-mono text-[#475467]">{r.lastLessonStatus || '—'}</td>
                      <td className="p-4 font-semibold text-[#101828]">{r.lastScoreRaw != null ? r.lastScoreRaw : '—'}</td>
                      <td className="p-4 font-mono text-[11px] text-[#475467]">{r.lastTotalTime || '—'}</td>
                      <td className="p-4 text-[11px] leading-relaxed text-[#475467]">{r.lastCommitAt ? new Date(r.lastCommitAt).toLocaleString() : r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—'}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={(event) => { event.stopPropagation(); setExpandedRegId(isExpanded ? null : r.id); }}
                            className="px-2.5 py-1.5 rounded-lg border border-[#D0D5DD] bg-white text-[10px] font-semibold text-[#344054] hover:bg-[#F9FAFB] inline-flex items-center gap-1.5"
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {isExpanded ? 'Hide' : 'Details'}
                          </button>
                          {r.status !== 'revoked' && (
                            <button
                              type="button"
                              onClick={(event) => { event.stopPropagation(); revoke(r.id); }}
                              className="px-3 py-1.5 rounded-lg border border-[#FDA29B] bg-white text-[10px] font-semibold text-[#B42318] hover:bg-[#FEF3F2]"
                            >Revoke</button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-[#050B14] border-b border-[#243751]">
                        <td colSpan={9} className="p-3 md:p-4">
                          <LearnerAuditDetail
                            learnerName={r.learnerName}
                            learnerEmail={r.learnerEmail}
                            entries={[{ ...r, courseTitle: course.title, scormStandard: course.package?.standard || r.scormStandard }]}
                            variant="workspace"
                          />
                        </td>
                      </tr>
                    )}
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