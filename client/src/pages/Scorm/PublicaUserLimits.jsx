import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { RefreshCw, Search, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import { invalidateScormData } from '../../services/scormDataCache';
import './flipbooks.css';

const API = '/api/scorm/flipbooks';

export default function PublicaUserLimits() {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await axios.get(apiUrl(`${API}/admin/users`), { headers, params: query ? { q: query } : undefined });
      setUsers(res.data.users || []);
      const next = {};
      (res.data.users || []).forEach((item) => { next[item.id] = item.quota?.max === null ? '' : String(item.quota?.max ?? 2); });
      setDrafts(next);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load user Publica limits.');
    } finally { setLoading(false); }
  }, [headers, query]);

  useEffect(() => { const t = window.setTimeout(load, query ? 250 : 0); return () => window.clearTimeout(t); }, [load, query]);

  const save = async (item) => {
    const raw = drafts[item.id];
    if (raw !== '' && (!/^\d+$/.test(String(raw)) || !Number.isSafeInteger(Number(raw)))) {
      setError('Enter a whole number of zero or more, or leave the limit blank for unlimited.');
      return;
    }
    setSaving(item.id); setError(''); setMessage('');
    try {
      const maxFlipbooks = raw === '' ? null : Number(raw);
      await axios.patch(apiUrl(`${API}/admin/users/${item.id}/limit`), { maxFlipbooks }, { headers });
      invalidateScormData('flipbooks', token);
      await load();
      setMessage(`Publica allowance updated for ${item.username || item.email || 'this account'}.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update this user limit.');
    } finally { setSaving(null); }
  };

  return (
    <section className="flip-admin-panel publica-user-limits">
      <div className="flip-section-heading">
        <div><div className="flip-kicker"><ShieldCheck size={13} /> Super Admin</div><h2>User Publica limits</h2><p>Set how many publications each account can keep and share. Leave blank for unlimited.</p></div>
        <div className="flip-search scorm-search-shell"><Search size={14} /><input aria-label="Search Publica users" type="search" className="scorm-search-shell-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search user or email" /></div>
      </div>
      {error && <div className="flip-error" role="alert"><span>{error}</span> <button type="button" onClick={load} className="underline">Try again</button></div>}
      {message && <div className="flip-success" role="status">{message}</div>}
      {loading ? <div className="flip-admin-loading"><RefreshCw size={16} className="animate-spin" /> Loading users…</div> : (
        <div className="flip-user-list">
          {users.map((item) => (
            <div className="flip-user-row" key={item.id}>
              <div className="flip-user-avatar"><Users size={15} /></div>
              <div className="flip-user-info"><strong>{item.username || 'Platform user'}</strong><span>{item.email || 'No email'}</span></div>
              <div className="flip-user-usage">{item.quota?.used || 0} used</div>
              {item.isSuperAdmin ? <div className="flip-unlimited">Unlimited</div> : <>
                <input aria-label={`Publica limit for ${item.email || item.username || 'platform user'}`} type="number" min="0" step="1" value={drafts[item.id] ?? ''} disabled={saving !== null} onChange={(e) => setDrafts((current) => ({ ...current, [item.id]: e.target.value }))} placeholder="Unlimited" className="flip-limit-input" />
                <button type="button" aria-label={`Save Publica limit for ${item.email || item.username || 'platform user'}`} onClick={() => save(item)} disabled={saving !== null} className="flip-button-secondary">{saving === item.id ? 'Saving…' : 'Save'}</button>
              </>}
            </div>
          ))}
          {!users.length && <div className="flip-empty-inline">No matching platform users.</div>}
        </div>
      )}
    </section>
  );
}
