import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { BarChart3, Copy, ExternalLink, Library, RefreshCw, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import './flipbookLibraryShare.css';

const API = '/api/scorm/flipbooks';

export default function FlipbookLibraryShare() {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [library, setLibrary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await axios.get(apiUrl(`${API}/library`), { headers });
      setLibrary(res.data?.library || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your shared flipbook library.');
    } finally { setLoading(false); }
  }, [headers]);

  useEffect(() => { load(); }, [load]);

  const copy = async () => {
    if (!library?.shareUrl) return;
    try { await navigator.clipboard.writeText(library.shareUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1300); } catch (_) {}
  };

  const share = async () => {
    if (!library?.shareUrl) return;
    try {
      if (navigator.share) await navigator.share({ title: library.title, url: library.shareUrl });
      else await copy();
    } catch (_) {}
  };

  if (loading) return <section className="flip-admin-panel"><div className="flip-admin-loading"><RefreshCw size={16} className="animate-spin" /> Preparing your library share link…</div></section>;
  if (error) return <section className="flip-admin-panel"><div className="flip-error">{error}</div></section>;
  if (!library) return null;

  return (
    <section className="flip-admin-panel flip-library-share-panel">
      <div className="flip-section-heading">
        <div><div className="flip-kicker"><Library size={13} /> Shared library</div><h2>{library.title}</h2><p>One permanent link that automatically shows all of your published flipbooks. Individual flipbook links continue to work as before.</p></div>
        <div className="flip-header-actions">
          <Link to="/scorm/flipbooks/analytics" className="flip-button-secondary"><BarChart3 size={14} /> Library analytics</Link>
          <button type="button" onClick={copy} className="flip-button-secondary"><Copy size={14} /> {copied ? 'Copied' : 'Copy library link'}</button>
          <button type="button" onClick={share} className="flip-button-secondary"><Share2 size={14} /> Share</button>
          {library.shareUrl && <a href={library.shareUrl} target="_blank" rel="noreferrer" className="flip-button-primary"><ExternalLink size={14} /> Open library</a>}
        </div>
      </div>
      <div className="flip-library-share-summary"><strong>{library.bookCount}</strong><span>published flipbook{library.bookCount === 1 ? '' : 's'} currently visible in this shared library</span></div>
    </section>
  );
}
