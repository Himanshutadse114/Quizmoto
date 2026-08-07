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

export default function ScormCourseDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [regs, setRegs] = useState([]);
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
    return axios.get(apiUrl(`/api/scorm/courses/${id}/registrations`), { headers }).then((r) => {
      setRegs(r.data || []);
    });
  }, [id, token]);

  useEffect(() => {
    if (!token) return navigate('/login');
    loadCourse().catch((e) => setMsg(e.response?.data?.message || e.message));
    loadRoster().catch(() => {});
    const t = setInterval(() => {
      loadRoster().catch(() => {});
    }, 20000);
    return () => clearInterval(t);
  }, [token, id]);

  useEffect(() => {
    if (!socket || !token || !id) return;
    const onUpdate = (payload) => {
      if (!payload || String(payload.courseId) !== String(id)) return;
      const reg = payload.registration;
      if (!reg || !reg.id) {
        loadRoster().catch(() => {});
        return;
      }
      setRegs((prev) => {
        const idx = prev.findIndex((r) => r.id === reg.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...reg };
          return next;
        }
        return [reg, ...prev];
      });
      setLive(true);
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
  }, [socket, token, id]);

  const publish = async () => {
    try {
      const res = await axios.patch(
        apiUrl(`/api/scorm/courses/${id}`),
        { status: 'published' },
        { headers }
      );
      setCourse(res.data);
      setMsg('Course published — share the invite link');
    } catch (err) {
      setMsg(err.response?.data?.message || err.message);
    }
  };

  const unpublish = async () => {
    try {
      const res = await axios.patch(
        apiUrl(`/api/scorm/courses/${id}`),
        { status: 'draft' },
        { headers }
      );
      setCourse(res.data);
    } catch (err) {
      setMsg(err.response?.data?.message || err.message);
    }
  };

  const preview = async () => {
    try {
      const res = await axios.post(apiUrl(`/api/scorm/courses/${id}/preview`), {}, { headers });
      openPlayerPopup(
        res.data.registrationId,
        res.data.token,
        res.data.packageId,
        res.data.entryHref
      );
      setMsg('Preview opened in a popup window');
      await loadRoster();
    } catch (err) {
      setMsg(err.response?.data?.message || err.message);
    }
  };

  const revoke = async (regId) => {
    if (!window.confirm('Revoke this learner registration?')) return;
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

  if (!course) {
    return (
      <div className="min-h-screen p-8 text-white/60 relative z-10">
        {msg || 'Loading course…'}
      </div>
    );
  }

  const completed = regs.filter(
    (r) =>
      ['completed', 'passed', 'failed'].includes(r.lastLessonStatus) || r.status === 'completed'
  ).length;
  const active = regs.filter((r) => r.status === 'active').length;

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-5xl mx-auto relative z-10">
      <button onClick={() => navigate('/scorm')} className="text-sm text-white/60 hover:text-white mb-4">
        ← SCORM World
      </button>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter">{course.title}</h1>
          <p className="text-white/50 text-sm mt-1">{course.description || 'No description'}</p>
          <div className="mt-2 flex flex-wrap gap-2 items-center">
            <span
              className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                course.status === 'published'
                  ? 'bg-quizmoto-green/20 text-quizmoto-green'
                  : 'bg-white/10 text-white/50'
              }`}
            >
              {course.status}
            </span>
            <span className="text-xs text-white/40 font-mono">code: {course.inviteCode}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {course.status !== 'published' ? (
            <button
              onClick={publish}
              className="px-4 py-2 rounded-xl bg-quizmoto-green text-white text-xs font-black shadow-[0_3px_0_0_#1a5e08]"
            >
              Publish
            </button>
          ) : (
            <button
              onClick={unpublish}
              className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-bold"
            >
              Unpublish
            </button>
          )}
          <button
            onClick={preview}
            className="px-4 py-2 rounded-xl bg-quizmoto-blue text-white text-xs font-black"
          >
            Preview as learner
          </button>
        </div>
      </div>

      {msg && (
        <div className="mb-4 p-3 rounded-xl bg-white/10 text-sm border border-white/10">{msg}</div>
      )}

      {course.status === 'published' && (
        <div className="rounded-2xl bg-quizmoto-yellow/10 border border-quizmoto-yellow/30 p-4 mb-8">
          <div className="text-[10px] font-black uppercase tracking-widest text-quizmoto-yellow mb-2">
            Invite link (share with many learners)
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              readOnly
              value={inviteUrl}
              className="flex-1 bg-black/30 rounded-xl px-3 py-2 text-sm font-mono text-white/90 border border-white/10"
            />
            <button
              onClick={copyInvite}
              className="px-4 py-2 rounded-xl bg-quizmoto-yellow text-quizmoto-darkPurple font-black text-xs"
            >
              Copy link
            </button>
          </div>
          <p className="text-xs text-white/50 mt-2">
            Each learner who opens this link gets their own registration. Courses open in a popup player.
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
          <div className="text-2xl font-black">{regs.length}</div>
          <div className="text-[9px] font-black uppercase tracking-widest text-white/40">Learners</div>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
          <div className="text-2xl font-black text-quizmoto-blue">{active}</div>
          <div className="text-[9px] font-black uppercase tracking-widest text-white/40">Active</div>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
          <div className="text-2xl font-black text-quizmoto-green">{completed}</div>
          <div className="text-[9px] font-black uppercase tracking-widest text-white/40">Finished</div>
        </div>
      </div>

      <h2 className="text-lg font-black mb-3 uppercase tracking-tight flex items-center gap-2">
        Live roster
        <span className="text-[10px] font-bold text-white/40 normal-case tracking-normal">
          {live ? '● live' : 'connecting…'} · backup 20s
        </span>
      </h2>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5 text-left text-[10px] font-black uppercase tracking-widest text-white/50">
              <th className="p-3">Learner</th>
              <th className="p-3">Status</th>
              <th className="p-3">Lesson</th>
              <th className="p-3">Score</th>
              <th className="p-3">Time</th>
              <th className="p-3">Last update</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {regs.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-white/40">
                  No learners yet — share the invite link
                </td>
              </tr>
            )}
            {regs.map((r) => (
              <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="p-3">
                  <div className="font-bold">{r.learnerName || 'Learner'}</div>
                  {r.learnerEmail && (
                    <div className="text-xs text-white/40">{r.learnerEmail}</div>
                  )}
                  {r.isPreview && (
                    <span className="text-[9px] text-quizmoto-yellow font-black uppercase">Preview</span>
                  )}
                </td>
                <td className="p-3">
                  <span className="text-xs font-bold capitalize">{r.status}</span>
                </td>
                <td className="p-3">
                  <span className="text-xs font-mono">{r.lastLessonStatus || '—'}</span>
                </td>
                <td className="p-3 font-black">
                  {r.lastScoreRaw != null ? r.lastScoreRaw : '—'}
                </td>
                <td className="p-3 font-mono text-xs text-white/70">
                  {r.lastTotalTime || '—'}
                </td>
                <td className="p-3 text-xs text-white/40">
                  {r.lastCommitAt
                    ? new Date(r.lastCommitAt).toLocaleString()
                    : r.updatedAt
                      ? new Date(r.updatedAt).toLocaleString()
                      : '—'}
                </td>
                <td className="p-3">
                  {r.status !== 'revoked' && (
                    <button
                      onClick={() => revoke(r.id)}
                      className="text-[10px] font-bold text-red-300/80 hover:text-red-300"
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
