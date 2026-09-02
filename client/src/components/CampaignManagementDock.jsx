import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  CheckCircle2,
  Mail,
  RefreshCw,
  Search,
  Send,
  Trash2,
  UserPlus,
  Users
} from 'lucide-react';
import { apiUrl } from '../config';

function storedSession() {
  let user = null;
  try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch (_) { user = null; }
  return { token: localStorage.getItem('token') || '', user };
}

function isCampaignAdmin(user) {
  return ['super_admin', 'admin', 'co_admin'].includes(String(user?.role || '').toLowerCase());
}

function registrationComplete(registration) {
  const status = String(registration?.status || '').toLowerCase();
  const lesson = String(registration?.lessonStatus || registration?.lastLessonStatus || '').toLowerCase();
  return status === 'completed' || ['completed', 'passed', 'failed'].includes(lesson);
}

function learnerStatus(email, registrations) {
  const rows = registrations.filter((registration) => String(registration.learnerEmail || '').toLowerCase() === String(email || '').toLowerCase());
  if (!rows.length) return { label: 'Not started', complete: false, tone: 'muted' };
  if (rows.every(registrationComplete)) return { label: 'Complete', complete: true, tone: 'success' };
  const started = rows.some((registration) => registration.status === 'in_progress' || registration.lastActivityAt || registration.lastCommitAt || registration.score !== null);
  return { label: started ? 'In progress' : 'Not started', complete: false, tone: started ? 'accent' : 'muted' };
}

function StatusPill({ value }) {
  const style = value.tone === 'success'
    ? { color: '#86efac', borderColor: 'rgba(74,222,128,.25)', background: 'rgba(74,222,128,.07)' }
    : value.tone === 'accent'
      ? { color: '#72D6CD', borderColor: 'rgba(79,201,191,.28)', background: 'rgba(79,201,191,.08)' }
      : { color: 'var(--scorm-muted)', borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' };
  return <span className="rounded-full border px-2 py-1 text-[8px] uppercase font-semibold whitespace-nowrap" style={style}>{value.label}</span>;
}

export default function CampaignManagementDock() {
  const [mountNode, setMountNode] = useState(null);
  const [session, setSession] = useState(storedSession);
  const [campaigns, setCampaigns] = useState([]);
  const [campaignId, setCampaignId] = useState('');
  const [detail, setDetail] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let previousPath = '';
    const sync = () => {
      const path = window.location.pathname;
      if (path !== previousPath) {
        previousPath = path;
        setSession(storedSession());
      }
      if (path === '/scorm/assignments') {
        const page = document.querySelector('.scorm-campaigns-page');
        setMountNode(page || null);
      } else {
        setMountNode(null);
      }
    };
    sync();
    const timer = window.setInterval(sync, 400);
    return () => window.clearInterval(timer);
  }, []);

  const headers = useMemo(() => ({ Authorization: `Bearer ${session.token}` }), [session.token]);
  const allowed = Boolean(mountNode && session.token && isCampaignAdmin(session.user));

  const loadCampaigns = async ({ preserve = true } = {}) => {
    if (!allowed) return;
    setLoading(true);
    try {
      const response = await axios.get(apiUrl('/api/scorm/campaigns'), { headers });
      const active = (response.data?.campaigns || []).filter((campaign) => campaign.status === 'active');
      setCampaigns(active);
      const nextId = preserve && campaignId && active.some((campaign) => campaign.id === campaignId)
        ? campaignId
        : active[0]?.id || '';
      setCampaignId(nextId);
      if (!nextId) setDetail(null);
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.message || 'Unable to load active campaigns.' });
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id = campaignId) => {
    if (!allowed || !id) return;
    setLoading(true);
    try {
      const response = await axios.get(apiUrl(`/api/scorm/campaigns/${id}`), { headers });
      setDetail(response.data?.campaign || null);
      setSelected((current) => current.filter((value) => (response.data?.campaign?.learners || []).some((learner) => learner.email === value)));
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.message || 'Unable to load campaign learners.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) loadCampaigns({ preserve: false });
  }, [allowed, session.token]);

  useEffect(() => {
    if (allowed && campaignId) loadDetail(campaignId);
  }, [campaignId]);

  const refresh = async () => {
    setNotice(null);
    await loadCampaigns();
    if (campaignId) await loadDetail(campaignId);
  };

  const addLearner = async (event) => {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setNotice({ type: 'error', text: 'Enter a valid learner email address.' });
      return;
    }
    if (!campaignId) return;
    setBusy('add');
    setNotice(null);
    try {
      const response = await axios.post(
        apiUrl(`/api/scorm/campaigns/${campaignId}/learners`),
        { learners: [{ email: cleanEmail, learnerName: name.trim() }] },
        { headers }
      );
      const sent = Number(response.data?.invitationSent || 0);
      setDetail(response.data?.campaign || null);
      setName('');
      setEmail('');
      setNotice({
        type: 'success',
        text: response.data?.added
          ? `Learner added to the running campaign.${sent ? ' The campaign invitation email was sent.' : ' The learner is active; no invitation email was confirmed by the mail provider.'}`
          : 'This learner is already in the campaign.'
      });
      await loadCampaigns();
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.message || 'Unable to add this learner.' });
    } finally {
      setBusy('');
    }
  };

  const removeLearner = async (learner) => {
    if (!window.confirm(`Remove ${learner.learnerName || learner.email} from this running campaign? Their campaign access will be revoked, while historical tracking data will be retained.`)) return;
    setBusy(`remove:${learner.email}`);
    setNotice(null);
    try {
      const response = await axios.delete(
        apiUrl(`/api/scorm/campaigns/${campaignId}/learners/${encodeURIComponent(learner.email)}`),
        { headers }
      );
      setDetail(response.data?.campaign || null);
      setSelected((current) => current.filter((value) => value !== learner.email));
      setNotice({ type: 'success', text: `${learner.learnerName || learner.email} was removed and campaign access was revoked.` });
      await loadCampaigns();
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.message || 'Unable to remove this learner.' });
    } finally {
      setBusy('');
    }
  };

  const sendReminders = async (emails) => {
    if (!campaignId) return;
    const targetLabel = emails.length ? `${emails.length} selected learner${emails.length === 1 ? '' : 's'}` : 'all incomplete learners';
    if (!window.confirm(`Send a campaign reminder to ${targetLabel}? Fully completed learners will be skipped.`)) return;
    setBusy('reminder');
    setNotice(null);
    try {
      const response = await axios.post(
        apiUrl(`/api/scorm/campaigns/${campaignId}/reminders`),
        { emails },
        { headers }
      );
      const result = response.data || {};
      setNotice({
        type: result.failed ? 'error' : 'success',
        text: `Reminder run complete: ${result.sent || 0} sent, ${result.skippedCompleted || 0} completed learner${Number(result.skippedCompleted) === 1 ? '' : 's'} skipped${result.failed ? ` and ${result.failed} failed.` : '.'}`
      });
      setSelected([]);
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.message || 'Unable to send campaign reminders.' });
    } finally {
      setBusy('');
    }
  };

  const learners = detail?.learners || [];
  const registrations = detail?.registrations || [];
  const filtered = learners.filter((learner) => {
    const q = query.trim().toLowerCase();
    return !q || `${learner.learnerName || ''} ${learner.email || ''}`.toLowerCase().includes(q);
  });
  const incompleteEmails = learners
    .filter((learner) => !learnerStatus(learner.email, registrations).complete)
    .map((learner) => learner.email);

  if (!allowed) return null;

  return createPortal(
    <section className="scorm-panel rounded-2xl border overflow-hidden mt-5" style={{ borderColor: 'var(--scorm-line)' }}>
      <div className="p-4 md:p-5 border-b flex flex-col xl:flex-row xl:items-center justify-between gap-4" style={{ borderColor: 'var(--scorm-line)' }}>
        <div>
          <div className="flex items-center gap-2 text-[#4FC9BF]"><Users size={15} /><span className="scorm-micro text-[9px] uppercase font-semibold">Running campaign controls</span></div>
          <h2 className="text-[17px] font-semibold mt-1.5">Manage campaign learners</h2>
          <p className="text-[10px] mt-1 max-w-2xl" style={{ color: 'var(--scorm-muted)' }}>Add learners after launch, revoke a learner’s campaign access or send reminders without stopping the campaign.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={campaignId}
            onChange={(event) => { setCampaignId(event.target.value); setSelected([]); setNotice(null); }}
            className="min-w-[220px] h-10 rounded-lg border px-3 text-xs bg-transparent"
            style={{ borderColor: 'var(--scorm-line)' }}
          >
            {campaigns.length ? campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>) : <option value="">No active campaigns</option>}
          </select>
          <button type="button" onClick={refresh} disabled={loading} className="scorm-button-secondary h-10 px-3 inline-flex items-center gap-2 text-[10px] font-semibold disabled:opacity-50"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh</button>
        </div>
      </div>

      {!campaigns.length ? (
        <div className="p-8 text-center text-xs" style={{ color: 'var(--scorm-muted)' }}>Start a campaign to manage its learners here.</div>
      ) : (
        <div className="p-4 md:p-5 space-y-4">
          {notice && (
            <div className="rounded-xl border px-3.5 py-3 text-[11px]" style={{
              borderColor: notice.type === 'success' ? 'rgba(74,222,128,.25)' : 'rgba(251,113,133,.28)',
              background: notice.type === 'success' ? 'rgba(74,222,128,.06)' : 'rgba(251,113,133,.07)',
              color: notice.type === 'success' ? '#86efac' : '#fda4af'
            }}>{notice.text}</div>
          )}

          <div className="grid xl:grid-cols-[.8fr_1.2fr] gap-4 items-start">
            <form onSubmit={addLearner} className="rounded-xl border p-4" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>
              <div className="flex items-center gap-2 mb-3"><UserPlus size={14} style={{ color: '#4FC9BF' }} /><h3 className="text-xs font-semibold">Add learner to this running campaign</h3></div>
              <label className="block"><span className="scorm-micro text-[8px] uppercase">Name · optional</span><input value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full px-3 py-2.5 text-xs" placeholder="Learner name" maxLength={180} /></label>
              <label className="block mt-3"><span className="scorm-micro text-[8px] uppercase">Email address</span><input value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full px-3 py-2.5 text-xs" placeholder="learner@company.com" type="email" /></label>
              <button type="submit" disabled={busy === 'add'} className="scorm-button-primary mt-3 h-10 px-4 inline-flex items-center gap-2 text-[10px] font-semibold disabled:opacity-50"><UserPlus size={13} /> {busy === 'add' ? 'Adding…' : 'Add learner'}</button>
              <p className="text-[9px] leading-relaxed mt-2" style={{ color: 'var(--scorm-muted)' }}>The learner gets all courses already in this campaign and receives the campaign invitation email automatically.</p>
            </form>

            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--scorm-line)' }}>
              <div className="p-3.5 border-b flex flex-col md:flex-row md:items-center justify-between gap-3" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>
                <div>
                  <div className="text-xs font-semibold">Current learners</div>
                  <div className="text-[9px] mt-1" style={{ color: 'var(--scorm-muted)' }}>{learners.length} learners · {incompleteEmails.length} incomplete</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--scorm-muted)' }} />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-9 w-[210px] pl-8 pr-3 text-[10px]" placeholder="Search learners" />
                  </div>
                  <button type="button" disabled={!selected.length || busy === 'reminder'} onClick={() => sendReminders(selected)} className="scorm-button-secondary h-9 px-3 inline-flex items-center gap-2 text-[9px] font-semibold disabled:opacity-35"><Mail size={12} /> Remind selected ({selected.length})</button>
                  <button type="button" disabled={!incompleteEmails.length || busy === 'reminder'} onClick={() => sendReminders([])} className="scorm-button-primary h-9 px-3 inline-flex items-center gap-2 text-[9px] font-semibold disabled:opacity-35"><Send size={12} /> {busy === 'reminder' ? 'Sending…' : 'Remind all incomplete'}</button>
                </div>
              </div>

              <div className="max-h-[380px] overflow-y-auto divide-y" style={{ borderColor: 'var(--scorm-line)' }}>
                {filtered.map((learner) => {
                  const status = learnerStatus(learner.email, registrations);
                  const checked = selected.includes(learner.email);
                  const removing = busy === `remove:${learner.email}`;
                  return (
                    <div key={learner.email} className="px-3.5 py-3 flex items-center gap-3 campaign-detail-row">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => setSelected((current) => event.target.checked ? [...new Set([...current, learner.email])] : current.filter((value) => value !== learner.email))}
                        className="w-4 h-4 shrink-0"
                        aria-label={`Select ${learner.email}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-semibold truncate">{learner.learnerName || 'Learner'}</div>
                        <div className="text-[9px] mt-0.5 truncate" style={{ color: 'var(--scorm-muted)' }}>{learner.email}</div>
                      </div>
                      <StatusPill value={status} />
                      {!status.complete && <button type="button" disabled={busy === 'reminder'} onClick={() => sendReminders([learner.email])} className="scorm-button-secondary w-9 h-9 grid place-items-center shrink-0 disabled:opacity-40" title="Send reminder"><Mail size={12} /></button>}
                      {status.complete && <span className="w-9 h-9 grid place-items-center shrink-0" title="Completed"><CheckCircle2 size={14} style={{ color: '#86efac' }} /></span>}
                      <button type="button" disabled={removing || Boolean(busy === 'reminder')} onClick={() => removeLearner(learner)} className="scorm-button-secondary w-9 h-9 grid place-items-center shrink-0 disabled:opacity-40" title="Remove learner from campaign"><Trash2 size={12} /></button>
                    </div>
                  );
                })}
                {!filtered.length && <div className="px-4 py-8 text-center text-[10px]" style={{ color: 'var(--scorm-muted)' }}>No learners match this search.</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>,
    mountNode
  );
}
