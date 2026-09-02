import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  BarChart3,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  FileSpreadsheet,
  KeyRound,
  Play,
  Plus,
  RefreshCw,
  Square,
  Trash2,
  UserRoundCog,
  Users
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import './scormCampaignReporting.css';

const PAGE_SIZE = 6;

function formatDate(value) {
  if (!value) return 'No due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No due date';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusLabel(status) {
  if (status === 'active') return 'Active';
  if (status === 'stopped') return 'Stopped';
  if (status === 'completed') return 'Completed';
  return 'Draft';
}

function statusStyle(status) {
  if (status === 'active') return { color: '#0B6259', borderColor: 'rgba(79,201,191,.38)', background: 'rgba(79,201,191,.11)' };
  if (status === 'stopped') return { color: '#be123c', borderColor: 'rgba(251,113,133,.30)', background: 'rgba(251,113,133,.08)' };
  if (status === 'completed') return { color: '#15803d', borderColor: 'rgba(74,222,128,.28)', background: 'rgba(74,222,128,.08)' };
  return { color: 'var(--scorm-muted)', borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' };
}

function authLabel(mode) {
  if (mode === 'google') return 'Google SSO';
  if (mode === 'microsoft') return 'Microsoft SSO';
  if (mode === 'sso_any') return 'Google or Microsoft SSO';
  return 'Email + access code';
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export default function Assignments() {
  const { token } = useAuth();
  const location = useLocation();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [campaigns, setCampaigns] = useState([]);
  const [filter, setFilter] = useState('active');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState('');
  const [message, setMessage] = useState(location.state?.campaignMessage || '');
  const [error, setError] = useState('');

  const load = async ({ showLoader = true } = {}) => {
    if (showLoader) setLoading(true);
    setError('');
    try {
      const response = await axios.get(apiUrl('/api/scorm/campaigns'), { headers });
      setCampaigns(response.data?.campaigns || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load campaigns.');
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => { if (token) load(); }, [token]);
  useEffect(() => { setPage(1); }, [filter]);

  const counts = useMemo(() => ({
    all: campaigns.length,
    active: campaigns.filter((campaign) => campaign.status === 'active').length,
    draft: campaigns.filter((campaign) => campaign.status === 'draft').length,
    stopped: campaigns.filter((campaign) => campaign.status === 'stopped').length
  }), [campaigns]);

  const filteredCampaigns = useMemo(() => (
    filter === 'all' ? campaigns : campaigns.filter((campaign) => campaign.status === filter)
  ), [campaigns, filter]);

  const pageCount = Math.max(1, Math.ceil(filteredCampaigns.length / PAGE_SIZE));
  const visibleCampaigns = filteredCampaigns.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const startCampaign = async (campaign) => {
    const method = authLabel(campaign.authMode);
    const extra = campaign.authMode === 'email_code'
      ? 'Learners will use their assigned email and unique access code.'
      : `Learners will be required to use ${method}.`;
    if (!window.confirm(`Start “${campaign.name}”? This creates a tracked course instance for every learner-course combination. ${extra}`)) return;
    setActionBusy(campaign.id);
    setError('');
    setMessage('');
    try {
      const response = await axios.post(apiUrl(`/api/scorm/campaigns/${campaign.id}/start`), {}, { headers });
      const started = response.data?.campaign;
      setMessage(`Campaign “${started?.name || campaign.name}” is active and learner tracking has started.`);
      await load({ showLoader: false });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to start campaign.');
    } finally {
      setActionBusy('');
    }
  };

  const stopCampaign = async (campaign) => {
    if (!window.confirm(`Stop “${campaign.name}”? Learner access will close immediately and no further progress will be accepted.`)) return;
    setActionBusy(campaign.id);
    setError('');
    setMessage('');
    try {
      const response = await axios.post(apiUrl(`/api/scorm/campaigns/${campaign.id}/stop`), {}, { headers });
      const stopped = response.data?.campaign || { status: 'stopped' };
      setCampaigns((current) => current.map((item) => item.id === campaign.id ? { ...item, ...stopped, status: 'stopped', portalPath: null } : item));
      setMessage(`Campaign “${campaign.name}” stopped.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to stop campaign.');
    } finally {
      setActionBusy('');
    }
  };

  const deleteCampaign = async (campaign) => {
    const prompt = campaign.status === 'stopped'
      ? `Delete stopped campaign “${campaign.name}”? This removes the campaign permanently.`
      : `Delete draft campaign “${campaign.name}”?`;
    if (!window.confirm(prompt)) return;
    setActionBusy(campaign.id);
    setError('');
    try {
      await axios.delete(apiUrl(`/api/scorm/campaigns/${campaign.id}`), { headers });
      setCampaigns((current) => current.filter((item) => item.id !== campaign.id));
      setMessage(`Campaign “${campaign.name}” deleted.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete campaign.');
    } finally {
      setActionBusy('');
    }
  };

  const copyPortal = async (campaign) => {
    if (!campaign?.portalPath) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${campaign.portalPath}`);
      setMessage('Campaign learner link copied.');
    } catch (_) {
      setError('Could not copy the campaign portal link.');
    }
  };

  const downloadAccessList = async (campaign) => {
    setError('');
    try {
      const response = await axios.get(apiUrl(`/api/scorm/campaigns/${campaign.id}/access-sheet`), { headers });
      const rows = response.data?.learners || [];
      const portalPath = response.data?.campaign?.portalPath || `/campaign/${campaign.id}`;
      const portalUrl = `${window.location.origin}${portalPath}`;
      const csv = [
        ['Name', 'Email', 'Access Code', 'Campaign Link'].map(csvCell).join(','),
        ...rows.map((learner) => [learner.learnerName || '', learner.email, learner.accessCode, portalUrl].map(csvCell).join(','))
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${String(campaign.name || 'campaign').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'campaign'}-learner-access.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage('Learner access list downloaded.');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to download learner access codes.');
    }
  };

  const filterOptions = [
    ['active', 'Active', counts.active],
    ['draft', 'Draft', counts.draft],
    ['stopped', 'Stopped', counts.stopped],
    ['all', 'All', counts.all]
  ];

  return (
    <div className="scorm-campaigns-page p-4 md:p-7 lg:p-8 w-full">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6 pb-6 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
        <div>
          <div className="scorm-micro text-[10px] uppercase font-semibold">Learner delivery</div>
          <h1 className="text-[28px] md:text-[34px] font-semibold tracking-[-.03em] mt-1.5">Campaigns</h1>
          <p className="text-sm mt-2 max-w-2xl leading-relaxed" style={{ color: 'var(--scorm-ink-soft)' }}>Create, launch and monitor campaigns from a compact workspace. Creation, details and learner management each have their own page.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => load()} disabled={loading} className="scorm-button-secondary h-10 px-3.5 inline-flex items-center justify-center gap-2 text-xs font-semibold disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
          <Link to="/scorm/campaigns/new" className="scorm-button-primary h-10 px-4 inline-flex items-center justify-center gap-2 text-xs font-semibold"><Plus size={15} /> Create campaign</Link>
        </div>
      </div>

      {message && <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(20,184,166,.28)', background: 'rgba(20,184,166,.08)' }}>{message}</div>}
      {error && <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(251,113,133,.30)', background: 'rgba(251,113,133,.08)' }}>{error}</div>}

      <section className="scorm-panel rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--scorm-line)' }}>
        <div className="p-4 md:p-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ borderColor: 'var(--scorm-line)' }}>
          <div>
            <h2 className="font-semibold text-[16px]">Campaign workspace</h2>
            <div className="text-[11px] mt-1" style={{ color: 'var(--scorm-muted)' }}>Active campaigns are shown first. Open a campaign action only when you need it.</div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {filterOptions.map(([value, label, count]) => (
              <button key={value} type="button" onClick={() => setFilter(value)} className="h-9 px-3 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-2 transition" style={{ borderColor: filter === value ? 'var(--scorm-accent-strong)' : 'var(--scorm-line)', background: filter === value ? 'rgba(79,201,191,.10)' : 'var(--scorm-surface-soft)', color: filter === value ? 'var(--scorm-accent-strong)' : 'var(--scorm-ink-soft)' }}>
                {label}<span className="text-[9px] opacity-70">{count}</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm" style={{ color: 'var(--scorm-muted)' }}>Loading campaigns…</div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-11 h-11 rounded-xl border grid place-items-center mx-auto mb-3" style={{ borderColor: 'var(--scorm-line)' }}><FileSpreadsheet size={18} /></div>
            <div className="text-sm font-semibold">No {filter === 'all' ? '' : `${filter} `}campaigns</div>
            <div className="text-xs mt-1.5" style={{ color: 'var(--scorm-muted)' }}>There is nothing in this view yet.</div>
            {filter === 'active' && <Link to="/scorm/campaigns/new" className="scorm-button-primary mt-4 h-10 px-4 inline-flex items-center gap-2 text-xs font-semibold"><Plus size={14} /> Create campaign</Link>}
          </div>
        ) : (
          <>
            <div className="divide-y" style={{ borderColor: 'var(--scorm-line)' }}>
              {visibleCampaigns.map((campaign) => {
                const busy = actionBusy === campaign.id;
                return (
                  <div key={campaign.id} className="campaign-list-row px-4 py-4 md:px-5 grid 2xl:grid-cols-[minmax(240px,1.2fr)_90px_90px_minmax(190px,.75fr)_minmax(0,auto)] gap-4 2xl:items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <Link to={`/scorm/campaigns/${campaign.id}`} className="text-sm font-semibold truncate hover:underline">{campaign.name}</Link>
                        <span className="px-2 py-1 rounded-full text-[8px] uppercase tracking-[.08em] font-bold border shrink-0" style={statusStyle(campaign.status)}>{statusLabel(campaign.status)}</span>
                      </div>
                      <div className="text-[11px] mt-1.5 truncate" style={{ color: 'var(--scorm-muted)' }}>Created {formatDate(campaign.createdAt)} · {formatDate(campaign.dueAt)} · {campaign.authModeLabel || authLabel(campaign.authMode)}</div>
                    </div>
                    <div><div className="scorm-micro text-[8px] uppercase">Learners</div><div className="text-sm font-semibold mt-1 flex items-center gap-1.5"><Users size={13} />{campaign.learnerCount}</div></div>
                    <div><div className="scorm-micro text-[8px] uppercase">Courses</div><div className="text-sm font-semibold mt-1 flex items-center gap-1.5"><BookOpen size={13} />{campaign.courseCount}</div></div>
                    <div>
                      <div className="flex items-center justify-between text-[9px] mb-1"><span className="scorm-micro uppercase">Completion</span><span>{campaign.completionPercent}%</span></div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--scorm-line)' }}><div className="h-full rounded-full" style={{ width: `${campaign.completionPercent}%`, background: '#4FC9BF' }} /></div>
                      <div className="text-[9px] mt-1" style={{ color: 'var(--scorm-muted)' }}>{campaign.completedCount}/{campaign.assignmentCount} instances completed</div>
                    </div>
                    <div className="campaign-actions flex items-center gap-2 justify-start 2xl:justify-end flex-wrap">
                      <Link to={`/scorm/campaigns/${campaign.id}`} className="scorm-button-secondary h-10 px-3 inline-flex items-center gap-2 text-xs font-semibold"><Eye size={13} /> Details</Link>
                      <Link to={`/scorm/campaigns/${campaign.id}/analytics`} className="scorm-button-secondary h-10 px-3 inline-flex items-center gap-2 text-xs font-semibold"><BarChart3 size={13} /> Analytics</Link>
                      {campaign.status === 'active' && <Link to={`/scorm/campaigns/${campaign.id}/learners`} className="scorm-button-primary h-10 px-3 inline-flex items-center gap-2 text-xs font-semibold"><UserRoundCog size={13} /> Manage learners</Link>}
                      {campaign.status === 'draft' && <button type="button" disabled={busy} onClick={() => startCampaign(campaign)} className="scorm-button-primary h-10 px-3 inline-flex items-center gap-2 text-xs font-semibold disabled:opacity-50"><Play size={13} /> {busy ? 'Starting…' : 'Start'}</button>}
                      {campaign.status === 'active' && <button type="button" onClick={() => copyPortal(campaign)} className="scorm-button-secondary h-10 px-3 inline-flex items-center gap-2 text-xs font-semibold"><Copy size={13} /> Portal</button>}
                      {campaign.status === 'active' && campaign.authMode === 'email_code' && <button type="button" onClick={() => downloadAccessList(campaign)} className="scorm-button-secondary h-10 px-3 inline-flex items-center gap-2 text-xs font-semibold"><KeyRound size={13} /> Codes</button>}
                      {campaign.status === 'active' && <button type="button" disabled={busy} onClick={() => stopCampaign(campaign)} className="scorm-button-secondary h-10 px-3 inline-flex items-center gap-2 text-xs font-semibold disabled:opacity-50"><Square size={12} /> {busy ? 'Stopping…' : 'Stop'}</button>}
                      {['draft', 'stopped'].includes(campaign.status) && <button type="button" disabled={busy} onClick={() => deleteCampaign(campaign)} className="scorm-button-secondary w-10 h-10 grid place-items-center disabled:opacity-50" title="Delete campaign"><Trash2 size={14} /></button>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-4 py-3 md:px-5 border-t flex items-center justify-between gap-3" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>
              <div className="text-[10px]" style={{ color: 'var(--scorm-muted)' }}>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredCampaigns.length)} of {filteredCampaigns.length}</div>
              <div className="flex items-center gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="scorm-button-secondary w-9 h-9 grid place-items-center disabled:opacity-35" aria-label="Previous campaign page"><ChevronLeft size={15} /></button>
                <span className="text-[11px] min-w-[58px] text-center">{page} / {pageCount}</span>
                <button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="scorm-button-secondary w-9 h-9 grid place-items-center disabled:opacity-35" aria-label="Next campaign page"><ChevronRight size={15} /></button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
