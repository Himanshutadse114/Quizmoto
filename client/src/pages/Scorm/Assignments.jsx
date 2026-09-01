import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  KeyRound,
  Mail,
  Play,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import './scormCampaignReporting.css';

function formatDate(value) {
  if (!value) return 'No due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No due date';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusLabel(status) {
  if (status === 'active') return 'Active';
  if (status === 'completed') return 'Completed';
  return 'Draft';
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

export default function Assignments() {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const fileRef = useRef(null);
  const [campaigns, setCampaigns] = useState([]);
  const [courses, setCourses] = useState([]);
  const [authOptions, setAuthOptions] = useState({ emailCode: true, googleConfigured: false, microsoftConfigured: false });
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [campaignDetail, setCampaignDetail] = useState(null);
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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(apiUrl('/api/scorm/campaigns'), { headers });
      setCampaigns(res.data?.campaigns || []);
      setCourses(res.data?.courses || []);
      setAuthOptions(res.data?.authOptions || { emailCode: true, googleConfigured: false, microsoftConfigured: false });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load campaigns.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) load(); }, [token]);

  const publishedCourses = courses.filter((course) => course.status === 'published');
  const toggleCourse = (id) => setSelectedCourses((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const learnerCount = learnerEntryMode === 'manual' ? manualLearners.length : Number(csvPreview?.validLearners || 0);

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
    if (!isValidEmail(email)) {
      setError('Enter a valid learner email address.');
      return;
    }
    if (manualLearners.some((learner) => learner.email === email)) {
      setError('This learner email has already been added.');
      return;
    }
    setManualLearners((current) => [...current, { email, learnerName: learnerName || email.split('@')[0] }]);
    setManualName('');
    setManualEmail('');
  };

  const removeManualLearner = (email) => {
    setManualLearners((current) => current.filter((learner) => learner.email !== email));
  };

  const resetLearnerInputs = () => {
    setLearnerEntryMode('csv');
    setCsvText('');
    setCsvFileName('');
    setCsvPreview(null);
    setManualLearners([]);
    setManualName('');
    setManualEmail('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const createCampaign = async () => {
    setError('');
    setMessage('');
    if (name.trim().length < 2) return setError('Enter a campaign name.');
    if (!learnerCount) return setError(learnerEntryMode === 'manual' ? 'Add at least one learner.' : 'Upload a learner CSV first.');
    if (!selectedCourses.length) return setError('Select at least one published course.');
    if (authMode === 'google' && !authOptions.googleConfigured) return setError('Google SSO is not configured for this tenant.');
    if (authMode === 'microsoft' && !authOptions.microsoftConfigured) return setError('Microsoft SSO is not configured for this tenant.');
    setBusy(true);
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
      const modeText = authLabel(campaign?.authMode || authMode);
      setMessage(`Campaign “${campaign?.name || name.trim()}” created as a draft with ${modeText}. Review it, then start the campaign.`);
      setName('');
      resetLearnerInputs();
      setSelectedCourses([]);
      setDueAt('');
      setRequired(true);
      setAuthMode('email_code');
      await load();
      if (campaign?.id) await viewCampaign(campaign.id);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to create campaign.');
    } finally {
      setBusy(false);
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

  const startCampaign = async (campaign) => {
    const method = authLabel(campaign.authMode);
    const extra = campaign.authMode === 'email_code'
      ? 'Learners will use their assigned email and unique access code.'
      : `Learners will be required to use ${method}.`;
    if (!window.confirm(`Start “${campaign.name}”? This will create a separate course instance for every learner-course combination. ${extra}`)) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await axios.post(apiUrl(`/api/scorm/campaigns/${campaign.id}/start`), {}, { headers });
      const started = res.data?.campaign;
      setMessage(`Campaign “${started?.name || campaign.name}” is active. Copy the learner portal link${started?.authMode === 'email_code' ? ' and download the access list' : ''}.`);
      await load();
      await viewCampaign(campaign.id);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to start campaign.');
    } finally {
      setBusy(false);
    }
  };

  const deleteCampaign = async (campaign) => {
    if (!window.confirm(`Delete draft campaign “${campaign.name}”?`)) return;
    setBusy(true);
    setError('');
    try {
      await axios.delete(apiUrl(`/api/scorm/campaigns/${campaign.id}`), { headers });
      if (selectedCampaign === campaign.id) {
        setSelectedCampaign(null);
        setCampaignDetail(null);
      }
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete campaign.');
    } finally {
      setBusy(false);
    }
  };

  const copyPortal = async (campaign) => {
    if (!campaign?.portalPath) return;
    const url = `${window.location.origin}${campaign.portalPath}`;
    try {
      await navigator.clipboard.writeText(url);
      if (campaign.authMode === 'email_code') {
        setMessage('Campaign learner link copied. Send each learner the link together with their unique access code from the access list.');
      } else {
        setMessage(`Campaign learner link copied. Learners must sign in with ${authLabel(campaign.authMode)} using the email assigned to this campaign.`);
      }
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
      setMessage('Learner access list downloaded. Each code is unique to that learner email and this campaign.');
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

  return (
    <div className="scorm-campaigns-page p-4 md:p-7 lg:p-9 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-7 pb-7 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
        <div className="max-w-3xl">
          <div className="scorm-micro text-[10px] uppercase font-semibold">Learner delivery</div>
          <h1 className="scorm-display text-[32px] md:text-[42px] mt-2">Campaigns</h1>
          <p className="text-sm mt-3 leading-relaxed" style={{ color: 'var(--scorm-ink-soft)' }}>
            Add learners individually or upload a CSV, choose published courses and decide how learners will authenticate for this campaign. SSO is optional — campaigns can also use a secure email + access code flow.
          </p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="scorm-button-secondary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {message && <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(20,184,166,.28)', background: 'rgba(20,184,166,.08)' }}>{message}</div>}
      {error && <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(251,113,133,.3)', background: 'rgba(251,113,133,.08)' }}>{error}</div>}

      <section className="scorm-panel rounded-2xl border overflow-hidden mb-7">
        <div className="p-4 md:p-5 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
          <div className="flex items-center gap-2"><FileSpreadsheet size={17} /><h2 className="font-semibold">Create campaign</h2></div>
          <p className="text-xs mt-1.5" style={{ color: 'var(--scorm-muted)' }}>Campaigns stay in Draft until you explicitly start them.</p>
        </div>

        <div className="p-4 md:p-5 grid xl:grid-cols-[.9fr_1.1fr] gap-6">
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
                <button
                  type="button"
                  onClick={() => setLearnerEntryMode('csv')}
                  className="rounded-lg px-3 py-2.5 text-xs font-semibold inline-flex items-center justify-center gap-2 transition"
                  style={{
                    border: learnerEntryMode === 'csv' ? '1px solid var(--scorm-accent-strong)' : '1px solid transparent',
                    background: learnerEntryMode === 'csv' ? 'rgba(79,201,191,.08)' : 'transparent',
                    color: learnerEntryMode === 'csv' ? 'var(--scorm-accent-strong)' : 'var(--scorm-ink)'
                  }}
                >
                  <Upload size={14} /> Upload CSV
                </button>
                <button
                  type="button"
                  onClick={() => setLearnerEntryMode('manual')}
                  className="rounded-lg px-3 py-2.5 text-xs font-semibold inline-flex items-center justify-center gap-2 transition"
                  style={{
                    border: learnerEntryMode === 'manual' ? '1px solid var(--scorm-accent-strong)' : '1px solid transparent',
                    background: learnerEntryMode === 'manual' ? 'rgba(79,201,191,.08)' : 'transparent',
                    color: learnerEntryMode === 'manual' ? 'var(--scorm-accent-strong)' : 'var(--scorm-ink)'
                  }}
                >
                  <UserPlus size={14} /> Add manually
                </button>
              </div>

              {learnerEntryMode === 'csv' ? (
                <div>
                  <div className="flex items-center justify-end mb-2">
                    <button type="button" onClick={downloadTemplate} className="text-[10px] font-semibold inline-flex items-center gap-1.5" style={{ color: 'var(--scorm-accent-strong)' }}><Download size={12} /> Download template</button>
                  </div>
                  <button type="button" onClick={() => fileRef.current?.click()} className="campaign-upload-zone w-full rounded-2xl border border-dashed p-5 text-left transition hover:opacity-90" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>
                    <div className="flex items-center gap-3"><span className="w-10 h-10 rounded-xl border grid place-items-center" style={{ borderColor: 'var(--scorm-line)' }}><Upload size={16} /></span><span><span className="block text-sm font-semibold">{csvFileName || 'Upload CSV file'}</span><span className="block text-[11px] mt-1" style={{ color: 'var(--scorm-muted)' }}>Required column: Email · Optional: Name, First Name, Last Name</span></span></div>
                  </button>
                  <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => readCsv(e.target.files?.[0])} />
                  {csvPreview && (
                    <div className="campaign-csv-preview mt-3 rounded-xl border px-3.5 py-3 text-xs" style={{ borderColor: 'var(--scorm-line)' }}>
                      <div className="flex flex-wrap gap-x-5 gap-y-2"><span><strong>{csvPreview.validLearners}</strong> valid learners</span><span><strong>{csvPreview.invalidRows?.length || 0}</strong> invalid rows</span></div>
                      {csvPreview.invalidRows?.length > 0 && <div className="mt-2 text-[11px]" style={{ color: 'var(--scorm-muted)' }}>Invalid rows are excluded. Fix the CSV before launch if those users should be included.</div>}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border p-3.5 md:p-4" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>
                  <form onSubmit={addManualLearner} className="grid sm:grid-cols-[1fr_1.2fr_auto] gap-2.5 items-end">
                    <label className="block">
                      <span className="scorm-micro block text-[8px] uppercase font-semibold mb-1.5">Name · optional</span>
                      <input value={manualName} onChange={(e) => setManualName(e.target.value)} className="w-full px-3 py-2.5 text-sm" placeholder="Learner name" maxLength={180} />
                    </label>
                    <label className="block">
                      <span className="scorm-micro block text-[8px] uppercase font-semibold mb-1.5">Email address</span>
                      <input value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} className="w-full px-3 py-2.5 text-sm" placeholder="learner@company.com" type="email" autoComplete="off" />
                    </label>
                    <button type="submit" className="scorm-button-secondary h-[42px] px-3.5 inline-flex items-center justify-center gap-2 text-xs font-semibold whitespace-nowrap"><UserPlus size={14} /> Add learner</button>
                  </form>

                  {manualLearners.length > 0 ? (
                    <div className="mt-3 rounded-xl border overflow-hidden divide-y max-h-[260px] overflow-y-auto" style={{ borderColor: 'var(--scorm-line)' }}>
                      {manualLearners.map((learner, index) => (
                        <div key={learner.email} className="px-3 py-2.5 flex items-center gap-3" style={{ borderColor: 'var(--scorm-line)' }}>
                          <span className="w-7 h-7 rounded-lg border grid place-items-center shrink-0 text-[10px] font-semibold" style={{ borderColor: 'var(--scorm-line)' }}>{index + 1}</span>
                          <span className="min-w-0 flex-1"><span className="block text-xs font-semibold truncate">{learner.learnerName || 'Learner'}</span><span className="block text-[10px] truncate mt-0.5" style={{ color: 'var(--scorm-muted)' }}>{learner.email}</span></span>
                          <button type="button" onClick={() => removeManualLearner(learner.email)} className="w-8 h-8 rounded-lg border grid place-items-center shrink-0" style={{ borderColor: 'var(--scorm-line)' }} title="Remove learner"><Trash2 size={13} /></button>
                        </div>
                      ))}
                    </div>
                  ) : <div className="text-[11px] mt-3" style={{ color: 'var(--scorm-muted)' }}>Add learners one at a time. Duplicate email addresses are blocked automatically.</div>}
                </div>
              )}
            </div>

            <div>
              <div className="scorm-micro text-[9px] uppercase font-semibold mb-2">Learner sign-in for this campaign</div>
              <div className="grid gap-2">
                {authCards.map((option) => {
                  const selected = authMode === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={!option.enabled}
                      onClick={() => option.enabled && setAuthMode(option.id)}
                      className="w-full rounded-xl border px-3.5 py-3 text-left transition disabled:opacity-45 disabled:cursor-not-allowed"
                      style={{
                        borderColor: selected ? 'var(--scorm-accent-strong)' : 'var(--scorm-line)',
                        background: selected ? 'rgba(79,201,191,.08)' : 'var(--scorm-surface-soft)'
                      }}
                    >
                      <span className="flex items-start gap-3">
                        <span className="w-8 h-8 rounded-lg border grid place-items-center shrink-0" style={{ borderColor: 'var(--scorm-line)' }}>{option.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-3"><span className="text-xs font-semibold">{option.title}</span><span className="text-[9px] uppercase font-semibold" style={{ color: selected ? 'var(--scorm-accent-strong)' : 'var(--scorm-muted)' }}>{selected ? 'Selected' : option.enabled ? 'Available' : 'Not configured'}</span></span>
                          <span className="block text-[10px] leading-relaxed mt-1" style={{ color: 'var(--scorm-muted)' }}>{option.description}</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label><span className="scorm-micro block text-[9px] uppercase font-semibold mb-1.5">Due date · optional</span><div className="relative"><CalendarDays size={14} className="absolute left-3 top-1/2 -translate-y-1/2" /><input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="w-full pl-9 pr-3 py-2.5 text-sm" /></div></label>
              <label className="flex items-end"><span className="campaign-required-toggle w-full min-h-[42px] flex items-center gap-2 rounded-xl border px-3" style={{ borderColor: 'var(--scorm-line)' }}><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /><span className="text-sm">Required courses</span></span></label>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-3"><div><div className="font-semibold text-sm">Choose published courses</div><div className="text-[11px] mt-1" style={{ color: 'var(--scorm-muted)' }}>{selectedCourses.length} selected</div></div><BookOpen size={17} /></div>
            <div className="campaign-course-list rounded-2xl border overflow-hidden max-h-[360px] overflow-y-auto divide-y" style={{ borderColor: 'var(--scorm-line)' }}>
              {publishedCourses.length ? publishedCourses.map((course) => (
                <label key={course.id} className="campaign-course-row p-3.5 md:p-4 flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={selectedCourses.includes(course.id)} onChange={() => toggleCourse(course.id)} />
                  <span className="w-9 h-9 rounded-xl border grid place-items-center shrink-0" style={{ borderColor: 'var(--scorm-line)' }}><BookOpen size={15} /></span>
                  <span className="min-w-0"><span className="block text-sm font-semibold truncate">{course.title}</span><span className="block text-[10px] uppercase mt-0.5" style={{ color: 'var(--scorm-accent-strong)' }}>Published</span></span>
                </label>
              )) : <div className="p-8 text-center text-sm" style={{ color: 'var(--scorm-muted)' }}>Create and publish a course first.</div>}
            </div>
          </div>
        </div>

        <div className="p-4 md:p-5 border-t flex flex-col lg:flex-row lg:items-center justify-between gap-3" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>
          <div className="text-[11px] leading-relaxed flex gap-2" style={{ color: 'var(--scorm-muted)' }}>
            <ShieldCheck size={14} className="shrink-0 mt-0.5" />
            <span>{authMode === 'email_code' ? 'No tenant SSO is required. Learners use their assigned email plus a unique campaign access code.' : <>{authLabel(authMode)} will be required for this campaign. Provider settings are managed in <Link to="/scorm/learner-access" className="font-semibold underline">Authentication & SSO</Link>.</>}</span>
          </div>
          <button type="button" disabled={busy || !name.trim() || !learnerCount || !selectedCourses.length} onClick={createCampaign} className="scorm-button-primary px-5 py-3 text-xs font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"><CheckCircle2 size={15} />{busy ? 'Creating…' : 'Create draft campaign'}</button>
        </div>
      </section>

      <section className="scorm-panel rounded-2xl border overflow-hidden">
        <div className="p-4 md:p-5 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--scorm-line)' }}>
          <div><h2 className="font-semibold">Campaigns</h2><div className="scorm-micro text-[9px] mt-1">{campaigns.length} campaign{campaigns.length === 1 ? '' : 's'}</div></div>
        </div>
        {loading ? <div className="p-10 text-center text-sm" style={{ color: 'var(--scorm-muted)' }}>Loading campaigns…</div> : campaigns.length === 0 ? <div className="p-10 text-center text-sm" style={{ color: 'var(--scorm-muted)' }}>No campaigns yet. Add learners and create your first campaign.</div> : (
          <div className="divide-y" style={{ borderColor: 'var(--scorm-line)' }}>
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="campaign-list-row p-4 md:p-5 grid xl:grid-cols-[1.2fr_.55fr_.55fr_.7fr_auto] gap-4 xl:items-center">
                <div className="min-w-0"><div className="flex items-center gap-2"><div className="text-sm font-semibold truncate">{campaign.name}</div><span className="px-2 py-1 rounded-full text-[8px] uppercase tracking-[.08em] font-bold border" style={{ borderColor: 'var(--scorm-line)' }}>{statusLabel(campaign.status)}</span></div><div className="text-[11px] mt-1" style={{ color: 'var(--scorm-muted)' }}>Created {formatDate(campaign.createdAt)} · {formatDate(campaign.dueAt)} · {campaign.authModeLabel || authLabel(campaign.authMode)}</div></div>
                <div><div className="scorm-micro text-[8px] uppercase">Learners</div><div className="text-sm font-semibold mt-1 flex items-center gap-1.5"><Users size={13} />{campaign.learnerCount}</div></div>
                <div><div className="scorm-micro text-[8px] uppercase">Courses</div><div className="text-sm font-semibold mt-1 flex items-center gap-1.5"><BookOpen size={13} />{campaign.courseCount}</div></div>
                <div><div className="flex items-center justify-between text-[9px] mb-1"><span className="scorm-micro uppercase">Completion</span><span>{campaign.completionPercent}%</span></div><div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--scorm-line)' }}><div className="h-full rounded-full" style={{ width: `${campaign.completionPercent}%`, background: '#4FC9BF' }} /></div><div className="text-[9px] mt-1" style={{ color: 'var(--scorm-muted)' }}>{campaign.completedCount}/{campaign.assignmentCount} instances completed</div></div>
                <div className="campaign-actions flex items-center gap-2 justify-end flex-wrap">
                  <button type="button" onClick={() => viewCampaign(campaign.id)} className="scorm-button-secondary w-10 h-10 grid place-items-center" title="View campaign"><Eye size={14} /></button>
                  <Link to={`/scorm/campaigns/${campaign.id}/analytics`} className="scorm-button-secondary h-10 px-3 inline-flex items-center gap-2 text-xs font-semibold"><BarChart3 size={13} /> Analytics</Link>
                  {campaign.status === 'draft' ? <button type="button" disabled={busy} onClick={() => startCampaign(campaign)} className="scorm-button-primary h-10 px-3 inline-flex items-center gap-2 text-xs font-semibold"><Play size={13} /> Start</button> : <button type="button" onClick={() => copyPortal(campaign)} className="scorm-button-primary h-10 px-3 inline-flex items-center gap-2 text-xs font-semibold"><Copy size={13} /> Portal</button>}
                  {campaign.authMode === 'email_code' && <button type="button" disabled={busy} onClick={() => downloadAccessList(campaign)} className="scorm-button-secondary h-10 px-3 inline-flex items-center gap-2 text-xs font-semibold" title="Download learner access list"><KeyRound size={13} /> Codes</button>}
                  {campaign.status === 'draft' && <button type="button" disabled={busy} onClick={() => deleteCampaign(campaign)} className="scorm-button-secondary w-10 h-10 grid place-items-center" title="Delete draft"><Trash2 size={14} /></button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedCampaign && (
        <section className="scorm-panel rounded-2xl border overflow-hidden mt-7">
          <div className="p-4 md:p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: 'var(--scorm-line)' }}>
            <div><div className="scorm-micro text-[9px] uppercase">Campaign detail</div><h2 className="font-semibold mt-1">{campaignDetail?.name || 'Loading…'}</h2>{campaignDetail && <div className="text-[10px] mt-1" style={{ color: 'var(--scorm-muted)' }}>{campaignDetail.authModeLabel || authLabel(campaignDetail.authMode)}</div>}</div>
            {campaignDetail && <div className="flex flex-wrap gap-2">
              <Link to={`/scorm/campaigns/${campaignDetail.id}/analytics`} className="scorm-button-secondary px-4 py-2.5 text-xs font-semibold inline-flex items-center gap-2"><BarChart3 size={13} /> View analytics</Link>
              {campaignDetail.authMode === 'email_code' && <button type="button" onClick={() => downloadAccessList(campaignDetail)} className="scorm-button-secondary px-4 py-2.5 text-xs font-semibold inline-flex items-center gap-2"><Download size={13} /> Download access list</button>}
              {campaignDetail.status === 'active' && <button type="button" onClick={() => copyPortal(campaignDetail)} className="scorm-button-primary px-4 py-2.5 text-xs font-semibold inline-flex items-center gap-2"><Copy size={13} /> Copy learner portal</button>}
            </div>}
          </div>
          {!campaignDetail ? <div className="p-8 text-sm" style={{ color: 'var(--scorm-muted)' }}>Loading campaign…</div> : (
            <div className="p-4 md:p-5 grid lg:grid-cols-2 gap-5">
              <div>
                <div className="font-semibold text-sm mb-3">Learners · {campaignDetail.learners?.length || 0}</div>
                <div className="campaign-detail-list rounded-xl border max-h-[310px] overflow-y-auto divide-y" style={{ borderColor: 'var(--scorm-line)' }}>
                  {(campaignDetail.learners || []).map((learner) => <div key={learner.id} className="campaign-detail-row px-3.5 py-3"><div className="text-xs font-semibold">{learner.learnerName || 'Learner'}</div><div className="text-[11px] mt-0.5" style={{ color: 'var(--scorm-muted)' }}>{learner.email}</div></div>)}
                </div>
              </div>
              <div>
                <div className="font-semibold text-sm mb-3">Campaign courses · {campaignDetail.courses?.length || 0}</div>
                <div className="campaign-detail-list rounded-xl border divide-y" style={{ borderColor: 'var(--scorm-line)' }}>
                  {(campaignDetail.courses || []).map((course) => <div key={course.id} className="campaign-detail-row px-3.5 py-3 flex items-center gap-3"><BookOpen size={14} /><span className="text-xs font-semibold">{course.title}</span></div>)}
                </div>
                {campaignDetail.status === 'active' && <div className="campaign-soft-card mt-4 rounded-xl border p-4" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}><div className="scorm-micro text-[8px] uppercase">Learner portal</div><div className="text-[11px] break-all mt-2" style={{ color: 'var(--scorm-muted)' }}>{`${window.location.origin}${campaignDetail.portalPath}`}</div>{campaignDetail.authMode === 'email_code' && <div className="text-[10px] leading-relaxed mt-2" style={{ color: 'var(--scorm-muted)' }}>Share this link with learners and provide each person only their own access code from the downloaded access list.</div>}</div>}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
