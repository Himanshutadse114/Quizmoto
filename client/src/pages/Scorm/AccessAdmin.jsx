import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  CheckCircle2,
  Clock3,
  LogIn,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

export default function AccessAdmin() {
  const { token, user } = useAuth();
  const [grants, setGrants] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [superAdminEmail, setSuperAdminEmail] = useState('tadsehimanshu@gmail.com');
  const [adminContact, setAdminContact] = useState('tadsehimanshu@gmail.com');
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

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
      setMessage(`${request.email} is approved. They can now sign in with the same credentials they already registered.`);
      await loadAccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not approve this SCORM AI registration.');
    } finally {
      setApprovingId(null);
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

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-[1180px] mx-auto">
      <section className="rounded-3xl overflow-hidden border border-[#263950] bg-[#050a12] shadow-[0_24px_60px_rgba(0,0,0,.28)]">
        <div className="px-5 py-5 md:px-7 md:py-6 border-b border-[#263950] bg-[radial-gradient(circle_at_92%_0%,rgba(59,130,246,.14),transparent_35%),linear-gradient(135deg,#0b1728,#07111f)] flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <div className="text-[#60a5fa] text-[9px] uppercase tracking-[.16em] font-semibold">Super administrator</div>
            <h1 className="mt-2 font-bold text-[#f8fafc] text-3xl md:text-4xl leading-none tracking-[-.035em]">SCORM AI Access Control</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#aebed1]">
              Users register first and remain pending until you approve their captured identity. Once approved, they sign in with the same password or Google account they originally used—no activation code and no second registration.
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
              <div className="mt-1 text-[#71839c] text-[8px] uppercase tracking-[.08em]">Google Sign-In only</div>
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
            <div className="px-4 py-3.5 border-b border-[#29405f] flex items-center justify-between gap-3 bg-[#0a1626]">
              <div>
                <div className="text-[#60a5fa] text-[8px] uppercase tracking-[.13em] font-semibold">Approved identities</div>
                <div className="mt-1 text-[#f8fafc] font-semibold">SCORM AI allowlist</div>
              </div>
              <div className="text-[#8295ae] text-[9px]">{loading ? 'Loading…' : `${grants.length} account${grants.length === 1 ? '' : 's'}`}</div>
            </div>

            {loading ? (
              <div className="p-10 text-center text-[#8295ae] text-sm">Loading authorised accounts…</div>
            ) : grants.length === 0 ? (
              <div className="p-10 text-center text-[#8295ae] text-sm">No access grants found.</div>
            ) : (
              <div className="divide-y divide-[#22324a]">
                {grants.map((grant) => (
                  <div key={grant.id} className="px-4 py-4 grid lg:grid-cols-[minmax(0,1fr)_150px_190px_auto] gap-3 lg:items-center hover:bg-[#0b1728] transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[#f1f5f9] font-semibold text-sm break-all">{grant.email}</span>
                        {grant.protected && <span className="px-2 py-1 rounded-md border border-blue-400/30 bg-blue-500/10 text-blue-300 text-[8px] uppercase tracking-[.1em] font-semibold">Protected</span>}
                      </div>
                      <div className="mt-1 text-[#71839c] text-[8px] uppercase tracking-[.08em]">Approved by {grant.addedByEmail || 'system'}</div>
                    </div>
                    <div>
                      <div className="text-[#71839c] text-[8px] uppercase tracking-[.1em]">Role</div>
                      <div className="mt-1 text-[#dce7f5] text-xs font-semibold">{grant.role === 'super_admin' ? 'Super Admin' : 'User'}</div>
                    </div>
                    <div>
                      <div className="text-[#71839c] text-[8px] uppercase tracking-[.1em]">Approved</div>
                      <div className="mt-1 text-[#dce7f5] text-xs">{grant.createdAt ? new Date(grant.createdAt).toLocaleString() : '—'}</div>
                    </div>
                    <div className="flex lg:justify-end">
                      {grant.protected ? (
                        <span className="text-[#71839c] text-[8px] uppercase tracking-[.08em]">Cannot remove</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => removeAccess(grant)}
                          disabled={removingId === grant.id}
                          className="min-h-9 px-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-[9px] font-semibold inline-flex items-center gap-2 hover:border-rose-400/50 hover:text-rose-200 disabled:opacity-50"
                        >
                          <Trash2 size={13} /> {removingId === grant.id ? 'Removing…' : 'Remove access'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="border border-[#29405f] rounded-xl bg-[#07111f] px-4 py-3 text-[#8295ae] text-xs leading-relaxed">
            Signed in as <span className="text-[#dce7f5]">{user?.email || superAdminEmail}</span>. Pending users are told that their registration is captured and to contact <span className="text-[#60a5fa]">{adminContact}</span>. After approval, they use the same credentials they registered originally.
          </div>
        </div>
      </section>
    </div>
  );
}
