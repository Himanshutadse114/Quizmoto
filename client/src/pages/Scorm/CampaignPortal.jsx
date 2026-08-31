import React, { useCallback, useEffect, useState } from 'react';
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
import { createMicrosoftPkceRequest } from './microsoftPkce';

function sessionKey(campaignId) {
  return `lmsgen_campaign_${campaignId}`;
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

function GoogleButton({ clientId, onSuccess, onError }) {
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <div className="w-full overflow-hidden rounded-xl flex justify-center">
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

export default function CampaignPortal() {
  const { campaignId } = useParams();
  const [config, setConfig] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(sessionKey(campaignId)) || '');
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadConfig = useCallback(async () => {
    const res = await axios.get(apiUrl(`/api/scorm-learner/campaign/${campaignId}/config`));
    setConfig(res.data?.config || null);
    return res.data?.config || null;
  }, [campaignId]);

  const loadDashboard = useCallback(async (sessionToken = token) => {
    if (!sessionToken) return null;
    const res = await axios.get(apiUrl('/api/scorm-learner/campaign/session/dashboard'), {
      headers: { Authorization: `Bearer ${sessionToken}` }
    });
    setDashboard(res.data);
    return res.data;
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      setLoading(true);
      setError('');
      try {
        await loadConfig();
        if (token) await loadDashboard(token);
      } catch (err) {
        if (err.response?.status === 401) {
          localStorage.removeItem(sessionKey(campaignId));
          if (!cancelled) setToken('');
        } else if (!cancelled) {
          setError(err.response?.data?.message || 'Unable to open this campaign.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    start();
    return () => { cancelled = true; };
  }, [campaignId]);

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
    if (!data?.token) throw new Error('SSO did not return a campaign session.');
    localStorage.setItem(sessionKey(campaignId), data.token);
    setToken(data.token);
    await loadDashboard(data.token);
  };

  const loginGoogle = async (credentialResponse) => {
    if (!credentialResponse?.credential) return setError('Google did not return a valid credential.');
    setBusy(true);
    setError('');
    try {
      const res = await axios.post(apiUrl(`/api/scorm-learner/campaign/${campaignId}/google`), {
        credential: credentialResponse.credential
      });
      await acceptSession(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const loginMicrosoft = async () => {
    if (!config?.microsoftClientId || !config?.microsoftTenantId || !config?.workspaceId) return;
    setBusy(true);
    setError('');
    try {
      const redirectUri = `${window.location.origin}/learn/${config.workspaceId}/microsoft/callback`;
      const pending = await createMicrosoftPkceRequest({
        clientId: config.microsoftClientId,
        tenantId: config.microsoftTenantId,
        redirectUri
      });
      sessionStorage.setItem('lmsgen_ms_campaign_pending', JSON.stringify({
        campaignId,
        workspaceId: config.workspaceId,
        state: pending.state,
        nonce: pending.nonce,
        verifier: pending.verifier,
        clientId: pending.clientId,
        tenantId: pending.tenantId,
        redirectUri: pending.redirectUri
      }));
      window.location.assign(pending.authorizeUrl);
    } catch (err) {
      setBusy(false);
      setError(err.message || 'Microsoft sign-in could not start.');
    }
  };

  const logout = () => {
    localStorage.removeItem(sessionKey(campaignId));
    setToken('');
    setDashboard(null);
  };

  const launch = async (course) => {
    setBusy(true);
    setError('');
    try {
      const res = await axios.post(apiUrl(`/api/scorm-learner/campaign/session/courses/${course.registrationId}/launch`), {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.data;
      const query = new URLSearchParams({
        token: data.token,
        entryHref: data.entryHref || '',
        packageId: data.packageId || ''
      });
      const url = apiUrl(`/api/scorm/play/${data.registrationId}?${query.toString()}`);
      const popup = window.open(url, `lmsgen_campaign_course_${data.registrationId}`, 'popup=yes,width=1280,height=820,resizable=yes,scrollbars=yes');
      if (!popup) window.location.assign(url);
      else popup.focus();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to launch this course.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#f4f8f7] text-[#102321] grid place-items-center"><div className="text-center"><RefreshCw size={22} className="animate-spin mx-auto text-[#159b91]" /><div className="mt-3 text-sm text-[#58706d]">Loading campaign…</div></div></div>;
  }

  const courses = dashboard?.courses || [];
  const completed = courses.filter((course) => course.status === 'completed').length;
  const progress = courses.length ? Math.round((completed / courses.length) * 100) : 0;

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
          <section className="max-w-lg mx-auto bg-white border border-[#dce8e5] rounded-[26px] shadow-[0_20px_60px_rgba(16,35,33,.08)] overflow-hidden">
            <div className="p-6 md:p-8 border-b border-[#e1ece9] bg-gradient-to-br from-[#e9f8f5] to-white">
              <div className="w-11 h-11 rounded-2xl bg-[#c8f0eb] text-[#087b73] grid place-items-center mb-5"><GraduationCap size={21} /></div>
              <div className="text-[10px] uppercase tracking-[.14em] font-bold text-[#5b7773]">Learning campaign</div>
              <h1 className="text-3xl md:text-[38px] font-semibold tracking-[-.04em] leading-tight mt-2">{config?.campaignName || 'Assigned learning'}</h1>
              <p className="text-sm leading-relaxed text-[#617572] mt-3">Sign in with your organisation account. Access is limited to verified emails included in the campaign learner CSV.</p>
            </div>
            <div className="p-6 md:p-8 space-y-3">
              {error && <div className="rounded-xl border border-[#f5c4cc] bg-[#fff3f5] text-[#9f3345] px-4 py-3 text-xs leading-relaxed">{error}</div>}
              {config?.googleEnabled && config?.googleClientId && <GoogleButton clientId={config.googleClientId} onSuccess={loginGoogle} onError={() => setError('Google sign-in failed.')} />}
              {config?.microsoftEnabled && (
                <button type="button" onClick={loginMicrosoft} disabled={busy} className="w-full h-11 rounded-xl border border-[#cfdcda] bg-white hover:bg-[#f7faf9] transition text-sm font-semibold flex items-center justify-center gap-3 disabled:opacity-50">
                  <span className="grid grid-cols-2 gap-[2px] w-4 h-4"><span className="bg-[#f25022]" /><span className="bg-[#7fba00]" /><span className="bg-[#00a4ef]" /><span className="bg-[#ffb900]" /></span>
                  {busy ? 'Opening Microsoft…' : 'Continue with Microsoft'}
                </button>
              )}
              <div className="rounded-xl bg-[#f0f7f6] border border-[#d7e7e4] px-3.5 py-3 text-[11px] leading-relaxed text-[#607572] flex gap-2"><ShieldCheck size={15} className="text-[#159b91] shrink-0" />Manual email entry is disabled. LMSGEN verifies your Google or Microsoft identity and then checks that exact email against the campaign CSV.</div>
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-[24px] bg-[#102321] text-white p-6 md:p-8 overflow-hidden relative">
              <div className="relative grid md:grid-cols-[1fr_auto] gap-7 md:items-end">
                <div><div className="text-[10px] uppercase tracking-[.16em] font-bold text-[#8bd8d1]">{dashboard.workspace?.name || 'LMSGEN'}</div><h1 className="text-3xl md:text-[46px] font-semibold tracking-[-.045em] mt-2">{dashboard.campaign?.name}</h1><p className="text-sm text-white/65 mt-3 max-w-2xl">Welcome, {dashboard.learner?.name || 'Learner'}. These are the courses assigned to you in this campaign.</p></div>
                <div className="min-w-[180px]"><div className="flex justify-between text-xs mb-2"><span>Campaign progress</span><strong>{progress}%</strong></div><div className="h-2 rounded-full bg-white/15 overflow-hidden"><div className="h-full bg-[#45c5bc] rounded-full" style={{ width: `${progress}%` }} /></div><div className="text-[10px] text-white/55 mt-2">{completed} of {courses.length} completed</div></div>
              </div>
            </section>

            {error && <div className="mt-5 rounded-xl border border-[#f5c4cc] bg-[#fff3f5] text-[#9f3345] px-4 py-3 text-sm">{error}</div>}

            <div className="mt-7 flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Assigned courses</h2><p className="text-xs text-[#6c817e] mt-1">Signed in as {dashboard.learner?.email}</p></div><button type="button" onClick={() => loadDashboard()} className="w-10 h-10 rounded-xl border border-[#d4e2df] bg-white grid place-items-center"><RefreshCw size={15} /></button></div>

            <div className="mt-5 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {courses.map((course) => {
                const complete = course.status === 'completed';
                return (
                  <article key={course.registrationId} className="bg-white border border-[#dce8e5] rounded-2xl p-5 flex flex-col min-h-[265px] shadow-[0_8px_30px_rgba(16,35,33,.04)]">
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
          </>
        )}
      </main>
    </div>
  );
}