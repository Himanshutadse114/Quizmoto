import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Search, Trash2, Upload, UserPlus, Users, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function parseRosterText(text) {
  const seen = new Set();
  const learners = [];
  const lines = String(text || '').split(/\r?\n/);

  for (const line of lines) {
    const matches = line.match(EMAIL_RE) || [];
    for (const match of matches) {
      const email = normalizeEmail(match);
      if (!email || seen.has(email)) continue;
      seen.add(email);
      const beforeEmail = line.slice(0, line.toLowerCase().indexOf(match.toLowerCase()));
      const name = beforeEmail.replace(/[",;\t|]+/g, ' ').trim().replace(/\s+/g, ' ');
      learners.push({
        email,
        learnerName: /^(name|email|learner|employee)$/i.test(name) ? '' : name.slice(0, 255)
      });
    }
  }
  return learners;
}

export default function LearnerRoster() {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [roster, setRoster] = useState([]);
  const [query, setQuery] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [paste, setPaste] = useState('');
  const [mode, setMode] = useState('append');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(apiUrl('/api/scorm/roster'), { headers });
      setRoster(res.data?.roster || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load learner roster.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) load(); }, [token]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter((row) => `${row.learnerName || ''} ${row.email || ''}`.toLowerCase().includes(q));
  }, [roster, query]);

  const addOne = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!email.trim()) return setError('Enter a learner email address.');
    setSaving(true);
    try {
      await axios.post(apiUrl('/api/scorm/roster'), {
        email: email.trim(),
        learnerName: name.trim()
      }, { headers });
      setEmail('');
      setName('');
      setMessage('Learner added to the approved roster.');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to add learner.');
    } finally {
      setSaving(false);
    }
  };

  const importRows = async (rows) => {
    if (!rows.length) return setError('No valid email addresses were found.');
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await axios.put(apiUrl('/api/scorm/roster'), {
        mode,
        learners: rows
      }, { headers });
      const invalidCount = res.data?.invalid?.length || 0;
      setMessage(`${res.data?.accepted || rows.length} learner email${(res.data?.accepted || rows.length) === 1 ? '' : 's'} processed. ${res.data?.total || 0} approved learner${(res.data?.total || 0) === 1 ? '' : 's'} are now in the roster.${invalidCount ? ` ${invalidCount} invalid value${invalidCount === 1 ? '' : 's'} skipped.` : ''}`);
      setPaste('');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update learner roster.');
    } finally {
      setSaving(false);
    }
  };

  const importPaste = () => importRows(parseRosterText(paste));

  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      await importRows(parseRosterText(text));
    } catch (_) {
      setError('Unable to read that file. Upload a CSV or text file containing learner emails.');
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Remove ${row.email} from the approved learner roster?`)) return;
    setError('');
    try {
      await axios.delete(apiUrl(`/api/scorm/roster/${row.id}`), { headers });
      setRoster((current) => current.filter((item) => item.id !== row.id));
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to remove learner.');
    }
  };

  return (
    <div className="p-4 md:p-7 lg:p-9 max-w-6xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-7 pb-7 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
        <div className="max-w-3xl">
          <div className="scorm-micro text-[10px] uppercase font-semibold">Learner access</div>
          <h1 className="scorm-display text-[38px] md:text-[50px] mt-2">Approved learner roster</h1>
          <p className="text-sm mt-3 leading-relaxed" style={{ color: 'var(--scorm-ink-soft)' }}>
            Only email addresses in this roster can start courses from your public invite links. No OTP is required.
          </p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="scorm-button-secondary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {message && <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(52,211,153,.28)', background: 'rgba(52,211,153,.08)', color: 'var(--scorm-ink)' }}>{message}</div>}
      {error && <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(251,113,133,.3)', background: 'rgba(251,113,133,.08)', color: 'var(--scorm-ink)' }}>{error}</div>}

      <div className="grid lg:grid-cols-[.82fr_1.18fr] gap-5 mb-6">
        <section className="scorm-panel rounded-2xl border p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus size={17} />
            <h2 className="font-semibold">Add one learner</h2>
          </div>
          <form onSubmit={addOne} className="space-y-3">
            <div>
              <label className="scorm-micro block text-[9px] uppercase font-semibold mb-1.5">Name <span className="normal-case font-normal">optional</span></label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2.5 text-sm" placeholder="Learner name" />
            </div>
            <div>
              <label className="scorm-micro block text-[9px] uppercase font-semibold mb-1.5">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2.5 text-sm" placeholder="learner@company.com" />
            </div>
            <button type="submit" disabled={saving} className="scorm-button-primary px-4 py-2.5 text-xs font-semibold disabled:opacity-50">Add learner</button>
          </form>
        </section>

        <section className="scorm-panel rounded-2xl border p-5 md:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2"><Upload size={17} /><h2 className="font-semibold">Upload or sync roster</h2></div>
            <div className="flex rounded-lg border p-1" style={{ borderColor: 'var(--scorm-line)' }}>
              {['append', 'replace'].map((value) => (
                <button key={value} type="button" onClick={() => setMode(value)} className={`px-3 py-1.5 rounded-md text-[10px] font-semibold capitalize ${mode === value ? 'scorm-button-primary' : ''}`}>{value}</button>
              ))}
            </div>
          </div>
          <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--scorm-muted)' }}>
            Upload a CSV/TXT file or paste a list. A standard “Name, Email” CSV is supported. Replace mode makes the uploaded file the new authoritative roster.
          </p>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={6} className="w-full px-3 py-2.5 text-sm font-mono" placeholder={'Name,Email\nAsha,asha@company.com\nRahul,rahul@company.com'} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={saving || !paste.trim()} onClick={importPaste} className="scorm-button-primary px-4 py-2.5 text-xs font-semibold disabled:opacity-50">Import pasted list</button>
            <label className="scorm-button-secondary px-4 py-2.5 text-xs font-semibold cursor-pointer inline-flex items-center gap-2">
              <Upload size={13} /> Upload CSV/TXT
              <input type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={importFile} />
            </label>
          </div>
        </section>
      </div>

      <section className="scorm-panel rounded-2xl border overflow-hidden">
        <div className="p-4 md:p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: 'var(--scorm-line)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl grid place-items-center border" style={{ borderColor: 'var(--scorm-line)', color: 'var(--scorm-accent-strong)' }}><Users size={16} /></div>
            <div><div className="font-semibold">Approved learners</div><div className="scorm-micro text-[9px] mt-0.5">{roster.length} email{roster.length === 1 ? '' : 's'}</div></div>
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full pl-9 pr-3 py-2.5 text-xs" placeholder="Search name or email" />
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm" style={{ color: 'var(--scorm-muted)' }}>Loading approved learners…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Users size={24} className="mx-auto mb-3" style={{ color: 'var(--scorm-muted)' }} />
            <div className="font-semibold">{roster.length ? 'No learners match this search.' : 'No approved learners yet.'}</div>
            {!roster.length && <div className="text-xs mt-1" style={{ color: 'var(--scorm-muted)' }}>Invite links will reject learner access until at least one approved email is added.</div>}
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--scorm-line)' }}>
            {filtered.map((row) => (
              <div key={row.id} className="px-4 md:px-5 py-3.5 grid sm:grid-cols-[1fr_1.4fr_auto] gap-2 sm:items-center">
                <div className="min-w-0"><div className="text-sm font-semibold truncate">{row.learnerName || 'Learner'}</div><div className="scorm-micro text-[8px] uppercase mt-0.5">{row.source || 'manual'}</div></div>
                <div className="text-xs break-all" style={{ color: 'var(--scorm-ink-soft)' }}>{row.email}</div>
                <button type="button" onClick={() => remove(row)} className="justify-self-start sm:justify-self-end w-9 h-9 rounded-lg border grid place-items-center" style={{ borderColor: 'rgba(251,113,133,.28)', color: '#fb7185' }} aria-label={`Remove ${row.email}`}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
