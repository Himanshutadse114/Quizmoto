import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
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
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { apiUrl } from '../../config';

function sessionKey(workspaceId) {
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

function GoogleLearnerButton({ clientId, onSuccess, onError }) {
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <div className="w-full overflow-hidden rounded-xl">
        <GoogleLogin
          onSuccess={onSuccess}
          onError={onError}
          theme="outline"
          size="large"
          shape="rectangular"
          text="continue_with"
          width="360"
        />
      </div>
    </GoogleOAuthProvider>
  );
}

export default function LearnerPortal() {
  const { workspaceId } = useParams();
  const [config, setConfig] = useState(null);
  const [learnerToken, setLearnerToken] = useState(() => localStorage.getItem(sessionKey(workspaceId)) || '');
  const [dashboard, setDashboard] = useState(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadConfig = useCallback(async () => {
    const res = await axios.get(apiUrl(`/api/scorm-learner/workspace/${workspaceId}/config`));
    setConfig(res.data?.config || null);
    return res.data?.config;
  }, [workspaceId]);

  const loadDashboard = useCallback(async (token = learnerToken) => {
    if (!token) return null;
    const res = await axios.get(apiUrl('/api/scorm-learner/dashboard'), {
      headers: { Authorization: `Bearer ${token}` }
    });
    setDashboard(res.data);
    return res.data;
  }, [learnerToken]);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      setLoading(true);
      setError('');
      try {
        await loadConfig();
        if (learnerToken) await loadDashboard(learnerToken);
      } catch (err) {
        if (err.response?.status === 401) {
          localStorage.removeItem(sessionKey(workspaceId));
          if (!cancelled) setLearnerToken('');
        } else if (!cancelled) {
          setError(err.response?.data?.message || 'Unable to open this learner portal.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    start();
    return () => { cancelled = true; };
  }, [workspaceId]);

  useEffect(() => {
    const onMessage = (event) => {
      if (event.data?.type === 'quizmoto-scorm-progress' || event.data?.type === 'quizmoto-scorm-exit') {
        loadDashboard().catch(() => {});
      }
    };
    const onFocus = () => learnerToken && loadDashboard().catch(() => {});
    window.addEventListener('message', onMessage);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('focus', onFocus);
    };
  }, [learnerToken, loadDashboard]);

  const acceptSession = (data) => {
    if (!data?.token) throw new Error('Learner sign-in did not return a session.');
    localStorage.setItem(sessionKey(workspaceId), data.token);
    setLearnerToken(data.token);
    setDashboard({ learner: data.learner, workspace: data.workspace, courses: data.courses || [] });
  };

  const loginEmail = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await axios.post(apiUrl(`/api/scorm-learner/workspace/${workspaceId}/email`), {
        email: email.trim().toLowerCase(),
        name: name.trim()
      });
      acceptSession(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Learner sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const loginGoogle = async (credentialResponse) => {
    if (!credentialResponse?.credential) return setError('Google did not return a valid sign-in credential.');
    setBusy(true);
    setError('');
    try {
      const res = await axios.post(apiUrl(`/api/scorm-learner/workspace/${workspaceId}/google`), {
        credential: credentialResponse.credential
      });
      acceptSession(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Google learner sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const loginMicrosoft = () => {
    if (!config?.microsoftClientId || !config?.microsoftTenantId) return;
    const state = crypto.randomUUID();
    const nonce = crypto.randomUUID();
    sessionStorage.setItem(`lmsgen_ms_state_${workspaceId}`, state);
    const redirectUri = `${window.location.origin}/learn/${workspaceId}/microsoft/callback`;
    const params = new URLSearchParams({
      client_id: config.microsoftClientId,
      response_type: 'id_token',
      redirect_uri: redirectUri,
      response_mode: 'fragment',
      scope: 'openid profile email',
      state,
      nonce,
      prompt: 'select_account'
    });
    window.location.assign(`https://login.microsoftonline.com/${encodeURIComponent(config.microsoftTenantId)}/oauth2/v2.0/authorize?${params.toString()}`);
  };

  const logout = () => {
    localStorage.removeItem(sessionKey(workspaceId));
    setLearnerToken('');
    setDashboard(null);
  };

  const launch = async (course) => {
    setBusy(true);
    setError('');
    try {
      const res = await axios.post(apiUrl(`/api/scorm-learner/courses/${course.registrationId}/launch`), {}, {
        headers: { Authorization: `Bearer ${learnerToken}` }
      });
      const data = res.data;
      const query = new URLSearchParams({
        token: data.token,
        entryHref: data.entryHref || '',
        packageId: data.packageId || ''
      });
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
          <div className="ml-auto flex items-center gap-2">
            {dashboard?.learner && <div className="hidden sm:block text-right"><div className="text-xs font-semibold">{dashboard.learner.name}</div><div className="text-[10px] text-[#6c817e]">{dashboard.learner.email}</div></div>}
            {dashboard && <button type="button" onClick={logout} className="h-10 px-3 rounded-xl border border-[#d4e2df] bg-white text-xs font-semibold inline-flex items-center gap-2"><LogOut size={14} /> Sign out</button>}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-7 py-7 md:py-10">
        {!dashboard ? (
          <div className="max-w-lg mx-auto">
            <section className="bg-white border border-[#dce8e5] rounded-[24px] shadow-[0_20px_60px_rgba(16,35,33,.08)] overflow-hidden">
              <div className="p-6 md:p-8 border-b border-[#e1ece9] bg-gradient-to-br from-[#e9f8f5] to-white">
                <div className="w-11 h-11 rounded-2xl bg-[#c8f0eb] text-[#087b73] grid place-items-center mb-5"><GraduationCap size={21} /></div>
                <div className="text-[10px] uppercase tracking-[.14em] font-bold text-[#5b7773]">Learner portal</div>
                <h1 className="text-3xl md:text-[38px] font-semibold tracking-[-.04em] leading-tight mt-2">{config?.workspaceName || 'Your learning workspace'}</h1>
                <p className="text-sm leading-relaxed text-[#617572] mt-3">Sign in with the method your administrator configured. Only identities with assigned courses can enter.</p>
              </div>

              <div className="p-6 md:p-8 space-y-3">
                {error && <div className="rounded-xl border border-[#f5c4cc] bg-[#fff3f5] text-[#9f3345] px-4 py-3 text-xs leading-relaxed">{error}</div>}

                {config?.googleEnabled && config?.googleClientId && (
                  <GoogleLearnerButton clientId={config.googleClientId} onSuccess={loginGoogle} onError={() => setError('Google sign-in failed. Please try again.')} />
                )}

                {config?.microsoftEnabled && (
                  <button type="button" onClick={loginMicrosoft} disabled={busy} className="w-full h-11 rounded-xl border border-[#cfdcda] bg-white hover:bg-[#f7faf9] transition text-sm font-semibold flex items-center justify-center gap-3 disabled:opacity-50">
                    <span className="grid grid-cols-2 gap-[2px] w-4 h-4"><span className="bg-[#f25022]" /><span className="bg-[#7fba00]" /><span className="bg-[#00a4ef]" /><span className="bg-[#ffb900]" /></span>
                    Continue with Microsoft
                  </button>
                )}

                {(config?.googleEnabled || config?.microsoftEnabled) && config?.emailEnabled && <div className="flex items-center gap-3 py-1"><span className="h-px bg-[#dce8e5] flex-1" /><span className="text-[10px] uppercase tracking-[.12em] text-[#81928f]">or assigned email</span><span className="h-px bg-[#dce8e5] flex-1" /></div>}

                {config?.emailEnabled && (
                  <form onSubmit={loginEmail} className="space-y-3">
                    <label className="block"><span className="block text-[10px] uppercase tracking-[.1em] font-bold text-[#5e7773] mb-1.5">Email assigned by your administrator</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-11 rounded-xl border border-[#cfdcda] bg-white px-3.5 text-sm outline-none focus:border-[#1aa99e]" placeholder="you@company.com" /></label>
                    <label className="block"><span className="block text-[10px] uppercase tracking-[.1em] font-bold text-[#5e7773] mb-1.5">Name · optional</span><input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-11 rounded-xl border border-[#cfdcda] bg-white px-3.5 text-sm outline-none focus:border-[#1aa99e]" placeholder="Your name" /></label>
                    <button type="submit" disabled={busy} className="w-full h-11 rounded-xl bg-[#45c5bc] hover:bg-[#36b7ae] text-[#0d2926] text-sm font-semibold disabled:opacity-50">{busy ? 'Checking assignment…' : 'Open my dashboard'}</button>
                  </form>
                )}

                {config?.ssoRequired && <div className="rounded-xl bg-[#f0f7f6] border border-[#d7e7e4] px-3.5 py-3 text-[11px] leading-relaxed text-[#607572] flex gap-2"><ShieldCheck size={15} className="text-[#159b91] shrink-0" />Your organisation requires verified SSO. There is no manual learner-email login on this workspace.</div>}
              </div>
            </section>
          </div>
        ) : (
          <>
            <section className="rounded-[24px] bg-[#102321] text-white p-6 md:p-8 overflow-hidden relative">
              <div className="absolute -right-16 -top-20 w-64 h-64 rounded-full border-[36px] border-[#45c5bc]/20" />
              <div className="relative grid md:grid-cols-[1fr_auto] gap-7 md:items-end">
                <div><div className="text-[10px] uppercase tracking-[.16em] font-bold text-[#8bd8d1]">{dashboard.workspace?.name || 'Learning dashboard'}</div><h1 className="text-3xl md:text-[46px] font-semibold tracking-[-.045em] mt-2">Welcome, {dashboard.learner?.name || 'Learner'}</h1><p className="text-sm text-white/65 mt-3 max-w-2xl">Your assigned courses are collected here. Progress and scores update automatically as you complete the learning.</p></div>
                <div className="min-w-[170px]"><div className="flex justify-between text-xs mb-2"><span>Overall progress</span><strong>{progress}%</strong></div><div className="h-2 rounded-full bg-white/15 overflow-hidden"><div className="h-full bg-[#45c5bc] rounded-full" style={{ width: `${progress}%` }} /></div><div className="text-[10px] text-white/55 mt-2">{completed} of {courses.length} completed</div></div>
              </div>
            </section>

            {error && <div className="mt-5 rounded-xl border border-[#f5c4cc] bg-[#fff3f5] text-[#9f3345] px-4 py-3 text-sm">{error}</div>}

            <div className="mt-7 flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Assigned courses</h2><p className="text-xs text-[#6c817e] mt-1">{courses.length} course{courses.length === 1 ? '' : 's'} assigned to {dashboard.learner?.email}</p></div><button type="button" onClick={() => loadDashboard()} className="w-10 h-10 rounded-xl border border-[#d4e2df] bg-white grid place-items-center"><RefreshCw size={15} /></button></div>

            {courses.length === 0 ? (
              <div className="mt-5 bg-white border border-[#dce8e5] rounded-2xl p-10 text-center"><BookOpen size={25} className="mx-auto text-[#78908c]" /><div className="font-semibold mt-3">No courses assigned</div><p className="text-xs text-[#718682] mt-1">Contact your administrator if you expected to see a course here.</p></div>
            ) : (
              <div className="mt-5 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {courses.map((course) => {
                  const due = formatDate(course.dueAt);
                  const complete = course.status === 'completed';
                  return (
                    <article key={course.registrationId} className="bg-white border border-[#dce8e5] rounded-2xl p-5 flex flex-col min-h-[260px] shadow-[0_8px_30px_rgba(16,35,33,.04)]">
                      <div className="flex items-start justify-between gap-3"><div className={`w-10 h-10 rounded-xl grid place-items-center ${complete ? 'bg-[#ddf6ed] text-[#187a59]' : 'bg-[#e3f5f3] text-[#117f77]'}`}>{complete ? <CheckCircle2 size={18} /> : <BookOpen size={18} />}</div><span className={`px-2.5 py-1 rounded-full text-[9px] uppercase tracking-[.08em] font-bold ${complete ? 'bg-[#e4f7ef] text-[#237a5d]' : course.status === 'in_progress' ? 'bg-[#fff2d9] text-[#9b6815]' : 'bg-[#eff4f3] text-[#647a76]'}`}>{statusLabel(course.status)}</span></div>
                      <h3 className="text-lg font-semibold tracking-[-.02em] mt-5 leading-snug">{course.title}</h3>
                      <p className="text-xs leading-relaxed text-[#6d817e] mt-2 line-clamp-3">{course.description || 'Assigned learning course'}</p>
                      <div className="mt-auto pt-5 space-y-2 text-[11px] text-[#647a76]">
                        {due && <div className="flex items-center gap-2"><CalendarDays size={13} /> Due {due}</div>}
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
