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

const Metric = ({ label, value, icon: Icon, bg = '#FFFFFF' }) => (
  <div className="rounded-2xl border border-black p-4" style={{ background: bg }}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="scorm-display text-2xl leading-none">{value}</div>
        <div className="scorm-micro mt-2 text-[8px] uppercase font-bold text-[#5A5A4F]">{label}</div>
      </div>
      {Icon && <div className="w-8 h-8 rounded-lg bg-[#F8F9EB] border border-black grid place-items-center text-black"><Icon size={15} /></div>}
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

  if (!course) return <div className="p-8 text-[#5A5A4F]">{msg || 'Loading course…'}</div>;

  const learnerRegs = regs.filter((r) => !r.isPreview);
  const previewRegs = regs.filter((r) => r.isPreview);
  const completed = trackingSummary?.completed ?? learnerRegs.filter((r) => r.progressAvailable && r.progressPercent >= 100).length;
  const active = trackingSummary?.active ?? learnerRegs.filter((r) => (r.progressAvailable && r.progressPercent > 0 && r.progressPercent < 100) || (!r.progressAvailable && r.status === 'active')).length;
  const avgProgress = Number(trackingSummary?.averageProgress || 0);
  const unavailable = Number(trackingSummary?.unavailable || 0);

  return (
    <div className="p-4 md:p-7 lg:p-9 max-w-[1500px] mx-auto">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-6 pb-7 border-b border-black">
        <div className="min-w-0 max-w-4xl">
          <div className="scorm-micro text-[10px] uppercase font-bold text-[#5A5A4F]">Course workspace</div>
          <h2 className="scorm-display text-[38px] md:text-[52px] mt-2 break-words">{course.title}</h2>
          <p className="text-sm mt-3 leading-relaxed max-w-3xl">{course.description || 'Manage publishing, learner access and progress for this course.'}</p>
          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <span className={`scorm-micro text-[8px] uppercase font-bold px-2.5 py-1 rounded-full border border-black ${course.status === 'published' ? 'bg-[#AAFDC0]' : 'bg-[#D3BEFF]'}`}>{course.status}</span>
            <span className="scorm-micro text-[9px] text-[#5A5A4F]">Invite {course.inviteCode}</span>
            <span className="scorm-micro text-[9px] text-[#5A5A4F]">{course.package?.standard || 'SCORM'}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {course.status !== 'published' ? (
            <button onClick={publish} className="scorm-button-primary px-4 py-2.5 text-xs font-bold">Publish</button>
          ) : (
            <button onClick={unpublish} className="scorm-button-secondary px-4 py-2.5 text-xs font-bold">Unpublish</button>
          )}
          <button onClick={preview} className="scorm-button-secondary px-4 py-2.5 text-xs font-bold inline-flex items-center gap-2">
            <Eye size={14} /> Preview as learner
          </button>
        </div>
      </div>

      {msg && <div className="mb-5 p-3.5 rounded-xl bg-[#B0F4FF] text-black text-sm border border-black">{msg}</div>}

      {course.status === 'published' && (
        <div className="rounded-[22px] bg-[#AAFDC0] border border-black p-4 md:p-5 mb-6">
          <div className="scorm-micro text-[9px] uppercase font-bold text-black mb-2">Learner invite link</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input readOnly value={inviteUrl} className="flex-1 px-3 py-2.5 text-xs font-mono" />
            <button onClick={copyInvite} className="scorm-button-secondary px-4 py-2.5 font-bold text-xs inline-flex items-center justify-center gap-2">
              <Copy size={13} /> Copy link
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        <Metric label="Learners" value={learnerRegs.length} icon={Users} />
        <Metric label="Preview sessions" value={previewRegs.length} icon={Eye} bg="#D3BEFF" />
        <Metric label="In progress" value={active} icon={Clock3} bg="#B0F4FF" />
        <Metric label="Completed" value={completed} icon={CheckCircle2} bg="#AAFDC0" />
        <Metric label="Average progress" value={`${avgProgress.toFixed(0)}%`} bg="#AAFDC0" />
        <Metric label="Unavailable" value={unavailable} icon={CircleDashed} bg="#FFC0E6" />
      </div>

      <div className="border border-black rounded-[22px] bg-white overflow-hidden">
        <div className="px-5 md:px-6 py-4 border-b border-black flex items-center justify-between gap-3 bg-[#F8F9EB]">
          <div>
            <div className="scorm-micro text-[9px] uppercase font-bold text-[#5A5A4F]">Learning operations</div>
            <h3 className="text-[20px] mt-1">Progress roster</h3>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#5A5A4F]">
            <span className={`w-2 h-2 rounded-full ${live ? 'bg-[#003D21]' : 'bg-[#C0C2A9]'}`} />
            {live ? 'Live updates' : 'Refreshes every 12s'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-sm">
            <thead>
              <tr className="text-left scorm-micro text-[9px] uppercase font-bold text-[#5A5A4F] border-b border-black bg-[#EDEEE1]">
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
              {regs.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-[#5A5A4F]">No learner or preview sessions yet.</td></tr>}
              {regs.map((r) => (
                <tr key={r.id} className={`border-b border-[#EDEEE1] ${r.isPreview ? 'bg-[#D3BEFF]' : 'bg-white'} hover:bg-[#AAFDC0]`}>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-black">{r.learnerName || (r.isPreview ? 'Host Preview' : 'Learner')}</div>
                      {r.isPreview && <span className="scorm-micro rounded-full bg-[#F8F9EB] border border-black px-2 py-0.5 text-[8px] uppercase font-bold text-black">Preview</span>}
                    </div>
                    <div className="text-[11px] text-[#5A5A4F] mt-0.5">{r.learnerEmail || (r.isPreview ? 'Host QA session' : 'No email')}</div>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-between gap-3 mb-2">
                      <span className="font-bold text-[11px] text-black">{r.progressAvailable ? `${Number(r.progressPercent).toFixed(0)}%` : '—'}</span>
                      <span className="scorm-micro text-[8px] uppercase font-bold text-[#5A5A4F]">{progressLabel(r)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#EDEEE1] border border-[#C0C2A9] overflow-hidden">
                      {r.progressAvailable && <div className="h-full bg-[#003D21]" style={{ width: `${Math.max(0, Math.min(100, r.progressPercent || 0))}%` }} />}
                    </div>
                  </td>
                  <td className="p-4 text-[11px] font-medium text-[#5A5A4F] max-w-[250px]">{r.lastLocation || 'Not started'}</td>
                  <td className="p-4 text-[11px] font-mono text-[#5A5A4F]">{r.lastLessonStatus || '—'}</td>
                  <td className="p-4 font-bold text-black">{r.lastScoreRaw != null ? r.lastScoreRaw : '—'}</td>
                  <td className="p-4 font-mono text-[11px] text-[#5A5A4F]">{r.lastTotalTime || '—'}</td>
                  <td className="p-4 text-[11px] text-[#5A5A4F]">{r.lastCommitAt ? new Date(r.lastCommitAt).toLocaleString() : r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—'}</td>
                  <td className="p-4">{r.status !== 'revoked' && <button onClick={() => revoke(r.id)} className="px-3 py-1.5 rounded-lg border border-[#3F0929] bg-white text-[10px] font-bold text-[#3F0929] hover:bg-[#3F0929] hover:text-white">Revoke</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
