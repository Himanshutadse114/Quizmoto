import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  BarChart3,
  BookOpenCheck,
  Copy,
  ExternalLink,
  Eye,
  FilePlus2,
  Gauge,
  Pencil,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Trash2,
  Users
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import './flipbooks.css';

const API = '/api/scorm/flipbooks';

function shareUrl(book) {
  return book?.sharePath ? apiUrl(book.sharePath) : '';
}

function QuotaCard({ quota }) {
  const max = quota?.max;
  const used = quota?.used || 0;
  const label = max === null ? `${used} used · Unlimited` : `${used} of ${max} used`;
  const pct = max === null || max === 0 ? (max === 0 ? 100 : 12) : Math.min(100, Math.round((used / max) * 100));
  return (
    <div className="flip-quota-card">
      <div className="flip-quota-icon"><Gauge size={18} /></div>
      <div className="min-w-0 flex-1">
        <div className="flip-kicker">Your allowance</div>
        <div className="flip-quota-value">{label}</div>
        <div className="flip-quota-track"><span style={{ width: `${pct}%` }} /></div>
      </div>
    </div>
  );
}

function FlipbookCard({ book, onDelete, onCopied }) {
  const published = book.status === 'published' && book.shareEnabled;
  const cover = book.coverPath ? apiUrl(book.coverPath) : '';
  const copy = async () => {
    if (!published) return;
    const url = shareUrl(book);
    try {
      await navigator.clipboard.writeText(url);
      onCopied(book.id);
    } catch (_) {}
  };
  const nativeShare = async () => {
    if (!published) return;
    const url = shareUrl(book);
    if (navigator.share) {
      try { await navigator.share({ title: book.title, url }); } catch (_) {}
    } else {
      await copy();
    }
  };

  return (
    <article className="flip-card">
      <div className="flip-cover-wrap">
        {cover ? <img src={cover} alt="" className="flip-cover" /> : <div className="flip-cover-placeholder"><BookOpenCheck size={34} /><span>{book.pageCount ? `${book.pageCount} pages` : 'Add pages'}</span></div>}
        <span className={`flip-status ${published ? 'is-published' : 'is-draft'}`}>{published ? 'Published' : 'Draft'}</span>
      </div>
      <div className="flip-card-body">
        <div className="min-w-0">
          <h3>{book.title}</h3>
          <p>{book.description || 'Interactive page-flipping publication'}</p>
        </div>
        <div className="flip-card-meta"><span>{book.pageCount} pages</span><span><Eye size={12} /> {book.viewCount || 0} reader opens</span></div>
        <div className="flip-card-actions">
          <Link to={`/scorm/flipbooks/${book.id}/edit`} className="flip-button-secondary"><Pencil size={14} /> Edit</Link>
          <Link to={`/scorm/flipbooks/${book.id}/analytics`} className="flip-button-secondary"><BarChart3 size={14} /> Analytics</Link>
          {published && <button type="button" className="flip-icon-button" onClick={copy} title="Copy share link"><Copy size={14} /></button>}
          {published && <button type="button" className="flip-icon-button" onClick={nativeShare} title="Share"><Share2 size={14} /></button>}
          {published && <a href={shareUrl(book)} target="_blank" rel="noreferrer" className="flip-icon-button" title="Open published flipbook"><ExternalLink size={14} /></a>}
          <button type="button" className="flip-icon-button is-danger" onClick={() => onDelete(book)} title="Delete"><Trash2 size={14} /></button>
        </div>
      </div>
    </article>
  );
}

function AdminLimits({ token }) {
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await axios.get(apiUrl(`${API}/admin/users`), { headers, params: query ? { q: query } : undefined });
      setUsers(res.data.users || []);
      const next = {};
      (res.data.users || []).forEach((item) => { next[item.id] = item.quota?.max === null ? '' : String(item.quota?.max ?? 3); });
      setDrafts(next);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load user flipbook limits.');
    } finally { setLoading(false); }
  }, [headers, query]);

  useEffect(() => { const t = window.setTimeout(load, query ? 250 : 0); return () => window.clearTimeout(t); }, [load, query]);

  const save = async (item) => {
    setSaving(item.id); setError('');
    try {
      const raw = drafts[item.id];
      const maxFlipbooks = raw === '' ? null : Math.max(0, Math.floor(Number(raw) || 0));
      await axios.patch(apiUrl(`${API}/admin/users/${item.id}/limit`), { maxFlipbooks }, { headers });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update this user limit.');
    } finally { setSaving(null); }
  };

  return (
    <section className="flip-admin-panel">
      <div className="flip-section-heading">
        <div><div className="flip-kicker"><ShieldCheck size={13} /> Super Admin</div><h2>User flipbook limits</h2><p>Set how many flipbooks each account can keep and share. Leave blank for unlimited.</p></div>
        <div className="flip-search"><Search size={14} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search user or email" /></div>
      </div>
      {error && <div className="flip-error">{error}</div>}
      {loading ? <div className="flip-admin-loading"><RefreshCw size={16} className="animate-spin" /> Loading users…</div> : (
        <div className="flip-user-list">
          {users.map((item) => (
            <div className="flip-user-row" key={item.id}>
              <div className="flip-user-avatar"><Users size={15} /></div>
              <div className="flip-user-info"><strong>{item.username || 'Platform user'}</strong><span>{item.email || 'No email'}</span></div>
              <div className="flip-user-usage">{item.quota?.used || 0} used</div>
              {item.isSuperAdmin ? <div className="flip-unlimited">Unlimited</div> : <>
                <input type="number" min="0" step="1" value={drafts[item.id] ?? ''} onChange={(e) => setDrafts((current) => ({ ...current, [item.id]: e.target.value }))} placeholder="Unlimited" className="flip-limit-input" />
                <button type="button" onClick={() => save(item)} disabled={saving === item.id} className="flip-button-secondary">{saving === item.id ? 'Saving…' : 'Save'}</button>
              </>}
            </div>
          ))}
          {!users.length && <div className="flip-empty-inline">No matching platform users.</div>}
        </div>
      )}
    </section>
  );
}

export default function Flipbooks() {
  const { token, user } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [books, setBooks] = useState([]);
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const isSuperAdmin = Boolean(user?.isSuperAdmin || user?.role === 'super_admin');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await axios.get(apiUrl(API), { headers });
      setBooks(res.data.flipbooks || []);
      setQuota(res.data.quota || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your flipbooks.');
    } finally { setLoading(false); }
  }, [headers]);

  useEffect(() => { load(); }, [load]);

  const remove = async (book) => {
    if (!window.confirm(`Delete “${book.title}”? Its public link will stop working.`)) return;
    try {
      await axios.delete(apiUrl(`${API}/${book.id}`), { headers });
      await load();
    } catch (err) { setError(err.response?.data?.message || 'Could not delete this flipbook.'); }
  };

  const atLimit = quota?.max !== null && quota?.max !== undefined && (quota?.used || 0) >= quota.max;
  const markCopied = (id) => { setCopied(id); window.setTimeout(() => setCopied(''), 1400); };

  return (
    <div className="flipbooks-page">
      <div className="flipbooks-header">
        <div>
          <div className="flip-kicker">Free publishing tool</div>
          <h1>Flipbooks</h1>
          <p>Turn a PDF or image set into a mobile-ready page-flipping publication, then share one link with employees, learners or customers.</p>
        </div>
        <div className="flip-header-actions">
          <QuotaCard quota={quota} />
          <Link to="/scorm/flipbooks/analytics" className="flip-button-secondary"><BarChart3 size={16} /> Library analytics</Link>
          <Link to="/scorm/flipbooks/new" className={`flip-button-primary ${atLimit ? 'is-disabled' : ''}`} aria-disabled={atLimit} onClick={(e) => atLimit && e.preventDefault()}><FilePlus2 size={16} /> Create flipbook</Link>
        </div>
      </div>

      {atLimit && <div className="flip-limit-banner"><Gauge size={15} /><span>You have reached your flipbook allowance. Delete a flipbook or ask the Super Admin to increase the limit.</span></div>}
      {copied && <div className="flip-toast">Share link copied</div>}
      {error && <div className="flip-error">{error}</div>}

      {loading ? <div className="flip-loading"><RefreshCw size={20} className="animate-spin" /><span>Loading flipbooks…</span></div> : books.length ? (
        <div className="flip-grid">{books.map((book) => <FlipbookCard key={book.id} book={book} onDelete={remove} onCopied={markCopied} />)}</div>
      ) : (
        <div className="flip-empty"><div className="flip-empty-icon"><BookOpenCheck size={30} /></div><h2>Create your first flipbook</h2><p>Upload a PDF or a set of images. Quizmoto will build the reader and give you a public sharing link.</p><Link to="/scorm/flipbooks/new" className="flip-button-primary"><FilePlus2 size={16} /> Create flipbook</Link></div>
      )}

      {isSuperAdmin && <AdminLimits token={token} />}
    </div>
  );
}