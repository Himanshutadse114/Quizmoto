import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  LogIn,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserCheck,
  UserPlus
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

const PERMISSION_LABELS = [
  ['courseAuthoring', 'Create courses'],
  ['coursePublishing', 'Publish courses'],
  ['coursePreview', 'Preview courses'],
  ['learnerRoster', 'Manage learner roster'],
  ['learnerTracking', 'Learner tracking'],
  ['reports', 'Reports & exports'],
  ['library', 'SCORM library'],
  ['contentEditor', 'Content editor']
];

function limitValue(value) {
  return value === null || value === undefined ? '' : String(value);
}

function EntitlementEditor({ grant, onSave, saving }) {
  const initial = grant.entitlement || {};
  const [maxCourses, setMaxCourses] = useState(limitValue(initial.maxCourses));
  const [maxLearners, setMaxLearners] = useState(limitValue(initial.maxLearners));
  const [permissions, setPermissions] = useState(initial.permissions || {});

  useEffect(() => {
    setMaxCourses(limitValue(grant.entitlement?.maxCourses));
    setMaxLearners(limitValue(grant.entitlement?.maxLearners));
    setPermissions(grant.entitlement?.permissions || {});
  }, [grant.id, grant.entitlement]);

  if (grant.protected) {
    return (
      <div className="mt-4 rounded-xl border border-blue-400/20 bg-blue-500/5 px-4 py-3 text-[10px] text-[#93c5fd]">
        Super administrator access is unrestricted: unlimited courses, unlimited learners and all capabilities enabled.
      </div>
    );
  }

  const save = () => {
    onSave(grant, {
      maxCourses: maxCourses === '' ? null : Math.max(0, Number(maxCourses) || 0),
      maxLearners: maxLearners === '' ? null : Math.max(0, Number(maxLearners) || 0),
      permissions
    });
  };

  return (
    <div className="mt-4 rounded-xl border border-[#29405f] bg-[#050d18] p-4">
      <div className="flex items-center gap-2 text-[#93c5fd] text-[9px] uppercase tracking-[.12em] font-semibold">
        <SlidersHorizontal size={13} /> Account restrictions
      </div>

      <div className="mt-3 grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[9px] uppercase tracking-[.09em] text-[#8295ae]">Maximum courses</span>
          <input
            type="number"
            min="0"
            value={maxCourses}
            onChange={(e) => setMaxCourses(e.target.value)}
            placeholder="Unlimited"
            className="mt-1.5 w-full rounded-lg border border-[#29405f] bg-[#07111f] px-3 py-2 text-xs text-[#f8fafc] outline-none focus:border-[#60a5fa]"
          />
          <div className="mt-1 text-[9px] text-[#71839c]">Used {grant.usage?.courses || 0}{grant.entitlement?.maxCourses == null ? ' · unlimited' : ` / ${grant.entitlement.maxCourses}`}</div>
        </label>

        <label className="block">
          <span className="text-[9px] uppercase tracking-[.09em] text-[#8295ae]">Maximum enrolled learners</span>
          <input
            type="number"
            min="0"
            value={maxLearners}
            onChange={(e) => setMaxLearners(e.target.value)}
            placeholder="Unlimited"
            className="mt-1.5 w-full rounded-lg border border-[#29405f] bg-[#07111f] px-3 py-2 text-xs text-[#f8fafc] outline-none focus:border-[#60a5fa]"
          />
          <div className="mt-1 text-[9px] text-[#71839c]">Enrolled {grant.usage?.learners || 0} · roster {grant.usage?.rosterLearners || 0}</div>
        </label>
      </div>

      <div className="mt-4">
        <div className="text-[9px] uppercase tracking-[.09em] text-[#8295ae] mb-2">Feature access</div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2">
          {PERMISSION_LABELS.map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 rounded-lg border border-[#22324a] bg-[#07111f] px-3 py-2 text-[10px] text-[#cbd5e1] cursor-pointer">
              <input
                type="checkbox"
                checked={permissions[key] !== false}
                onChange={(e) => setPermissions((current) => ({ ...current, [key]: e.target.checked }))}
                className="accent-[#4FC9BF]"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="scorm-button-primary min-h-9 px-3.5 text-[10px] font-semibold inline-flex items-center gap-2 disabled:opacity-50"
        >
          <Save size={13} /> {saving ? 'Saving…' : 'Save restrictions'}
        </button>
      </div>
    </div>
  );
}

function hasCustomRestrictions(grant) {
  if (grant.protected) return false;
  const entitlement = grant.entitlement || {};
  const hasLimit = entitlement.maxCourses != null || entitlement.maxLearners != null;
  const hasDisabledPermission = Object.values(entitlement.permissions || {}).some((value) => value === false);
  return hasLimit || hasDisabledPermission;
}

export default function AccessAdmin() {
  const { token, user } = useAuth();
  const [grants, setGrants] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [superAdminEmail, setSuperAdminEmail] = useState('tadsehimanshu@gmail.com');
  const [adminContact, setAdminContact] = useState('tadsehimanshu@gmail.com');
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [savingGrantId, setSavingGrantId] = useState(null);
  const [expandedGrantId, setExpandedGrantId] = useState(null);
  const [accountSearch, setAccountSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState('all');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const filteredGrants = useMemo(() => {
    const query = accountSearch.trim().toLowerCase();
    return grants.filter((grant) => {
      if (query && !String(grant.email || '').toLowerCase().includes(query)) return false;
      if (accountFilter === 'users' && grant.role === 'super_admin') return false;
      if (accountFilter === 'super_admin' && grant.role !== 'super_admin') return false;
      if (accountFilter === 'restricted' && !hasCustomRestrictions(grant)) return false;
      if (accountFilter === 'unrestricted' && (grant.protected || hasCustomRestrictions(grant))) return false;
      return true;
    });
  }, [grants, accountSearch, accountFilter]);

  const loadAccess = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(apiUrl('/api/scorm/access'), { headers });
      setGrants(res.data?.grants || []);
      setPendingRequests(res.data?.pendingRequests || []);
      setSuperAdminEmail(res.data?.superAdminEmail || 'tadsehimanshu@gmail.com');
      setAdminContact(res.data?.adminContact || 'tadsehimanshu@gmail.com');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load SCORM AI access control data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccess();
  }, [token]);

  const approveRequest = async (request) => {
    setApprovingId(request.id);
    setError('');
    setMessage('');
    try {
      await axios.post(apiUrl(`/api/scorm/access/requests/${request.id}/approve`), {}, { headers });
      setMessage(`${request.email} is approved. You can now configure course, learner and feature limits for this account.`);
      await loadAccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not approve this SCORM AI registration.');
    } finally {
      setApprovingId(null);
    }
  };

  const saveEntitlement = async (grant, patch) => {
    setSavingGrantId(grant.id);
    setError('');
    setMessage('');
    try {
      const res = await axios.patch(apiUrl(`/api/scorm/access/${grant.id}/entitlement`), patch, { headers });
      const updated = res.data?.grant;
      if (updated) setGrants((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage(`Restrictions updated for ${grant.email}. Changes are enforced server-side immediately.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save account restrictions.');
    } finally {
      setSavingGrantId(null);
    }
  };

  const removeAccess = async (grant) => {
    if (grant.protected) return;
    if (!window.confirm(`Remove SCORM AI access for ${grant.email}? Their existing SCORM AI session will stop working on the next protected request.`)) return;
    setRemovingId(grant.id);
    setError('');
    setMessage('');
    try {
      await axios.delete(apiUrl(`/api/scorm/access/${grant.id}`), { headers });
      setMessage(`${grant.email} is no longer authorised. Their registered account is back in Pending Registrations and can be approved again later.`);
      if (expandedGrantId === grant.id) setExpandedGrantId(null);
      await loadAccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not remove SCORM AI access.');
    } finally {
      setRemovingId(null);
    }
  };

  const authMethodLabel = (method) => {
    if (method === 'google') return 'Google';
    if (method === 'mixed') return 'Google + password';
    return 'Email + password';
  };

  const jumpToAccount = (value) => {
    const nextId = value === '' ? null : Number(value) || value;
    setExpandedGrantId(nextId);
    if (!nextId) return;
    requestAnimationFrame(() => {
      document.getElementById(`access-account-${nextId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-[1180px] mx-auto">
      <section className="rounded-3xl overflow-hidden border border-[#263950] bg-[#050a12] shadow-[0_24px_60px_rgba(0,0,0,.28)]">
        <div className="px-5 py-5 md:px-7 md:py-6 border-b border-[#263950] bg-[radial-gradient(circle_at_92%_0%,rgba(59,130,246,.14),transparent_35%),linear-gradient(135deg,#0b1728,#07111f)] flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <div className="text-[#60a5fa] text-[9px] uppercase tracking-[.16em] font-semibold">Super administrator</div>
            <h1 className="mt-2 font-bold text-[#f8fafc] text-3xl md:text-4xl leading-none tracking-[-.035em]">SCORM AI Access Control</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#aebed1]">
              Approve accounts, set course and learner limits, and control access to authoring, publishing, previews, learner management, tracking, reports, the library and the content editor.
            </p>
          </div>
          <button type="button" onClick={loadAccess} disabled={loading} className="scorm-button-secondary min-h-10 px-3.5 text-[10px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="p-5 md:p-7 grid gap-5">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="border border-[#263950] rounded-2xl bg-[#07111f] p-4">
              <div className="w-9 h-9 rounded-xl bg-[#2563eb] text-white grid place-items-center"><ShieldCheck size={17} /></div>
              <div className="mt-3 text-[#60a5fa] text-[8px] uppercase tracking-[.12em] font-semibold">Protected super admin</div>
              <div className="mt-1 text-[#f1f5f9] text-sm font-semibold break-all">{superAdminEmail}</div>
              <div className="mt-1 text-[#71839c] text-[8px] uppercase tracking-[.08em]">Unlimited access</div>
            </div>
            <div className="border border-[#263950] rounded-2xl bg-[#07111f] p-4">
              <div className="w-9 h-9 rounded-xl border border-[#315a8b] text-[#93c5fd] grid place-items-center"><Clock3 size={17} /></div>
              <div className="mt-3 text-[#8295ae] text-[8px] uppercase tracking-[.12em] font-semibold">Pending registrations</div>
              <div className="mt-1 text-[#f8fafc] text-3xl font-bold">{pendingRequests.length}</div>
            </div>
            <div className="border border-[#263950] rounded-2xl bg-[#07111f] p-4">
              <div className="w-9 h-9 rounded-xl border border-[#315a8b] text-[#93c5fd] grid place-items-center"><UserCheck size={17} /></div>
              <div className="mt-3 text-[#8295ae] text-[8px] uppercase tracking-[.12em] font-semibold">Authorised accounts</div>
              <div className="mt-1 text-[#f8fafc] text-3xl font-bold">{grants.length}</div>
            </div>
          </div>

          {message && <div className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 rounded-xl px-4 py-3 text-xs">{message}</div>}
          {error && <div className="border border-rose-500/30 bg-rose-500/10 text-rose-200 rounded-xl px-4 py-3 text-xs">{error}</div>}

          <section className="border border-[#29405f] rounded-2xl overflow-hidden bg-[#07111f]">
            <div className="px-4 py-4 md:px-5 border-b border-[#29405f] bg-[#0a1626] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="text-[#60a5fa] text-[8px] uppercase tracking-[.13em] font-semibold">Waiting for your approval</div>
                <div className="mt-1 text-[#f8fafc] text-xl font-semibold">Pending Registrations</div>
                <div className="mt-1 text-[#8295ae] text-xs">Only accounts that have actually registered or attempted Google Sign-In appear here. Approving one unlocks that existing identity.</div>
              </div>
              <div className="px-2.5 py-1.5 rounded-lg border border-[#315a8b] bg-[#08182b] text-[#b8c7da] text-[9px] font-semibold">{pendingRequests.length} pending</div>
            </div>

            {loading ? (
              <div className="p-10 text-center text-[#8295ae] text-sm">Loading registrations…</div>
            ) : pendingRequests.length === 0 ? (
              <div className="p-9 text-center">
                <CheckCircle2 size={26} className="mx-auto text-emerald-400" />
                <div className="mt-3 text-[#dce7f5] font-semibold">No registrations are waiting for approval.</div>
                <div className="mt-1 text-[#71839c] text-xs">New registration attempts will appear here automatically.</div>
              </div>
            ) : (
              <div className="divide-y divide-[#22324a]">
                {pendingRequests.map((request) => (
                  <div key={request.id} className="px-4 py-4 md:px-5 grid xl:grid-cols-[minmax(0,1.25fr)_170px_190px_auto] gap-3 xl:items-center hover:bg-[#0b1728] transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[#f1f5f9] font-semibold text-sm">{request.username || 'SCORM AI user'}</span>
                        <span className="px-2 py-1 rounded-md border border-blue-400/30 bg-blue-500/10 text-blue-300 text-[8px] uppercase tracking-[.1em] font-semibold">Pending</span>
                      </div>
                      <div className="mt-1 text-[#b8c7da] text-xs break-all">{request.email}</div>
                    </div>
                    <div>
                      <div className="text-[#71839c] text-[8px] uppercase tracking-[.1em]">Registered with</div>
                      <div className="mt-1 text-[#dce7f5] text-xs font-semibold inline-flex items-center gap-1.5"><LogIn size={12} /> {authMethodLabel(request.authMethod)}</div>
                    </div>
                    <div>
                      <div className="text-[#71839c] text-[8px] uppercase tracking-[.1em]">Last request</div>
                      <div className="mt-1 text-[#dce7f5] text-xs">{request.requestedAt ? new Date(request.requestedAt).toLocaleString() : '—'}</div>
                    </div>
                    <div className="flex xl:justify-end">
                      <button
                        type="button"
                        onClick={() => approveRequest(request)}
                        disabled={approvingId === request.id}
                        className="scorm-button-primary min-h-10 px-4 text-[10px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <UserPlus size={14} /> {approvingId === request.id ? 'Approving…' : 'Approve access'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="border border-[#29405f] rounded-2xl overflow-hidden bg-[#07111f]">
            <div className="px-4 py-4 md:px-5 border-b border-[#29405f] bg-[#0a1626]">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                  <div className="text-[#60a5fa] text-[8px] uppercase tracking-[.13em] font-semibold">Approved identities</div>
                  <div className="mt-1 text-[#f8fafc] font-semibold">Accounts, limits & permissions</div>
                  <div className="mt-1 text-[#8295ae] text-xs">Search for an account, then expand only the user you want to manage.</div>
                </div>
                <div className="text-[#8295ae] text-[9px]">{loading ? 'Loading…' : `${filteredGrants.length} of ${grants.length} account${grants.length === 1 ? '' : 's'}`}</div>
              </div>

              <div className="mt-4 grid lg:grid-cols-[minmax(0,1.5fr)_210px_260px] gap-2.5">
                <label className="relative min-w-0">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71839c] pointer-events-none" />
                  <input
                    type="search"
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                    placeholder="Search by email address"
                    className="w-full min-h-10 rounded-lg border border-[#29405f] bg-[#07111f] pl-9 pr-3 text-xs text-[#f8fafc] outline-none focus:border-[#60a5fa]"
                  />
                </label>

                <select
                  value={accountFilter}
                  onChange={(e) => setAccountFilter(e.target.value)}
                  className="min-h-10 rounded-lg border border-[#29405f] bg-[#07111f] px-3 text-xs text-[#f8fafc] outline-none focus:border-[#60a5fa]"
                >
                  <option value="all">All accounts</option>
                  <option value="users">Users only</option>
                  <option value="restricted">Restricted accounts</option>
                  <option value="unrestricted">Unrestricted users</option>
                  <option value="super_admin">Super admin</option>
                </select>

                <select
                  value={expandedGrantId == null ? '' : String(expandedGrantId)}
                  onChange={(e) => jumpToAccount(e.target.value)}
                  className="min-h-10 rounded-lg border border-[#29405f] bg-[#07111f] px-3 text-xs text-[#f8fafc] outline-none focus:border-[#60a5fa]"
                >
                  <option value="">Jump to account…</option>
                  {filteredGrants.map((grant) => (
                    <option key={grant.id} value={grant.id}>{grant.email}</option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="p-10 text-center text-[#8295ae] text-sm">Loading authorised accounts…</div>
            ) : grants.length === 0 ? (
              <div className="p-10 text-center text-[#8295ae] text-sm">No access grants found.</div>
            ) : filteredGrants.length === 0 ? (
              <div className="p-10 text-center">
                <Search size={24} className="mx-auto text-[#71839c]" />
                <div className="mt-3 text-[#dce7f5] font-semibold">No matching accounts.</div>
                <div className="mt-1 text-[#71839c] text-xs">Try a different email or account filter.</div>
              </div>
            ) : (
              <div className="divide-y divide-[#22324a] max-h-[680px] overflow-y-auto">
                {filteredGrants.map((grant) => {
                  const expanded = expandedGrantId === grant.id;
                  const restricted = hasCustomRestrictions(grant);
                  return (
                    <div id={`access-account-${grant.id}`} key={grant.id} className="px-4 py-3.5 md:px-5 hover:bg-[#0b1728] transition-colors">
                      <div className="grid lg:grid-cols-[minmax(0,1fr)_130px_200px_auto] gap-3 lg:items-center">
                        <button
                          type="button"
                          onClick={() => setExpandedGrantId(expanded ? null : grant.id)}
                          className="min-w-0 text-left group"
                          aria-expanded={expanded}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[#f1f5f9] font-semibold text-sm break-all group-hover:text-[#93c5fd] transition-colors">{grant.email}</span>
                            {grant.protected && <span className="px-2 py-1 rounded-md border border-blue-400/30 bg-blue-500/10 text-blue-300 text-[8px] uppercase tracking-[.1em] font-semibold">Protected</span>}
                            {!grant.protected && restricted && <span className="px-2 py-1 rounded-md border border-amber-400/30 bg-amber-500/10 text-amber-300 text-[8px] uppercase tracking-[.1em] font-semibold">Restricted</span>}
                          </div>
                          <div className="mt-1 text-[#71839c] text-[9px]">
                            {grant.usage?.courses || 0} courses · {grant.usage?.learners || 0} learners
                          </div>
                        </button>

                        <div>
                          <div className="text-[#71839c] text-[8px] uppercase tracking-[.1em]">Role</div>
                          <div className="mt-1 text-[#dce7f5] text-xs font-semibold">{grant.role === 'super_admin' ? 'Super Admin' : 'User'}</div>
                        </div>

                        <div>
                          <div className="text-[#71839c] text-[8px] uppercase tracking-[.1em]">Approved</div>
                          <div className="mt-1 text-[#dce7f5] text-xs">{grant.createdAt ? new Date(grant.createdAt).toLocaleString() : '—'}</div>
                        </div>

                        <div className="flex flex-wrap lg:justify-end gap-2">
                          {!grant.protected && (
                            <button
                              type="button"
                              onClick={() => removeAccess(grant)}
                              disabled={removingId === grant.id}
                              className="min-h-9 px-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-[9px] font-semibold inline-flex items-center gap-2 hover:border-rose-400/50 hover:text-rose-200 disabled:opacity-50"
                            >
                              <Trash2 size={13} /> {removingId === grant.id ? 'Removing…' : 'Remove'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setExpandedGrantId(expanded ? null : grant.id)}
                            className="scorm-button-secondary min-h-9 px-3 text-[9px] font-semibold inline-flex items-center gap-2"
                          >
                            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            {expanded ? 'Hide' : grant.protected ? 'View' : 'Manage'}
                          </button>
                        </div>
                      </div>

                      {expanded && (
                        <EntitlementEditor
                          grant={grant}
                          onSave={saveEntitlement}
                          saving={savingGrantId === grant.id}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="border border-[#29405f] rounded-xl bg-[#07111f] px-4 py-3 text-[#8295ae] text-xs leading-relaxed">
            Signed in as <span className="text-[#dce7f5]">{user?.email || superAdminEmail}</span>. Limits and disabled capabilities are enforced by the server, so users cannot bypass them by calling the API directly.
          </div>
        </div>
      </section>
    </div>
  );
}
