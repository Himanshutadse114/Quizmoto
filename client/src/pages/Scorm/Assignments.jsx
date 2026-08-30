import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  Play,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  Users
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

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

export default function Assignments() {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const fileRef = useRef(null);
  const [campaigns, setCampaigns] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [campaignDetail, setCampaignDetail] = useState(null);
  const [name, setName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [csvFileName, setCsvFileName] = useState('');
  const [csvPreview, setCsvPreview] = useState(null);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [dueAt, setDueAt] = useState('');
  const [required, setRequired] = useState(true);
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
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load campaigns.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) load(); }, [token]);

  const publishedCourses = courses.filter((course) => course.status === 'published');
  const toggleCourse = (id) => setSelectedCourses((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

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

  const createCampaign = async () => {
    setError('');
    setMessage('');
    if (name.trim().length < 2) return setError('Enter a campaign name.');
    if (!csvText || !csvPreview?.validLearners) return setError('Upload a learner CSV first.');
    if (!selectedCourses.length) return setError('Select at least one published course.');
    setBusy(true);
    try {
      const res = await axios.post(apiUrl('/api/scorm/campaigns'), {
        name: name.trim(),
        csvText,
        courseIds: selectedCourses,
        dueAt: dueAt || null,
        required
      }, { headers });
      const campaign = res.data?.campaign;
      setMessage(`Campaign “${campaign?.name || name.trim()}” created as a draft. Review it, then start the campaign to create learner-course instances and activate the SSO portal.`);
      setName('');
      setCsvText('');
      setCsvFileName('');
      setCsvPreview(null);
      setSelectedCourses([]);
      setDueAt('');
      setRequired(true);
      if (fileRef.current) fileRef.current.value = '';
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
    if (!window.confirm(`Start “${campaign.name}”? This will create a separate course instance for every learner-course combination and activate the SSO portal.`)) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await axios.post(apiUrl(`/api/scorm/campaigns/${campaign.id}/start`), {}, { headers });
      const started = res.data?.campaign;
      setMessage(`Campaign “${started?.name || campaign.name}” is active. Copy the campaign portal link and send the same link to everyone in the CSV.`);
      await load();
      await viewCampaign(campaign.id);
    } catch (err) {
      const msg = err.response?.data?.message || 'Unable to start campaign.';
      setError(msg);
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
      setMessage('Campaign portal link copied. Only verified Google/Microsoft emails included in this campaign CSV can enter.');
    } catch (_) {
      setError('Could not copy the campaign portal link.');
    }
  };

  return (
    <div className="p-4 md:p-7 lg:p-9 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-7 pb-7 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
        <div className="max-w-3xl">
          <div className="scorm-micro text-[10px] uppercase font-semibold">Learner delivery</div>
          <h1 className="scorm-display text-[36px] md:text-[50px] mt-2">Campaigns</h1>
          <p className="text-sm mt-3 leading-relaxed" style={{ color: 'var(--scorm-ink-soft)' }}>
            Upload the approved learner CSV, choose one or more published courses, name the campaign and start it. Learners receive one campaign link and must verify the exact CSV email with Google or Microsoft SSO.
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
                <span className="scorm-micro text-[9px] uppercase font-semibold">Learner CSV</span>
                <button type="button" onClick={downloadTemplate} className="text-[10px] font-semibold inline-flex items-center gap-1.5" style={{ color: 'var(--scorm-accent-strong)' }}><Download size={12} /> Download template</button>
              </div>
              <button type="button" onClick={() => fileRef.current?.click()} className="w-full rounded-2xl border border-dashed p-5 text-left transition hover:opacity-90" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>
                <div className="flex items-center gap-3"><span className="w-10 h-10 rounded-xl border grid place-items-center" style={{ borderColor: 'var(--scorm-line)' }}><Upload size={16} /></span><span><span className="block text-sm font-semibold">{csvFileName || 'Upload CSV file'}</span><span className="block text-[11px] mt-1" style={{ color: 'var(--scorm-muted)' }}>Required column: Email · Optional: Name, First Name, Last Name</span></span></div>
              </button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => readCsv(e.target.files?.[0])} />
              {csvPreview && (
                <div className="mt-3 rounded-xl border px-3.5 py-3 text-xs" style={{ borderColor: 'var(--scorm-line)' }}>
                  <div className="flex flex-wrap gap-x-5 gap-y-2"><span><strong>{csvPreview.validLearners}</strong> valid learners</span><span><strong>{csvPreview.invalidRows?.length || 0}</strong> invalid rows</span></div>
                  {csvPreview.invalidRows?.length > 0 && <div className="mt-2 text-[11px]" style={{ color: 'var(--scorm-muted)' }}>Invalid rows are excluded. Fix the CSV before launch if those users should be included.</div>}
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label><span className="scorm-micro block text-[9px] uppercase font-semibold mb-1.5">Due date · optional</span><div className="relative"><CalendarDays size={14} className="absolute left-3 top-1/2 -translate-y-1/2" /><input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="w-full pl-9 pr-3 py-2.5 text-sm" /></div></label>
              <label className="flex items-end"><span className="w-full min-h-[42px] flex items-center gap-2 rounded-xl border px-3" style={{ borderColor: 'var(--scorm-line)' }}><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /><span className="text-sm">Required courses</span></span></label>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-3"><div><div className="font-semibold text-sm">Choose published courses</div><div className="text-[11px] mt-1" style={{ color: 'var(--scorm-muted)' }}>{selectedCourses.length} selected</div></div><BookOpen size={17} /></div>
            <div className="rounded-2xl border overflow-hidden max-h-[360px] overflow-y-auto divide-y" style={{ borderColor: 'var(--scorm-line)' }}>
              {publishedCourses.length ? publishedCourses.map((course) => (
                <label key={course.id} className="p-3.5 md:p-4 flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={selectedCourses.includes(course.id)} onChange={() => toggleCourse(course.id)} />
                  <span className="w-9 h-9 rounded-xl border grid place-items-center shrink-0" style={{ borderColor: 'var(--scorm-line)' }}><BookOpen size={15} /></span>
                  <span className="min-w-0"><span className="block text-sm font-semibold truncate">{course.title}</span><span className="block text-[10px] uppercase mt-0.5" style={{ color: 'var(--scorm-accent-strong)' }}>Published</span></span>
                </label>
              )) : <div className="p-8 text-center text-sm" style={{ color: 'var(--scorm-muted)' }}>Create and publish a course first.</div>}
            </div>
          </div>
        </div>

        <div className="p-4 md:p-5 border-t flex flex-col lg:flex-row lg:items-center justify-between gap-3" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>
          <div className="text-[11px] leading-relaxed flex gap-2" style={{ color: 'var(--scorm-muted)' }}><ShieldCheck size={14} className="shrink-0 mt-0.5" />Starting a campaign requires Google or Microsoft learner SSO to be enabled in <Link to="/scorm/learner-access" className="font-semibold underline">Authentication & SSO</Link>.</div>
          <button type="button" disabled={busy || !name.trim() || !csvPreview?.validLearners || !selectedCourses.length} onClick={createCampaign} className="scorm-button-primary px-5 py-3 text-xs font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"><CheckCircle2 size={15} />{busy ? 'Creating…' : 'Create draft campaign'}</button>
        </div>
      </section>

      <section className="scorm-panel rounded-2xl border overflow-hidden">
        <div className="p-4 md:p-5 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--scorm-line)' }}>
          <div><h2 className="font-semibold">Campaigns</h2><div className="scorm-micro text-[9px] mt-1">{campaigns.length} campaign{campaigns.length === 1 ? '' : 's'}</div></div>
        </div>
        {loading ? <div className="p-10 text-center text-sm" style={{ color: 'var(--scorm-muted)' }}>Loading campaigns…</div> : campaigns.length === 0 ? <div className="p-10 text-center text-sm" style={{ color: 'var(--scorm-muted)' }}>No campaigns yet. Upload a CSV and create your first campaign.</div> : (
          <div className="divide-y" style={{ borderColor: 'var(--scorm-line)' }}>
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="p-4 md:p-5 grid xl:grid-cols-[1.2fr_.65fr_.65fr_.7fr_auto] gap-4 xl:items-center">
                <div className="min-w-0"><div className="flex items-center gap-2"><div className="text-sm font-semibold truncate">{campaign.name}</div><span className="px-2 py-1 rounded-full text-[8px] uppercase tracking-[.08em] font-bold border" style={{ borderColor: 'var(--scorm-line)' }}>{statusLabel(campaign.status)}</span></div><div className="text-[11px] mt-1" style={{ color: 'var(--scorm-muted)' }}>Created {formatDate(campaign.createdAt)} · {formatDate(campaign.dueAt)}</div></div>
                <div><div className="scorm-micro text-[8px] uppercase">Learners</div><div className="text-sm font-semibold mt-1 flex items-center gap-1.5"><Users size={13} />{campaign.learnerCount}</div></div>
                <div><div className="scorm-micro text-[8px] uppercase">Courses</div><div className="text-sm font-semibold mt-1 flex items-center gap-1.5"><BookOpen size={13} />{campaign.courseCount}</div></div>
                <div><div className="flex items-center justify-between text-[9px] mb-1"><span className="scorm-micro uppercase">Completion</span><span>{campaign.completionPercent}%</span></div><div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--scorm-line)' }}><div className="h-full rounded-full" style={{ width: `${campaign.completionPercent}%`, background: 'var(--scorm-accent)' }} /></div><div className="text-[9px] mt-1" style={{ color: 'var(--scorm-muted)' }}>{campaign.completedCount}/{campaign.assignmentCount} instances completed</div></div>
                <div className="flex items-center gap-2 justify-end">
                  <button type="button" onClick={() => viewCampaign(campaign.id)} className="scorm-button-secondary w-10 h-10 grid place-items-center" title="View campaign"><Eye size={14} /></button>
                  {campaign.status === 'draft' ? <button type="button" disabled={busy} onClick={() => startCampaign(campaign)} className="scorm-button-primary h-10 px-3 inline-flex items-center gap-2 text-xs font-semibold"><Play size={13} /> Start</button> : <button type="button" onClick={() => copyPortal(campaign)} className="scorm-button-primary h-10 px-3 inline-flex items-center gap-2 text-xs font-semibold"><Copy size={13} /> Portal</button>}
                  {campaign.status === 'draft' && <button type="button" disabled={busy} onClick={() => deleteCampaign(campaign)} className="scorm-button-secondary w-10 h-10 grid place-items-center" title="Delete draft"><Trash2 size={14} /></button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedCampaign && (
        <section className="scorm-panel rounded-2xl border overflow-hidden mt-7">
          <div className="p-4 md:p-5 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--scorm-line)' }}>
            <div><div className="scorm-micro text-[9px] uppercase">Campaign detail</div><h2 className="font-semibold mt-1">{campaignDetail?.name || 'Loading…'}</h2></div>
            {campaignDetail?.status === 'active' && <button type="button" onClick={() => copyPortal(campaignDetail)} className="scorm-button-primary px-4 py-2.5 text-xs font-semibold inline-flex items-center gap-2"><Copy size={13} /> Copy learner portal</button>}
          </div>
          {!campaignDetail ? <div className="p-8 text-sm" style={{ color: 'var(--scorm-muted)' }}>Loading campaign…</div> : (
            <div className="p-4 md:p-5 grid lg:grid-cols-2 gap-5">
              <div>
                <div className="font-semibold text-sm mb-3">CSV learners · {campaignDetail.learners?.length || 0}</div>
                <div className="rounded-xl border max-h-[310px] overflow-y-auto divide-y" style={{ borderColor: 'var(--scorm-line)' }}>
                  {(campaignDetail.learners || []).map((learner) => <div key={learner.id} className="px-3.5 py-3"><div className="text-xs font-semibold">{learner.learnerName || 'Learner'}</div><div className="text-[11px] mt-0.5" style={{ color: 'var(--scorm-muted)' }}>{learner.email}</div></div>)}
                </div>
              </div>
              <div>
                <div className="font-semibold text-sm mb-3">Campaign courses · {campaignDetail.courses?.length || 0}</div>
                <div className="rounded-xl border divide-y" style={{ borderColor: 'var(--scorm-line)' }}>
                  {(campaignDetail.courses || []).map((course) => <div key={course.id} className="px-3.5 py-3 flex items-center gap-3"><BookOpen size={14} /><span className="text-xs font-semibold">{course.title}</span></div>)}
                </div>
                {campaignDetail.status === 'active' && <div className="mt-4 rounded-xl border p-4" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}><div className="scorm-micro text-[8px] uppercase">Learner portal</div><div className="text-[11px] break-all mt-2" style={{ color: 'var(--scorm-muted)' }}>{`${window.location.origin}${campaignDetail.portalPath}`}</div></div>}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
