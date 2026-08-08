import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Copy, Eye, Users, CheckCircle2, Clock3, CircleDashed } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import { useSocket } from '../../context/SocketContext';

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

function barTone(value) {
  if (value >= 100) return 'bg-[#7b9285]';
  if (value >= 60) return 'bg-[#829daf]';
  if (value > 0) return 'bg-[#b39368]';
  return 'bg-[#dfe5e1]';
}

function progressLabel(row) {
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

const Metric = ({ label, value, icon: Icon, tint, tone }) => (
  <div className={`rounded-2xl border border-[#e1e6e2] p-4 ${tint}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-2xl font-semibold tracking-[-0.04em] text-[#26312d]">{value}</div>
        <div className="mt-1 text-[10px] font-semibold text-[#7e8983]">{label}</div>
      </div>
      {Icon && <div className="w-8 h-8 rounded-lg bg-white/75 border border-white grid place-items-center" style={{ color: tone }}><Icon size={15} /></div>}
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

  useEffect(() => {
    if (!token) return navigate('/login');
    loadCourse().catch((e) => setMsg(e.response?.data?.message || e.message));
    loadRoster().catch(() => {});
    const t = setInterval(() => loadRoster().catch(() => {}), 12000);
    return () => clearInterval(t);
  }, [token, id, navigate, loadCourse, loadRoster]);

  useEffect(() => {
    if (!socket || !token || !id) return;
    const onUpdate = (payload) => {
      if (!payload || String(payload.courseId) !== String(id)) return;
      setLive(true);
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
  }, [socket, token, id, loadRoster]);

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
    try {
      const res = await axios.post(apiUrl(`/api/scorm/courses/${id}/preview`), {}, { headers });
      await loadRoster().catch(() => {});
      openPlayerPopup(res.data.registrationId, res.data.token, res.data.packageId, res.data.entryHref);
      setMsg('Preview opened. Host preview progress appears below but is excluded from learner totals.');
    } catch (err) { setMsg(err.response?.data?.message || err.message); }
  };

  const revoke = async (regId) => {
    if (!window.confirm('Revoke this registration?')) return;
    try {
      await axios.post(apiUrl(`/api/scorm/registrations/${regId}/revoke`), {}, { headers });
      await loadRoster();
    } catch (err) { setMsg(err.response?.data?.message || err.message); }
  };

  const copyInvite = () => {
    navigator.clipboard?.writeText(inviteUrl);
    setMsg('Invite link copied');
  };

  if (!course) return <div className="p-8 text-[#7d8882]">{msg || 'Loading course…'}</div>;

  const learnerRegs = regs.filter((r) => !r.isPreview);
  const previewRegs = regs.filter((r) => r.isPreview);
  const completed = trackingSummary?.completed ?? learnerRegs.filter((r) => r.progressAvailable && r.progressPercent >= 100).length;
  const active = trackingSummary?.active ?? learnerRegs.filter((r) => (r.progressAvailable && r.progressPercent > 0 && r.progressPercent < 100) || (!r.progressAvailable && r.status === 'active')).length;
  const avgProgress = Number(trackingSummary?.averageProgress || 0);
  const unavailable = Number(trackingSummary?.unavailable || 0);

  return (
    <div className="p-4 md:p-7 lg:p-8 max-w-[1500px] mx-auto">
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5 mb-6">
        <div className="min-w-0 max-w-3xl">
          <div className="text-[11px] font-semibold text-[#829087]">Course workspace</div>
          <h2 className="text-3xl md:text-[36px] font-semibold tracking-[-0.04em] mt-1.5">{course.title}</h2>
          <p className="text-sm mt-2 leading-relaxed">{course.description || 'Manage publishing, learner access and progress for this course.'}</p>
          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <span className={`text-[9px] font-semibold px-2.5 py-1 rounded-full border ${course.status === 'published' ? 'bg-[#edf3ef] text-[#607568] border-[#dce8e0]' : 'bg-[#f5f0e8] text-[#987a52] border-[#e9decc]'}`}>{course.status}</span>
            <span className="text-[11px] text-[#8a948f] font-mono">Invite {course.inviteCode}</span>
            <span className="text-[11px] text-[#8a948f]">{course.package?.standard || 'SCORM'}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {course.status !== 'published' ? (
            <button onClick={publish} className="scorm-button-primary px-4 py-2.5 text-xs font-semibold">Publish</button>
          ) : (
            <button onClick={unpublish} className="scorm-button-secondary px-4 py-2.5 text-xs font-semibold">Unpublish</button>
          )}
          <button onClick={preview} className="px-4 py-2.5 rounded-xl bg-[#eef3f7] border border-[#d7e2e9] text-[#657f90] text-xs font-semibold inline-flex items-center gap-2">
            <Eye size={14} /> Preview as learner
          </button>
        </div>
      </div>

      {msg && <div className="mb-5 p-3.5 rounded-xl bg-[#eef3f7] text-[#607889] text-sm border border-[#d9e3e9]">{msg}</div>}

      {course.status === 'published' && (
        <div className="rounded-2xl bg-[#edf3ef] border border-[#dbe6df] p-4 md:p-5 mb-6">
          <div className="text-[11px] font-semibold text-[#607568] mb-2">Learner invite link</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input readOnly value={inviteUrl} className="flex-1 px-3 py-2.5 text-xs font-mono" />
            <button onClick={copyInvite} className="scorm-button-secondary px-4 py-2.5 font-semibold text-xs inline-flex items-center justify-center gap-2">
              <Copy size={13} /> Copy link
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        <Metric label="Learners" value={learnerRegs.length} icon={Users} tint="bg-[#edf3ef]" tone="#607568" />
        <Metric label="Preview sessions" value={previewRegs.length} icon={Eye} tint="bg-[#f2eff6]" tone="#81759a" />
        <Metric label="In progress" value={active} icon={Clock3} tint="bg-[#eef3f7]" tone="#6f899b" />
        <Metric label="Completed" value={completed} icon={CheckCircle2} tint="bg-[#edf3ef]" tone="#607568" />
        <Metric label="Average progress" value={`${avgProgress.toFixed(0)}%`} tint="bg-[#f5f0e8]" tone="#987a52" />
        <Metric label="Unavailable" value={unavailable} icon={CircleDashed} tint="bg-[#f7eeee]" tone="#a86963" />
      </div>

      <div className="scorm-soft-card overflow-hidden">
        <div className="px-5 md:px-6 py-4 border-b border-[#e1e6e2] flex items-center justify-between gap-3 bg-[#fbfcfa]">
          <div>
            <div className="text-[11px] font-semibold text-[#829087]">Learning operations</div>
            <h3 className="font-semibold text-[17px] mt-0.5">Progress roster</h3>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[#7d8882]">
            <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-[#7b9285]' : 'bg-[#b8c0bc]'}`} />
            {live ? 'Live updates' : 'Refreshes every 12s'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-sm">
            <thead>
              <tr className="text-left text-[10px] font-semibold text-[#7f8a84] border-b border-[#e1e6e2] bg-[#f7f9f6]">
                <th className="p-4">Learner / preview</th>
                <th className="p-4 min-w-[220px]">Completion</th>
                <th className="p-4">Last location</th>
                <th className="p-4">Lesson status</th>
                <th className="p-4">Score</th>
                <th className="p-4">Time</th>
                <th className="p-4">Last activity</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {regs.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-[#929c97]">No learner or preview sessions yet.</td></tr>}
              {regs.map((r) => (
                <tr key={r.id} className={`border-b border-[#edf0ee] ${r.isPreview ? 'bg-[#fbf9fd]' : 'bg-white'} hover:bg-[#fafbf9]`}>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-[#34413b]">{r.learnerName || (r.isPreview ? 'Host Preview' : 'Learner')}</div>
                      {r.isPreview && <span className="rounded-full bg-[#f2eff6] border border-[#e3ddec] px-2 py-0.5 text-[8px] tracking-[0.08em] font-semibold text-[#81759a]">PREVIEW</span>}
                    </div>
                    <div className="text-[11px] text-[#929c97] mt-0.5">{r.learnerEmail || (r.isPreview ? 'Host QA session' : 'No email')}</div>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-between gap-3 mb-2">
                      <span className="font-semibold text-[11px] text-[#405048]">{r.progressAvailable ? `${Number(r.progressPercent).toFixed(0)}%` : '—'}</span>
                      <span className="text-[9px] font-medium text-[#8a948f]">{progressLabel(r)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#edf0ee] overflow-hidden">
                      {r.progressAvailable && <div className={`h-full rounded-full ${barTone(r.progressPercent || 0)}`} style={{ width: `${Math.max(0, Math.min(100, r.progressPercent || 0))}%` }} />}
                    </div>
                  </td>
                  <td className="p-4 text-[11px] font-medium text-[#66716b] max-w-[250px]">{r.lastLocation || 'Not started'}</td>
                  <td className="p-4 text-[11px] font-mono text-[#707a75]">{r.lastLessonStatus || '—'}</td>
                  <td className="p-4 font-semibold text-[#536159]">{r.lastScoreRaw != null ? r.lastScoreRaw : '—'}</td>
                  <td className="p-4 font-mono text-[11px] text-[#707a75]">{r.lastTotalTime || '—'}</td>
                  <td className="p-4 text-[11px] text-[#7f8a84]">{r.lastCommitAt ? new Date(r.lastCommitAt).toLocaleString() : r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—'}</td>
                  <td className="p-4">{r.status !== 'revoked' && <button onClick={() => revoke(r.id)} className="text-[10px] font-semibold text-[#a86963] hover:text-[#8f5954]">Revoke</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
