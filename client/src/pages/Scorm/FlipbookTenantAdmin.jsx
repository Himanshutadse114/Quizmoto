import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { BookOpenCheck, Building2, RefreshCw, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

export default function FlipbookTenantAdmin() {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [tenants, setTenants] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await axios.get(apiUrl('/api/scorm/flipbook-tenants'), { headers });
      const rows = res.data?.tenants || [];
      setTenants(rows);
      const next = {};
      rows.forEach((tenant) => {
        next[tenant.id] = {
          enabled: tenant.quota?.enabled !== false,
          maxFlipbooks: tenant.quota?.max === null ? '' : String(tenant.quota?.max ?? 3)
        };
      });
      setDrafts(next);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load tenant Flipbook controls.');
    } finally { setLoading(false); }
  }, [headers]);

  useEffect(() => { load(); }, [load]);

  const save = async (tenant) => {
    const draft = drafts[tenant.id] || {};
    setSaving(tenant.id); setError(''); setMessage('');
    try {
      await axios.patch(apiUrl(`/api/scorm/flipbook-tenants/${tenant.id}`), {
        enabled: draft.enabled !== false,
        maxFlipbooks: draft.maxFlipbooks === '' ? null : Math.max(0, Math.floor(Number(draft.maxFlipbooks) || 0))
      }, { headers });
      setMessage(`${tenant.name} Flipbook controls updated.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update tenant Flipbook controls.');
    } finally { setSaving(''); }
  };

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-[1280px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-5">
        <div>
          <div className="text-[#4FC9BF] text-[9px] uppercase tracking-[.15em] font-semibold">Tenant content controls</div>
          <h1 className="mt-2 text-xl md:text-2xl font-semibold tracking-[-.02em]">Flipbook Management</h1>
          <p className="mt-2 text-xs max-w-3xl leading-relaxed" style={{ color: 'var(--scorm-muted)' }}>Control Flipbook availability and storage allowance for each tenant. Tenant usage is shared across its linked authors while personal free accounts keep their own allowance.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="scorm-button-secondary min-h-9 px-3 text-[10px] font-semibold inline-flex items-center gap-2"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      {message && <div className="mb-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-500">{message}</div>}
      {error && <div className="mb-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-xs text-rose-400">{error}</div>}

      {loading && !tenants.length ? <div className="scorm-panel min-h-[180px] rounded-2xl border grid place-items-center"><RefreshCw size={19} className="animate-spin opacity-50" /></div> : (
        <div className="grid gap-3">
          {tenants.map((tenant) => {
            const draft = drafts[tenant.id] || { enabled: true, maxFlipbooks: '3' };
            return (
              <section key={tenant.id} className="scorm-panel rounded-2xl border p-4 md:p-5">
                <div className="flex flex-col xl:flex-row xl:items-center gap-4">
                  <div className="flex items-center gap-3 min-w-0 xl:flex-1">
                    <div className="w-10 h-10 rounded-xl border grid place-items-center text-[#4FC9BF]"><Building2 size={17} /></div>
                    <div className="min-w-0"><div className="text-sm font-semibold truncate">{tenant.name}</div><div className="mt-1 text-[9px] opacity-50">{tenant.id}</div></div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 xl:w-[430px]">
                    <div className="rounded-xl border px-3 py-2.5"><div className="text-[8px] uppercase opacity-45">Used</div><div className="mt-1 text-base font-semibold">{tenant.quota?.used || 0}</div></div>
                    <div className="rounded-xl border px-3 py-2.5"><div className="text-[8px] uppercase opacity-45">Allowance</div><div className="mt-1 text-base font-semibold">{tenant.quota?.max === null ? 'Unlimited' : tenant.quota?.max ?? 3}</div></div>
                    <div className="rounded-xl border px-3 py-2.5 col-span-2 md:col-span-1"><div className="text-[8px] uppercase opacity-45">Published / total</div><div className="mt-1 text-base font-semibold"><BookOpenCheck size={13} className="inline mr-1.5" />{(tenant.flipbooks || []).filter((book) => book.status === 'published').length} / {(tenant.flipbooks || []).length}</div></div>
                  </div>
                  <div className="flex flex-wrap items-end gap-2 xl:justify-end">
                    <label className="block"><span className="text-[8px] uppercase opacity-45">Max Flipbooks</span><input type="number" min="0" value={draft.maxFlipbooks} onChange={(event) => setDrafts((current) => ({ ...current, [tenant.id]: { ...draft, maxFlipbooks: event.target.value } }))} placeholder="Unlimited" className="mt-1 w-28 h-9 rounded-lg border bg-transparent px-2.5 text-[10px] outline-none" /></label>
                    <button type="button" onClick={() => setDrafts((current) => ({ ...current, [tenant.id]: { ...draft, enabled: !draft.enabled } }))} className="scorm-button-secondary h-9 px-3 text-[10px] font-semibold inline-flex items-center gap-2">{draft.enabled ? <ToggleRight size={16} className="text-[#4FC9BF]" /> : <ToggleLeft size={16} />} {draft.enabled ? 'Enabled' : 'Disabled'}</button>
                    <button type="button" onClick={() => save(tenant)} disabled={saving === tenant.id} className="scorm-button-primary h-9 px-3 text-[10px] font-semibold inline-flex items-center gap-2 disabled:opacity-50"><Save size={12} /> {saving === tenant.id ? 'Saving…' : 'Save'}</button>
                  </div>
                </div>
                {(tenant.flipbooks || []).length > 0 && <div className="mt-4 pt-3 border-t flex flex-wrap gap-2">{tenant.flipbooks.slice(0, 12).map((book) => <span key={book.id} className="rounded-lg border px-2.5 py-1.5 text-[9px] opacity-70">{book.title} · {book.pageCount} pages · {book.viewCount} opens</span>)}{tenant.flipbooks.length > 12 && <span className="px-2 py-1.5 text-[9px] opacity-50">+{tenant.flipbooks.length - 12} more</span>}</div>}
              </section>
            );
          })}
          {!tenants.length && <div className="scorm-panel min-h-[160px] rounded-2xl border grid place-items-center text-xs opacity-55">No tenants are available.</div>}
        </div>
      )}
    </div>
  );
}
