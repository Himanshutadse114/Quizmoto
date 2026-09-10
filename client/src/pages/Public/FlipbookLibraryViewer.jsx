import React, { useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, ExternalLink, RefreshCw, Share2 } from 'lucide-react';
import axios from 'axios';
import { apiUrl } from '../../config';
import './flipbookLibrary.css';

const API = '/api/scorm/flipbooks';

export default function FlipbookLibraryViewer() {
  const shareToken = window.location.pathname.split('/flipbook-library/')[1]?.split('/')[0] || '';
  const [library, setLibrary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const endpoint = useMemo(() => shareToken ? apiUrl(`${API}/public-library/${encodeURIComponent(shareToken)}`) : '', [shareToken]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!endpoint) { setLoading(false); setError('This library link is invalid.'); return; }
      try {
        const res = await axios.get(endpoint);
        if (active) setLibrary(res.data?.library || null);
      } catch (err) {
        if (active) setError(err.response?.data?.message || 'This flipbook library is not available.');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [endpoint]);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: library?.title || 'Flipbook Library', url });
      else await navigator.clipboard.writeText(url);
    } catch (_) {}
  };

  if (loading) return <main className="public-flip-library loading"><RefreshCw size={22} className="animate-spin" /><span>Loading library…</span></main>;
  if (error || !library) return <main className="public-flip-library loading"><BookOpenCheck size={30} /><h1>Library unavailable</h1><p>{error || 'This library link is invalid.'}</p></main>;

  return (
    <main className="public-flip-library">
      <header className="public-flip-library-header">
        <div className="public-flip-library-brand">LMSGEN · Flipbook Library</div>
        <div className="public-flip-library-heading"><div><h1>{library.title}</h1><p>{library.description || 'Browse the published flipbooks in this shared library.'}</p></div><button type="button" onClick={share}><Share2 size={15} /> Share library</button></div>
        <div className="public-flip-library-count">{library.bookCount} published flipbook{library.bookCount === 1 ? '' : 's'}</div>
      </header>
      <section className="public-flip-library-grid">
        {(library.books || []).map((book) => (
          <article className="public-flip-library-card" key={book.id}>
            <a href={book.shareUrl} className="public-flip-library-cover" aria-label={`Open ${book.title}`}>
              {book.coverPath ? <img src={apiUrl(book.coverPath)} alt="" /> : <div className="public-flip-library-placeholder"><BookOpenCheck size={34} /></div>}
            </a>
            <div className="public-flip-library-body"><h2>{book.title}</h2><p>{book.description || 'Interactive flipbook publication'}</p><div className="public-flip-library-meta"><span>{book.pageCount} pages</span><span>{book.viewCount} reader opens</span></div><a href={book.shareUrl} className="public-flip-library-open">Open flipbook <ExternalLink size={13} /></a></div>
          </article>
        ))}
      </section>
      {!library.books?.length && <section className="public-flip-library-empty"><BookOpenCheck size={32} /><h2>No published flipbooks yet</h2><p>The author has not published any flipbooks to this library.</p></section>}
    </main>
  );
}
