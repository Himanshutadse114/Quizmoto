import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, BookOpen, CalendarDays, CheckCircle2, Download, KeyRound, Mail, ShieldCheck, Trash2, Upload, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import './scormCampaignReporting.css';

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function isValidEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim().toLowerCase()); }
function manualLearnersToCsv(learners) {
  return [['Email', 'Name'].map(csvCell).join(','), ...learners.map((learner) => [learner.email, learner.learnerName || ''].map(csvCell).join(','))].join('\n');
}

export default function CampaignCreate() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const fileRef = useRef(null);
  const [courses, setCourses] = useState([]);
  const [authOptions, setAuthOptions] = useState({ emailCode: true, googleConfigured: false, microsoftConfigured: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    axios.get(apiUrl('/api/scorm/campaigns/create-options'), { headers })
      .then((response) => {
        if (cancelled) return;
        setCourses(response.data?.courses || []);
        setAuthOptions(response.data?.authOptions || { emailCode: true, googleConfigured: false, microsoftConfigured: false });
      })
      .catch((err) => !cancelled && setError(err.response?.data?.message || 'Unable to prepare campaign creation.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [token]);

  const learnerCount = learnerEntryMode === 'manual' ? manualLearners.length : Number(csvPreview?.validLearners || 0);
  const toggleCourse = (id) => setSelectedCourses((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  const readCsv = async (file) => {
    if (!file) return;
    setError('');
    try {
      const text = await file.text();
      const response = await axios.post(apiUrl('/api/scorm/campaigns/preview-csv'), { csvText: text }, { headers });
      setCsvText(text); setCsvFileName(file.name); setCsvPreview(response.data);
    } catch (err) {
      setCsvText(''); setCsvFileName(''); setCsvPreview(null);
      setError(err.response?.data?.message || 'Unable to read this CSV file.');
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob(['Email,Name\nlearner1@company.com,Learner One\nlearner2@company.com,Learner Two\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'lmsgen-campaign-learners.csv'; link.click(); URL.revokeObjectURL(url);
  };

  const addManualLearner = (event) => {
    event.preventDefault(); setError('');
    const email = String(manualEmail || '').trim().toLowerCase();
    const learnerName = String(manualName || '').trim().slice(0, 180);
    if (!isValidEmail(email)) return setError('Enter a valid learner email address.');
    if (manualLearners.some((learner) => learner.email === email)) return setError('This learner email has already been added.');
    setManualLearners((current) => [...current, { email, learnerName: learnerName || email.split('@')[0] }]);
    setManualName(''); setManualEmail('');
  };

  const authCards = [
    { id: 'email_code', title: 'Email + access code', description: 'No tenant SSO required. Each learner receives a unique campaign access code.', enabled: true, icon: <KeyRound size={16} /> },
    { id: 'google', title: 'Google SSO', description: authOptions.googleConfigured ? 'Learners verify the assigned email with Google.' : 'Configure Google learner SSO first.', enabled: authOptions.googleConfigured, icon: <Mail size={16} /> },
    { id: 'microsoft', title: 'Microsoft SSO', description: authOptions.microsoftConfigured ? 'Learners verify the assigned email with Microsoft.' : 'Configure Microsoft learner SSO first.', enabled: authOptions.microsoftConfigured, icon: <ShieldCheck size={16} /> }
  ];

  const createCampaign = async () => {
    setError('');
    if (name.trim().length < 2) return setError('Enter a campaign name.');
    if (!learnerCount) return setError(learnerEntryMode === 'manual' ? 'Add at least one learner.' : 'Upload a learner CSV first.');
    if (!selectedCourses.length) return setError('Select at least one published course.');
    if (authMode === 'google' && !authOptions.googleConfigured) return setError('Google SSO is not configured for this tenant.');
    if (authMode === 'microsoft' && !authOptions.microsoftConfigured) return setError('Microsoft SSO is not configured for this tenant.');
    setBusy(true);
    try {
      const learnerCsvText = learnerEntryMode === 'manual' ? manualLearnersToCsv(manualLearners) : csvText;
      const response = await axios.post(apiUrl('/api/scorm/campaigns'), { name: name.trim(), csvText: learnerCsvText, courseIds: selectedCourses, dueAt: dueAt || null, required, authMode }, { headers });
      const campaign = response.data?.campaign;
      navigate('/scorm/assignments', { replace: true, state: { campaignMessage: `Campaign “${campaign?.name || name.trim()}” created as a draft.` } });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to create campaign.');
    } finally { setBusy(false); }
  };

  return (
    <div className="scorm-campaigns-page p-4 md:p-7 lg:p-8 w-full">
      <div className="max-w-[1320px] mx-auto">
        <div className="mb-6 pb-6 border-b flex flex-col lg:flex-row lg:items-end justify-between gap-4" style={{ borderColor: 'var(--scorm-line)' }}>
          <div>
            <Link to="/scorm/assignments" className="inline-flex items-center gap-2 text-xs font-semibold mb-4" style={{ color: 'var(--scorm-accent-strong)' }}><ArrowLeft size={14} /> Back to campaigns</Link>
            <div className="scorm-micro text-[10px] uppercase font-semibold">Learner delivery</div>
            <h1 className="text-[28px] md:text-[34px] font-semibold tracking-[-.03em] mt-1.5">Create campaign</h1>
            <p className="text-sm mt-2 max-w-2xl leading-relaxed" style={{ color: 'var(--scorm-ink-soft)' }}>Set up learners, courses and sign-in in one dedicated campaign creation workspace.</p>
          </div>
          <div className="flex items-center gap-2"><Link to="/scorm/assignments" className="scorm-button-secondary h-10 px-4 inline-flex items-center justify-center text-xs font-semibold">Cancel</Link><button type="button" onClick={createCampaign} disabled={busy || loading || !name.trim() || !learnerCount || !selectedCourses.length} className="scorm-button-primary h-10 px-4 inline-flex items-center gap-2 text-xs font-semibold disabled:opacity-50"><CheckCircle2 size={14} /> {busy ? 'Creating…' : 'Create draft campaign'}</button></div>
        </div>

        {error && <div className="mb-5 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(251,113,133,.30)', background: 'rgba(251,113,133,.08)' }}>{error}</div>}
        {loading ? <div className="scorm-panel rounded-2xl border p-12 text-center text-sm" style={{ borderColor: 'var(--scorm-line)', color: 'var(--scorm-muted)' }}>Preparing campaign options…</div> : (
          <div className="grid xl:grid-cols-[.92fr_1.08fr] gap-5 items-start">
            <section className="scorm-panel rounded-2xl border p-5 md:p-6 space-y-5" style={{ borderColor: 'var(--scorm-line)' }}>
              <div><div className="scorm-micro text-[9px] uppercase font-semibold">Campaign basics</div><h2 className="text-lg font-semibold mt-1">Who is this campaign for?</h2></div>
              <label className="block"><span className="scorm-micro block text-[9px] uppercase font-semibold mb-1.5">Campaign name</span><input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2.5 text-sm" placeholder="September Security Awareness" maxLength={180} /></label>

              <div>
                <div className="flex items-center justify-between gap-3 mb-2"><span className="scorm-micro text-[9px] uppercase font-semibold">Add learners</span><span className="text-[10px]" style={{ color: 'var(--scorm-muted)' }}>{learnerCount} learner{learnerCount === 1 ? '' : 's'} ready</span></div>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl border mb-3" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>
                  <button type="button" onClick={() => setLearnerEntryMode('csv')} className="rounded-lg px-3 py-2.5 text-xs font-semibold" style={{ border: learnerEntryMode === 'csv' ? '1px solid var(--scorm-accent-strong)' : '1px solid transparent', background: learnerEntryMode === 'csv' ? 'rgba(79,201,191,.08)' : 'transparent' }}><Upload size={14} className="inline mr-2" /> Upload CSV</button>
                  <button type="button" onClick={() => setLearnerEntryMode('manual')} className="rounded-lg px-3 py-2.5 text-xs font-semibold" style={{ border: learnerEntryMode === 'manual' ? '1px solid var(--scorm-accent-strong)' : '1px solid transparent', background: learnerEntryMode === 'manual' ? 'rgba(79,201,191,.08)' : 'transparent' }}><UserPlus size={14} className="inline mr-2" /> Add manually</button>
                </div>
                {learnerEntryMode === 'csv' ? <div><div className="flex justify-end mb-2"><button type="button" onClick={downloadTemplate} className="text-[10px] font-semibold inline-flex items-center gap-1.5" style={{ color: 'var(--scorm-accent-strong)' }}><Download size={12} /> Download template</button></div><button type="button" onClick={() => fileRef.current?.click()} className="campaign-upload-zone w-full rounded-2xl border border-dashed p-5 text-left" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}><span className="flex items-center gap-3"><span className="w-10 h-10 rounded-xl border grid place-items-center"><Upload size={16} /></span><span><span className="block text-sm font-semibold">{csvFileName || 'Choose learner CSV'}</span><span className="block text-[11px] mt-1" style={{ color: 'var(--scorm-muted)' }}>Required: Email · Optional: Name</span></span></span></button><input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => readCsv(e.target.files?.[0])} />{csvPreview && <div className="campaign-csv-preview mt-3 rounded-xl border px-3.5 py-3 text-xs"><strong>{csvPreview.validLearners}</strong> valid learners · <strong>{csvPreview.invalidRows?.length || 0}</strong> invalid rows</div>}</div> : <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}><form onSubmit={addManualLearner} className="grid sm:grid-cols-[1fr_1.2fr_auto] gap-2.5 items-end"><label><span className="scorm-micro block text-[8px] uppercase mb-1.5">Name · optional</span><input value={manualName} onChange={(e) => setManualName(e.target.value)} className="w-full px-3 py-2.5 text-sm" placeholder="Learner name" /></label><label><span className="scorm-micro block text-[8px] uppercase mb-1.5">Email</span><input value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} className="w-full px-3 py-2.5 text-sm" placeholder="learner@company.com" type="email" /></label><button type="submit" className="scorm-button-secondary h-[42px] px-3.5 inline-flex items-center gap-2 text-xs font-semibold"><UserPlus size={14} /> Add</button></form>{manualLearners.length ? <div className="mt-3 rounded-xl border divide-y max-h-[220px] overflow-y-auto" style={{ borderColor: 'var(--scorm-line)' }}>{manualLearners.map((learner) => <div key={learner.email} className="px-3 py-2.5 flex items-center gap-3"><div className="min-w-0 flex-1"><div className="text-xs font-semibold truncate">{learner.learnerName}</div><div className="text-[10px] truncate" style={{ color: 'var(--scorm-muted)' }}>{learner.email}</div></div><button type="button" onClick={() => setManualLearners((current) => current.filter((item) => item.email !== learner.email))} className="scorm-button-secondary w-8 h-8 grid place-items-center"><Trash2 size={12} /></button></div>)}</div> : <div className="text-[11px] mt-3" style={{ color: 'var(--scorm-muted)' }}>Add learners one at a time.</div>}</div>}
              </div>

              <div className="grid sm:grid-cols-2 gap-3"><label><span className="scorm-micro block text-[9px] uppercase font-semibold mb-1.5">Due date · optional</span><div className="relative"><CalendarDays size={14} className="absolute left-3 top-1/2 -translate-y-1/2" /><input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="w-full pl-9 pr-3 py-2.5 text-sm" /></div></label><label className="flex items-end"><span className="campaign-required-toggle w-full min-h-[42px] flex items-center gap-2 rounded-xl border px-3"><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /><span className="text-sm">Required courses</span></span></label></div>
            </section>

            <section className="scorm-panel rounded-2xl border p-5 md:p-6 space-y-5" style={{ borderColor: 'var(--scorm-line)' }}>
              <div><div className="scorm-micro text-[9px] uppercase font-semibold">Learning setup</div><h2 className="text-lg font-semibold mt-1">What should learners receive?</h2></div>
              <div><div className="flex items-center justify-between gap-3 mb-3"><div><div className="font-semibold text-sm">Published courses</div><div className="text-[11px] mt-1" style={{ color: 'var(--scorm-muted)' }}>{selectedCourses.length} selected</div></div><BookOpen size={17} /></div><div className="campaign-course-list rounded-2xl border overflow-hidden max-h-[340px] overflow-y-auto divide-y" style={{ borderColor: 'var(--scorm-line)' }}>{courses.length ? courses.map((course) => <label key={course.id} className="campaign-course-row p-3.5 md:p-4 flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={selectedCourses.includes(course.id)} onChange={() => toggleCourse(course.id)} /><span className="w-9 h-9 rounded-xl border grid place-items-center"><BookOpen size={15} /></span><span className="min-w-0"><span className="block text-sm font-semibold truncate">{course.title}</span><span className="block text-[10px] uppercase mt-0.5" style={{ color: 'var(--scorm-accent-strong)' }}>Published</span></span></label>) : <div className="p-8 text-center text-sm" style={{ color: 'var(--scorm-muted)' }}>Create and publish a course first.</div>}</div></div>
              <div><div className="scorm-micro text-[9px] uppercase font-semibold mb-2">Learner sign-in</div><div className="grid gap-2">{authCards.map((option) => { const selected = authMode === option.id; return <button key={option.id} type="button" disabled={!option.enabled} onClick={() => option.enabled && setAuthMode(option.id)} className="w-full rounded-xl border px-3.5 py-3 text-left disabled:opacity-45" style={{ borderColor: selected ? 'var(--scorm-accent-strong)' : 'var(--scorm-line)', background: selected ? 'rgba(79,201,191,.08)' : 'var(--scorm-surface-soft)' }}><span className="flex gap-3"><span className="w-8 h-8 rounded-lg border grid place-items-center shrink-0">{option.icon}</span><span className="min-w-0 flex-1"><span className="flex justify-between gap-3"><span className="text-xs font-semibold">{option.title}</span><span className="text-[9px] uppercase font-semibold" style={{ color: selected ? 'var(--scorm-accent-strong)' : 'var(--scorm-muted)' }}>{selected ? 'Selected' : option.enabled ? 'Available' : 'Not configured'}</span></span><span className="block text-[10px] leading-relaxed mt-1" style={{ color: 'var(--scorm-muted)' }}>{option.description}</span></span></span></button>; })}</div></div>
              <div className="campaign-soft-card rounded-xl border p-4 text-[11px] leading-relaxed flex gap-2" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)', color: 'var(--scorm-muted)' }}><ShieldCheck size={14} className="shrink-0 mt-0.5" /><span>{authMode === 'email_code' ? 'Learners use their assigned email plus a unique campaign access code.' : `${authCards.find((item) => item.id === authMode)?.title || 'SSO'} will be required for learner access.`}</span></div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
