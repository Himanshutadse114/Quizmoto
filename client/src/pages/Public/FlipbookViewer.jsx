import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Expand, Minimize, Share2 } from 'lucide-react';
import axios from 'axios';
import { apiUrl } from '../../config';
import '../Scorm/flipbooks.css';

const API = '/api/scorm/flipbooks';

function useMobileReader() {
  const [mobile, setMobile] = useState(() => window.matchMedia?.('(max-width: 760px)').matches ?? false);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const change = () => setMobile(media.matches);
    change(); media.addEventListener?.('change', change);
    return () => media.removeEventListener?.('change', change);
  }, []);
  return mobile;
}

function lastStartFor(pageCount, mobile) {
  if (!pageCount) return 0;
  return mobile
    ? Math.max(0, pageCount - 1)
    : Math.max(0, Math.floor((pageCount - 1) / 2) * 2);
}

export default function FlipbookViewer({ shareToken: propToken }) {
  const shareToken = propToken || window.location.pathname.split('/').filter(Boolean).pop();
  const mobile = useMobileReader();
  const rootRef = useRef(null);
  const touchStart = useRef(null);
  const [book, setBook] = useState(null);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState('next');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    axios.get(apiUrl(`${API}/public/${shareToken}`)).then((res) => {
      if (!live) return;
      setBook(res.data.flipbook);
      const marker = `flipbook-viewed:${shareToken}`;
      if (!sessionStorage.getItem(marker)) {
        sessionStorage.setItem(marker, '1');
        axios.post(apiUrl(`${API}/public/${shareToken}/view`)).catch(() => null);
      }
    }).catch((err) => live && setError(err.response?.data?.message || 'This flipbook is not available.')).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [shareToken]);

  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  useEffect(() => {
    const pageCount = book?.pageCount || 0;
    const lastStart = lastStartFor(pageCount, mobile);
    setIndex((current) => {
      const normalised = mobile ? current : Math.floor(current / 2) * 2;
      return Math.max(0, Math.min(lastStart, normalised));
    });
  }, [mobile, book?.pageCount]);

  const pageCount = book?.pageCount || 0;
  const pagesPerView = mobile ? 1 : 2;
  const maxStart = lastStartFor(pageCount, mobile);
  const currentStart = mobile ? index : Math.floor(index / 2) * 2;

  const go = useCallback((delta) => {
    if (!book?.pageCount) return;
    setDirection(delta > 0 ? 'next' : 'prev');
    setIndex((current) => {
      const step = mobile ? 1 : 2;
      const base = mobile ? current : Math.floor(current / 2) * 2;
      const lastStart = lastStartFor(book.pageCount, mobile);
      return Math.max(0, Math.min(lastStart, base + (delta > 0 ? step : -step)));
    });
  }, [book?.pageCount, mobile]);

  useEffect(() => {
    const key = (event) => {
      if (event.key === 'ArrowRight' || event.key === 'PageDown') go(1);
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') go(-1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [go]);

  const pageSrc = useCallback((pageIndex) => apiUrl(`${API}/public/${shareToken}/pages/${pageIndex}`), [shareToken]);
  const visiblePages = useMemo(() => {
    if (!book) return [];
    if (mobile) return [currentStart];
    return [currentStart, currentStart + 1].filter((item) => item < book.pageCount);
  }, [book, mobile, currentStart]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen?.();
    } catch (_) {}
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: book?.title || 'Flipbook', url }); } catch (_) {}
      return;
    }
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1400); } catch (_) {}
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 1400); } catch (_) {}
  };

  const onTouchStart = (event) => { touchStart.current = event.touches?.[0]?.clientX ?? null; };
  const onTouchEnd = (event) => {
    const start = touchStart.current;
    const end = event.changedTouches?.[0]?.clientX;
    touchStart.current = null;
    if (start === null || end === undefined || Math.abs(end - start) < 45) return;
    go(end < start ? 1 : -1);
  };

  if (loading) return <div className="flip-public-loading"><div className="flip-reader-spinner" /><span>Opening publication…</span></div>;
  if (error || !book) return <div className="flip-public-error"><div className="flip-reader-logo">LMSGEN</div><h1>Publication unavailable</h1><p>{error || 'This flipbook is not available.'}</p></div>;

  const startPage = currentStart + 1;
  const endPage = Math.min(book.pageCount, currentStart + pagesPerView);
  const canPrev = currentStart > 0;
  const canNext = currentStart < maxStart;

  return (
    <main ref={rootRef} className={`flip-reader ${fullscreen ? 'is-fullscreen' : ''}`} style={{ '--reader-accent': book.theme?.accent || '#4FC9BF', '--reader-bg': book.theme?.background || '#07111f' }}>
      <header className="flip-reader-header">
        <div className="flip-reader-brand"><span className="flip-reader-brandmark">L</span><div><strong>{book.title}</strong><span>{book.description || 'Interactive flipbook'}</span></div></div>
        <div className="flip-reader-tools">
          <button type="button" onClick={copy} aria-label="Copy link" title="Copy link"><Copy size={16} /></button>
          <button type="button" onClick={share} aria-label="Share" title="Share"><Share2 size={16} /></button>
          <button type="button" onClick={toggleFullscreen} aria-label="Toggle fullscreen" title="Fullscreen">{fullscreen ? <Minimize size={16} /> : <Expand size={16} />}</button>
        </div>
      </header>

      <section className="flip-reader-workspace" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <button type="button" className="flip-reader-arrow is-left" onClick={() => go(-1)} disabled={!canPrev} aria-label="Previous page"><ChevronLeft size={25} /></button>
        <div className={`flip-book-stage ${mobile ? 'is-mobile' : 'is-desktop'} turn-${direction}`}>
          <div className="flip-book-shadow" />
          {visiblePages.map((pageIndex, position) => (
            <div className={`flip-reader-page ${position === 0 ? 'is-left' : 'is-right'}`} key={`${pageIndex}-${direction}-${currentStart}`}>
              <img src={pageSrc(pageIndex)} alt={`Page ${pageIndex + 1}`} draggable="false" />
              <span className="flip-page-number">{pageIndex + 1}</span>
            </div>
          ))}
          {!mobile && visiblePages.length === 1 && <div className="flip-reader-page is-right is-blank" />}
          {!mobile && <div className="flip-book-spine" />}
        </div>
        <button type="button" className="flip-reader-arrow is-right" onClick={() => go(1)} disabled={!canNext} aria-label="Next page"><ChevronRight size={25} /></button>
      </section>

      <footer className="flip-reader-footer">
        <button type="button" onClick={() => go(-1)} disabled={!canPrev}><ChevronLeft size={17} /> <span>Previous</span></button>
        <div className="flip-reader-progress"><span>{mobile || startPage === endPage ? `Page ${startPage}` : `Pages ${startPage}–${endPage}`} of {book.pageCount}</span><div><i style={{ width: `${Math.min(100, (endPage / book.pageCount) * 100)}%` }} /></div></div>
        <button type="button" onClick={() => go(1)} disabled={!canNext}><span>Next</span> <ChevronRight size={17} /></button>
      </footer>
      {copied && <div className="flip-reader-toast">Link copied</div>}
    </main>
  );
}
