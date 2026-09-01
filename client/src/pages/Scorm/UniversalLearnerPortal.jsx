import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  GraduationCap,
  LogOut,
  RefreshCw
} from 'lucide-react';
import { apiUrl } from '../../config';
import LearnerEmailOtpLogin from './LearnerEmailOtpLogin';

const UNIVERSAL_SESSION_KEY = 'lmsgen_learner_universal';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '1001652255296-695gf3vjul0fjh1oden4k2n6tvvdvncn.apps.googleusercontent.com';

function workspaceSessionKey(workspaceId) {
  return `lmsgen_learner_${workspaceId}`;
}

function statusLabel(status) {
  if (status === 'completed') return 'Completed';
  if (status === 'in_progress') return 'In progress';
  return 'Not started';
}

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function MicrosoftMark() {
  return (
    <span className="grid grid-cols-2 gap-[2px] w-4 h-4" aria-hidden="true">
      <span className="bg-[#f25022]" /><span className="bg-[#7fba00]" />
      <span className="bg-[#00a4ef]" /><span className="bg-[#ffb900]" />
    </span>
  );
}

function GoogleButton({ onSuccess, onError }) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="w-full overflow-hidden rounded-xl flex justify-center">
        <GoogleLogin onSuccess={onSuccess} onError={onError} theme="outline" size="large" shape="rectangular" text="continue_with" width="360" />
      </div>
    </GoogleOAuthProvider>
  );
}

export default function UniversalLearnerPortal() {
  const navigate = useNavigate();
  const [workspaceId, setWorkspaceId] = useState('');
  const [token, setToken] = useState(() => localStorage.getItem(UNIVERSAL_SESSION_KEY) || '');
  const [dashboard, setDashboard] = useState(null);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [loading, setLoading] = useState(Boolean(token));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async (sessionToken = token) => {
    if (!sessionToken) return null;
    const res = await axios.get(apiUrl('/api/scorm-learner/dashboard'), {
      headers: { Authorization: `Bearer ${sessionToken}` }
    });
    setDashboard(res.data);
    if (res.data?.workspace?.id) setWorkspaceId(res.data.workspace.id);
    return res.data;
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        await loadDashboard(token);
      } catch (_) {
        localStorage.removeItem(UNIVERSAL_SESSION_KEY);
        if (!cancelled) {
          setToken('');
          setDashboard(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    restore();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const refresh = () => token && loadDashboard().catch(() => {});
    const onMessage = (event) => {
      if (event.data?.type === 'quizmoto-scorm-progress' || event.data?.type === 'quizmoto-scorm-exit') refresh();
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('message', onMessage);
    };
  }, [token, loadDashboard]);

  const acceptSession = async (data) => {
    if (!data?.token) throw new Error('Learner sign-in did not return a session.');
    const id = data.workspace?.id || workspaceId;
    localStorage.setItem(UNIVERSAL_SESSION_KEY, data.token);
    if (id) localStorage.setItem(workspaceSessionKey(id), data.token);
    setToken(data.token);
    setWorkspaceId(id || '');
    setDashboard({ learner: data.learner, workspace: data.workspace, courses: data.courses || [] });
  };

  const loginGoogle = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      setError('Google did not return a valid sign-in credential.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await axios.post(apiUrl('/api/scorm-learner/google'), { credential: credentialResponse.credential });
      await acceptSession(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Google learner sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(UNIVERSAL_SESSION_KEY);
    if (workspaceId) localStorage.removeItem(workspaceSessionKey(workspaceId));
    setToken('');
    setDashboard(null);
    setWorkspaceId('');
    setShowEmailLogin(false);
  };

  const launch = async (course) => {
    setBusy(true);
    setError('');
    try {
      const res = await axios.post(apiUrl(`/api/scorm-learner/courses/${course.registrationId}/launch`), {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.data;
      const query = new URLSearchParams({ token: data.token, entryHref: data.entryHref || '', packageId: data.packageId || '' });
      const url = apiUrl(`/api/scorm/play/${data.registrationId}?${query.toString()}`);
      const popup = window.open(url, `lmsgen_course_${data.registrationId}`, 'popup=yes,width=1280,height=820,resizable=yes,scrollbars=yes');
      if (!popup) window.location.assign(url);
      else popup.focus();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to launch this course.');
    } finally {
      setBusy(false);
    }
  };

  const courses = dashboard?.courses || [];
  const completed = courses.filter((course) => course.status === 'completed').length;
  const progress = courses.length ? Math.round((completed / courses.length) * 100) : 0;

  if (loading) {
    return <div className="min-h-screen bg-[#f4f8f7] text-[#102321] grid place-items-center"><div className="text-center"><RefreshCw size={22} className="animate-spin mx-auto text-[#159b91]" /><div className="mt-3 text-sm text-[#58706d]">Loading learner portal…</div></div></div>;
  }

  return (
    <div className="min-h-screen bg-[#f4f8f7] text-[#102321]">
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-[#dce8e5]">
        <div className="max-w-6xl mx-auto px-4 md:px-7 h-16 flex items-center gap-3">
          <img src="/branding/lmsgen-logo-light.png" alt="LMSGEN" className="w-[118px] h-auto" />
          {dashboard && <button type="button" onClick={logout} className="ml-auto h-10 px-3 rounded-xl border border-[#d4e2df] bg-white text-xs font-semibold inline-flex items-center gap-2"><LogOut size={14} /> Sign out</button>}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-7 py-8 md:py-11">
        {!dashboard ? (
          <section className="max-w-md mx-auto bg-white border border-[#dce8e5] rounded-[24px] shadow-[0_20px_60px_rgba(16,35,33,.08)] overflow-hidden">
            <div className="p-6 md:p-7 border-b border-[#e1ece9] bg-gradient-to-br from-[#e9f8f5] to-white">
              <div className="w-11 h-11 rounded-2xl bg-[#c8f0eb] text-[#087b73] grid place-items-center mb-4"><GraduationCap size={21} /></div>
              <div className="text-[10px] uppercase tracking-[.14em] font-bold text-[#5b7773]">Learner portal</div>
              <h1 className="text-2xl md:text-[30px] font-semibold tracking-[-.035em] leading-tight mt-2">Sign in to your learning</h1>
              <p className="text-sm leading-relaxed text-[#617572] mt-2">Use Microsoft, Google or your assigned work email. Email sign-in is protected by a one-time verification code.</p>
            </div>

            <div className="p-6 md:p-7 space-y-3">
              {error && <div className="rounded-xl border border-[#f5c4cc] bg-[#fff3f5] text-[#9f3345] px-4 py-3 text-xs leading-relaxed">{error}</div>}

              <button type="button" onClick={() => navigate('/learn/microsoft')} disabled={busy} className="w-full h-11 rounded-xl border border-[#cfdcda] bg-white hover:bg-[#f7faf9] transition text-sm font-semibold flex items-center justify-center gap-3 disabled:opacity-50">
                <MicrosoftMark /> Continue with Microsoft
              </button>

              <GoogleButton onSuccess={loginGoogle} onError={() => setError('Google sign-in failed. Please try again.')} />

              <div className="flex items-center gap-3 py-1"><span className="h-px bg-[#dce8e5] flex-1" /><span className="text-[10px] uppercase tracking-[.12em] text-[#81928f]">or</span><span className="h-px bg-[#dce8e5] flex-1" /></div>

              {!showEmailLogin ? (
                <button type="button" onClick={() => { setShowEmailLogin(true); setError(''); }} className="w-full h-10 rounded-xl text-xs font-semibold text-[#32645f] hover:bg-[#f2f8f7]">Use assigned email instead</button>
              ) : (
                <div className="rounded-xl border border-[#dce8e5] p-4 bg-[#fbfdfd]">
                  <LearnerEmailOtpLogin
                    compact
                    onWorkspaceResolved={setWorkspaceId}
                    onAuthenticated={acceptSession}
                  />
                </div>
              )}
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-[24px] bg-[#102321] text-white p-6 md:p-8 overflow-hidden relative">
              <div className="absolute -right-16 -top-20 w-64 h-64 rounded-full border-[36px] border-[#45c5bc]/20" />
              <div className="relative grid md:grid-cols-[1fr_auto] gap-7 md:items-end">
                <div><div className="text-[10px] uppercase tracking-[.16em] font-bold text-[#8bd8d1]">{dashboard.workspace?.name || 'Learning dashboard'}</div><h1 className="text-3xl md:text-[46px] font-semibold tracking-[-.045em] mt-2">Welcome, {dashboard.learner?.name || 'Learner'}</h1><p className="text-sm text-white/65 mt-3 max-w-2xl">All current courses assigned to your verified email are collected here, including campaign courses.</p></div>
                <div className="min-w-[170px]"><div className="flex justify-between text-xs mb-2"><span>Overall progress</span><strong>{progress}%</strong></div><div className="h-2 rounded-full bg-white/15 overflow-hidden"><div className="h-full bg-[#45c5bc] rounded-full" style={{ width: `${progress}%` }} /></div><div className="text-[10px] text-white/55 mt-2">{completed} of {courses.length} completed</div></div>
              </div>
            </section>

            {error && <div className="mt-5 rounded-xl border border-[#f5c4cc] bg-[#fff3f5] text-[#9f3345] px-4 py-3 text-sm">{error}</div>}
            <div className="mt-7 flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Assigned courses</h2><p className="text-xs text-[#6c817e] mt-1">{courses.length} course{courses.length === 1 ? '' : 's'} assigned to {dashboard.learner?.email}</p></div><button type="button" onClick={() => loadDashboard()} className="w-10 h-10 rounded-xl border border-[#d4e2df] bg-white grid place-items-center"><RefreshCw size={15} /></button></div>

            {courses.length === 0 ? (
              <div className="mt-5 bg-white border border-[#dce8e5] rounded-2xl p-10 text-center"><BookOpen size={25} className="mx-auto text-[#78908c]" /><div className="font-semibold mt-3">No courses assigned</div></div>
            ) : (
              <div className="mt-5 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {courses.map((course) => {
                  const complete = course.status === 'completed';
                  return (
                    <article key={course.registrationId} className="bg-white border border-[#dce8e5] rounded-2xl p-5 flex flex-col min-h-[260px] shadow-[0_8px_30px_rgba(16,35,33,.04)]">
                      <div className="flex items-start justify-between gap-3"><div className={`w-10 h-10 rounded-xl grid place-items-center ${complete ? 'bg-[#ddf6ed] text-[#187a59]' : 'bg-[#e3f5f3] text-[#117f77]'}`}>{complete ? <CheckCircle2 size={18} /> : <BookOpen size={18} />}</div><span className="px-2.5 py-1 rounded-full text-[9px] uppercase tracking-[.08em] font-bold bg-[#eff4f3] text-[#647a76]">{statusLabel(course.status)}</span></div>
                      <h3 className="text-lg font-semibold tracking-[-.02em] mt-5 leading-snug">{course.title}</h3>
                      <p className="text-xs leading-relaxed text-[#6d817e] mt-2 line-clamp-3">{course.description || 'Assigned learning course'}</p>
                      <div className="mt-auto pt-5 space-y-2 text-[11px] text-[#647a76]">
                        {course.dueAt && <div className="flex items-center gap-2"><CalendarDays size={13} /> Due {formatDate(course.dueAt)}</div>}
                        {course.lastActivityAt && <div className="flex items-center gap-2"><Clock3 size={13} /> Last activity {formatDate(course.lastActivityAt)}</div>}
                        {course.score != null && <div className="flex items-center gap-2"><GraduationCap size={13} /> Score {Math.round(course.score)}%</div>}
                      </div>
                      <button type="button" disabled={busy} onClick={() => launch(course)} className="mt-4 w-full h-10 rounded-xl bg-[#45c5bc] hover:bg-[#36b7ae] text-[#0d2926] text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"><ExternalLink size={13} />{complete ? 'Review course' : course.status === 'in_progress' ? 'Continue course' : 'Start course'}</button>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
