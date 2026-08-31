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
  PowerOff
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

const emptyForm = { name: '', adminEmail: '', adminName: '' };

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-[var(--scorm-border,#29405f)] bg-[var(--scorm-panel-soft,rgba(79,201,191,.04))] px-3 py-2.5">
      <div className="flex items-center gap-2 text-[10px] opacity-60"><Icon size={13} /> {label}</div>
      <div className="mt-1 text-lg font-semibold">{value ?? 0}</div>
    </div>
  );
}

function TenantCard({ tenant, onRefresh }) {
  const { token } = useAuth();
  const [editingAdmin, setEditingAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState(tenant.admin?.email || '');
  const [adminName, setAdminName] = useState(tenant.admin?.displayName || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => {
    setAdminEmail(tenant.admin?.email || '');
    setAdminName(tenant.admin?.displayName || '');
  }, [tenant.admin?.email, tenant.admin?.displayName]);

  const saveAdmin = async () => {
    setBusy(true);
    setError('');
    try {
      await axios.patch(apiUrl(`/api/scorm/access/tenants/${tenant.id}/admin`), {
        adminEmail: adminEmail.trim().toLowerCase(),
        adminName: adminName.trim() || null
      }, { headers });
      setEditingAdmin(false);
      await onRefresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change the Tenant Admin.');
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async () => {
    const next = tenant.status === 'active' ? 'disabled' : 'active';
    if (!window.confirm(`${next === 'disabled' ? 'Disable' : 'Activate'} ${tenant.name}?`)) return;
    setBusy(true);
    setError('');
    try {
      await axios.patch(apiUrl(`/api/scorm/access/tenants/${tenant.id}/status`), { status: next }, { headers });
      await onRefresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update the tenant status.');
    } finally {
      setBusy(false);
    }
  };

  const copyLogin = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/login`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch (_) {}
  };

  return (
    <article className="scorm-panel rounded-2xl border overflow-hidden">
      <div className="p-4 md:p-5 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 border-b">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-9 h-9 rounded-xl grid place-items-center border text-[#4FC9BF]"><Building2 size={17} /></div>
            <div>
              <h2 className="text-base md:text-lg font-semibold leading-tight">{tenant.name}</h2>
              <div className="mt-1 text-[10px] opacity-55 break-all">Tenant ID · {tenant.id}</div>
            </div>
            <span className={`ml-1 rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[.08em] ${tenant.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
              {tenant.status}
            </span>
          </div>
          <div className="mt-4 flex items-start gap-2 text-xs">
            <ShieldCheck size={15} className="text-[#4FC9BF] mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">Tenant Admin</div>
              <div className="mt-0.5 opacity-65 break-all">{tenant.admin?.email || 'No Tenant Admin assigned'}</div>
              {tenant.admin?.displayName && <div className="mt-0.5 opacity-50">{tenant.admin.displayName}</div>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copyLogin} className="scorm-button-secondary min-h-9 px-3 text-[10px] font-semibold inline-flex items-center gap-2">
            {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy staff login'}
          </button>
          <button type="button" onClick={() => setEditingAdmin((value) => !value)} className="scorm-button-secondary min-h-9 px-3 text-[10px] font-semibold inline-flex items-center gap-2">
            <UserCog size={13} /> Change Admin
          </button>
          <button type="button" onClick={toggleStatus} disabled={busy} className="scorm-button-secondary min-h-9 px-3 text-[10px] font-semibold inline-flex items-center gap-2 disabled:opacity-50">
            {tenant.status === 'active' ? <PowerOff size={13} /> : <Power size={13} />}
            {tenant.status === 'active' ? 'Disable' : 'Activate'}
          </button>
        </div>
      </div>

      <div className="p-4 md:p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <Metric icon={Users} label="Staff" value={tenant.usage?.staff} />
          <Metric icon={BookOpen} label="Courses" value={tenant.usage?.courses} />
          <Metric icon={UserCheck} label="Learners" value={tenant.usage?.learners} />
          <Metric icon={Megaphone} label="Campaigns" value={tenant.usage?.campaigns} />
        </div>

        {editingAdmin && (
          <div className="mt-4 rounded-xl border p-4 bg-[rgba(79,201,191,.035)]">
            <div className="text-xs font-semibold">Change primary Tenant Admin</div>
            <p className="mt-1 text-[10px] leading-relaxed opacity-60">
              The tenant and all of its courses, learners, campaigns, reports and SSO settings stay in the same space. The previous Admin becomes a Co-admin.
            </p>
            <div className="mt-3 grid md:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[9px] uppercase tracking-[.08em] opacity-55">Admin email</span>
                <input type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-xs bg-transparent outline-none focus:border-[#4FC9BF]" />
              </label>
              <label className="block">
                <span className="text-[9px] uppercase tracking-[.08em] opacity-55">Admin name (optional)</span>
                <input value={adminName} onChange={(event) => setAdminName(event.target.value)} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-xs bg-transparent outline-none focus:border-[#4FC9BF]" />
              </label>
            </div>
            {error && <div className="mt-3 text-xs text-rose-400">{error}</div>}
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setEditingAdmin(false)} className="scorm-button-secondary min-h-9 px-3 text-[10px] font-semibold">Cancel</button>
              <button type="button" onClick={saveAdmin} disabled={busy || !adminEmail.trim()} className="scorm-button-primary min-h-9 px-3 text-[10px] font-semibold disabled:opacity-50">
                {busy ? 'Saving…' : 'Save Tenant Admin'}
              </button>
            </div>
          </div>
        )}

        {!editingAdmin && error && <div className="mt-3 text-xs text-rose-400">{error}</div>}

        <div className="mt-4 rounded-xl border px-3.5 py-3 text-[10px] leading-relaxed opacity-65">
          Tenant-specific Google and Microsoft Staff/Learner SSO is configured by this Tenant Admin under <strong>Authentication & SSO</strong>. Staff access is always matched to an exact tenant membership.
        </div>
      </div>
    </article>
  );
}

export default function TenantAdmin() {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [tenants, setTenants] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(apiUrl('/api/scorm/access/tenants'), { headers });
      setTenants(res.data?.tenants || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load tenants.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadTenants(); }, [loadTenants]);

  const create = async (event) => {
    event.preventDefault();
    setCreating(true);
    setError('');
    setMessage('');
    try {
      const res = await axios.post(apiUrl('/api/scorm/access/tenants'), {
        name: form.name.trim(),
        adminEmail: form.adminEmail.trim().toLowerCase(),
        adminName: form.adminName.trim() || null
      }, { headers });
      setForm(emptyForm);
      setMessage(`${res.data?.tenant?.name || 'Tenant'} created. The assigned Admin can sign in at the common /login page using an authorised method.`);
      await loadTenants();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create the tenant.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-[1180px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <div className="text-[#4FC9BF] text-[9px] uppercase tracking-[.15em] font-semibold">Platform administration</div>
          <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-[-.025em]">Tenant Management</h1>
          <p className="mt-2 text-xs md:text-sm opacity-65 max-w-3xl leading-relaxed">
            Create independent LMSGEN tenant spaces and assign the primary Tenant Admin by exact email. The tenant owns its data and SSO configuration; changing the Admin never moves the tenant.
          </p>
        </div>
        <button type="button" onClick={loadTenants} disabled={loading} className="scorm-button-secondary min-h-10 px-3.5 text-[10px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {message && <div className="mb-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-500">{message}</div>}
      {error && <div className="mb-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-xs text-rose-400">{error}</div>}

      <section className="scorm-panel rounded-2xl border p-4 md:p-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl grid place-items-center bg-[#4FC9BF]/10 text-[#4FC9BF] border border-[#4FC9BF]/20"><Plus size={18} /></div>
          <div>
            <h2 className="text-base font-semibold">Create Tenant</h2>
            <p className="mt-0.5 text-[10px] opacity-55">Create the tenant first, then assign the human Admin email.</p>
          </div>
        </div>

        <form onSubmit={create} className="mt-4 grid md:grid-cols-3 gap-3 items-end">
          <label className="block">
            <span className="text-[9px] uppercase tracking-[.08em] opacity-55">Tenant name</span>
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required minLength={2} placeholder="Acme Corporation" className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-xs bg-transparent outline-none focus:border-[#4FC9BF]" />
          </label>
          <label className="block">
            <span className="text-[9px] uppercase tracking-[.08em] opacity-55">Tenant Admin email</span>
            <input type="email" value={form.adminEmail} onChange={(event) => setForm((current) => ({ ...current, adminEmail: event.target.value }))} required placeholder="admin@company.com" className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-xs bg-transparent outline-none focus:border-[#4FC9BF]" />
          </label>
          <label className="block">
            <span className="text-[9px] uppercase tracking-[.08em] opacity-55">Admin name (optional)</span>
            <input value={form.adminName} onChange={(event) => setForm((current) => ({ ...current, adminName: event.target.value }))} placeholder="Admin name" className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-xs bg-transparent outline-none focus:border-[#4FC9BF]" />
          </label>
          <div className="md:col-span-3 flex justify-end">
            <button type="submit" disabled={creating} className="scorm-button-primary min-h-10 px-4 text-[10px] font-semibold inline-flex items-center gap-2 disabled:opacity-50">
              <Building2 size={14} /> {creating ? 'Creating…' : 'Create Tenant'}
            </button>
          </div>
        </form>
      </section>

      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="text-[9px] uppercase tracking-[.12em] font-semibold text-[#4FC9BF]">Tenants</div>
          <div className="mt-1 text-xs opacity-55">{tenants.length} tenant{tenants.length === 1 ? '' : 's'}</div>
        </div>
      </div>

      {loading && !tenants.length ? (
        <div className="scorm-panel rounded-2xl border min-h-[180px] grid place-items-center"><RefreshCw size={20} className="animate-spin opacity-50" /></div>
      ) : tenants.length ? (
        <div className="grid gap-4">{tenants.map((tenant) => <TenantCard key={tenant.id} tenant={tenant} onRefresh={loadTenants} />)}</div>
      ) : (
        <div className="scorm-panel rounded-2xl border py-14 px-5 text-center">
          <Building2 size={28} className="mx-auto text-[#4FC9BF] opacity-70" />
          <div className="mt-3 text-sm font-semibold">No tenants yet</div>
          <p className="mt-1 text-xs opacity-55">Create the first customer tenant above and assign its primary Admin email.</p>
        </div>
      )}
    </div>
  );
}
