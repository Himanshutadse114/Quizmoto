import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
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
  try {
    win.focus();
  } catch (_) {}
  return win;
}

function barTone(value) {
  if (value >= 100) return 'bg-emerald-400';
  if (value >= 60) return 'bg-blue-400';
  if (value > 0) return 'bg-amber-400';
  return 'bg-white/15';
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
  }, [token, id]);

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
      setMsg('Course published — share the invite link');
    } catch (err) {
      setMsg(err.response?.data?.message || err.message);
    }
  };

  const unpublish = async () => {
    try {
      const res = await axios.patch(apiUrl(`/api/scorm/courses/${id}`), { status: 'draft' }, { headers });
      setCourse(res.data);
    } catch (err) {
      setMsg(err.response?.data?.message || err.message);
    }
  };

  const preview = async () => {
    try {
      const res = await axios.post(apiUrl(`/api/scorm/courses/${id}/preview`), {}, { headers });
      // The registration exists before the popup opens, so surface it immediately.
      await loadRoster().catch(() => {});
      openPlayerPopup(res.data.registrationId, res.data.token, res.data.packageId, res.data.entryHref);
      setMsg('Preview opened. This Host Preview session is tracked below but excluded from learner totals.');
    } catch (err) {
      setMsg(err.response?.data?.message || err.message);
    }
  };

  const revoke = async (regId) => {
    if (!window.confirm('Revoke this registration?')) return;
    try {
      await axios.post(apiUrl(`/api/scorm/registrations/${regId}/revoke`), {}, { headers });
      await loadRoster();
    } catch (err) {
      setMsg(err.response?.data?.message || err.message);
    }
  };

  const copyInvite = () => {
    navigator.clipboard?.writeText(inviteUrl);
    setMsg('Invite link copied');
  };

  if (!course) return <div className="p-8 text-white/60">{msg || 'Loading course…'}</div>;

  const learnerRegs = regs.filter((r) => !r.isPreview);
  const previewRegs = regs.filter((r) => r.isPreview);
  const completed = trackingSummary?.completed ?? learnerRegs.filter((r) => r.progressAvailable && r.progressPercent >= 100).length;
  const active = trackingSummary?.active ?? learnerRegs.filter((r) => (r.progressAvailable && r.progressPercent > 0 && r.progressPercent < 100) || (!r.progressAvailable && r.status === 'active')).length;
  const avgProgress = Number(trackingSummary?.averageProgress || 0);
  const unavailable = Number(trackingSummary?.unavailable || 0);

  return (
    <div className="p-4 md:p-8 max-w-[1500px] mx-auto">
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5 mb-6">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.18em] font-black text-white/45">Course Workspace</div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mt-2">{course.title}</h2>
          <p className="text-white/60 text-sm mt-2 max-w-3xl">{course.description || 'Manage publishing, learner access and progress for this course.'}</p>
          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <span className={`text-[9px] font-black uppercase tracking-[0.14em] px-2.5 py-1 rounded-full ${course.status === 'published' ? 'bg-emerald-600 text-white' : 'bg-[#314572] text-white/80'}`}>{course.status}</span>
            <span className="text-xs text-white/55 font-mono">Invite {course.inviteCode}</span>
            <span className="text-xs text-white/55">{course.package?.standard || 'SCORM'}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {course.status !== 'published' ? (
            <button onClick={publish} className="px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-black">Publish</button>
          ) : (
            <button onClick={unpublish} className="px-4 py-2.5 rounded-xl bg-[#314572] border border-[#4c5f96] text-white text-xs font-bold">Unpublish</button>
          )}
          <button onClick={preview} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black">Preview as learner</button>
        </div>
      </div>

      {msg && <div className="mb-5 p-3.5 rounded-xl bg-[#293b68] text-sm border border-[#4c5f96]">{msg}</div>}

      {course.status === 'published' && (
        <div className="rounded-2xl bg-[#51461f] border border-[#75672e] p-4 mb-6">
          <div className="text-[9px] font-black uppercase tracking-[0.16em] text-quizmoto-yellow mb-2">Learner invite link</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input readOnly value={inviteUrl} className="flex-1 bg-[#1c2a4d] rounded-xl px-3 py-2.5 text-sm font-mono text-white border border-[#4c5f96]" />
            <button onClick={copyInvite} className="px-4 py-2.5 rounded-xl bg-quizmoto-yellow text-[#171126] font-black text-xs">Copy link</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        {[
          ['Learners', learnerRegs.length, 'text-white'],
          ['Preview sessions', previewRegs.length, 'text-violet-200'],
          ['In progress', active, 'text-blue-300'],
          ['Completed', completed, 'text-emerald-300'],
          ['Average progress', `${avgProgress.toFixed(0)}%`, 'text-quizmoto-yellow'],
          ['Unavailable', unavailable, 'text-white/70']
        ].map(([label, value, cls]) => (
          <div key={label} className="rounded-2xl bg-[#263762] border border-[#3f4f86] p-4 md:p-5">
            <div className={`text-2xl md:text-3xl font-black ${cls}`}>{value}</div>
            <div className="text-[9px] font-black uppercase tracking-[0.14em] text-white/50 mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[#3f4f86] bg-[#22325a] overflow-hidden">
        <div className="px-4 md:px-5 py-4 border-b border-[#3f4f86] flex items-center justify-between gap-3 bg-[#293b68]">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-white/45 font-black">Learning operations</div>
            <h3 className="font-black mt-1">Progress roster</h3>
          </div>
          <span className="text-[10px] font-bold text-white/55">{live ? 'Live updates active' : '12s refresh'}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-sm">
            <thead>
              <tr className="text-left text-[9px] font-black uppercase tracking-[0.14em] text-white/50 border-b border-[#3f4f86] bg-[#24355e]">
                <th className="p-3.5">Learner / Preview</th>
                <th className="p-3.5 min-w-[220px]">Completion</th>
                <th className="p-3.5">Last location</th>
                <th className="p-3.5">Lesson status</th>
                <th className="p-3.5">Score</th>
                <th className="p-3.5">Time</th>
                <th className="p-3.5">Last activity</th>
                <th className="p-3.5"></th>
              </tr>
            </thead>
            <tbody>
              {regs.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-white/50">No learner or preview sessions yet.</td></tr>}
              {regs.map((r) => (
                <tr key={r.id} className={`border-b border-[#33456f] ${r.isPreview ? 'bg-[#302d61]' : 'bg-[#22325a]'} hover:bg-[#2a3e69]`}>
                  <td className="p-3.5">
                    <div className="flex items-center gap-2">
                      <div className="font-black">{r.learnerName || (r.isPreview ? 'Host Preview' : 'Learner')}</div>
                      {r.isPreview && <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[8px] uppercase tracking-[0.12em] font-black text-white">Preview</span>}
                    </div>
                    <div className="text-xs text-white/50 mt-0.5">{r.learnerEmail || (r.isPreview ? 'Host QA session' : 'No email')}</div>
                  </td>
                  <td className="p-3.5">
                    <div className="flex justify-between gap-3 mb-2"><span className="font-black text-xs">{r.progressAvailable ? `${Number(r.progressPercent).toFixed(0)}%` : '—'}</span><span className="text-[9px] uppercase tracking-[0.1em] font-black text-white/50">{progressLabel(r)}</span></div>
                    <div className="h-2 rounded-full bg-[#182544] overflow-hidden">{r.progressAvailable && <div className={`h-full rounded-full ${barTone(r.progressPercent || 0)}`} style={{ width: `${Math.max(0, Math.min(100, r.progressPercent || 0))}%` }} />}</div>
                  </td>
                  <td className="p-3.5 text-xs font-bold text-white/75 max-w-[250px]">{r.lastLocation || 'Not started'}</td>
                  <td className="p-3.5 text-xs font-mono text-white/70">{r.lastLessonStatus || '—'}</td>
                  <td className="p-3.5 font-black">{r.lastScoreRaw != null ? r.lastScoreRaw : '—'}</td>
                  <td className="p-3.5 font-mono text-xs text-white/70">{r.lastTotalTime || '—'}</td>
                  <td className="p-3.5 text-xs text-white/60">{r.lastCommitAt ? new Date(r.lastCommitAt).toLocaleString() : r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—'}</td>
                  <td className="p-3.5">{r.status !== 'revoked' && <button onClick={() => revoke(r.id)} className="text-[10px] font-black text-red-300 hover:text-red-200">Revoke</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
