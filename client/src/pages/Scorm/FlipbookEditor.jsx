import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  FileImage,
  FileText,
  Loader2,
  Save,
  Share2,
  Sparkles,
  UploadCloud
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import './flipbooks.css';

const API = '/api/scorm/flipbooks';
const PDF_JS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDF_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const MAX_PAGES = 100;
const MAX_RENDER_WIDTH = 1400;

function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${PDF_JS_URL}"]`);
    const finish = () => {
      if (!window.pdfjsLib) return reject(new Error('PDF reader could not be loaded. Try image pages instead.'));
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
      resolve(window.pdfjsLib);
    };
    if (existing) {
      existing.addEventListener('load', finish, { once: true });
      existing.addEventListener('error', () => reject(new Error('PDF reader could not be loaded.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = PDF_JS_URL;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = finish;
    script.onerror = () => reject(new Error('PDF reader could not be loaded. Check the network and try again.'));
    document.head.appendChild(script);
  });
}

function canvasToJpeg(canvas, quality = 0.82) {
  return canvas.toDataURL('image/jpeg', quality);
}

async function imageFileToPage(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error(`Could not read ${file.name}.`));
      element.src = url;
    });
    const scale = Math.min(1, MAX_RENDER_WIDTH / image.naturalWidth);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    return { dataUrl: canvasToJpeg(canvas), width, height };
  } finally { URL.revokeObjectURL(url); }
}

async function pdfToPages(file, onProgress) {
  const pdfjs = await loadPdfJs();
  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  if (pdf.numPages > MAX_PAGES) throw new Error(`This PDF has ${pdf.numPages} pages. The maximum is ${MAX_PAGES}.`);
  const result = [];
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2, MAX_RENDER_WIDTH / base.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, background: '#ffffff' }).promise;
    result.push({ dataUrl: canvasToJpeg(canvas), width: canvas.width, height: canvas.height });
    onProgress?.({ stage: 'converting', current: number, total: pdf.numPages });
  }
  return result;
}

async function filesToPages(files, onProgress) {
  const list = Array.from(files || []);
  if (!list.length) return [];
  const pdfs = list.filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
  if (pdfs.length) {
    if (list.length !== 1 || pdfs.length !== 1) throw new Error('Upload one PDF at a time, or select multiple image files instead.');
    return pdfToPages(pdfs[0], onProgress);
  }
  const images = list.filter((file) => /^image\/(jpeg|png|webp)$/i.test(file.type));
  if (images.length !== list.length) throw new Error('Use a PDF, JPEG, PNG or WebP file.');
  if (images.length > MAX_PAGES) throw new Error(`A flipbook can contain up to ${MAX_PAGES} pages.`);
  const pages = [];
  for (let index = 0; index < images.length; index += 1) {
    pages.push(await imageFileToPage(images[index]));
    onProgress?.({ stage: 'converting', current: index + 1, total: images.length });
  }
  return pages;
}

export default function FlipbookEditor() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { token } = useAuth();
  const navigate = useNavigate();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const fileInput = useRef(null);
  const [book, setBook] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [fileSummary, setFileSummary] = useState('');
  const [replacePages, setReplacePages] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!editing) return;
    let live = true;
    axios.get(apiUrl(`${API}/${id}`), { headers }).then((res) => {
      if (!live) return;
      const item = res.data.flipbook;
      setBook(item); setTitle(item.title || ''); setDescription(item.description || '');
    }).catch((err) => live && setError(err.response?.data?.message || 'Could not load this flipbook.')).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [editing, id, headers]);

  const chooseFiles = (selected) => {
    const list = Array.from(selected || []);
    setFiles(list);
    setReplacePages(Boolean(editing && list.length));
    if (!list.length) return setFileSummary('');
    if (list.length === 1) setFileSummary(list[0].name);
    else setFileSummary(`${list.length} image pages selected`);
  };

  const save = async (status) => {
    setBusy(true); setError(''); setSuccess(''); setProgress(null);
    let activeBook = book;
    let createdHere = false;
    try {
      if (!activeBook) {
        const created = await axios.post(apiUrl(API), { title: title.trim() || 'Untitled flipbook', description }, { headers });
        activeBook = created.data.flipbook;
        setBook(activeBook);
        createdHere = true;
      }

      if (files.length) {
        const pages = await filesToPages(files, setProgress);
        if (!pages.length) throw new Error('No valid pages were found.');
        if (replacePages || activeBook.pageCount) {
          await axios.delete(apiUrl(`${API}/${activeBook.id}/pages`), { headers });
        }
        for (let index = 0; index < pages.length; index += 1) {
          setProgress({ stage: 'uploading', current: index + 1, total: pages.length });
          await axios.post(apiUrl(`${API}/${activeBook.id}/pages`), pages[index], { headers });
        }
        activeBook = { ...activeBook, pageCount: pages.length };
      }

      const pageCount = files.length ? activeBook.pageCount : Number(activeBook.pageCount || 0);
      if (status === 'published' && pageCount < 1) throw new Error('Upload a PDF or image pages before publishing.');
      const updated = await axios.patch(apiUrl(`${API}/${activeBook.id}`), {
        title: title.trim() || 'Untitled flipbook',
        description,
        status,
        shareEnabled: true
      }, { headers });
      activeBook = updated.data.flipbook;
      setBook(activeBook);
      setFiles([]); setFileSummary(''); setReplacePages(false); setProgress(null);
      if (status === 'published') {
        setSuccess('Published. The public link is ready to share.');
      } else {
        setSuccess('Draft saved.');
      }
      if (createdHere) navigate(`/scorm/flipbooks/${activeBook.id}/edit`, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not save this flipbook.');
    } finally { setBusy(false); }
  };

  const copyShare = async () => {
    if (!book?.sharePath) return;
    try { await navigator.clipboard.writeText(`${window.location.origin}${book.sharePath}`); setSuccess('Share link copied.'); } catch (_) {}
  };

  if (loading) return <div className="flip-loading"><Loader2 size={20} className="animate-spin" /> Loading editor…</div>;

  const published = book?.status === 'published' && book?.sharePath;
  const progressText = progress ? `${progress.stage === 'uploading' ? 'Uploading' : 'Converting'} page ${progress.current} of ${progress.total}` : '';
  const progressPercent = progress ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="flip-editor-page">
      <div className="flip-editor-topbar">
        <Link to="/scorm/flipbooks" className="flip-back"><ArrowLeft size={15} /> Flipbooks</Link>
        <div className="flip-editor-state">{editing ? 'Edit publication' : 'New publication'}</div>
      </div>

      <div className="flip-editor-grid">
        <section className="flip-editor-panel">
          <div className="flip-section-heading compact"><div><div className="flip-kicker">Publication details</div><h1>{editing ? 'Edit flipbook' : 'Create flipbook'}</h1><p>Upload a PDF or image pages. Page conversion happens in your browser before secure storage.</p></div></div>
          <label className="flip-field"><span>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={180} placeholder="Employee Security Handbook" /></label>
          <label className="flip-field"><span>Description</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={3000} placeholder="Optional short description for readers" /></label>

          <div className="flip-upload-zone" role="button" tabIndex={0} onClick={() => fileInput.current?.click()} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInput.current?.click()}>
            <input ref={fileInput} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple onChange={(e) => chooseFiles(e.target.files)} hidden />
            <div className="flip-upload-icon"><UploadCloud size={25} /></div>
            <strong>{fileSummary || (book?.pageCount ? 'Replace existing pages' : 'Upload your PDF or page images')}</strong>
            <span>PDF, JPG, PNG or WebP · up to {MAX_PAGES} pages</span>
            {book?.pageCount > 0 && !files.length && <em>{book.pageCount} pages currently stored</em>}
          </div>

          {files.length > 0 && <div className="flip-file-note"><FileText size={14} /><span>{replacePages ? 'These files will replace the current pages when you save.' : 'These files will become the flipbook pages.'}</span></div>}

          {progress && <div className="flip-progress"><div className="flip-progress-row"><span>{progressText}</span><strong>{progressPercent}%</strong></div><div className="flip-progress-track"><span style={{ width: `${progressPercent}%` }} /></div></div>}
          {error && <div className="flip-error">{error}</div>}
          {success && <div className="flip-success"><CheckCircle2 size={15} /> {success}</div>}

          <div className="flip-editor-actions">
            <button type="button" onClick={() => save('draft')} disabled={busy} className="flip-button-secondary"><Save size={15} /> {busy ? 'Working…' : 'Save draft'}</button>
            <button type="button" onClick={() => save('published')} disabled={busy} className="flip-button-primary"><Sparkles size={15} /> {busy ? 'Working…' : book?.status === 'published' ? 'Update published' : 'Publish & share'}</button>
          </div>
        </section>

        <aside className="flip-editor-preview">
          <div className="flip-preview-book">
            <div className="flip-preview-page">
              <FileImage size={34} />
              <strong>{title || 'Your flipbook'}</strong>
              <span>{files.length ? fileSummary : book?.pageCount ? `${book.pageCount} pages` : 'Upload pages to begin'}</span>
            </div>
          </div>
          <div className="flip-preview-copy"><strong>Responsive reader included</strong><p>Desktop readers see a book-style spread. Phones automatically switch to a single-page swipe view with the same share link.</p></div>
          {published && <div className="flip-share-box"><div><div className="flip-kicker">Published link</div><div className="flip-share-url">{`${window.location.origin}${book.sharePath}`}</div></div><div className="flex gap-2"><button type="button" onClick={copyShare} className="flip-icon-button"><Copy size={14} /></button><a href={`${window.location.origin}${book.sharePath}`} target="_blank" rel="noreferrer" className="flip-icon-button"><Share2 size={14} /></a></div></div>}
        </aside>
      </div>
    </div>
  );
}
