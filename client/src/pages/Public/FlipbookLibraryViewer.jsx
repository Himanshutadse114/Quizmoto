import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BookOpenCheck, ChevronLeft, ChevronRight, ExternalLink, RefreshCw, Share2 } from 'lucide-react';
import axios from 'axios';
import { apiUrl } from '../../config';
import { copyText } from '../../utils/clipboard';
import './flipbookLibrary.css';

const API = '/api/scorm/flipbooks';
const BOOKS_PER_PAGE = 6;

export default function FlipbookLibraryViewer() {
  const { shareToken = '' } = useParams();
  const [library, setLibrary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  const endpoint = useMemo(() => shareToken ? apiUrl(`${API}/public-library/${encodeURIComponent(shareToken)}`) : '', [shareToken]);
  const books = library?.books || [];
  const pageCount = Math.max(1, Math.ceil(books.length / BOOKS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const visibleBooks = books.slice((currentPage - 1) * BOOKS_PER_PAGE, currentPage * BOOKS_PER_PAGE);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!endpoint) { setLoading(false); setError('This library link is invalid.'); return; }
      try {
        const res = await axios.get(endpoint);
        if (active) setLibrary(res.data?.library || null);
      } catch (err) {
        if (active) setError(err.response?.data?.message || 'This Publica library is not available.');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [endpoint]);

  useEffect(() => { setPage(1); }, [shareToken]);

  const changePage = (nextPage) => {
    setPage(Math.max(1, Math.min(pageCount, nextPage)));
    window.requestAnimationFrame(() => {
      document.querySelector('.public-flip-library-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: library?.title || 'LMSGEN Publica Library', url });
      else await copyText(url, { successMessage: 'Library link copied.' });
    } catch { return; }
  };

  if (loading) return <main className="public-flip-library loading"><RefreshCw size={22} className="animate-spin" /><span>Loading library…</span></main>;
  if (error || !library) return <main className="public-flip-library loading"><BookOpenCheck size={30} /><h1>Library unavailable</h1><p>{error || 'This library link is invalid.'}</p></main>;

  return (
    <main className="public-flip-library" onContextMenu={(event) => event.preventDefault()} onDragStart={(event) => event.preventDefault()}>
      <header className="public-flip-library-header">
        <div className="public-flip-library-brand">LMSGEN Publica</div>
        <div className="public-flip-library-heading"><div><h1>{library.title}</h1><p>{library.description || 'Browse the published content in this shared Publica library.'}</p></div><button type="button" onClick={share}><Share2 size={15} /> Share library</button></div>
        <div className="public-flip-library-count">{library.bookCount} published publication{library.bookCount === 1 ? '' : 's'}</div>
      </header>
      <section className="public-flip-library-grid">
        {visibleBooks.map((book) => (
          <article className="public-flip-library-card" key={book.id}>
            <a href={book.shareUrl} className="public-flip-library-cover" aria-label={`Open ${book.title}`}>
              {book.coverPath ? <img src={apiUrl(book.coverPath)} alt="" draggable="false" /> : <div className="public-flip-library-placeholder"><BookOpenCheck size={34} /></div>}
            </a>
            <div className="public-flip-library-body"><h2>{book.title}</h2><p>{book.description || 'Trackable digital publication'}</p><div className="public-flip-library-meta"><span>{book.pageCount} pages</span><span>{book.viewCount} reader opens</span></div><a href={book.shareUrl} className="public-flip-library-open">Open publication <ExternalLink size={13} /></a></div>
          </article>
        ))}
      </section>
      {pageCount > 1 && (
        <nav className="public-flip-library-pagination" aria-label="Publications pages">
          <button type="button" onClick={() => changePage(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft size={15} /> Previous</button>
          <span>Page {currentPage} of {pageCount}</span>
          <button type="button" onClick={() => changePage(currentPage + 1)} disabled={currentPage === pageCount}>Next <ChevronRight size={15} /></button>
        </nav>
      )}
      {!library.books?.length && <section className="public-flip-library-empty"><BookOpenCheck size={32} /><h2>No publications yet</h2><p>The author has not published anything to this Publica library.</p></section>}
    </main>
  );
}
