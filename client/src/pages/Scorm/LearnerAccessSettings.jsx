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
  ShieldCheck,
  Users,
  GraduationCap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

const LEARNER_JOINING_MODES = [
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
    description: 'Remove the learner email field. Learners must prove identity with an enabled organisation SSO provider.'
  }
];

const STAFF_JOINING_MODES = [
  {
    id: 'password_or_sso',
    title: 'Password + SSO',
    description: 'Admin, Co-admin and Analytics Viewer can use configured organisation SSO, while existing password sign-in remains available.'
  },
  {
    id: 'sso_only',
    title: 'SSO only',
    description: 'Workspace staff must sign in through the configured Google or Microsoft provider. Old/global staff sessions are rejected.'
  }
];

function LinkCard({ icon: Icon, title, description, value, onCopy }) {
  return (
    <div className="rounded-2xl border p-4 md:p-5" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl grid place-items-center border shrink-0" style={{ borderColor: 'var(--scorm-line)' }}><Icon size={17} /></div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--scorm-muted)' }}>{description}</p>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <input readOnly value={value} className="flex-1 min-w-0 px-3 py-2.5 text-[11px]" />
            <button type="button" disabled={!value} onClick={onCopy} className="scorm-button-secondary px-4 py-2.5 text-xs font-semibold inline-flex items-center justify-center gap-2"><Copy size={13} /> Copy</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeCards({ modes, selected, onSelect }) {
  return (
    <div className={`grid gap-3 ${modes.length === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
      {modes.map((mode) => {
        const active = selected === mode.id;
        return (
          <button key={mode.id} type="button" onClick={() => onSelect(mode.id)} className="text-left rounded-2xl border p-4 transition" style={{ borderColor: active ? 'var(--scorm-accent)' : 'var(--scorm-line)', background: active ? 'var(--scorm-surface-soft)' : 'transparent' }}>
            <div className="flex items-center justify-between gap-3"><div className="font-semibold text-sm">{mode.title}</div>{active && <CheckCircle2 size={16} style={{ color: 'var(--scorm-accent-strong)' }} />}</div>
            <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--scorm-muted)' }}>{mode.description}</p>
          </button>
        );
      })}
    </div>
  );
}

export default function LearnerAccessSettings() {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [config, setConfig] = useState(null);
  const [learnerPortalPath, setLearnerPortalPath] = useState('');
  const [staffLoginPath, setStaffLoginPath] = useState('');
  const [staffMicrosoftCallbackPath, setStaffMicrosoftCallbackPath] = useState('');
  const [learnerMicrosoftCallbackPath, setLearnerMicrosoftCallbackPath] = useState('');
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
      setLearnerPortalPath(res.data?.learnerPortalPath || '');
      setStaffLoginPath(res.data?.staffLoginPath || '');
      setStaffMicrosoftCallbackPath(res.data?.staffMicrosoftCallbackPath || '');
      setLearnerMicrosoftCallbackPath(res.data?.learnerMicrosoftCallbackPath || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load authentication settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) load(); }, [token]);

  const patch = (values) => setConfig((current) => ({ ...(current || {}), ...values }));
  const absoluteUrl = (path) => path ? `${window.location.origin}${path}` : '';
  const learnerPortalUrl = absoluteUrl(learnerPortalPath);
  const staffLoginUrl = absoluteUrl(staffLoginPath);
  const staffMicrosoftRedirectUri = absoluteUrl(staffMicrosoftCallbackPath);
  const learnerMicrosoftRedirectUri = absoluteUrl(learnerMicrosoftCallbackPath);

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await axios.put(apiUrl('/api/scorm/learner-access'), {
        // Staff policy
        staffJoiningMode: config?.staffJoiningMode,
        staffGoogleEnabled: Boolean(config?.staffGoogleEnabled),
        staffGoogleClientId: String(config?.staffGoogleClientId || '').trim(),
        staffMicrosoftEnabled: Boolean(config?.staffMicrosoftEnabled),
        staffMicrosoftClientId: String(config?.staffMicrosoftClientId || '').trim(),
        staffMicrosoftTenantId: String(config?.staffMicrosoftTenantId || '').trim(),
        staffAllowedDomains: Array.isArray(config?.staffAllowedDomains) ? config.staffAllowedDomains : String(config?.staffAllowedDomains || '').split(/[\s,;]+/),

        // Learner policy
        joiningMode: config?.joiningMode,
        googleEnabled: Boolean(config?.googleEnabled),
        googleClientId: String(config?.googleClientId || '').trim(),
        microsoftEnabled: Boolean(config?.microsoftEnabled),
        microsoftClientId: String(config?.microsoftClientId || '').trim(),
        microsoftTenantId: String(config?.microsoftTenantId || '').trim(),
        allowedDomains: Array.isArray(config?.allowedDomains) ? config.allowedDomains : String(config?.allowedDomains || '').split(/[\s,;]+/)
      }, { headers });
      setConfig(res.data?.config || config);
      setLearnerPortalPath(res.data?.learnerPortalPath || learnerPortalPath);
      setStaffLoginPath(res.data?.staffLoginPath || staffLoginPath);
      setStaffMicrosoftCallbackPath(res.data?.staffMicrosoftCallbackPath || staffMicrosoftCallbackPath);
      setLearnerMicrosoftCallbackPath(res.data?.learnerMicrosoftCallbackPath || learnerMicrosoftCallbackPath);
      setMessage('Authentication settings saved. New staff and learner sign-ins will use this policy immediately.');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save authentication settings.');
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
    return <div className="p-10 text-center text-sm" style={{ color: 'var(--scorm-muted)' }}><RefreshCw className="animate-spin mx-auto mb-3" size={18} />Loading authentication settings…</div>;
  }

  return (
    <div className="p-4 md:p-7 lg:p-9 max-w-6xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-7 pb-7 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
        <div className="max-w-3xl">
          <div className="scorm-micro text-[10px] uppercase font-semibold">Workspace administration</div>
          <h1 className="scorm-display text-[36px] md:text-[50px] mt-2">Authentication & SSO</h1>
          <p className="text-sm mt-3 leading-relaxed" style={{ color: 'var(--scorm-ink-soft)' }}>
            Configure staff sign-in and learner sign-in independently. Staff access is limited to Admin, Co-admin and Analytics Viewer memberships; learner access is limited to assigned learner identities.
          </p>
        </div>
        <button type="button" onClick={save} disabled={saving || !config} className="scorm-button-primary inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-semibold disabled:opacity-50">
          <Save size={14} /> {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>

      {message && <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(20,184,166,.28)', background: 'rgba(20,184,166,.08)' }}>{message}</div>}
      {error && <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(251,113,133,.3)', background: 'rgba(251,113,133,.08)' }}>{error}</div>}

      <section className="scorm-panel rounded-2xl border p-5 md:p-6 mb-6">
        <div className="flex items-center gap-2 mb-4"><ExternalLink size={17} /><h2 className="font-semibold">Workspace access links</h2></div>
        <div className="grid lg:grid-cols-2 gap-4">
          <LinkCard
            icon={Users}
            title="Staff / Admin login link"
            description="Send this link to the workspace Admin, Co-admins and Analytics Viewers. It loads only the staff authentication methods configured below."
            value={staffLoginUrl}
            onCopy={() => copy(staffLoginUrl, 'Staff login link')}
          />
          <LinkCard
            icon={GraduationCap}
            title="Learner portal link"
            description="Send this single link to learners. After identity verification they see all current course instances assigned to their email."
            value={learnerPortalUrl}
            onCopy={() => copy(learnerPortalUrl, 'Learner portal link')}
          />
        </div>
      </section>

      <section className="scorm-panel rounded-2xl border p-5 md:p-6 mb-6">
        <div className="flex items-center gap-2 mb-2"><Users size={17} /><h2 className="font-semibold">Admin & team sign-in</h2></div>
        <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--scorm-muted)' }}>This policy applies only to the workspace Admin, invited Co-admins and Analytics Viewers.</p>
        <ModeCards modes={STAFF_JOINING_MODES} selected={config?.staffJoiningMode || 'password_or_sso'} onSelect={(staffJoiningMode) => patch({ staffJoiningMode })} />

        <div className="grid lg:grid-cols-2 gap-5 mt-5">
          <div className="rounded-2xl border p-4 md:p-5" style={{ borderColor: 'var(--scorm-line)' }}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2"><ShieldCheck size={17} /><h3 className="font-semibold">Staff Google Workspace</h3></div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={Boolean(config?.staffGoogleEnabled)} onChange={(e) => patch({ staffGoogleEnabled: e.target.checked })} /> Enabled</label>
            </div>
            <label><span className="scorm-micro block text-[9px] uppercase font-semibold mb-1.5">Google OAuth client ID</span><input value={config?.staffGoogleClientId || ''} onChange={(e) => patch({ staffGoogleClientId: e.target.value })} className="w-full px-3 py-2.5 text-xs" placeholder="123...apps.googleusercontent.com" /></label>
            <p className="text-[11px] mt-3 leading-relaxed" style={{ color: 'var(--scorm-muted)' }}>Create a Google OAuth Web client and add <strong>{window.location.origin}</strong> as an authorised JavaScript origin.</p>
          </div>

          <div className="rounded-2xl border p-4 md:p-5" style={{ borderColor: 'var(--scorm-line)' }}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2"><Building2 size={17} /><h3 className="font-semibold">Staff Microsoft Entra ID</h3></div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={Boolean(config?.staffMicrosoftEnabled)} onChange={(e) => patch({ staffMicrosoftEnabled: e.target.checked })} /> Enabled</label>
            </div>
            <div className="space-y-3">
              <label><span className="scorm-micro block text-[9px] uppercase font-semibold mb-1.5">Application / client ID</span><input value={config?.staffMicrosoftClientId || ''} onChange={(e) => patch({ staffMicrosoftClientId: e.target.value })} className="w-full px-3 py-2.5 text-xs" /></label>
              <label><span className="scorm-micro block text-[9px] uppercase font-semibold mb-1.5">Directory / tenant ID</span><input value={config?.staffMicrosoftTenantId || ''} onChange={(e) => patch({ staffMicrosoftTenantId: e.target.value })} className="w-full px-3 py-2.5 text-xs" /></label>
              <div><span className="scorm-micro block text-[9px] uppercase font-semibold mb-1.5">SPA redirect URI</span><div className="flex gap-2"><input readOnly value={staffMicrosoftRedirectUri} className="min-w-0 flex-1 px-3 py-2.5 text-[10px]" /><button type="button" onClick={() => copy(staffMicrosoftRedirectUri, 'Staff Microsoft redirect URI')} className="scorm-button-secondary px-3 grid place-items-center"><Copy size={13} /></button></div></div>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center gap-2 mb-2"><LockKeyhole size={15} /><h3 className="text-sm font-semibold">Staff allowed domains</h3></div>
          <input value={Array.isArray(config?.staffAllowedDomains) ? config.staffAllowedDomains.join(', ') : (config?.staffAllowedDomains || '')} onChange={(e) => patch({ staffAllowedDomains: e.target.value })} className="w-full px-3 py-2.5 text-sm" placeholder="company.com, subsidiary.com" />
          {config?.staffJoiningMode === 'sso_only' && !config?.staffGoogleEnabled && !config?.staffMicrosoftEnabled && <div className="mt-3 rounded-xl border px-3 py-2.5 text-xs" style={{ borderColor: 'rgba(251,191,36,.3)', background: 'rgba(251,191,36,.08)' }}>Enable Staff Google or Staff Microsoft before saving Staff SSO only.</div>}
        </div>
      </section>

      <section className="scorm-panel rounded-2xl border p-5 md:p-6">
        <div className="flex items-center gap-2 mb-2"><GraduationCap size={17} /><h2 className="font-semibold">Learner sign-in</h2></div>
        <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--scorm-muted)' }}>Learners can enter only when their verified email has at least one active assigned course instance.</p>
        <ModeCards modes={LEARNER_JOINING_MODES} selected={config?.joiningMode || 'assigned_email'} onSelect={(joiningMode) => patch({ joiningMode })} />

        <div className="grid lg:grid-cols-2 gap-5 mt-5">
          <div className="rounded-2xl border p-4 md:p-5" style={{ borderColor: 'var(--scorm-line)' }}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2"><ShieldCheck size={17} /><h3 className="font-semibold">Learner Google Workspace</h3></div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={Boolean(config?.googleEnabled)} onChange={(e) => patch({ googleEnabled: e.target.checked })} /> Enabled</label>
            </div>
            <label><span className="scorm-micro block text-[9px] uppercase font-semibold mb-1.5">Google OAuth client ID</span><input value={config?.googleClientId || ''} onChange={(e) => patch({ googleClientId: e.target.value })} className="w-full px-3 py-2.5 text-xs" placeholder="123...apps.googleusercontent.com" /></label>
            <p className="text-[11px] mt-3 leading-relaxed" style={{ color: 'var(--scorm-muted)' }}>You may reuse the same Google OAuth client as Staff SSO if your organisation wants both audiences on the same identity provider.</p>
          </div>

          <div className="rounded-2xl border p-4 md:p-5" style={{ borderColor: 'var(--scorm-line)' }}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2"><Building2 size={17} /><h3 className="font-semibold">Learner Microsoft Entra ID</h3></div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={Boolean(config?.microsoftEnabled)} onChange={(e) => patch({ microsoftEnabled: e.target.checked })} /> Enabled</label>
            </div>
            <div className="space-y-3">
              <label><span className="scorm-micro block text-[9px] uppercase font-semibold mb-1.5">Application / client ID</span><input value={config?.microsoftClientId || ''} onChange={(e) => patch({ microsoftClientId: e.target.value })} className="w-full px-3 py-2.5 text-xs" /></label>
              <label><span className="scorm-micro block text-[9px] uppercase font-semibold mb-1.5">Directory / tenant ID</span><input value={config?.microsoftTenantId || ''} onChange={(e) => patch({ microsoftTenantId: e.target.value })} className="w-full px-3 py-2.5 text-xs" /></label>
              <div><span className="scorm-micro block text-[9px] uppercase font-semibold mb-1.5">SPA redirect URI</span><div className="flex gap-2"><input readOnly value={learnerMicrosoftRedirectUri} className="min-w-0 flex-1 px-3 py-2.5 text-[10px]" /><button type="button" onClick={() => copy(learnerMicrosoftRedirectUri, 'Learner Microsoft redirect URI')} className="scorm-button-secondary px-3 grid place-items-center"><Copy size={13} /></button></div></div>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center gap-2 mb-2"><KeyRound size={15} /><h3 className="text-sm font-semibold">Learner allowed domains</h3></div>
          <input value={Array.isArray(config?.allowedDomains) ? config.allowedDomains.join(', ') : (config?.allowedDomains || '')} onChange={(e) => patch({ allowedDomains: e.target.value })} className="w-full px-3 py-2.5 text-sm" placeholder="company.com, subsidiary.com" />
          {config?.joiningMode === 'sso_only' && !config?.googleEnabled && !config?.microsoftEnabled && <div className="mt-3 rounded-xl border px-3 py-2.5 text-xs" style={{ borderColor: 'rgba(251,191,36,.3)', background: 'rgba(251,191,36,.08)' }}>Enable Learner Google or Learner Microsoft before saving Learner SSO only.</div>}
        </div>
      </section>
    </div>
  );
}
