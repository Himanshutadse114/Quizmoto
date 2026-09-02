import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, BarChart3, BookOpen, Copy, KeyRound, RefreshCw, UserRoundCog, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import './scormCampaignReporting.css';

function statusLabel(status) {
  if (status === 'active') return 'Active';
  if (status === 'stopped') return 'Stopped';
  if (status === 'completed') return 'Completed';
  return 'Draft';
}
function statusStyle(status) {
  if (status === 'active') return { color: '#0B6259', borderColor: 'rgba(79,201,191,.38)', background: 'rgba(79,201,191,.11)' };
  if (status === 'stopped') return { color: '#be123c', borderColor: 'rgba(251,113,133,.30)', background: 'rgba(251,113,133,.08)' };
  return { color: 'var(--scorm-muted)', borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' };
}
function formatDate(value) {
  if (!value) return 'No due date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'No due date' : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}
function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export default function CampaignDetail() {
  const { campaignId } = useParams();
  const location = useLocation();
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(location.state?.campaignMessage || '');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const response = await axios.get(apiUrl(`/api/scorm/campaigns/${campaignId}/summary`), { headers });
      setCampaign(response.data?.campaign || null);
    } catch (err) { setError(err.response?.data?.message || 'Unable to load campaign.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (token && campaignId) load(); }, [token, campaignId]);

  const copyPortal = async () => {
    if (!campaign?.portalPath) return;
    try { await navigator.clipboard.writeText(`${window.location.origin}${campaign.portalPath}`); setMessage('Campaign learner link copied.'); }
    catch (_) { setError('Could not copy the campaign learner link.'); }
  };

  const downloadAccessList = async () => {
    try {
      const response = await axios.get(apiUrl(`/api/scorm/campaigns/${campaignId}/access-sheet`), { headers });
      const rows = response.data?.learners || [];
      const portalPath = response.data?.campaign?.portalPath || `/campaign/${campaignId}`;
      const portalUrl = `${window.location.origin}${portalPath}`;
      const csv = [['Name', 'Email', 'Access Code', 'Campaign Link'].map(csvCell).join(','), ...rows.map((learner) => [learner.learnerName || '', learner.email, learner.accessCode, portalUrl].map(csvCell).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${String(campaign?.name || 'campaign').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-learner-access.csv`; link.click(); URL.revokeObjectURL(url);
      setMessage('Learner access list downloaded.');
    } catch (err) { setError(err.response?.data?.message || 'Unable to download learner access codes.'); }
  };

  return (
    <div className="scorm-campaigns-page p-4 md:p-7 lg:p-8 w-full">
      <div className="max-w-[1320px] mx-auto">
        <div className="mb-6 pb-6 border-b flex flex-col xl:flex-row xl:items-end justify-between gap-4" style={{ borderColor: 'var(--scorm-line)' }}>
          <div><Link to="/scorm/assignments" className="inline-flex items-center gap-2 text-xs font-semibold mb-4" style={{ color: 'var(--scorm-accent-strong)' }}><ArrowLeft size={14} /> Back to campaigns</Link><div className="scorm-micro text-[10px] uppercase font-semibold">Campaign detail</div><div className="flex items-center gap-2 mt-1.5"><h1 className="text-[28px] md:text-[34px] font-semibold tracking-[-.03em]">{campaign?.name || 'Campaign'}</h1>{campaign && <span className="px-2 py-1 rounded-full text-[8px] uppercase font-bold border" style={statusStyle(campaign.status)}>{statusLabel(campaign.status)}</span>}</div><p className="text-sm mt-2" style={{ color: 'var(--scorm-ink-soft)' }}>Review campaign scope, learners, courses and learner access from this dedicated page.</p></div>
          <div className="flex items-center gap-2 flex-wrap"><button type="button" onClick={load} disabled={loading} className="scorm-button-secondary h-10 px-3.5 inline-flex items-center gap-2 text-xs font-semibold"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>{campaign?.status === 'active' && <Link to={`/scorm/campaigns/${campaignId}/learners`} className="scorm-button-primary h-10 px-4 inline-flex items-center gap-2 text-xs font-semibold"><UserRoundCog size={14} /> Manage learners</Link>}<Link to={`/scorm/campaigns/${campaignId}/analytics`} className="scorm-button-secondary h-10 px-4 inline-flex items-center gap-2 text-xs font-semibold"><BarChart3 size={14} /> Analytics</Link></div>
        </div>

        {message && <div className="mb-5 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(74,222,128,.28)', background: 'rgba(74,222,128,.07)' }}>{message}</div>}
        {error && <div className="mb-5 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(251,113,133,.30)', background: 'rgba(251,113,133,.08)' }}>{error}</div>}
        {loading && !campaign ? <div className="scorm-panel rounded-2xl border p-12 text-center text-sm" style={{ borderColor: 'var(--scorm-line)', color: 'var(--scorm-muted)' }}>Loading campaign…</div> : campaign && <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">{[['Learners', campaign.learnerCount, Users], ['Courses', campaign.courseCount, BookOpen], ['Completion', `${campaign.completionPercent || 0}%`, BarChart3], ['Due date', formatDate(campaign.dueAt), RefreshCw]].map(([label, value, Icon]) => <div key={label} className="scorm-panel rounded-xl border p-4" style={{ borderColor: 'var(--scorm-line)' }}><div className="flex justify-between gap-3"><div><div className="scorm-micro text-[8px] uppercase">{label}</div><div className="text-lg font-semibold mt-1.5">{value}</div></div><div className="w-9 h-9 rounded-lg border grid place-items-center" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}><Icon size={14} /></div></div></div>)}</div>
          {campaign.status === 'active' && <div className="scorm-panel rounded-xl border p-4 mb-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3" style={{ borderColor: 'var(--scorm-line)' }}><div><div className="scorm-micro text-[8px] uppercase">Learner access</div><div className="text-xs mt-1 break-all" style={{ color: 'var(--scorm-muted)' }}>{`${window.location.origin}${campaign.portalPath}`}</div></div><div className="flex gap-2"><button type="button" onClick={copyPortal} className="scorm-button-secondary h-10 px-3 inline-flex items-center gap-2 text-xs font-semibold"><Copy size={13} /> Copy portal</button>{campaign.authMode === 'email_code' && <button type="button" onClick={downloadAccessList} className="scorm-button-secondary h-10 px-3 inline-flex items-center gap-2 text-xs font-semibold"><KeyRound size={13} /> Download codes</button>}</div></div>}
          <div className="grid lg:grid-cols-2 gap-5"><section className="scorm-panel rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--scorm-line)' }}><div className="p-4 border-b font-semibold" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>Learners · {campaign.learners?.length || 0}</div><div className="divide-y" style={{ borderColor: 'var(--scorm-line)' }}>{(campaign.learners || []).map((learner) => <div key={learner.id || learner.email} className="px-4 py-3"><div className="text-sm font-semibold">{learner.learnerName || 'Learner'}</div><div className="text-[11px] mt-0.5" style={{ color: 'var(--scorm-muted)' }}>{learner.email}</div></div>)}</div></section><section className="scorm-panel rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--scorm-line)' }}><div className="p-4 border-b font-semibold" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>Courses · {campaign.courses?.length || 0}</div><div className="divide-y" style={{ borderColor: 'var(--scorm-line)' }}>{(campaign.courses || []).map((course) => <div key={course.id} className="px-4 py-3 flex items-center gap-3"><BookOpen size={14} /><div><div className="text-sm font-semibold">{course.title}</div><div className="text-[10px] uppercase mt-0.5" style={{ color: 'var(--scorm-muted)' }}>{course.status || 'Published'}</div></div></div>)}</div></section></div>
        </>}
      </div>
    </div>
  );
}
