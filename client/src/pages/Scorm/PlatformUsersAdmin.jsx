import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Building2,
  CheckCircle2,
  KeyRound,
  Link2,
  RefreshCw,
  Search,
  ShieldCheck,
  Unlink,
  UserRound,
  UsersRound
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

const ROLE_OPTIONS = [
  ['admin', 'Tenant Admin'],
  ['co_admin', 'Co-admin'],
  ['analytics_viewer', 'Analytics Viewer']
];

function roleLabel(role) {
  return ROLE_OPTIONS.find(([value]) => value === role)?.[1] || (role === 'super_admin' ? 'Super Admin' : 'No LMSGEN role');
}

function initials(user) {
  const label = String(user?.username || user?.email || 'U').trim();
  return label.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function UserAvatar({ user }) {
  if (user.avatar) return <img src={user.avatar} alt="" className="w-10 h-10 rounded-xl object-cover border" />;
  return <div className="w-10 h-10 rounded-xl grid place-items-center border bg-[#4FC9BF]/8 text-[#4FC9BF] text-xs font-bold">{initials(user)}</div>;
}

export default function PlatformUsersAdmin() {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [users, setUsers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [assignment, setAssignment] = useState({ workspaceId: '', role: 'co_admin' });
  const [tenantDraft, setTenantDraft] = useState({ open: false, name: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [userRes, tenantRes] = await Promise.all([
        axios.get(apiUrl('/api/scorm/platform-users'), { headers, params: { q: query || undefined, scope } }),
        axios.get(apiUrl('/api/scorm/access/tenants'), { headers })
      ]);
      setUsers(userRes.data?.users || []);
      setTenants((tenantRes.data?.tenants || []).filter((tenant) => tenant.status === 'active' && !tenant.protected));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load platform users.');
    } finally {
      setLoading(false);
    }
  }, [headers, query, scope]);

  useEffect(() => {
    const timer = window.setTimeout(load, query ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [load, query]);

  const openManage = (user) => {
    setEditingUser(user);
    setAssignment({
      workspaceId: user.tenant?.id || tenants[0]?.id || '',
      role: user.tenant?.role || 'co_admin'
    });
    setTenantDraft({ open: false, name: '' });
    setError(''); setMessage('');
  };

  const assign = async () => {
    if (!editingUser || !assignment.workspaceId) return;
    const moving = Boolean(editingUser.tenant && editingUser.tenant.id !== assignment.workspaceId);
    if (moving && !window.confirm(`Move ${editingUser.email} from ${editingUser.tenant.name} to the selected tenant?`)) return;
    setSaving(true); setError(''); setMessage('');
    try {
      await axios.patch(apiUrl(`/api/scorm/platform-users/${editingUser.id}/tenant`), {
        workspaceId: assignment.workspaceId,
        role: assignment.role,
        moveExisting: moving
      }, { headers });
      setMessage(`${editingUser.email} is now assigned as ${roleLabel(assignment.role)}.`);
      setEditingUser(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not assign this user.');
    } finally { setSaving(false); }
  };

  const createTenant = async () => {
    if (!editingUser || tenantDraft.name.trim().length < 2) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const res = await axios.post(apiUrl('/api/scorm/access/tenants'), {
        name: tenantDraft.name.trim(),
        adminEmail: editingUser.email,
        adminName: editingUser.username || null,
        entitlement: {}
      }, { headers });
      setMessage(`${res.data?.tenant?.name || tenantDraft.name.trim()} created and ${editingUser.email} assigned as Tenant Admin.`);
      setEditingUser(null);
      setTenantDraft({ open: false, name: '' });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create a tenant for this user.');
    } finally { setSaving(false); }
  };

  const unassign = async (user) => {
    if (!user.tenant || user.tenant.role === 'admin') return;
    if (!window.confirm(`Unassign ${user.email} from ${user.tenant.name}? The account will keep its normal LMSGEN/Quizmoto login.`)) return;
    setSaving(true); setError(''); setMessage('');
    try {
      await axios.delete(apiUrl(`/api/scorm/platform-users/${user.id}/tenant`), { headers });
      setMessage(`${user.email} was unassigned from the tenant.`);
      if (editingUser?.id === user.id) setEditingUser(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not unassign this user.');
    } finally { setSaving(false); }
  };

  const counts = useMemo(() => ({
    shown: users.length,
    assigned: users.filter((user) => user.tenant).length,
    unassigned: users.filter((user) => !user.tenant && !user.protected).length,
    google: users.filter((user) => user.googleConnected).length
  }), [users]);

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-[1280px] mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
        <div>
          <div className="text-[#4FC9BF] text-[9px] uppercase tracking-[.15em] font-semibold">Global account directory</div>
          <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-[-.025em]">Platform Users</h1>
          <p className="mt-2 text-xs md:text-sm opacity-65 max-w-3xl leading-relaxed">See every real LMSGEN account, including people who joined with normal Google SSO. Bind an existing account to a tenant without creating a duplicate user.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="scorm-button-secondary min-h-10 px-3.5 text-[10px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      {message && <div className="mb-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-500"><CheckCircle2 size={14} className="inline mr-2" />{message}</div>}
      {error && <div className="mb-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-xs text-rose-400">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
        <div className="scorm-panel rounded-xl border px-3.5 py-3"><div className="text-[9px] opacity-50 uppercase">Shown</div><div className="mt-1 text-xl font-semibold">{counts.shown}</div></div>
        <div className="scorm-panel rounded-xl border px-3.5 py-3"><div className="text-[9px] opacity-50 uppercase">Assigned</div><div className="mt-1 text-xl font-semibold text-[#4FC9BF]">{counts.assigned}</div></div>
        <div className="scorm-panel rounded-xl border px-3.5 py-3"><div className="text-[9px] opacity-50 uppercase">Unassigned</div><div className="mt-1 text-xl font-semibold">{counts.unassigned}</div></div>
        <div className="scorm-panel rounded-xl border px-3.5 py-3"><div className="text-[9px] opacity-50 uppercase">Google connected</div><div className="mt-1 text-xl font-semibold">{counts.google}</div></div>
      </div>

      <section className="scorm-panel rounded-2xl border overflow-hidden">
        <div className="p-3.5 md:p-4 border-b flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1 h-10 rounded-xl border px-3 flex items-center gap-2"><Search size={14} className="opacity-45" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, tenant or sign-in method" className="w-full bg-transparent outline-none text-xs" /></div>
          <div className="inline-flex rounded-xl border p-1 self-start md:self-auto">
            {[['all', 'All'], ['unassigned', 'Unassigned'], ['assigned', 'Assigned']].map(([value, label]) => <button key={value} type="button" onClick={() => setScope(value)} className="h-8 px-3 rounded-lg text-[10px] font-semibold" style={{ background: scope === value ? 'rgba(79,201,191,.12)' : 'transparent', color: scope === value ? '#4FC9BF' : 'var(--scorm-muted)' }}>{label}</button>)}
          </div>
        </div>

        {loading ? <div className="min-h-[180px] grid place-items-center"><RefreshCw size={20} className="animate-spin opacity-45" /></div> : users.length ? (
          <div className="divide-y">
            {users.map((user) => (
              <div key={user.id} className="p-3.5 md:p-4">
                <div className="flex flex-col xl:flex-row xl:items-center gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <UserAvatar user={user} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><div className="text-sm font-semibold truncate">{user.username || 'Platform user'}</div>{user.protected && <span className="rounded-full border px-2 py-0.5 text-[8px] uppercase font-semibold text-[#4FC9BF]">Protected</span>}</div>
                      <div className="mt-0.5 text-[10px] opacity-55 break-all">{user.email || 'No email address'}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 xl:w-[520px]">
                    <div className="rounded-lg border px-3 py-2"><div className="text-[8px] uppercase opacity-45">Sign-in</div><div className="mt-1 text-[10px] font-semibold flex items-center gap-1.5"><KeyRound size={11} /> {user.authMethod}</div></div>
                    <div className="rounded-lg border px-3 py-2"><div className="text-[8px] uppercase opacity-45">Tenant</div><div className="mt-1 text-[10px] font-semibold truncate">{user.tenant?.name || 'Unassigned'}</div></div>
                    <div className="rounded-lg border px-3 py-2 col-span-2 md:col-span-1"><div className="text-[8px] uppercase opacity-45">Role</div><div className="mt-1 text-[10px] font-semibold">{roleLabel(user.tenant?.role || user.accessRole)}</div></div>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    {!user.protected && <button type="button" onClick={() => openManage(user)} className="scorm-button-secondary min-h-9 px-3 text-[10px] font-semibold inline-flex items-center gap-2"><Link2 size={13} /> {user.tenant ? 'Manage assignment' : 'Assign user'}</button>}
                    {user.tenant && user.tenant.role !== 'admin' && !user.protected && <button type="button" onClick={() => unassign(user)} disabled={saving} className="scorm-button-secondary min-h-9 px-3 text-[10px] font-semibold inline-flex items-center gap-2 disabled:opacity-50"><Unlink size={13} /> Unassign</button>}
                  </div>
                </div>

                {editingUser?.id === user.id && <div className="mt-4 rounded-xl border border-[#4FC9BF]/20 bg-[#4FC9BF]/5 p-4">
                  <div className="flex items-center gap-2"><UsersRound size={15} className="text-[#4FC9BF]" /><div className="text-xs font-semibold">Manage {user.email}</div></div>
                  <div className="mt-3 grid lg:grid-cols-[1fr_190px_auto] gap-3">
                    <label className="block"><span className="text-[9px] uppercase opacity-50">Tenant</span><select value={assignment.workspaceId} onChange={(event) => setAssignment((current) => ({ ...current, workspaceId: event.target.value }))} className="mt-1.5 w-full rounded-lg border bg-transparent px-3 h-10 text-xs outline-none"><option value="">Choose tenant</option>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}</select></label>
                    <label className="block"><span className="text-[9px] uppercase opacity-50">Role</span><select value={assignment.role} onChange={(event) => setAssignment((current) => ({ ...current, role: event.target.value }))} className="mt-1.5 w-full rounded-lg border bg-transparent px-3 h-10 text-xs outline-none">{ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                    <div className="flex items-end gap-2"><button type="button" onClick={assign} disabled={saving || !assignment.workspaceId} className="scorm-button-primary h-10 px-4 text-[10px] font-semibold disabled:opacity-50">{saving ? 'Saving…' : 'Save assignment'}</button><button type="button" onClick={() => setEditingUser(null)} className="scorm-button-secondary h-10 px-3 text-[10px] font-semibold">Cancel</button></div>
                  </div>

                  {!user.tenant && <div className="mt-4 border-t pt-4">
                    {!tenantDraft.open ? <button type="button" onClick={() => setTenantDraft({ open: true, name: `${user.username || user.email?.split('@')[0] || 'New'} tenant` })} className="scorm-button-secondary min-h-9 px-3 text-[10px] font-semibold inline-flex items-center gap-2"><Building2 size={13} /> Create a new tenant for this user</button> : <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end"><label className="block"><span className="text-[9px] uppercase opacity-50">New tenant name</span><input value={tenantDraft.name} onChange={(event) => setTenantDraft((current) => ({ ...current, name: event.target.value }))} className="mt-1.5 w-full rounded-lg border bg-transparent px-3 h-10 text-xs outline-none focus:border-[#4FC9BF]" /></label><div className="flex gap-2"><button type="button" onClick={createTenant} disabled={saving || tenantDraft.name.trim().length < 2} className="scorm-button-primary h-10 px-4 text-[10px] font-semibold disabled:opacity-50">Create & make Admin</button><button type="button" onClick={() => setTenantDraft({ open: false, name: '' })} className="scorm-button-secondary h-10 px-3 text-[10px] font-semibold">Cancel</button></div></div>}
                    <p className="mt-2 text-[9px] opacity-50">The existing Google/password account is linked to the new tenant. No duplicate user is created. Capacity and feature limits can be adjusted afterwards in Tenant Management.</p>
                  </div>}
                </div>}
              </div>
            ))}
          </div>
        ) : <div className="min-h-[180px] grid place-items-center text-center p-6"><div><UserRound size={24} className="mx-auto opacity-30" /><div className="mt-3 text-sm font-semibold">No matching users</div><div className="mt-1 text-[10px] opacity-50">Try another search or filter.</div></div></div>}
      </section>

      <div className="mt-4 rounded-xl border px-4 py-3 text-[10px] leading-relaxed opacity-65"><ShieldCheck size={13} className="inline mr-2 text-[#4FC9BF]" />Only the Super Admin can see this global directory or move accounts between tenants. Tenant Admins continue to manage only members inside their own tenant.</div>
    </div>
  );
}
