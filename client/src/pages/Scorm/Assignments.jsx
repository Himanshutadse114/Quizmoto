import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  KeyRound,
  Mail,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Square,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X
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
  if (status === 'active') return { color: '#64d8cd', borderColor: 'rgba(79,201,191,.35)', background: 'rgba(79,201,191,.08)' };
  if (status === 'stopped') return { color: '#fda4af', borderColor: 'rgba(251,113,133,.32)', background: 'rgba(251,113,133,.07)' };
  if (status === 'completed') return { color: '#86efac', borderColor: 'rgba(74,222,128,.28)', background: 'rgba(74,222,128,.07)' };
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

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim().toLowerCase());
}

function manualLearnersToCsv(learners) {
  return [
    ['Email', 'Name'].map(csvCell).join(','),
    ...learners.map((learner) => [learner.email, learner.learnerName || ''].map(csvCell).join(','))
  ].join('\n');
}

function ModalShell({ open, onClose, children, labelledBy }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 md:p-6" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" aria-label="Close dialog" onClick={onClose} />
      <div className="relative z-10 w-full max-w-6xl max-h-[calc(100vh-24px)] md:max-h-[calc(100vh-48px)] overflow-hidden rounded-2xl border scorm-panel shadow-2xl" style={{ borderColor: 'var(--scorm-line)' }}>
        {children}
      </div>
    </div>
  );
}

export default function Assignments() {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const fileRef = useRef(null);

  const [campaigns, setCampaigns] = useState([]);
  const [courses, setCourses] = useState([]);
  const [authOptions, setAuthOptions] = useState({ emailCode: true, googleConfigured: false, microsoftConfigured: false });
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [campaignDetail, setCampaignDetail] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [filter, setFilter] = useState('active');
  const [page, setPage] = useState(1);

  const [name, setName] = useState('');
  const [learnerEntryMode, setLearnerEntryMode] = useState('csv');
  const [csvText, setCsvText] = useState('');
  const [csvFileName, setCsvFileName] = useState('');
  const [csvPreview, setCsvPreview] = useState(null);
  const [manualLearners, setManualLearners] = useState([]);
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [dueAt, setDueAt] = useState('');
  const [required, setRequired] = useState(true);
  const [authMode, setAuthMode] = useState('email_code');

  const [loading, setLoading] = useState(true);
  const [formBusy, setFormBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async ({ showLoader = true } = {}) => {
    if (showLoader) setLoading(true);
    setError('');
    try {
      const res = await axios.get(apiUrl('/api/scorm/campaigns'), { headers });
      setCampaigns(res.data?.campaigns || []);
      setCourses(res.data?.courses || []);
      setAuthOptions(res.data?.authOptions || { emailCode: true, googleConfigured: false, microsoftConfigured: false });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load campaigns.');
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => { if (token) load(); }, [token]);

  useEffect(() => {
    if (!createOpen && !selectedCampaign) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [createOpen, selectedCampaign]);

  useEffect(() => { setPage(1); }, [filter]);

  const publishedCourses = courses.filter((course) => course.status === 'published');
  const toggleCourse = (id) => setSelectedCourses((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const learnerCount = learnerEntryMode === 'manual' ? manualLearners.length : Number(csvPreview?.validLearners || 0);

  const counts = useMemo(() => ({
    all: campaigns.length,
    active: campaigns.filter((campaign) => campaign.status === 'active').length,
    draft: campaigns.filter((campaign) => campaign.status === 'draft').length,
    stopped: campaigns.filter((campaign) => campaign.status === 'stopped').length
  }), [campaigns]);

  const filteredCampaigns = useMemo(() => {
    if (filter === 'all') return campaigns;
    return campaigns.filter((campaign) => campaign.status === filter);
  }, [campaigns, filter]);

  const pageCount = Math.max(1, Math.ceil(filteredCampaigns.length / PAGE_SIZE));
  const visibleCampaigns = filteredCampaigns.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const readCsv = async (file) => {
    if (!file) return;
    setError('');
    setMessage('');
    try {
      const text = await file.text();
      const res = await axios.post(apiUrl('/api/scorm/campaigns/preview-csv'), { csvText: text }, { headers });
      setCsvText(text);
      setCsvFileName(file.name);
      setCsvPreview(res.data);
    } catch (err) {
      setCsvText('');
      setCsvFileName('');
      setCsvPreview(null);
      setError(err.response?.data?.message || 'Unable to read this CSV file.');
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob(['Email,Name\nlearner1@company.com,Learner One\nlearner2@company.com,Learner Two\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lmsgen-campaign-learners.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const addManualLearner = (event) => {
    event?.preventDefault?.();
    setError('');
    setMessage('');
    const email = String(manualEmail || '').trim().toLowerCase();
    const learnerName = String(manualName || '').trim().slice(0, 180);
    if (!isValidEmail(email)) return setError('Enter a valid learner email address.');
    if (manualLearners.some((learner) => learner.email === email)) return setError('This learner email has already been added.');
    setManualLearners((current) => [...current, { email, learnerName: learnerName || email.split('@')[0] }]);
    setManualName('');
    setManualEmail('');
  };

  const removeManualLearner = (email) => setManualLearners((current) => current.filter((learner) => learner.email !== email));

  const resetCampaignForm = () => {
    setName('');
    setLearnerEntryMode('csv');
    setCsvText('');
    setCsvFileName('');
    setCsvPreview(null);
    setManualLearners([]);
    setManualName('');
    setManualEmail('');
    setSelectedCourses([]);
    setDueAt('');
    setRequired(true);
    setAuthMode('email_code');
    if (fileRef.current) fileRef.current.value = '';
  };

  const openCreate = () => {
    setError('');
    setMessage('');
    setCreateOpen(true);
  };

  const createCampaign = async () => {
    setError('');
    setMessage('');
    if (name.trim().length < 2) return setError('Enter a campaign name.');
    if (!learnerCount) return setError(learnerEntryMode === 'manual' ? 'Add at least one learner.' : 'Upload a learner CSV first.');
    if (!selectedCourses.length) return setError('Select at least one published course.');
    if (authMode === 'google' && !authOptions.googleConfigured) return setError('Google SSO is not configured for this tenant.');
    if (authMode === 'microsoft' && !authOptions.microsoftConfigured) return setError('Microsoft SSO is not configured for this tenant.');

    setFormBusy(true);
    try {
      const learnerCsvText = learnerEntryMode === 'manual' ? manualLearnersToCsv(manualLearners) : csvText;
      const res = await axios.post(apiUrl('/api/scorm/campaigns'), {
        name: name.trim(),
        csvText: learnerCsvText,
        courseIds: selectedCourses,
        dueAt: dueAt || null,
        required,
        authMode
      }, { headers });
      const campaign = res.data?.campaign;
      setMessage(`Campaign “${campaign?.name || name.trim()}” created as a draft. Start it when you are ready to begin learner tracking.`);
      resetCampaignForm();
      setCreateOpen(false);
      setFilter('draft');
      setPage(1);
      await load({ showLoader: false });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to create campaign.');
    } finally {
      setFormBusy(false);
    }
  };

  const viewCampaign = async (id) => {
    setSelectedCampaign(id);
    setCampaignDetail(null);
    setError('');
    try {
      const res = await axios.get(apiUrl(`/api/scorm/campaigns/${id}`), { headers });
      setCampaignDetail(res.data?.campaign || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load campaign details.');
    }
  };

  const closeDetail = () => {
    setSelectedCampaign(null);
    setCampaignDetail(null);
  };

  const startCampaign = async (campaign) => {
    const method = authLabel(campaign.authMode);
    const extra = campaign.authMode === 'email_code'
      ? 'Learners will use their assigned email and unique access code.'
      : `Learners will be required to use ${method}.`;
    if (!window.confirm(`Start “${campaign.name}”? This will create a separate course instance for every learner-course combination. ${extra}`)) return;

    setActionBusy(campaign.id);
    setError('');
    setMessage('');
    try {
      const res = await axios.post(apiUrl(`/api/scorm/campaigns/${campaign.id}/start`), {}, { headers });
      const started = res.data?.campaign;
      setMessage(`Campaign “${started?.name || campaign.name}” is active and learner tracking has started.`);
      if (selectedCampaign === campaign.id) setCampaignDetail((current) => current ? { ...current, ...started, status: 'active' } : current);
      await load({ showLoader: false });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to start campaign.');
    } finally {
      setActionBusy('');
    }
  };

  const stopCampaign = async (campaign) => {
    if (!window.confirm(`Stop “${campaign.name}”? Learner access will close immediately and no further score, progress or completion tracking will be accepted. You can delete the campaign after it is stopped.`)) return;

    setActionBusy(campaign.id);
    setError('');
    setMessage('');
    try {
      const res = await axios.post(apiUrl(`/api/scorm/campaigns/${campaign.id}/stop`), {}, { headers });
      const stopped = res.data?.campaign || { status: 'stopped' };
      setCampaigns((current) => current.map((item) => item.id === campaign.id ? { ...item, ...stopped, status: 'stopped', portalPath: null } : item));
      if (selectedCampaign === campaign.id) setCampaignDetail((current) => current ? { ...current, ...stopped, status: 'stopped', portalPath: null } : current);
      setMessage(`Campaign “${campaign.name}” stopped. Tracking is closed and the campaign can now be deleted.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to stop campaign.');
    } finally {
      setActionBusy('');
    }
  };

  const deleteCampaign = async (campaign) => {
    const stopped = campaign.status === 'stopped';
    const prompt = stopped
      ? `Delete stopped campaign “${campaign.name}”? This removes the campaign permanently.`
      : `Delete draft campaign “${campaign.name}”?`;
    if (!window.confirm(prompt)) return;

    setActionBusy(campaign.id);
    setError('');
    try {
      await axios.delete(apiUrl(`/api/scorm/campaigns/${campaign.id}`), { headers });
      setCampaigns((current) => current.filter((item) => item.id !== campaign.id));
      if (selectedCampaign === campaign.id) closeDetail();
      setMessage(`Campaign “${campaign.name}” deleted.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete campaign.');
    } finally {
      setActionBusy('');
    }
  };

  const copyPortal = async (campaign) => {
    if (!campaign?.portalPath) return;
    const url = `${window.location.origin}${campaign.portalPath}`;
    try {
      await navigator.clipboard.writeText(url);
      setMessage(campaign.authMode === 'email_code'
        ? 'Campaign learner link copied. Send it with each learner’s unique access code.'
        : `Campaign learner link copied. Learners must sign in with ${authLabel(campaign.authMode)}.`);
    } catch (_) {
      setError('Could not copy the campaign portal link.');
    }
  };

  const downloadAccessList = async (campaign) => {
    setError('');
    setMessage('');
    try {
      const res = await axios.get(apiUrl(`/api/scorm/campaigns/${campaign.id}/access-sheet`), { headers });
      const rows = res.data?.learners || [];
      const portalPath = res.data?.campaign?.portalPath || `/campaign/${campaign.id}`;
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

  const authCards = [
    {
      id: 'email_code',
      title: 'Email + access code',
      description: 'Works without tenant SSO. Each assigned learner gets a unique campaign access code.',
      enabled: true,
      icon: <KeyRound size={16} />
    },
    {
      id: 'google',
      title: 'Google SSO',
      description: authOptions.googleConfigured ? 'Learners verify the exact assigned email with Google.' : 'Configure Google learner SSO first.',
      enabled: authOptions.googleConfigured,
      icon: <Mail size={16} />
    },
    {
      id: 'microsoft',
      title: 'Microsoft SSO',
      description: authOptions.microsoftConfigured ? 'Learners verify the exact assigned email with Microsoft.' : 'Configure Microsoft learner SSO first.',
      enabled: authOptions.microsoftConfigured,
      icon: <ShieldCheck size={16} />
    }
  ];

  const filterOptions = [
    ['active', 'Active', counts.active],
    ['draft', 'Draft', counts.draft],
    ['stopped', 'Stopped', counts.stopped],
    ['all', 'All', counts.all]
  ];

  const renderCampaignActions = (campaign, compact = false) => {
    const busy = actionBusy === campaign.id;
    const common = compact ? 'h-9 px-3' : 'h-10 px-3';
    return (
      <>
        <Link to={`/scorm/campaigns/${campaign.id}/analytics`} className={`scorm-button-secondary ${common} inline-flex items-center gap-2 text-xs font-semibold`}><BarChart3 size={13} /> Analytics</Link>
        {campaign.status === 'draft' && <button type="button" disabled={busy} onClick={() => startCampaign(campaign)} className={`scorm-button-primary ${common} inline-flex items-center gap-2 text-xs font-semibold disabled:opacity-50`}><Play size={13} /> {busy ? 'Starting…' : 'Start'}</button>}
        {campaign.status === 'active' && <button type="button" onClick={() => copyPortal(campaign)} className={`scorm-button-primary ${common} inline-flex items-center gap-2 text-xs font-semibold`}><Copy size={13} /> Portal</button>}
        {campaign.status === 'active' && campaign.authMode === 'email_code' && <button type="button" onClick={() => downloadAccessList(campaign)} className={`scorm-button-secondary ${common} inline-flex items-center gap-2 text-xs font-semibold`}><KeyRound size={13} /> Codes</button>}
        {campaign.status === 'active' && <button type="button" disabled={busy} onClick={() => stopCampaign(campaign)} className={`scorm-button-secondary ${common} inline-flex items-center gap-2 text-xs font-semibold disabled:opacity-50`}><Square size={12} /> {busy ? 'Stopping…' : 'Stop'}</button>}
        {['draft', 'stopped'].includes(campaign.status) && <button type="button" disabled={busy} onClick={() => deleteCampaign(campaign)} className={`scorm-button-secondary ${compact ? 'w-9 h-9' : 'w-10 h-10'} grid place-items-center disabled:opacity-50`} title="Delete campaign"><Trash2 size={14} /></button>}
      </>
    );
  };

  return (
    <div className="scorm-campaigns-page p-4 md:p-7 lg:p-8 w-full">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-6 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
        <div>
          <div className="scorm-micro text-[10px] uppercase font-semibold">Learner delivery</div>
          <h1 className="text-[28px] md:text-[34px] font-semibold tracking-[-.03em] mt-1.5">Campaigns</h1>
          <p className="text-sm mt-2 max-w-2xl leading-relaxed" style={{ color: 'var(--scorm-ink-soft)' }}>Create, launch and monitor learner campaigns without leaving one long scrolling page.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => load()} disabled={loading} className="scorm-button-secondary h-10 px-3.5 inline-flex items-center justify-center gap-2 text-xs font-semibold disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
          <button type="button" onClick={openCreate} className="scorm-button-primary h-10 px-4 inline-flex items-center justify-center gap-2 text-xs font-semibold"><Plus size={15} /> Create campaign</button>
        </div>
      </div>

      {message && <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(20,184,166,.28)', background: 'rgba(20,184,166,.08)' }}>{message}</div>}
      {error && !createOpen && <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(251,113,133,.3)', background: 'rgba(251,113,133,.08)' }}>{error}</div>}

      <section className="scorm-panel rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--scorm-line)' }}>
        <div className="p-4 md:p-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ borderColor: 'var(--scorm-line)' }}>
          <div>
            <h2 className="font-semibold text-[16px]">Campaign workspace</h2>
            <div className="text-[11px] mt-1" style={{ color: 'var(--scorm-muted)' }}>Active campaigns are shown first. Use the filters to review drafts or stopped campaigns.</div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {filterOptions.map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className="h-9 px-3 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-2 transition"
                style={{
                  borderColor: filter === value ? 'var(--scorm-accent-strong)' : 'var(--scorm-line)',
                  background: filter === value ? 'rgba(79,201,191,.10)' : 'var(--scorm-surface-soft)',
                  color: filter === value ? 'var(--scorm-accent-strong)' : 'var(--scorm-ink-soft)'
                }}
              >
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
            <div className="text-xs mt-1.5" style={{ color: 'var(--scorm-muted)' }}>{filter === 'active' ? 'Create a campaign or start one of your drafts.' : 'There is nothing in this view yet.'}</div>
            {filter === 'active' && <button type="button" onClick={openCreate} className="scorm-button-primary mt-4 h-10 px-4 inline-flex items-center gap-2 text-xs font-semibold"><Plus size={14} /> Create campaign</button>}
          </div>
        ) : (
          <>
            <div className="divide-y" style={{ borderColor: 'var(--scorm-line)' }}>
              {visibleCampaigns.map((campaign) => (
                <div key={campaign.id} className="campaign-list-row px-4 py-4 md:px-5 grid xl:grid-cols-[minmax(240px,1.25fr)_110px_110px_minmax(220px,.8fr)_auto] gap-4 xl:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <button type="button" onClick={() => viewCampaign(campaign.id)} className="text-sm font-semibold truncate text-left hover:underline">{campaign.name}</button>
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
                  <div className="campaign-actions flex items-center gap-2 justify-start xl:justify-end flex-wrap">
                    <button type="button" onClick={() => viewCampaign(campaign.id)} className="scorm-button-secondary w-10 h-10 grid place-items-center" title="View campaign"><Eye size={14} /></button>
                    {renderCampaignActions(campaign)}
                  </div>
                </div>
              ))}
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

      <ModalShell open={createOpen} onClose={() => !formBusy && setCreateOpen(false)} labelledBy="create-campaign-title">
        <div className="h-full max-h-[calc(100vh-24px)] md:max-h-[calc(100vh-48px)] flex flex-col">
          <div className="p-4 md:px-6 md:py-5 border-b flex items-start justify-between gap-4 shrink-0" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>
            <div>
              <div className="scorm-micro text-[9px] uppercase">New learner campaign</div>
              <h2 id="create-campaign-title" className="text-xl font-semibold mt-1">Create campaign</h2>
              <p className="text-xs mt-1.5" style={{ color: 'var(--scorm-muted)' }}>Add learners, choose courses, select sign-in and save the campaign as a draft. You decide when tracking starts.</p>
            </div>
            <button type="button" disabled={formBusy} onClick={() => setCreateOpen(false)} className="scorm-button-secondary w-9 h-9 grid place-items-center shrink-0 disabled:opacity-50" aria-label="Close create campaign"><X size={16} /></button>
          </div>

          <div className="overflow-y-auto p-4 md:p-6">
            {error && <div className="mb-5 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(251,113,133,.3)', background: 'rgba(251,113,133,.08)' }}>{error}</div>}
            <div className="grid xl:grid-cols-[.95fr_1.05fr] gap-6">
              <div className="space-y-5">
                <label className="block">
                  <span className="scorm-micro block text-[9px] uppercase font-semibold mb-1.5">Campaign name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2.5 text-sm" placeholder="September Security Awareness" maxLength={180} />
                </label>

                <div>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="scorm-micro text-[9px] uppercase font-semibold">Add learners</span>
                    <span className="text-[10px]" style={{ color: 'var(--scorm-muted)' }}>{learnerCount} learner{learnerCount === 1 ? '' : 's'} ready</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-1 rounded-xl border mb-3" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>
                    <button type="button" onClick={() => setLearnerEntryMode('csv')} className="rounded-lg px-3 py-2.5 text-xs font-semibold inline-flex items-center justify-center gap-2 transition" style={{ border: learnerEntryMode === 'csv' ? '1px solid var(--scorm-accent-strong)' : '1px solid transparent', background: learnerEntryMode === 'csv' ? 'rgba(79,201,191,.08)' : 'transparent', color: learnerEntryMode === 'csv' ? 'var(--scorm-accent-strong)' : 'var(--scorm-ink)' }}><Upload size={14} /> Upload CSV</button>
                    <button type="button" onClick={() => setLearnerEntryMode('manual')} className="rounded-lg px-3 py-2.5 text-xs font-semibold inline-flex items-center justify-center gap-2 transition" style={{ border: learnerEntryMode === 'manual' ? '1px solid var(--scorm-accent-strong)' : '1px solid transparent', background: learnerEntryMode === 'manual' ? 'rgba(79,201,191,.08)' : 'transparent', color: learnerEntryMode === 'manual' ? 'var(--scorm-accent-strong)' : 'var(--scorm-ink)' }}><UserPlus size={14} /> Add manually</button>
                  </div>

                  {learnerEntryMode === 'csv' ? (
                    <div>
                      <div className="flex items-center justify-end mb-2"><button type="button" onClick={downloadTemplate} className="text-[10px] font-semibold inline-flex items-center gap-1.5" style={{ color: 'var(--scorm-accent-strong)' }}><Download size={12} /> Download template</button></div>
                      <button type="button" onClick={() => fileRef.current?.click()} className="campaign-upload-zone w-full rounded-2xl border border-dashed p-5 text-left transition hover:opacity-90" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>
                        <div className="flex items-center gap-3"><span className="w-10 h-10 rounded-xl border grid place-items-center" style={{ borderColor: 'var(--scorm-line)' }}><Upload size={16} /></span><span><span className="block text-sm font-semibold">{csvFileName || 'Upload CSV file'}</span><span className="block text-[11px] mt-1" style={{ color: 'var(--scorm-muted)' }}>Required: Email · Optional: Name, First Name, Last Name</span></span></div>
                      </button>
                      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => readCsv(e.target.files?.[0])} />
                      {csvPreview && <div className="campaign-csv-preview mt-3 rounded-xl border px-3.5 py-3 text-xs" style={{ borderColor: 'var(--scorm-line)' }}><div className="flex flex-wrap gap-x-5 gap-y-2"><span><strong>{csvPreview.validLearners}</strong> valid learners</span><span><strong>{csvPreview.invalidRows?.length || 0}</strong> invalid rows</span></div></div>}
                    </div>
                  ) : (
                    <div className="rounded-2xl border p-3.5 md:p-4" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>
                      <form onSubmit={addManualLearner} className="grid sm:grid-cols-[1fr_1.2fr_auto] gap-2.5 items-end">
                        <label className="block"><span className="scorm-micro block text-[8px] uppercase font-semibold mb-1.5">Name · optional</span><input value={manualName} onChange={(e) => setManualName(e.target.value)} className="w-full px-3 py-2.5 text-sm" placeholder="Learner name" maxLength={180} /></label>
                        <label className="block"><span className="scorm-micro block text-[8px] uppercase font-semibold mb-1.5">Email address</span><input value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} className="w-full px-3 py-2.5 text-sm" placeholder="learner@company.com" type="email" autoComplete="off" /></label>
                        <button type="submit" className="scorm-button-secondary h-[42px] px-3.5 inline-flex items-center justify-center gap-2 text-xs font-semibold whitespace-nowrap"><UserPlus size={14} /> Add</button>
                      </form>
                      {manualLearners.length > 0 ? <div className="mt-3 rounded-xl border overflow-hidden divide-y max-h-[220px] overflow-y-auto" style={{ borderColor: 'var(--scorm-line)' }}>{manualLearners.map((learner, index) => <div key={learner.email} className="px-3 py-2.5 flex items-center gap-3" style={{ borderColor: 'var(--scorm-line)' }}><span className="w-7 h-7 rounded-lg border grid place-items-center shrink-0 text-[10px] font-semibold" style={{ borderColor: 'var(--scorm-line)' }}>{index + 1}</span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold truncate">{learner.learnerName || 'Learner'}</span><span className="block text-[10px] truncate mt-0.5" style={{ color: 'var(--scorm-muted)' }}>{learner.email}</span></span><button type="button" onClick={() => removeManualLearner(learner.email)} className="w-8 h-8 rounded-lg border grid place-items-center shrink-0" style={{ borderColor: 'var(--scorm-line)' }} title="Remove learner"><Trash2 size={13} /></button></div>)}</div> : <div className="text-[11px] mt-3" style={{ color: 'var(--scorm-muted)' }}>Add learners one at a time. Duplicate emails are blocked automatically.</div>}
                    </div>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <label><span className="scorm-micro block text-[9px] uppercase font-semibold mb-1.5">Due date · optional</span><div className="relative"><CalendarDays size={14} className="absolute left-3 top-1/2 -translate-y-1/2" /><input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="w-full pl-9 pr-3 py-2.5 text-sm" /></div></label>
                  <label className="flex items-end"><span className="campaign-required-toggle w-full min-h-[42px] flex items-center gap-2 rounded-xl border px-3" style={{ borderColor: 'var(--scorm-line)' }}><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /><span className="text-sm">Required courses</span></span></label>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between gap-3 mb-3"><div><div className="font-semibold text-sm">Choose published courses</div><div className="text-[11px] mt-1" style={{ color: 'var(--scorm-muted)' }}>{selectedCourses.length} selected</div></div><BookOpen size={17} /></div>
                  <div className="campaign-course-list rounded-2xl border overflow-hidden max-h-[300px] overflow-y-auto divide-y" style={{ borderColor: 'var(--scorm-line)' }}>
                    {publishedCourses.length ? publishedCourses.map((course) => <label key={course.id} className="campaign-course-row p-3.5 md:p-4 flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={selectedCourses.includes(course.id)} onChange={() => toggleCourse(course.id)} /><span className="w-9 h-9 rounded-xl border grid place-items-center shrink-0" style={{ borderColor: 'var(--scorm-line)' }}><BookOpen size={15} /></span><span className="min-w-0"><span className="block text-sm font-semibold truncate">{course.title}</span><span className="block text-[10px] uppercase mt-0.5" style={{ color: 'var(--scorm-accent-strong)' }}>Published</span></span></label>) : <div className="p-8 text-center text-sm" style={{ color: 'var(--scorm-muted)' }}>Create and publish a course first.</div>}
                  </div>
                </div>

                <div>
                  <div className="scorm-micro text-[9px] uppercase font-semibold mb-2">Learner sign-in</div>
                  <div className="grid gap-2">
                    {authCards.map((option) => {
                      const selected = authMode === option.id;
                      return <button key={option.id} type="button" disabled={!option.enabled} onClick={() => option.enabled && setAuthMode(option.id)} className="w-full rounded-xl border px-3.5 py-3 text-left transition disabled:opacity-45 disabled:cursor-not-allowed" style={{ borderColor: selected ? 'var(--scorm-accent-strong)' : 'var(--scorm-line)', background: selected ? 'rgba(79,201,191,.08)' : 'var(--scorm-surface-soft)' }}><span className="flex items-start gap-3"><span className="w-8 h-8 rounded-lg border grid place-items-center shrink-0" style={{ borderColor: 'var(--scorm-line)' }}>{option.icon}</span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-3"><span className="text-xs font-semibold">{option.title}</span><span className="text-[9px] uppercase font-semibold" style={{ color: selected ? 'var(--scorm-accent-strong)' : 'var(--scorm-muted)' }}>{selected ? 'Selected' : option.enabled ? 'Available' : 'Not configured'}</span></span><span className="block text-[10px] leading-relaxed mt-1" style={{ color: 'var(--scorm-muted)' }}>{option.description}</span></span></span></button>;
                    })}
                  </div>
                </div>

                <div className="campaign-soft-card rounded-xl border p-4 text-[11px] leading-relaxed flex gap-2" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)', color: 'var(--scorm-muted)' }}><ShieldCheck size={14} className="shrink-0 mt-0.5" /><span>{authMode === 'email_code' ? 'No tenant SSO is required. Learners use their assigned email plus a unique campaign access code.' : <>{authLabel(authMode)} will be required. Provider settings are managed in <Link to="/scorm/learner-access" className="font-semibold underline">Authentication & SSO</Link>.</>}</span></div>
              </div>
            </div>
          </div>

          <div className="p-4 md:px-6 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>
            <div className="text-[10px]" style={{ color: 'var(--scorm-muted)' }}>This saves a Draft. Learner tracking starts only after you press Start.</div>
            <div className="flex items-center gap-2 justify-end">
              <button type="button" disabled={formBusy} onClick={() => setCreateOpen(false)} className="scorm-button-secondary h-10 px-4 text-xs font-semibold disabled:opacity-50">Cancel</button>
              <button type="button" disabled={formBusy || !name.trim() || !learnerCount || !selectedCourses.length} onClick={createCampaign} className="scorm-button-primary h-10 px-4 text-xs font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"><CheckCircle2 size={14} /> {formBusy ? 'Creating…' : 'Create draft campaign'}</button>
            </div>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={Boolean(selectedCampaign)} onClose={closeDetail} labelledBy="campaign-detail-title">
        <div className="h-full max-h-[calc(100vh-24px)] md:max-h-[calc(100vh-48px)] flex flex-col">
          <div className="p-4 md:px-6 md:py-5 border-b flex items-start justify-between gap-4 shrink-0" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>
            <div className="min-w-0">
              <div className="scorm-micro text-[9px] uppercase">Campaign detail</div>
              <div className="flex items-center gap-2 mt-1"><h2 id="campaign-detail-title" className="text-xl font-semibold truncate">{campaignDetail?.name || 'Loading campaign…'}</h2>{campaignDetail && <span className="px-2 py-1 rounded-full text-[8px] uppercase tracking-[.08em] font-bold border shrink-0" style={statusStyle(campaignDetail.status)}>{statusLabel(campaignDetail.status)}</span>}</div>
              {campaignDetail && <div className="text-[10px] mt-1.5" style={{ color: 'var(--scorm-muted)' }}>{campaignDetail.authModeLabel || authLabel(campaignDetail.authMode)}</div>}
            </div>
            <button type="button" onClick={closeDetail} className="scorm-button-secondary w-9 h-9 grid place-items-center shrink-0" aria-label="Close campaign details"><X size={16} /></button>
          </div>

          <div className="overflow-y-auto p-4 md:p-6">
            {!campaignDetail ? <div className="p-10 text-sm text-center" style={{ color: 'var(--scorm-muted)' }}>Loading campaign…</div> : (
              <>
                <div className="flex flex-wrap gap-2 mb-5">{renderCampaignActions(campaignDetail, true)}</div>
                <div className="grid lg:grid-cols-2 gap-5">
                  <div>
                    <div className="font-semibold text-sm mb-3">Learners · {campaignDetail.learners?.length || 0}</div>
                    <div className="campaign-detail-list rounded-xl border max-h-[330px] overflow-y-auto divide-y" style={{ borderColor: 'var(--scorm-line)' }}>
                      {(campaignDetail.learners || []).map((learner) => <div key={learner.id} className="campaign-detail-row px-3.5 py-3"><div className="text-xs font-semibold">{learner.learnerName || 'Learner'}</div><div className="text-[11px] mt-0.5" style={{ color: 'var(--scorm-muted)' }}>{learner.email}</div></div>)}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-sm mb-3">Campaign courses · {campaignDetail.courses?.length || 0}</div>
                    <div className="campaign-detail-list rounded-xl border max-h-[260px] overflow-y-auto divide-y" style={{ borderColor: 'var(--scorm-line)' }}>
                      {(campaignDetail.courses || []).map((course) => <div key={course.id} className="campaign-detail-row px-3.5 py-3 flex items-center gap-3"><BookOpen size={14} /><span className="text-xs font-semibold">{course.title}</span></div>)}
                    </div>
                    {campaignDetail.status === 'active' && campaignDetail.portalPath && <div className="campaign-soft-card mt-4 rounded-xl border p-4" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}><div className="scorm-micro text-[8px] uppercase">Learner portal</div><div className="text-[11px] break-all mt-2" style={{ color: 'var(--scorm-muted)' }}>{`${window.location.origin}${campaignDetail.portalPath}`}</div></div>}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </ModalShell>
    </div>
  );
}
