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
  Share2,
  Trash2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import { copyText } from '../../utils/clipboard';
import { invalidateScormData, peekScormData, setScormData } from '../../services/scormDataCache';
import FlipbookLibraryShare from './FlipbookLibraryShare';
import './flipbooks.css';

const API = '/api/scorm/flipbooks';

function shareUrl(book) {
  return book?.sharePath ? apiUrl(book.sharePath) : '';
}

function QuotaCard({ quota }) {
  const max = quota?.max;
  const used = quota?.used || 0;
  const label = !quota ? 'Allowance unavailable' : max === null ? `${used} used · Unlimited` : Number.isFinite(max) ? `${used} of ${max} used` : `${used} used`;
  const pct = Number.isFinite(max) && max > 0 ? Math.min(100, Math.round((used / max) * 100)) : max === 0 ? 100 : 0;
  return (
    <div className="flip-quota-card">
      <div className="flip-quota-icon"><Gauge size={18} /></div>
      <div className="min-w-0 flex-1">
        <div className="flip-kicker">Your allowance</div>
        <div className="flip-quota-value">{label}</div>
        {Number.isFinite(max) && <div className="flip-quota-track"><span style={{ width: `${pct}%` }} /></div>}
      </div>
    </div>
  );
}

function FlipbookCard({ book, onDelete, onCopied }) {
  const published = book.status === 'published' && book.shareEnabled;
  const cover = book.thumbnailPath ? apiUrl(book.thumbnailPath) : book.coverPath ? apiUrl(book.coverPath) : '';
  const copy = async () => {
    if (!published) return;
    const url = shareUrl(book);
    try {
      await copyText(url, { successMessage: 'Publication share link copied.' });
      onCopied(book.id);
    } catch { /* Clipboard feedback is handled by the shared copy helper. */ }
  };
  const nativeShare = async () => {
    if (!published) return;
    const url = shareUrl(book);
    if (navigator.share) {
      try { await navigator.share({ title: book.title, url }); } catch { /* The user cancelled the native share sheet. */ }
    } else {
      await copy();
    }
  };

  return (
    <article className="flip-card">
      <div className="flip-cover-wrap">
        {cover ? <img src={cover} alt="" className="flip-cover" /> : <div className="flip-cover-placeholder"><BookOpenCheck size={34} /><span>{book.pageCount ? `${book.pageCount} pages` : 'Add pages'}</span></div>}
        <span className={`flip-status ${published ? 'is-published' : 'is-draft'}`}>{book.isPlatformDefault ? 'Included by LMSGEN' : published ? 'Published' : 'Draft'}</span>
      </div>
      <div className="flip-card-body">
        <div className="min-w-0">
          <h3 className="platform-item-title">{book.title}</h3>
          <p>{book.description || 'Interactive page-flipping publication'}</p>
        </div>
        <div className="flip-card-meta"><span>{book.pageCount} pages</span><span><Eye size={12} /> {book.viewCount || 0} reader opens</span></div>
        <div className="flip-card-actions">
          {book.readOnly ? <a href={shareUrl(book)} target="_blank" rel="noreferrer" className="flip-button-secondary"><ExternalLink size={14} /> Read publication</a> : <>
            <Link to={`/scorm/publica/${book.id}/edit`} className="flip-button-secondary"><Pencil size={14} /> Edit</Link>
            <Link to={`/scorm/publica/${book.id}/analytics`} className="flip-button-secondary"><BarChart3 size={14} /> Analytics</Link>
          </>}
          {published && <button type="button" className="flip-icon-button" onClick={copy} title="Copy share link"><Copy size={14} /></button>}
          {published && <button type="button" className="flip-icon-button" onClick={nativeShare} title="Share"><Share2 size={14} /></button>}
          {published && <a href={shareUrl(book)} target="_blank" rel="noreferrer" className="flip-icon-button" title="Open published publication"><ExternalLink size={14} /></a>}
          {!book.readOnly && <button type="button" className="flip-icon-button is-danger" onClick={() => onDelete(book)} title="Delete"><Trash2 size={14} /></button>}
        </div>
      </div>
    </article>
  );
}


export default function Flipbooks() {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const prepared = useMemo(() => peekScormData('flipbooks', token), [token]);
  const [books, setBooks] = useState(() => prepared?.flipbooks || []);
  const [quota, setQuota] = useState(() => prepared?.quota || null);
  const [loading, setLoading] = useState(() => !prepared);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    const cached = peekScormData('flipbooks', token);
    if (cached) {
      setBooks(cached.flipbooks || []);
      setQuota(cached.quota || null);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const res = await axios.get(apiUrl(API), { headers });
      setBooks(res.data.flipbooks || []);
      setQuota(res.data.quota || null);
      setScormData('flipbooks', token, res.data);
    } catch (err) {
      if (!cached) setError(err.response?.data?.message || 'Could not load your publications.');
    } finally { setLoading(false); }
  }, [headers, token]);

  useEffect(() => { load(); }, [load]);

  const remove = async (book) => {
    if (!window.confirm(`Delete “${book.title}”? Its public link will stop working.`)) return;
    try {
      await axios.delete(apiUrl(`${API}/${book.id}`), { headers });
      invalidateScormData('flipbooks', token);
      invalidateScormData('flipbook-library', token);
      await load();
    } catch (err) { setError(err.response?.data?.message || 'Could not delete this publication.'); }
  };

  const atLimit = quota?.max !== null && quota?.max !== undefined && (quota?.used || 0) >= quota.max;
  const markCopied = (id) => { setCopied(id); window.setTimeout(() => setCopied(''), 1400); };

  return (
    <div className="platform-section-page flipbooks-page">
      <div className="flipbooks-header">
        <div>
          <div className="flip-kicker">Secure digital publishing</div>
          <h1>LMSGEN Publica</h1>
          <p>Turn a PDF or image set into a mobile-ready, trackable publication, then share one secure link with employees, learners or customers.</p>
        </div>
        <div className="flip-header-actions">
          <QuotaCard quota={quota} />
          <Link to="/scorm/publica/analytics" className="flip-button-secondary"><BarChart3 size={16} /> Library analytics</Link>
          <Link to="/scorm/publica/new" className={`flip-button-primary ${atLimit ? 'is-disabled' : ''}`} aria-disabled={atLimit} onClick={(e) => atLimit && e.preventDefault()}><FilePlus2 size={16} /> Create publication</Link>
        </div>
      </div>

      <FlipbookLibraryShare />
      {books.some((book) => book.readOnly && book.isPlatformDefault) && <div className="flip-limit-banner"><BookOpenCheck size={15} /><span>The publication marked “Included by LMSGEN” is available to every account, is read-only, and does not use your Publica allowance.</span></div>}
      {atLimit && <div className="flip-limit-banner"><Gauge size={15} /><span>You have reached your Publica allowance. Delete a publication or ask the Super Admin to increase the limit.</span></div>}
      {copied && <div className="flip-toast">Share link copied</div>}
      {error && <div className="flip-error" role="alert"><span>{error}</span> <button type="button" onClick={load} className="underline">Try again</button></div>}

      {loading ? <div className="flip-loading"><RefreshCw size={20} className="animate-spin" /><span>Loading publications…</span></div> : books.length ? (
        <div className="flip-grid">{books.map((book) => <FlipbookCard key={book.id} book={book} onDelete={remove} onCopied={markCopied} />)}</div>
      ) : error ? null : (
        <div className="flip-empty"><div className="flip-empty-icon"><BookOpenCheck size={30} /></div><h2>Create your first publication</h2><p>Upload a PDF or a set of images. LMSGEN Publica will build the reader and give you a secure sharing link.</p><Link to="/scorm/publica/new" className="flip-button-primary"><FilePlus2 size={16} /> Create publication</Link></div>
      )}

    </div>
  );
}
