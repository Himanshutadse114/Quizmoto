import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  BarChart3,
  CheckCircle2,
  Loader2,
  Mail,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

const ROLE_OPTIONS = [
  {
    value: 'co_admin',
    label: 'Co-admin',
    description: 'Can create courses, manage learners, assignments, tracking and reports.'
  },
  {
    value: 'analytics_viewer',
    label: 'Analytics viewer',
    description: 'Read-only access to learner tracking, analytics and reports.'
  }
];

function roleLabel(role) {
  if (role === 'admin') return 'Admin';
  if (role === 'co_admin') return 'Co-admin';
  if (role === 'analytics_viewer') return 'Analytics viewer';
  return role || 'Member';
}

function statusLabel(status) {
  if (status === 'active') return 'Active';
  return 'Invite ready';
}

export default function TeamAccess() {
  const { token, user } = useAuth();
  const [workspace, setWorkspace] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState(null);
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState({ email: '', displayName: '', role: 'co_admin' });

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await axios.get(apiUrl('/api/scorm/team'), { headers });
      setWorkspace(res.data?.workspace || null);
      setMembers(Array.isArray(res.data?.members) ? res.data.members : []);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Could not load team access.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const invite = async (event) => {
    event.preventDefault();
    const email = form.email.trim().toLowerCase();
    if (!email || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      await axios.post(apiUrl('/api/scorm/team'), {
        email,
        displayName: form.displayName.trim() || null,
        role: form.role
      }, { headers });
      setForm({ email: '', displayName: '', role: 'co_admin' });
      setMessage({ type: 'success', text: 'Team access added. They can sign in using the approved email address.' });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Could not add this team member.' });
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (member, role) => {
    if (!member?.id || busyMemberId) return;
    setBusyMemberId(member.id);
    setMessage(null);
    try {
      await axios.patch(apiUrl(`/api/scorm/team/${member.id}`), { role }, { headers });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Could not update this role.' });
    } finally {
      setBusyMemberId(null);
    }
  };

  const removeMember = async (member) => {
    if (!member?.id || busyMemberId || member.role === 'admin') return;
    const confirmed = window.confirm(`Remove ${member.email} from this workspace? Their LMSGEN access will be revoked.`);
    if (!confirmed) return;
    setBusyMemberId(member.id);
    setMessage(null);
    try {
      await axios.delete(apiUrl(`/api/scorm/team/${member.id}`), { headers });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Could not remove this team member.' });
    } finally {
      setBusyMemberId(null);
    }
  };

  return (
    <div className="p-4 md:p-7 max-w-6xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
        <div>
          <div className="scorm-eyebrow">Workspace administration</div>
          <h1 className="text-2xl md:text-3xl font-semibold mt-1">Team & roles</h1>
          <p className="text-sm mt-2 max-w-2xl text-slate-500 dark:text-slate-400">
            Keep one primary Admin, add Co-admins for day-to-day course operations, and add read-only Analytics viewers for reporting.
          </p>
        </div>
        <div className="scorm-panel rounded-2xl border px-4 py-3 min-w-0 lg:min-w-[300px]">
          <div className="text-[10px] uppercase tracking-[.12em] font-semibold opacity-60">Workspace</div>
          <div className="mt-1 text-sm font-semibold truncate">{workspace?.name || 'Your LMSGEN workspace'}</div>
          <div className="mt-1 text-xs opacity-60 break-all">Admin: {user?.email || '—'}</div>
        </div>
      </div>

      {message && (
        <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${message.type === 'error' ? 'border-red-400/30 bg-red-500/10 text-red-300' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'}`}>
          {message.text}
        </div>
      )}

      <div className="grid xl:grid-cols-[360px_minmax(0,1fr)] gap-5 items-start">
        <section className="scorm-panel rounded-2xl border overflow-hidden">
          <div className="scorm-panel-header px-5 py-4 border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl grid place-items-center border"><UserPlus size={18} /></div>
              <div>
                <div className="text-sm font-semibold">Add team access</div>
                <div className="text-xs opacity-60 mt-0.5">Invite by approved work email.</div>
              </div>
            </div>
          </div>

          <form onSubmit={invite} className="p-5 space-y-4">
            <div>
              <label className="qmx-field-label block text-[10px] uppercase tracking-[.11em] font-semibold mb-2">Name <span className="normal-case opacity-60">(optional)</span></label>
              <input
                value={form.displayName}
                onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                className="w-full rounded-xl border bg-transparent px-3.5 py-3 text-sm outline-none"
                placeholder="Aditi Phadtare"
                maxLength={160}
              />
            </div>

            <div>
              <label className="qmx-field-label block text-[10px] uppercase tracking-[.11em] font-semibold mb-2">Work email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-45" />
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className="w-full rounded-xl border bg-transparent pl-10 pr-3.5 py-3 text-sm outline-none"
                  placeholder="person@company.com"
                  autoComplete="off"
                />
              </div>
            </div>

            <div>
              <label className="qmx-field-label block text-[10px] uppercase tracking-[.11em] font-semibold mb-2">Role</label>
              <div className="space-y-2">
                {ROLE_OPTIONS.map((option) => {
                  const selected = form.role === option.value;
                  const Icon = option.value === 'co_admin' ? ShieldCheck : BarChart3;
                  return (
                    <label key={option.value} className={`block rounded-xl border p-3.5 cursor-pointer transition ${selected ? 'ring-2 ring-teal-400/20 border-teal-400/60' : ''}`}>
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="workspace-role"
                          value={option.value}
                          checked={selected}
                          onChange={() => setForm((current) => ({ ...current, role: option.value }))}
                          className="mt-1"
                        />
                        <Icon size={16} className="mt-0.5 shrink-0" />
                        <div>
                          <div className="text-sm font-semibold">{option.label}</div>
                          <div className="text-xs opacity-60 leading-relaxed mt-1">{option.description}</div>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <button type="submit" disabled={saving || !form.email.trim()} className="scorm-button-primary w-full min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              {saving ? 'Adding access…' : 'Add team member'}
            </button>
          </form>
        </section>

        <section className="scorm-panel rounded-2xl border overflow-hidden min-w-0">
          <div className="scorm-panel-header px-5 py-4 border-b flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl grid place-items-center border shrink-0"><Users size={18} /></div>
              <div className="min-w-0">
                <div className="text-sm font-semibold">Workspace team</div>
                <div className="text-xs opacity-60 mt-0.5">{members.length} member{members.length === 1 ? '' : 's'}</div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="min-h-[280px] grid place-items-center">
              <div className="text-center"><Loader2 size={24} className="animate-spin mx-auto opacity-60" /><div className="text-xs opacity-60 mt-3">Loading team…</div></div>
            </div>
          ) : members.length === 0 ? (
            <div className="p-8 text-center text-sm opacity-60">No workspace members found.</div>
          ) : (
            <div className="divide-y divide-white/10">
              {members.map((member) => {
                const owner = member.role === 'admin';
                const busy = busyMemberId === member.id;
                return (
                  <div key={member.id} className="p-4 md:p-5 grid md:grid-cols-[minmax(0,1fr)_180px_auto] gap-3 md:items-center">
                    <div className="min-w-0 flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl grid place-items-center border shrink-0 ${owner ? 'text-teal-300' : ''}`}>
                        {owner ? <ShieldCheck size={17} /> : member.role === 'analytics_viewer' ? <BarChart3 size={17} /> : <Users size={17} />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold truncate max-w-full">{member.displayName || member.email}</div>
                          {owner && <span className="text-[9px] uppercase tracking-[.08em] rounded-full px-2 py-1 border border-teal-400/30 text-teal-300">Primary</span>}
                        </div>
                        <div className="text-xs opacity-60 break-all mt-1">{member.email}</div>
                        <div className="mt-2 flex items-center gap-1.5 text-[10px] opacity-65">
                          <CheckCircle2 size={12} /> {statusLabel(member.status)}
                        </div>
                      </div>
                    </div>

                    {owner ? (
                      <div className="text-xs font-semibold opacity-70">{roleLabel(member.role)}</div>
                    ) : (
                      <select
                        value={member.role}
                        disabled={busy}
                        onChange={(event) => changeRole(member, event.target.value)}
                        className="w-full rounded-xl border bg-transparent px-3 py-2.5 text-xs font-semibold outline-none disabled:opacity-50"
                      >
                        {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    )}

                    <div className="flex md:justify-end">
                      {!owner && (
                        <button
                          type="button"
                          onClick={() => removeMember(member)}
                          disabled={busy}
                          className="scorm-button-secondary min-h-10 inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold disabled:opacity-50"
                        >
                          {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
