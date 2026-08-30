import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Building2,
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  Save,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

const JOINING_MODES = [
  {
    id: 'assigned_email',
    title: 'Assigned email',
    description: 'Learners enter an email, but access is granted only when that exact address already has an assigned course.'
  },
  {
    id: 'sso_preferred',
    title: 'SSO preferred',
    description: 'Show enabled Google/Microsoft SSO first while keeping assigned-email access as a fallback.'
  },
  {
    id: 'sso_only',
    title: 'SSO only',
    description: 'Remove the learner email field completely. Learners must prove identity with an enabled organisation SSO provider.'
  }
];

export default function LearnerAccessSettings() {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [config, setConfig] = useState(null);
  const [portalPath, setPortalPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(apiUrl('/api/scorm/learner-access'), { headers });
      setConfig(res.data?.config || null);
      setPortalPath(res.data?.learnerPortalPath || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load learner access settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) load(); }, [token]);

  const patch = (values) => setConfig((current) => ({ ...(current || {}), ...values }));
  const portalUrl = portalPath ? `${window.location.origin}${portalPath}` : '';
  const microsoftRedirectUri = config?.workspaceId
    ? `${window.location.origin}/learn/${config.workspaceId}/microsoft/callback`
    : '';

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await axios.put(apiUrl('/api/scorm/learner-access'), {
        joiningMode: config?.joiningMode,
        googleEnabled: Boolean(config?.googleEnabled),
        googleClientId: String(config?.googleClientId || '').trim(),
        microsoftEnabled: Boolean(config?.microsoftEnabled),
        microsoftClientId: String(config?.microsoftClientId || '').trim(),
        microsoftTenantId: String(config?.microsoftTenantId || '').trim(),
        allowedDomains: Array.isArray(config?.allowedDomains) ? config.allowedDomains : String(config?.allowedDomains || '').split(/[\s,;]+/)
      }, { headers });
      setConfig(res.data?.config || config);
      setPortalPath(res.data?.learnerPortalPath || portalPath);
      setMessage('Learner access settings saved. New learner sign-ins will use this policy immediately.');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save learner access settings.');
    } finally {
      setSaving(false);
    }
  };

  const copy = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied.`);
    } catch (_) {
      setError(`Could not copy ${label.toLowerCase()}.`);
    }
  };

  if (loading && !config) {
    return <div className="p-10 text-center text-sm" style={{ color: 'var(--scorm-muted)' }}><RefreshCw className="animate-spin mx-auto mb-3" size={18} />Loading learner access settings…</div>;
  }

  return (
    <div className="p-4 md:p-7 lg:p-9 max-w-6xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-7 pb-7 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
        <div className="max-w-3xl">
          <div className="scorm-micro text-[10px] uppercase font-semibold">Workspace administration</div>
          <h1 className="scorm-display text-[36px] md:text-[50px] mt-2">Learner access & SSO</h1>
          <p className="text-sm mt-3 leading-relaxed" style={{ color: 'var(--scorm-ink-soft)' }}>
            Decide how assigned learners prove their identity. SSO-only mode removes free-form learner email entry and accepts only verified Google or Microsoft identities.
          </p>
        </div>
        <button type="button" onClick={save} disabled={saving || !config} className="scorm-button-primary inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-semibold disabled:opacity-50">
          <Save size={14} /> {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>

      {message && <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(20,184,166,.28)', background: 'rgba(20,184,166,.08)' }}>{message}</div>}
      {error && <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(251,113,133,.3)', background: 'rgba(251,113,133,.08)' }}>{error}</div>}

      <section className="scorm-panel rounded-2xl border p-5 md:p-6 mb-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl grid place-items-center border shrink-0" style={{ borderColor: 'var(--scorm-line)' }}><ExternalLink size={17} /></div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Learner portal</h2>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--scorm-muted)' }}>Share this single workspace link with learners. After sign-in they see every course assigned to their verified identity.</p>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <input readOnly value={portalUrl} className="flex-1 px-3 py-2.5 text-xs" />
              <button type="button" disabled={!portalUrl} onClick={() => copy(portalUrl, 'Learner portal link')} className="scorm-button-secondary px-4 py-2.5 text-xs font-semibold inline-flex items-center justify-center gap-2"><Copy size={13} /> Copy link</button>
            </div>
          </div>
        </div>
      </section>

      <section className="scorm-panel rounded-2xl border p-5 md:p-6 mb-5">
        <div className="flex items-center gap-2 mb-4"><KeyRound size={17} /><h2 className="font-semibold">Learner joining method</h2></div>
        <div className="grid lg:grid-cols-3 gap-3">
          {JOINING_MODES.map((mode) => {
            const selected = config?.joiningMode === mode.id;
            return (
              <button key={mode.id} type="button" onClick={() => patch({ joiningMode: mode.id })} className="text-left rounded-2xl border p-4 transition" style={{ borderColor: selected ? 'var(--scorm-accent)' : 'var(--scorm-line)', background: selected ? 'var(--scorm-surface-soft)' : 'transparent' }}>
                <div className="flex items-center justify-between gap-3"><div className="font-semibold text-sm">{mode.title}</div>{selected && <CheckCircle2 size={16} style={{ color: 'var(--scorm-accent-strong)' }} />}</div>
                <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--scorm-muted)' }}>{mode.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <section className="scorm-panel rounded-2xl border p-5 md:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2"><ShieldCheck size={17} /><h2 className="font-semibold">Google Workspace</h2></div>
            <label className="inline-flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={Boolean(config?.googleEnabled)} onChange={(e) => patch({ googleEnabled: e.target.checked })} /> Enabled</label>
          </div>
          <label>
            <span className="scorm-micro block text-[9px] uppercase font-semibold mb-1.5">Google OAuth client ID</span>
            <input value={config?.googleClientId || ''} onChange={(e) => patch({ googleClientId: e.target.value })} className="w-full px-3 py-2.5 text-xs" placeholder="123...apps.googleusercontent.com" />
          </label>
          <p className="text-[11px] mt-3 leading-relaxed" style={{ color: 'var(--scorm-muted)' }}>
            Use a Google OAuth Web client and add <strong>{window.location.origin}</strong> as an authorised JavaScript origin. LMSGEN validates the returned Google ID token against this client ID.
          </p>
        </section>

        <section className="scorm-panel rounded-2xl border p-5 md:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2"><Building2 size={17} /><h2 className="font-semibold">Microsoft Entra ID</h2></div>
            <label className="inline-flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={Boolean(config?.microsoftEnabled)} onChange={(e) => patch({ microsoftEnabled: e.target.checked })} /> Enabled</label>
          </div>
          <div className="space-y-3">
            <label><span className="scorm-micro block text-[9px] uppercase font-semibold mb-1.5">Application / client ID</span><input value={config?.microsoftClientId || ''} onChange={(e) => patch({ microsoftClientId: e.target.value })} className="w-full px-3 py-2.5 text-xs" placeholder="00000000-0000-0000-0000-000000000000" /></label>
            <label><span className="scorm-micro block text-[9px] uppercase font-semibold mb-1.5">Directory / tenant ID</span><input value={config?.microsoftTenantId || ''} onChange={(e) => patch({ microsoftTenantId: e.target.value })} className="w-full px-3 py-2.5 text-xs" placeholder="00000000-0000-0000-0000-000000000000" /></label>
            <div><span className="scorm-micro block text-[9px] uppercase font-semibold mb-1.5">SPA redirect URI</span><div className="flex gap-2"><input readOnly value={microsoftRedirectUri} className="min-w-0 flex-1 px-3 py-2.5 text-[10px]" /><button type="button" onClick={() => copy(microsoftRedirectUri, 'Microsoft redirect URI')} className="scorm-button-secondary px-3 grid place-items-center"><Copy size={13} /></button></div></div>
          </div>
          <p className="text-[11px] mt-3 leading-relaxed" style={{ color: 'var(--scorm-muted)' }}>Register the redirect URI above as a Single-page application redirect URI in Microsoft Entra. No client secret is stored in LMSGEN.</p>
        </section>
      </div>

      <section className="scorm-panel rounded-2xl border p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4"><LockKeyhole size={17} /><h2 className="font-semibold">Allowed organisation domains</h2></div>
        <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--scorm-muted)' }}>Optional additional restriction. When set, even a valid SSO identity must use one of these email domains. Separate multiple domains with commas.</p>
        <input value={Array.isArray(config?.allowedDomains) ? config.allowedDomains.join(', ') : (config?.allowedDomains || '')} onChange={(e) => patch({ allowedDomains: e.target.value })} className="w-full px-3 py-2.5 text-sm" placeholder="company.com, subsidiary.com" />
        {config?.joiningMode === 'sso_only' && !config?.googleEnabled && !config?.microsoftEnabled && (
          <div className="mt-3 rounded-xl border px-3 py-2.5 text-xs" style={{ borderColor: 'rgba(251,191,36,.3)', background: 'rgba(251,191,36,.08)' }}>Enable Google or Microsoft before saving SSO-only access.</div>
        )}
      </section>
    </div>
  );
}
