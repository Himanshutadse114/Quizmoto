import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { KeyRound, MailPlus, RefreshCw, ShieldCheck, Trash2, UserCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

export default function AccessAdmin() {
  const { token, user } = useAuth();
  const [email, setEmail] = useState('');
  const [grants, setGrants] = useState([]);
  const [superAdminEmail, setSuperAdminEmail] = useState('tadsehimanshu@gmail.com');
  const [adminContact, setAdminContact] = useState('tadsehimanshu@gmail.com');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      setSuperAdminEmail(res.data?.superAdminEmail || 'tadsehimanshu@gmail.com');
      setAdminContact(res.data?.adminContact || 'tadsehimanshu@gmail.com');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load SCORM AI access list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccess();
  }, [token]);

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
      setMessage(`${nextEmail} can now access SCORM AI.`);
      await loadAccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add SCORM AI access.');
    } finally {
      setSaving(false);
    }
  };

  const removeAccess = async (grant) => {
    if (grant.protected) return;
    if (!window.confirm(`Remove SCORM AI access for ${grant.email}? Existing SCORM AI sessions will be revoked on the next protected request.`)) return;
    setRemovingId(grant.id);
    setError('');
    setMessage('');
    try {
      await axios.delete(apiUrl(`/api/scorm/access/${grant.id}`), { headers });
      setGrants((current) => current.filter((item) => item.id !== grant.id));
      setMessage(`${grant.email} no longer has SCORM AI access.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not remove SCORM AI access.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-[1180px] mx-auto">
      <section className="border border-[#6d4a29] rounded-xl overflow-hidden bg-[#2c1b0e] shadow-[0_24px_60px_rgba(12,7,3,.18)]">
        <div className="px-5 py-5 md:px-7 md:py-6 border-b border-[#604024] bg-[linear-gradient(135deg,#472b16,#332012)] flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <div className="text-[#ffc45c] font-mono text-[9px] uppercase tracking-[.16em]">Super administrator</div>
            <h1 className="mt-2 font-black text-[#f8edd4] text-4xl md:text-5xl leading-none tracking-[-.025em]">SCORM AI Access Control</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#d0ad80]">
              Only approved email addresses can authenticate to SCORM AI. Approved users may use Google Sign-In or create a password account with the same email address.
            </p>
          </div>
          <button type="button" onClick={loadAccess} disabled={loading} className="min-h-10 px-3.5 rounded-lg border border-[#765033] bg-[#2a1a10] text-[#efcf9e] font-mono text-[10px] font-semibold inline-flex items-center justify-center gap-2 hover:border-[#ff941f] disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh list
          </button>
        </div>

        <div className="p-5 md:p-7 grid gap-5">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="border border-[#714b2c] rounded-lg bg-[#24170e] p-4">
              <div className="w-9 h-9 rounded-lg bg-[#ff941f] text-[#241307] grid place-items-center"><ShieldCheck size={17} /></div>
              <div className="mt-3 text-[#ffc45c] font-mono text-[8px] uppercase tracking-[.12em]">Protected super admin</div>
              <div className="mt-1 text-[#f8edd4] text-sm font-bold break-all">{superAdminEmail}</div>
            </div>
            <div className="border border-[#714b2c] rounded-lg bg-[#24170e] p-4">
              <div className="w-9 h-9 rounded-lg border border-[#8d6036] text-[#ffc45c] grid place-items-center"><UserCheck size={17} /></div>
              <div className="mt-3 text-[#b98e60] font-mono text-[8px] uppercase tracking-[.12em]">Authorised accounts</div>
              <div className="mt-1 text-[#f8edd4] text-3xl font-black">{grants.length}</div>
            </div>
            <div className="border border-[#714b2c] rounded-lg bg-[#24170e] p-4">
              <div className="w-9 h-9 rounded-lg border border-[#8d6036] text-[#ffc45c] grid place-items-center"><KeyRound size={17} /></div>
              <div className="mt-3 text-[#b98e60] font-mono text-[8px] uppercase tracking-[.12em]">Signed in as</div>
              <div className="mt-1 text-[#f8edd4] text-sm font-bold break-all">{user?.email || superAdminEmail}</div>
            </div>
          </div>

          <form onSubmit={addAccess} className="border border-[#765033] rounded-xl bg-[#352214] p-4 md:p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[linear-gradient(180deg,#ffc05c,#ff941f)] text-[#2b1606] grid place-items-center shrink-0"><MailPlus size={18} /></div>
              <div className="min-w-0 flex-1">
                <div className="text-[#f8edd4] font-bold">Authorise another account</div>
                <div className="mt-1 text-[#b98e60] text-xs leading-relaxed">Add the exact email address the user will use with Google or SCORM AI registration.</div>
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
                {saving ? 'Adding…' : 'Add access'}
              </button>
            </div>
          </form>

          {message && <div className="border border-[#59c97d]/35 bg-[#59c97d]/10 text-[#bfe9c9] rounded-lg px-4 py-3 text-xs">{message}</div>}
          {error && <div className="border border-[#ff8071]/40 bg-[#ff8071]/10 text-[#ffd0c7] rounded-lg px-4 py-3 text-xs">{error}</div>}

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
                      <div className="mt-1 text-[#8f6b48] font-mono text-[8px] uppercase tracking-[.08em]">Added by {grant.addedByEmail || 'system'}</div>
                    </div>
                    <div>
                      <div className="text-[#92704d] font-mono text-[7px] uppercase tracking-[.1em]">Role</div>
                      <div className="mt-1 text-[#e5c69b] text-xs font-semibold">{grant.role === 'super_admin' ? 'Super Admin' : 'User'}</div>
                    </div>
                    <div>
                      <div className="text-[#92704d] font-mono text-[7px] uppercase tracking-[.1em]">Authorised</div>
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
                          <Trash2 size={13} /> {removingId === grant.id ? 'Removing…' : 'Remove'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="text-[#98724d] text-xs leading-relaxed">
            Users without an approved email are shown: “Your account does not have access to SCORM AI. Please contact the administrator at <span className="text-[#e9c89b]">{adminContact}</span>.”
          </div>
        </div>
      </section>
    </div>
  );
}
