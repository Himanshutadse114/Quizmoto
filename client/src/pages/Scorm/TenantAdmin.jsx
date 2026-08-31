import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Building2,
  CheckCircle2,
  Copy,
  RefreshCw,
  ShieldCheck,
  UserCog,
  Users,
  BookOpen,
  Megaphone,
  UserCheck,
  Plus,
  Power,
  PowerOff,
  Settings2,
  Gauge,
  Link2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

const DEFAULT_PERMISSIONS = {
  courseAuthoring: true,
  coursePublishing: true,
  coursePreview: true,
  learnerRoster: true,
  learnerTracking: true,
  assignments: true,
  campaigns: true,
  reports: true,
  library: true,
  contentEditor: true,
  teamManagement: true,
  ssoManagement: true
};

const PERMISSION_LABELS = [
  ['courseAuthoring', 'AI course authoring'],
  ['contentEditor', 'Course content editor'],
  ['coursePublishing', 'Course publishing'],
  ['coursePreview', 'Course preview'],
  ['library', 'Course library / packages'],
  ['learnerRoster', 'Learner roster'],
  ['assignments', 'Course assignments'],
  ['learnerTracking', 'Learner tracking'],
  ['campaigns', 'Campaigns'],
  ['reports', 'Reports'],
  ['teamManagement', 'Team & roles'],
  ['ssoManagement', 'Authentication & SSO']
];

const LIMIT_FIELDS = [
  ['maxCourses', 'Lifetime course creations', 'Generated or manually created courses. Deleting or archiving does not refund this allowance.'],
  ['maxLearners', 'Learner capacity', 'Maximum unique learners that can be assigned learning.'],
  ['maxStaff', 'Staff seats', 'Tenant Admin, Co-admins and Analytics Viewers.'],
  ['maxCampaigns', 'Campaigns', 'Maximum campaigns stored in the tenant.'],
  ['maxAssignments', 'Learner-course assignments', 'Maximum active learner × course assignment pairs.']
];

function blankLimits() {
  return { maxCourses: '', maxLearners: '', maxStaff: '', maxCampaigns: '', maxAssignments: '' };
}

function emptyForm() {
  return {
    name: '',
    adminEmail: '',
    adminName: '',
    ...blankLimits(),
    permissions: { ...DEFAULT_PERMISSIONS }
  };
}

function limitPayload(source) {
  const result = {};
  LIMIT_FIELDS.forEach(([key]) => {
    const value = source[key];
    result[key] = value === '' || value === null || value === undefined ? null : Math.max(0, Math.floor(Number(value) || 0));
  });
  result.permissions = { ...DEFAULT_PERMISSIONS, ...(source.permissions || {}) };
  return result;
}

function entitlementForm(entitlement = {}) {
  const limits = {};
  LIMIT_FIELDS.forEach(([key]) => {
    limits[key] = entitlement[key] === null || entitlement[key] === undefined ? '' : String(entitlement[key]);
  });
  return { ...limits, permissions: { ...DEFAULT_PERMISSIONS, ...(entitlement.permissions || {}) } };
}

function showLimit(value) {
  return value === null || value === undefined ? 'Unlimited' : value;
}

function Metric({ icon: Icon, label, value, limit, emphasise = false }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${emphasise ? 'border-[#4FC9BF]/30 bg-[#4FC9BF]/5' : 'border-[var(--scorm-border,#29405f)] bg-[var(--scorm-panel-soft,rgba(79,201,191,.04))]'}`}>
      <div className="flex items-center gap-2 text-[10px] opacity-60"><Icon size={13} /> {label}</div>
      <div className="mt-1 text-lg font-semibold">
        {value ?? 0}
        {limit !== undefined && <span className="ml-1 text-[10px] font-medium opacity-45">/ {showLimit(limit)}</span>}
      </div>
    </div>
  );
}

function LimitInputs({ value, onChange }) {
  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3">
      {LIMIT_FIELDS.map(([key, label, help]) => (
        <label key={key} className="block rounded-xl border p-3 bg-[rgba(79,201,191,.025)]">
          <span className="text-[9px] uppercase tracking-[.07em] opacity-60">{label}</span>
          <input
            type="number"
            min="0"
            step="1"
            value={value[key]}
            onChange={(event) => onChange({ ...value, [key]: event.target.value })}
            placeholder="Unlimited"
            className="mt-2 w-full rounded-lg border px-3 py-2.5 text-xs bg-transparent outline-none focus:border-[#4FC9BF]"
          />
          <span className="mt-2 block text-[9px] leading-relaxed opacity-45">{help}</span>
        </label>
      ))}
    </div>
  );
}

function PermissionGrid({ permissions, onChange }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
      {PERMISSION_LABELS.map(([key, label]) => {
        const enabled = permissions[key] !== false;
        return (
          <label key={key} className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer text-[10px]">
            <input type="checkbox" checked={enabled} onChange={(event) => onChange({ ...permissions, [key]: event.target.checked })} className="accent-[#4FC9BF]" />
            <span className={enabled ? '' : 'opacity-45'}>{label}</span>
          </label>
        );
      })}
    </div>
  );
}

function TenantCard({ tenant, onRefresh }) {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [editingAdmin, setEditingAdmin] = useState(false);
  const [editingEntitlement, setEditingEntitlement] = useState(false);
  const [adminEmail, setAdminEmail] = useState(tenant.admin?.email || '');
  const [adminName, setAdminName] = useState(tenant.admin?.displayName || '');
  const [entitlement, setEntitlement] = useState(() => entitlementForm(tenant.entitlement));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setAdminEmail(tenant.admin?.email || '');
    setAdminName(tenant.admin?.displayName || '');
    setEntitlement(entitlementForm(tenant.entitlement));
  }, [tenant.admin?.email, tenant.admin?.displayName, tenant.entitlement]);

  const saveAdmin = async () => {
    setBusy(true); setError('');
    try {
      await axios.patch(apiUrl(`/api/scorm/access/tenants/${tenant.id}/admin`), { adminEmail: adminEmail.trim().toLowerCase(), adminName: adminName.trim() || null }, { headers });
      setEditingAdmin(false); await onRefresh();
    } catch (err) { setError(err.response?.data?.message || 'Could not change the Tenant Admin.'); }
    finally { setBusy(false); }
  };

  const saveEntitlement = async () => {
    setBusy(true); setError('');
    try {
      await axios.patch(apiUrl(`/api/scorm/access/tenants/${tenant.id}/entitlement`), limitPayload(entitlement), { headers });
      setEditingEntitlement(false); await onRefresh();
    } catch (err) { setError(err.response?.data?.message || 'Could not update tenant limits and features.'); }
    finally { setBusy(false); }
  };

  const toggleStatus = async () => {
    const next = tenant.status === 'active' ? 'disabled' : 'active';
    if (!window.confirm(`${next === 'disabled' ? 'Disable' : 'Activate'} ${tenant.name}?`)) return;
    setBusy(true); setError('');
    try { await axios.patch(apiUrl(`/api/scorm/access/tenants/${tenant.id}/status`), { status: next }, { headers }); await onRefresh(); }
    catch (err) { setError(err.response?.data?.message || 'Could not update the tenant status.'); }
    finally { setBusy(false); }
  };

  const copyLogin = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/login`); setCopied(true); window.setTimeout(() => setCopied(false), 1400); } catch (_) {}
  };

  const e = tenant.entitlement || {};
  const u = tenant.usage || {};

  return (
    <article className="scorm-panel rounded-2xl border overflow-hidden">
      <div className="p-4 md:p-5 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 border-b">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-9 h-9 rounded-xl grid place-items-center border text-[#4FC9BF]"><Building2 size={17} /></div>
            <div><h2 className="text-base md:text-lg font-semibold leading-tight">{tenant.name}</h2><div className="mt-1 text-[10px] opacity-55 break-all">Tenant ID · {tenant.id}</div></div>
            <span className={`ml-1 rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[.08em] ${tenant.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>{tenant.status}</span>
            {tenant.protected && <span className="rounded-full px-2.5 py-1 text-[9px] border opacity-60">Protected</span>}
          </div>
          <div className="mt-4 flex items-start gap-2 text-xs"><ShieldCheck size={15} className="text-[#4FC9BF] mt-0.5 shrink-0" /><div><div className="font-semibold">Tenant Admin</div><div className="mt-0.5 opacity-65 break-all">{tenant.admin?.email || 'No Tenant Admin assigned'}</div>{tenant.admin?.displayName && <div className="mt-0.5 opacity-50">{tenant.admin.displayName}</div>}</div></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copyLogin} className="scorm-button-secondary min-h-9 px-3 text-[10px] font-semibold inline-flex items-center gap-2">{copied ? <CheckCircle2 size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy staff login'}</button>
          {!tenant.protected && <>
            <button type="button" onClick={() => { setEditingEntitlement((value) => !value); setEditingAdmin(false); }} className="scorm-button-secondary min-h-9 px-3 text-[10px] font-semibold inline-flex items-center gap-2"><Settings2 size={13} /> Limits & features</button>
            <button type="button" onClick={() => { setEditingAdmin((value) => !value); setEditingEntitlement(false); }} className="scorm-button-secondary min-h-9 px-3 text-[10px] font-semibold inline-flex items-center gap-2"><UserCog size={13} /> Change Admin</button>
            <button type="button" onClick={toggleStatus} disabled={busy} className="scorm-button-secondary min-h-9 px-3 text-[10px] font-semibold inline-flex items-center gap-2 disabled:opacity-50">{tenant.status === 'active' ? <PowerOff size={13} /> : <Power size={13} />}{tenant.status === 'active' ? 'Disable' : 'Activate'}</button>
          </>}
        </div>
      </div>

      <div className="p-4 md:p-5">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
          <Metric icon={BookOpen} label="Course creations used" value={u.courseCreations ?? u.courses} limit={e.maxCourses} emphasise />
          <Metric icon={BookOpen} label="Active courses" value={u.courses} />
          <Metric icon={UserCheck} label="Learners" value={u.learners} limit={e.maxLearners} />
          <Metric icon={Users} label="Staff" value={u.staff} limit={e.maxStaff} />
          <Metric icon={Megaphone} label="Campaigns" value={u.campaigns} limit={e.maxCampaigns} />
          <Metric icon={Link2} label="Assignments" value={u.assignments} limit={e.maxAssignments} />
        </div>

        {!tenant.protected && <div className="mt-3 rounded-xl border border-[#4FC9BF]/20 bg-[#4FC9BF]/5 px-3.5 py-3 text-[10px] leading-relaxed"><strong>Course allowance is lifetime consumption.</strong> Archiving or deleting a course removes it from the active library but does not return a course creation slot.</div>}

        {editingEntitlement && <div className="mt-4 rounded-xl border p-4 bg-[rgba(79,201,191,.025)]">
          <div className="flex items-center gap-2"><Gauge size={15} className="text-[#4FC9BF]" /><div className="text-xs font-semibold">Tenant limits</div></div>
          <p className="mt-1 text-[10px] opacity-55">Leave a limit blank for unlimited. Setting a limit below current usage blocks new usage without deleting existing data.</p>
          <div className="mt-3"><LimitInputs value={entitlement} onChange={setEntitlement} /></div>
          <div className="mt-5 text-xs font-semibold">Enabled tenant features</div>
          <p className="mt-1 text-[10px] opacity-55">Disabled features are enforced by the backend, not only hidden in the interface.</p>
          <div className="mt-3"><PermissionGrid permissions={entitlement.permissions} onChange={(permissions) => setEntitlement((current) => ({ ...current, permissions }))} /></div>
          {error && <div className="mt-3 text-xs text-rose-400">{error}</div>}
          <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => { setEditingEntitlement(false); setEntitlement(entitlementForm(tenant.entitlement)); }} className="scorm-button-secondary min-h-9 px-3 text-[10px] font-semibold">Cancel</button><button type="button" onClick={saveEntitlement} disabled={busy} className="scorm-button-primary min-h-9 px-3 text-[10px] font-semibold disabled:opacity-50">{busy ? 'Saving…' : 'Save limits & features'}</button></div>
        </div>}

        {editingAdmin && <div className="mt-4 rounded-xl border p-4 bg-[rgba(79,201,191,.035)]">
          <div className="text-xs font-semibold">Change primary Tenant Admin</div>
          <p className="mt-1 text-[10px] leading-relaxed opacity-60">The tenant, quota consumption, courses, learners, campaigns, reports and SSO settings stay in the same space. The previous Admin becomes a Co-admin.</p>
          <div className="mt-3 grid md:grid-cols-2 gap-3"><label className="block"><span className="text-[9px] uppercase tracking-[.08em] opacity-55">Admin email</span><input type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-xs bg-transparent outline-none focus:border-[#4FC9BF]" /></label><label className="block"><span className="text-[9px] uppercase tracking-[.08em] opacity-55">Admin name (optional)</span><input value={adminName} onChange={(event) => setAdminName(event.target.value)} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-xs bg-transparent outline-none focus:border-[#4FC9BF]" /></label></div>
          {error && <div className="mt-3 text-xs text-rose-400">{error}</div>}
          <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setEditingAdmin(false)} className="scorm-button-secondary min-h-9 px-3 text-[10px] font-semibold">Cancel</button><button type="button" onClick={saveAdmin} disabled={busy || !adminEmail.trim()} className="scorm-button-primary min-h-9 px-3 text-[10px] font-semibold disabled:opacity-50">{busy ? 'Saving…' : 'Save Tenant Admin'}</button></div>
        </div>}

        {!editingAdmin && !editingEntitlement && error && <div className="mt-3 text-xs text-rose-400">{error}</div>}
        <div className="mt-4 rounded-xl border px-3.5 py-3 text-[10px] leading-relaxed opacity-65">Tenant-specific Google and Microsoft Staff/Learner SSO is configured by the Tenant Admin under <strong>Authentication & SSO</strong>. Super Admin feature controls above decide whether SSO management is available to this tenant.</div>
      </div>
    </article>
  );
}

export default function TenantAdmin() {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [tenants, setTenants] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [advanced, setAdvanced] = useState(true);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadTenants = useCallback(async () => {
    setLoading(true); setError('');
    try { const res = await axios.get(apiUrl('/api/scorm/access/tenants'), { headers }); setTenants(res.data?.tenants || []); }
    catch (err) { setError(err.response?.data?.message || 'Could not load tenants.'); }
    finally { setLoading(false); }
  }, [headers]);

  useEffect(() => { loadTenants(); }, [loadTenants]);

  const create = async (event) => {
    event.preventDefault(); setCreating(true); setError(''); setMessage('');
    try {
      const res = await axios.post(apiUrl('/api/scorm/access/tenants'), { name: form.name.trim(), adminEmail: form.adminEmail.trim().toLowerCase(), adminName: form.adminName.trim() || null, entitlement: limitPayload(form) }, { headers });
      setForm(emptyForm()); setMessage(`${res.data?.tenant?.name || 'Tenant'} created with its limits and feature configuration.`); await loadTenants();
    } catch (err) { setError(err.response?.data?.message || 'Could not create the tenant.'); }
    finally { setCreating(false); }
  };

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-[1280px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6"><div><div className="text-[#4FC9BF] text-[9px] uppercase tracking-[.15em] font-semibold">Platform administration</div><h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-[-.025em]">Tenant Management</h1><p className="mt-2 text-xs md:text-sm opacity-65 max-w-3xl leading-relaxed">Create independent tenant spaces, assign the primary Admin and control capacity, product features and access from one place.</p></div><button type="button" onClick={loadTenants} disabled={loading} className="scorm-button-secondary min-h-10 px-3.5 text-[10px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button></div>
      {message && <div className="mb-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-500">{message}</div>}
      {error && <div className="mb-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-xs text-rose-400">{error}</div>}

      <section className="scorm-panel rounded-2xl border p-4 md:p-5 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl grid place-items-center bg-[#4FC9BF]/10 text-[#4FC9BF] border border-[#4FC9BF]/20"><Plus size={18} /></div><div><h2 className="text-base font-semibold">Create Tenant</h2><p className="mt-0.5 text-[10px] opacity-55">Define the tenant, Admin, capacity and enabled features before it goes live.</p></div></div><button type="button" onClick={() => setAdvanced((value) => !value)} className="scorm-button-secondary min-h-9 px-3 text-[10px] font-semibold inline-flex items-center gap-2"><Settings2 size={13} /> {advanced ? 'Hide advanced configuration' : 'Show advanced configuration'}</button></div>
        <form onSubmit={create} className="mt-4">
          <div className="grid md:grid-cols-3 gap-3"><label className="block"><span className="text-[9px] uppercase tracking-[.08em] opacity-55">Tenant name</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required minLength={2} placeholder="Acme Corporation" className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-xs bg-transparent outline-none focus:border-[#4FC9BF]" /></label><label className="block"><span className="text-[9px] uppercase tracking-[.08em] opacity-55">Tenant Admin email</span><input type="email" value={form.adminEmail} onChange={(event) => setForm((current) => ({ ...current, adminEmail: event.target.value }))} required placeholder="admin@company.com" className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-xs bg-transparent outline-none focus:border-[#4FC9BF]" /></label><label className="block"><span className="text-[9px] uppercase tracking-[.08em] opacity-55">Admin name (optional)</span><input value={form.adminName} onChange={(event) => setForm((current) => ({ ...current, adminName: event.target.value }))} placeholder="Admin name" className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-xs bg-transparent outline-none focus:border-[#4FC9BF]" /></label></div>
          {advanced && <div className="mt-5 border-t pt-5"><div className="flex items-center gap-2"><Gauge size={15} className="text-[#4FC9BF]" /><div className="text-xs font-semibold">Capacity limits</div></div><p className="mt-1 text-[10px] opacity-55">Blank means unlimited. Course creation is a lifetime allowance and is not restored by deleting a course.</p><div className="mt-3"><LimitInputs value={form} onChange={(next) => setForm((current) => ({ ...current, ...next }))} /></div><div className="mt-5 text-xs font-semibold">Enabled tenant features</div><p className="mt-1 text-[10px] opacity-55">Turn modules on or off per tenant. These controls are enforced on the server.</p><div className="mt-3"><PermissionGrid permissions={form.permissions} onChange={(permissions) => setForm((current) => ({ ...current, permissions }))} /></div></div>}
          <div className="mt-4 flex justify-end"><button type="submit" disabled={creating} className="scorm-button-primary min-h-10 px-4 text-[10px] font-semibold inline-flex items-center gap-2 disabled:opacity-50"><Building2 size={14} /> {creating ? 'Creating…' : 'Create Tenant'}</button></div>
        </form>
      </section>

      <div className="flex items-center justify-between gap-3 mb-3"><div><div className="text-[9px] uppercase tracking-[.12em] font-semibold text-[#4FC9BF]">Tenants</div><div className="mt-1 text-xs opacity-55">{tenants.length} tenant{tenants.length === 1 ? '' : 's'}</div></div></div>
      {loading && !tenants.length ? <div className="scorm-panel rounded-2xl border min-h-[180px] grid place-items-center"><RefreshCw size={20} className="animate-spin opacity-50" /></div> : tenants.length ? <div className="grid gap-4">{tenants.map((tenant) => <TenantCard key={tenant.id} tenant={tenant} onRefresh={loadTenants} />)}</div> : <div className="scorm-panel rounded-2xl border min-h-[180px] grid place-items-center text-center p-6"><div><Building2 size={24} className="mx-auto opacity-35" /><div className="mt-3 text-sm font-semibold">No tenants yet</div><div className="mt-1 text-[10px] opacity-50">Create the first tenant above.</div></div></div>}
    </div>
  );
}
