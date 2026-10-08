import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, DatabaseZap, LoaderCircle, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

const CONFIRMATION = 'DELETE ALL COURSES AND PUBLICA';

export default function PlatformDataPurgePanel() {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const ready = confirmation === CONFIRMATION && acknowledged && !busy;

  const purge = async () => {
    if (!ready) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const response = await axios.post(apiUrl('/api/scorm/access/purge-learning-content'), {
        confirmation,
        acknowledgeIrreversible: true
      }, { headers });
      setResult(response.data);
      setOpen(false);
      setConfirmation('');
      setAcknowledged(false);
    } catch (err) {
      setResult(err.response?.data?.result || null);
      setError(err.response?.data?.message || 'The platform purge could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="platform-admin-section px-4 py-6 md:px-8 md:py-8 max-w-[1280px] mx-auto">
      <section className="rounded-2xl border border-rose-500/35 bg-rose-500/[.035] overflow-hidden">
        <div className="platform-panel-body p-5 md:p-6 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 text-rose-400 text-[9px] uppercase tracking-[.15em] font-semibold"><ShieldAlert size={14} /> Irreversible platform operation</div>
            <h1 className="mt-2 text-xl md:text-2xl font-semibold tracking-[-.02em]">Delete every course and Publica</h1>
            <p className="mt-2 text-xs leading-relaxed opacity-65">Permanently deletes courses and SCORM packages, Publica publications, assignments, learner tracking, reader analytics, campaign links, and their stored files across every account and tenant.</p>
            <p className="mt-2 text-[10px] leading-relaxed text-amber-400/90">Tenant accounts, users, permissions, quotas, campaigns, email templates, and standalone videos are not deleted. AI-generation credit history is preserved.</p>
          </div>
          <button type="button" onClick={() => { setOpen(true); setError(''); setResult(null); }} disabled={busy} className="min-h-11 px-4 rounded-xl border border-rose-500/45 bg-rose-500/10 text-rose-300 text-xs font-semibold inline-flex items-center justify-center gap-2 hover:bg-rose-500/20 disabled:opacity-50"><DatabaseZap size={16} /> Delete all courses &amp; Publica</button>
        </div>

        {open && <div className="border-t border-rose-500/25 p-5 md:p-6 bg-black/10">
          <div className="max-w-2xl">
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[.06] p-3.5 text-xs leading-relaxed text-amber-200"><AlertTriangle size={18} className="shrink-0 mt-0.5" /><span>This cannot be undone. Any active course generation will be stopped, and matching course/Publica objects will also be removed from R2.</span></div>
            <label className="block mt-4 text-[10px] font-semibold">Type <span className="text-rose-300 select-all">{CONFIRMATION}</span> to continue
              <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} autoComplete="off" spellCheck="false" className="mt-2 w-full min-h-11 rounded-xl border border-rose-500/30 bg-transparent px-3 text-xs outline-none focus:border-rose-400 disabled:opacity-50" />
            </label>
            <label className="mt-3 flex items-start gap-2.5 text-[10px] leading-relaxed cursor-pointer"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} disabled={busy} className="mt-0.5 accent-rose-500" /><span>I understand this permanently removes learning content and learner evidence from every account and tenant.</span></label>
            {error && <div className="mt-3 text-xs text-rose-400">{error}</div>}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => { setOpen(false); setConfirmation(''); setAcknowledged(false); setError(''); }} disabled={busy} className="scorm-button-secondary min-h-10 px-4 text-[10px] font-semibold disabled:opacity-50">Cancel</button>
              <button type="button" onClick={purge} disabled={!ready} className="min-h-10 px-4 rounded-xl bg-rose-600 text-white text-[10px] font-semibold inline-flex items-center gap-2 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed">{busy ? <LoaderCircle size={14} className="animate-spin" /> : <DatabaseZap size={14} />}{busy ? 'Deleting across all tenants…' : 'Permanently delete everything'}</button>
            </div>
          </div>
        </div>}
      </section>

      {result && <div className={`mt-4 rounded-xl border p-4 text-xs ${result.ok ? 'border-emerald-500/30 bg-emerald-500/[.05] text-emerald-300' : 'border-amber-500/30 bg-amber-500/[.05] text-amber-300'}`}>
        <div className="font-semibold">{result.ok ? 'Platform learning content deleted' : 'Database deleted; R2 cleanup needs another run'}</div>
        <div className="mt-1 opacity-75">Removed {result.counts?.courses ?? 0} courses, {result.counts?.packages ?? 0} packages, {result.counts?.publications ?? 0} Publica publications, and {result.storageObjectsDeleted ?? 0} stored objects.</div>
      </div>}
    </div>
  );
}
