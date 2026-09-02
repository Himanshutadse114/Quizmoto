import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, CheckCircle2, Mail, RefreshCw, Search, Send, Trash2, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import './scormCampaignReporting.css';

function learnerStatus(learner) {
  const value = String(learner?.progressStatus || '').toLowerCase();
  if (value === 'completed') return { label: 'Complete', complete: true, tone: 'success' };
  if (value === 'in_progress') return { label: 'In progress', complete: false, tone: 'accent' };
  return { label: 'Not started', complete: false, tone: 'muted' };
}

function StatusPill({ value }) {
  const style = value.tone === 'success'
    ? { color: '#15803d', borderColor: 'rgba(74,222,128,.30)', background: 'rgba(74,222,128,.08)' }
    : value.tone === 'accent'
      ? { color: 'var(--scorm-accent-strong)', borderColor: 'rgba(79,201,191,.30)', background: 'rgba(79,201,191,.09)' }
      : { color: 'var(--scorm-muted)', borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' };
  return <span className="rounded-full border px-2 py-1 text-[8px] uppercase font-semibold whitespace-nowrap" style={style}>{value.label}</span>;
}

export default function CampaignLearners() {
  const { campaignId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [detail, setDetail] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);

  const load = async ({ showLoader = true } = {}) => {
    if (!campaignId) return;
    if (showLoader) setLoading(true);
    try {
      const response = await axios.get(apiUrl(`/api/scorm/campaigns/${campaignId}/manage`), { headers });
      const campaign = response.data?.campaign || null;
      if (campaign && campaign.status !== 'active') {
        navigate(`/scorm/campaigns/${campaignId}`, { replace: true, state: { campaignMessage: 'Learners can only be changed while a campaign is active.' } });
        return;
      }
      setDetail(campaign);
      setSelected((current) => current.filter((value) => (campaign?.learners || []).some((learner) => learner.email === value)));
      setNotice(null);
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.message || 'Unable to load campaign learners.' });
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => { if (token && campaignId) load(); }, [token, campaignId]);

  const addLearner = async (event) => {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return setNotice({ type: 'error', text: 'Enter a valid learner email address.' });
    setBusy('add'); setNotice(null);
    try {
      const response = await axios.post(apiUrl(`/api/scorm/campaigns/${campaignId}/learners`), { learners: [{ email: cleanEmail, learnerName: name.trim() }] }, { headers });
      setDetail(response.data?.campaign || null);
      setName(''); setEmail('');
      const sent = Number(response.data?.invitationSent || 0);
      setNotice({ type: 'success', text: response.data?.added ? `Learner added.${sent ? ' Invitation email sent.' : ''}` : 'This learner is already in the campaign.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.message || 'Unable to add this learner.' });
    } finally { setBusy(''); }
  };

  const removeLearner = async (learner) => {
    if (!window.confirm(`Remove ${learner.learnerName || learner.email} from this running campaign? Their campaign access will be revoked.`)) return;
    setBusy(`remove:${learner.email}`); setNotice(null);
    try {
      const response = await axios.delete(apiUrl(`/api/scorm/campaigns/${campaignId}/learners/${encodeURIComponent(learner.email)}`), { headers });
      setDetail(response.data?.campaign || null);
      setSelected((current) => current.filter((value) => value !== learner.email));
      setNotice({ type: 'success', text: `${learner.learnerName || learner.email} removed from the campaign.` });
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.message || 'Unable to remove this learner.' });
    } finally { setBusy(''); }
  };

  const sendReminders = async (emails) => {
    const targetLabel = emails.length ? `${emails.length} selected learner${emails.length === 1 ? '' : 's'}` : 'all incomplete learners';
    if (!window.confirm(`Send a campaign reminder to ${targetLabel}? Completed learners will be skipped.`)) return;
    setBusy('reminder'); setNotice(null);
    try {
      const response = await axios.post(apiUrl(`/api/scorm/campaigns/${campaignId}/reminders`), { emails }, { headers });
      const result = response.data || {};
      setNotice({ type: result.failed ? 'error' : 'success', text: `Reminder run: ${result.sent || 0} sent, ${result.skippedCompleted || 0} completed skipped${result.failed ? `, ${result.failed} failed.` : '.'}` });
      setSelected([]);
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.message || 'Unable to send campaign reminders.' });
    } finally { setBusy(''); }
  };

  const learners = detail?.learners || [];
  const filtered = learners.filter((learner) => {
    const q = query.trim().toLowerCase();
    return !q || `${learner.learnerName || ''} ${learner.email || ''}`.toLowerCase().includes(q);
  });
  const incompleteEmails = learners.filter((learner) => !learnerStatus(learner).complete).map((learner) => learner.email);

  return (
    <div className="scorm-campaigns-page p-4 md:p-7 lg:p-8 w-full">
      <div className="max-w-[1320px] mx-auto">
        <div className="mb-6 pb-6 border-b flex flex-col xl:flex-row xl:items-end justify-between gap-4" style={{ borderColor: 'var(--scorm-line)' }}>
          <div>
            <Link to="/scorm/assignments" className="inline-flex items-center gap-2 text-xs font-semibold mb-4" style={{ color: 'var(--scorm-accent-strong)' }}><ArrowLeft size={14} /> Back to campaigns</Link>
            <div className="scorm-micro text-[10px] uppercase font-semibold">Running campaign</div>
            <h1 className="text-[28px] md:text-[34px] font-semibold tracking-[-.03em] mt-1.5">Manage learners</h1>
            <p className="text-sm mt-2 max-w-2xl leading-relaxed" style={{ color: 'var(--scorm-ink-soft)' }}>{detail?.name || 'Campaign'} · Add or remove learners and send reminders without returning to the campaign list.</p>
          </div>
          <div className="flex items-center gap-2"><Link to={`/scorm/campaigns/${campaignId}`} className="scorm-button-secondary h-10 px-4 inline-flex items-center text-xs font-semibold">Campaign details</Link><button type="button" onClick={() => load()} disabled={loading} className="scorm-button-secondary h-10 px-3.5 inline-flex items-center gap-2 text-xs font-semibold disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button></div>
        </div>

        {notice && <div className="mb-5 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: notice.type === 'success' ? 'rgba(74,222,128,.28)' : 'rgba(251,113,133,.30)', background: notice.type === 'success' ? 'rgba(74,222,128,.07)' : 'rgba(251,113,133,.08)' }}>{notice.text}</div>}

        {loading && !detail ? <div className="scorm-panel rounded-2xl border p-12 text-center text-sm" style={{ borderColor: 'var(--scorm-line)', color: 'var(--scorm-muted)' }}>Loading campaign learners…</div> : (
          <div className="grid xl:grid-cols-[360px_minmax(0,1fr)] gap-5 items-start">
            <section className="scorm-panel rounded-2xl border p-5 md:p-6" style={{ borderColor: 'var(--scorm-line)' }}>
              <div className="flex items-center gap-2 mb-4"><UserPlus size={16} style={{ color: 'var(--scorm-accent-strong)' }} /><div><div className="scorm-micro text-[9px] uppercase font-semibold">Add learner</div><h2 className="font-semibold mt-1">Add to running campaign</h2></div></div>
              <form onSubmit={addLearner} className="space-y-4">
                <label className="block"><span className="scorm-micro block text-[8px] uppercase mb-1.5">Name · optional</span><input value={name} onChange={(event) => setName(event.target.value)} className="w-full px-3 py-2.5 text-sm" placeholder="Learner name" maxLength={180} /></label>
                <label className="block"><span className="scorm-micro block text-[8px] uppercase mb-1.5">Email address</span><input value={email} onChange={(event) => setEmail(event.target.value)} className="w-full px-3 py-2.5 text-sm" placeholder="learner@company.com" type="email" /></label>
                <button type="submit" disabled={busy === 'add'} className="scorm-button-primary h-10 px-4 inline-flex items-center gap-2 text-xs font-semibold disabled:opacity-50"><UserPlus size={13} /> {busy === 'add' ? 'Adding…' : 'Add learner'}</button>
              </form>
              <div className="mt-4 rounded-xl border p-3.5 text-[11px] leading-relaxed" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)', color: 'var(--scorm-muted)' }}>The learner receives every course already assigned to this campaign and the campaign invitation email is sent automatically.</div>
              <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl border p-3" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}><div className="scorm-micro text-[8px] uppercase">Learners</div><div className="text-xl font-semibold mt-1">{learners.length}</div></div><div className="rounded-xl border p-3" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}><div className="scorm-micro text-[8px] uppercase">Incomplete</div><div className="text-xl font-semibold mt-1">{incompleteEmails.length}</div></div></div>
            </section>

            <section className="scorm-panel rounded-2xl border overflow-hidden min-w-0" style={{ borderColor: 'var(--scorm-line)' }}>
              <div className="p-4 md:p-5 border-b flex flex-col lg:flex-row lg:items-center justify-between gap-3" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>
                <div><div className="flex items-center gap-2"><Users size={15} /><h2 className="font-semibold">Current learners</h2></div><div className="text-[10px] mt-1" style={{ color: 'var(--scorm-muted)' }}>{learners.length} learners · {incompleteEmails.length} incomplete</div></div>
                <div className="flex flex-wrap items-center gap-2"><div className="relative"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--scorm-muted)' }} /><input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 w-[220px] pl-8 pr-3 text-xs" placeholder="Search learners" /></div><button type="button" disabled={!selected.length || busy === 'reminder'} onClick={() => sendReminders(selected)} className="scorm-button-secondary h-10 px-3 inline-flex items-center gap-2 text-xs font-semibold disabled:opacity-35"><Mail size={13} /> Remind selected ({selected.length})</button><button type="button" disabled={!incompleteEmails.length || busy === 'reminder'} onClick={() => sendReminders([])} className="scorm-button-primary h-10 px-3 inline-flex items-center gap-2 text-xs font-semibold disabled:opacity-35"><Send size={13} /> {busy === 'reminder' ? 'Sending…' : 'Remind all incomplete'}</button></div>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--scorm-line)' }}>
                {filtered.map((learner) => {
                  const status = learnerStatus(learner); const checked = selected.includes(learner.email); const removing = busy === `remove:${learner.email}`;
                  return <div key={learner.email} className="campaign-detail-row px-4 py-3.5 flex items-center gap-3"><input type="checkbox" checked={checked} onChange={(event) => setSelected((current) => event.target.checked ? [...new Set([...current, learner.email])] : current.filter((value) => value !== learner.email))} className="w-4 h-4 shrink-0" /><div className="min-w-0 flex-1"><div className="text-sm font-semibold truncate">{learner.learnerName || 'Learner'}</div><div className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--scorm-muted)' }}>{learner.email}</div></div><StatusPill value={status} />{!status.complete ? <button type="button" disabled={busy === 'reminder'} onClick={() => sendReminders([learner.email])} className="scorm-button-secondary w-9 h-9 grid place-items-center shrink-0" title="Send reminder"><Mail size={12} /></button> : <span className="w-9 h-9 grid place-items-center shrink-0" title="Completed"><CheckCircle2 size={15} style={{ color: '#15803d' }} /></span>}<button type="button" disabled={removing || busy === 'reminder'} onClick={() => removeLearner(learner)} className="scorm-button-secondary w-9 h-9 grid place-items-center shrink-0 disabled:opacity-40" title="Remove learner"><Trash2 size={12} /></button></div>;
                })}
                {!filtered.length && <div className="px-4 py-10 text-center text-sm" style={{ color: 'var(--scorm-muted)' }}>No learners match this view.</div>}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
