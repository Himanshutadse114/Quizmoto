import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  CheckCircle2,
  Clock3,
  LogIn,
  MailPlus,
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
  const [email, setEmail] = useState('');
  const [grants, setGrants] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [superAdminEmail, setSuperAdminEmail] = useState('tadsehimanshu@gmail.com');
  const [adminContact, setAdminContact] = useState('tadsehimanshu@gmail.com');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  const addAccess = async (event) => {
    event.preventDefault();
    const nextEmail = email.trim().toLowerCase();
    if (!nextEmail) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await axios.post(apiUrl('/api/scorm/access'), { email: nextEmail }, { headers });
      setEmail('');
      setMessage(`${nextEmail} has been authorised for SCORM AI.`);
      await loadAccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add SCORM AI access.');
    } finally {
      setSaving(false);
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
      setMessage(`${grant.email} is no longer authorised. If they previously registered, their account is back in Pending Registrations.`);
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
      <section className="border border-[#6d4a29] rounded-xl overflow-hidden bg-[#2c1b0e] shadow-[0_24px_60px_rgba(12,7,3,.18)]">
        <div className="px-5 py-5 md:px-7 md:py-6 border-b border-[#604024] bg-[linear-gradient(135deg,#472b16,#332012)] flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <div className="text-[#ffc45c] font-mono text-[9px] uppercase tracking-[.16em]">Super administrator</div>
            <h1 className="mt-2 font-black text-[#f8edd4] text-4xl md:text-5xl leading-none tracking-[-.025em]">SCORM AI Access Control</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#d0ad80]">
              Users register first. Their account details are stored but access stays pending until you approve them. Once approved, they sign in with the same password or Google account they originally used—no activation code is required.
            </p>
          </div>
          <button type="button" onClick={loadAccess} disabled={loading} className="min-h-10 px-3.5 rounded-lg border border-[#765033] bg-[#2a1a10] text-[#efcf9e] font-mono text-[10px] font-semibold inline-flex items-center justify-center gap-2 hover:border-[#ff941f] disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="p-5 md:p-7 grid gap-5">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="border border-[#714b2c] rounded-lg bg-[#24170e] p-4">
              <div className="w-9 h-9 rounded-lg bg-[#ff941f] text-[#241307] grid place-items-center"><ShieldCheck size={17} /></div>
              <div className="mt-3 text-[#ffc45c] font-mono text-[8px] uppercase tracking-[.12em]">Protected super admin</div>
              <div className="mt-1 text-[#f8edd4] text-sm font-bold break-all">{superAdminEmail}</div>
              <div className="mt-1 text-[#99724e] font-mono text-[7px] uppercase tracking-[.08em]">Google Sign-In only</div>
            </div>
            <div className="border border-[#714b2c] rounded-lg bg-[#24170e] p-4">
              <div className="w-9 h-9 rounded-lg border border-[#c57b31] text-[#ffc45c] grid place-items-center"><Clock3 size={17} /></div>
              <div className="mt-3 text-[#b98e60] font-mono text-[8px] uppercase tracking-[.12em]">Pending registrations</div>
              <div className="mt-1 text-[#f8edd4] text-3xl font-black">{pendingRequests.length}</div>
            </div>
            <div className="border border-[#714b2c] rounded-lg bg-[#24170e] p-4">
              <div className="w-9 h-9 rounded-lg border border-[#8d6036] text-[#ffc45c] grid place-items-center"><UserCheck size={17} /></div>
              <div className="mt-3 text-[#b98e60] font-mono text-[8px] uppercase tracking-[.12em]">Authorised accounts</div>
              <div className="mt-1 text-[#f8edd4] text-3xl font-black">{grants.length}</div>
            </div>
          </div>

          {message && <div className="border border-[#59c97d]/35 bg-[#59c97d]/10 text-[#bfe9c9] rounded-lg px-4 py-3 text-xs">{message}</div>}
          {error && <div className="border border-[#ff8071]/40 bg-[#ff8071]/10 text-[#ffd0c7] rounded-lg px-4 py-3 text-xs">{error}</div>}

          <section className="border border-[#8b5a2d] rounded-xl overflow-hidden bg-[#2a1a10]">
            <div className="px-4 py-4 md:px-5 border-b border-[#6b4728] bg-[linear-gradient(135deg,#3b2514,#2e1c10)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="text-[#ffc45c] font-mono text-[8px] uppercase tracking-[.13em]">Waiting for your approval</div>
                <div className="mt-1 text-[#f8edd4] text-xl font-black">Pending Registrations</div>
                <div className="mt-1 text-[#ae8459] text-xs">These users already registered. Approval unlocks their existing credentials; it does not create a new password.</div>
              </div>
              <div className="px-2.5 py-1.5 rounded-md border border-[#7e552f] bg-[#25170d] text-[#d4ae7c] font-mono text-[9px]">{pendingRequests.length} pending</div>
            </div>

            {loading ? (
              <div className="p-10 text-center text-[#b58b5e] text-sm">Loading registrations…</div>
            ) : pendingRequests.length === 0 ? (
              <div className="p-9 text-center">
                <CheckCircle2 size={26} className="mx-auto text-[#69ca85]" />
                <div className="mt-3 text-[#e5c69b] font-semibold">No registrations are waiting for approval.</div>
                <div className="mt-1 text-[#8f6b48] text-xs">New registration attempts will appear here automatically.</div>
              </div>
            ) : (
              <div className="divide-y divide-[#5a3b23]">
                {pendingRequests.map((request) => (
                  <div key={request.id} className="px-4 py-4 md:px-5 grid xl:grid-cols-[minmax(0,1.25fr)_170px_190px_auto] gap-3 xl:items-center hover:bg-[#332013] transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[#f8edd4] font-semibold text-sm">{request.username || 'SCORM AI user'}</span>
                        <span className="px-2 py-1 rounded border border-[#d08a3f]/45 bg-[#ff941f]/10 text-[#ffc45c] font-mono text-[7px] uppercase tracking-[.1em]">Pending</span>
                      </div>
                      <div className="mt-1 text-[#d4b080] text-xs break-all">{request.email}</div>
                    </div>
                    <div>
                      <div className="text-[#92704d] font-mono text-[7px] uppercase tracking-[.1em]">Registered with</div>
                      <div className="mt-1 text-[#e5c69b] text-xs font-semibold inline-flex items-center gap-1.5"><LogIn size={12} /> {authMethodLabel(request.authMethod)}</div>
                    </div>
                    <div>
                      <div className="text-[#92704d] font-mono text-[7px] uppercase tracking-[.1em]">Last request</div>
                      <div className="mt-1 text-[#e5c69b] text-xs">{request.requestedAt ? new Date(request.requestedAt).toLocaleString() : '—'}</div>
                    </div>
                    <div className="flex xl:justify-end">
                      <button
                        type="button"
                        onClick={() => approveRequest(request)}
                        disabled={approvingId === request.id}
                        className="min-h-10 px-4 rounded-lg border border-[#ffb15f] bg-[linear-gradient(180deg,#ffb145,#ff941f)] text-[#241307] font-mono text-[9px] font-bold inline-flex items-center justify-center gap-2 shadow-[0_3px_0_#9c4b08] hover:translate-y-[2px] hover:shadow-[0_1px_0_#9c4b08] disabled:opacity-50"
                      >
                        <UserPlus size={14} /> {approvingId === request.id ? 'Approving…' : 'Approve access'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <form onSubmit={addAccess} className="border border-[#765033] rounded-xl bg-[#352214] p-4 md:p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[linear-gradient(180deg,#ffc05c,#ff941f)] text-[#2b1606] grid place-items-center shrink-0"><MailPlus size={18} /></div>
              <div className="min-w-0 flex-1">
                <div className="text-[#f8edd4] font-bold">Authorise an email in advance</div>
                <div className="mt-1 text-[#b98e60] text-xs leading-relaxed">Optional: approve an email before the user registers. If they register later with this exact email, their account can enter immediately.</div>
              </div>
            </div>
            <div className="mt-4 grid sm:grid-cols-[minmax(0,1fr)_auto] gap-2">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="person@company.com"
                required
                className="min-h-11 rounded-lg border border-[#694727] bg-[#1f140c] px-3.5 text-[#f8edd4] text-sm outline-none placeholder:text-[#7c5b3b] focus:border-[#ff941f] focus:ring-2 focus:ring-[#ff941f]/10"
              />
              <button disabled={saving} className="min-h-11 px-5 rounded-lg border border-[#ffb15f] bg-[linear-gradient(180deg,#ffb145,#ff941f)] text-[#241307] font-mono text-[10px] font-bold shadow-[0_3px_0_#9c4b08] hover:translate-y-[2px] hover:shadow-[0_1px_0_#9c4b08] disabled:opacity-50">
                {saving ? 'Authorising…' : 'Authorise email'}
              </button>
            </div>
          </form>

          <section className="border border-[#68472a] rounded-xl overflow-hidden bg-[#25180f]">
            <div className="px-4 py-3.5 border-b border-[#5d3d23] flex items-center justify-between gap-3 bg-[#2f1e12]">
              <div>
                <div className="text-[#ffc45c] font-mono text-[8px] uppercase tracking-[.13em]">Approved identities</div>
                <div className="mt-1 text-[#f8edd4] font-bold">SCORM AI allowlist</div>
              </div>
              <div className="text-[#9e7952] font-mono text-[9px]">{loading ? 'Loading…' : `${grants.length} account${grants.length === 1 ? '' : 's'}`}</div>
            </div>

            {loading ? (
              <div className="p-10 text-center text-[#b58b5e] text-sm">Loading authorised accounts…</div>
            ) : grants.length === 0 ? (
              <div className="p-10 text-center text-[#b58b5e] text-sm">No access grants found.</div>
            ) : (
              <div className="divide-y divide-[#52361f]">
                {grants.map((grant) => (
                  <div key={grant.id} className="px-4 py-4 grid lg:grid-cols-[minmax(0,1fr)_150px_190px_auto] gap-3 lg:items-center hover:bg-[#2d1d12] transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[#f8edd4] font-semibold text-sm break-all">{grant.email}</span>
                        {grant.protected && <span className="px-2 py-1 rounded border border-[#ff9e32]/45 bg-[#ff941f]/10 text-[#ffc45c] font-mono text-[7px] uppercase tracking-[.1em]">Protected</span>}
                      </div>
                      <div className="mt-1 text-[#8f6b48] font-mono text-[8px] uppercase tracking-[.08em]">Approved by {grant.addedByEmail || 'system'}</div>
                    </div>
                    <div>
                      <div className="text-[#92704d] font-mono text-[7px] uppercase tracking-[.1em]">Role</div>
                      <div className="mt-1 text-[#e5c69b] text-xs font-semibold">{grant.role === 'super_admin' ? 'Super Admin' : 'User'}</div>
                    </div>
                    <div>
                      <div className="text-[#92704d] font-mono text-[7px] uppercase tracking-[.1em]">Approved</div>
                      <div className="mt-1 text-[#e5c69b] text-xs">{grant.createdAt ? new Date(grant.createdAt).toLocaleString() : '—'}</div>
                    </div>
                    <div className="flex lg:justify-end">
                      {grant.protected ? (
                        <span className="text-[#9d7954] font-mono text-[8px] uppercase tracking-[.08em]">Cannot remove</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => removeAccess(grant)}
                          disabled={removingId === grant.id}
                          className="min-h-9 px-3 rounded-lg border border-[#7d4437] bg-[#3a2018] text-[#f0ae9e] font-mono text-[9px] font-semibold inline-flex items-center gap-2 hover:border-[#ff8071] hover:text-[#ffd0c7] disabled:opacity-50"
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

          <div className="border border-[#604126] rounded-lg bg-[#24170e] px-4 py-3 text-[#a77f55] text-xs leading-relaxed">
            Signed in as <span className="text-[#e9c89b]">{user?.email || superAdminEmail}</span>. Pending users are told that their registration is captured and to contact <span className="text-[#ffc45c]">{adminContact}</span>. After you approve them, they use the same credentials they registered originally.
          </div>
        </div>
      </section>
    </div>
  );
}
