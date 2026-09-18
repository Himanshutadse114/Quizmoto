import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Film, Play, Plus, Trash2, UploadCloud } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import LearnerVideoModal from './LearnerVideoModal';

function fileSize(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(0, Math.round(value / 1024))} KB`;
}

function durationLabel(seconds) {
  const total = Math.max(0, Math.round(Number(seconds || 0)));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}

async function readDuration(file) {
  return new Promise((resolve) => {
    const element = document.createElement('video');
    const url = URL.createObjectURL(file);
    element.preload = 'metadata';
    element.onloadedmetadata = () => { const value = Number(element.duration || 0); URL.revokeObjectURL(url); resolve(Number.isFinite(value) ? value : 0); };
    element.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    element.src = url;
  });
}

function encodeUploadMetadata(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export default function Videos() {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const fileRef = useRef(null);
  const [videos, setVideos] = useState([]);
  const [maxUploadMb, setMaxUploadMb] = useState(250);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);

  const load = async () => {
    try {
      const response = await axios.get(apiUrl('/api/scorm/videos'), { headers });
      setVideos(response.data?.videos || []);
      setMaxUploadMb(response.data?.maxUploadMb || 250);
    } catch (err) { setError(err.response?.data?.message || 'Unable to load videos.'); }
  };

  useEffect(() => { if (token) load(); }, [token]);

  const pick = (selected) => {
    if (!selected) return;
    setError(''); setMessage(''); setFile(selected);
    if (!title.trim()) setTitle(selected.name.replace(/\.[^.]+$/, ''));
  };

  const upload = async (event) => {
    event.preventDefault();
    if (!file || !title.trim()) return setError('Choose a video and enter its title.');
    if (file.size > maxUploadMb * 1024 * 1024) return setError(`Video exceeds the ${maxUploadMb} MB limit.`);
    setBusy(true); setProgress(0); setError(''); setMessage('');
    try {
      const durationSeconds = await readDuration(file);
      const metadata = { title: title.trim(), description: description.trim(), durationSeconds };
      const ticket = await axios.post(apiUrl('/api/scorm/videos/upload-ticket'), {
        mimeType: file.type || 'video/mp4', byteSize: file.size, metadata
      }, { headers });
      let response;
      if (ticket.data?.direct && ticket.data?.uploadUrl) {
        try {
          await axios.put(ticket.data.uploadUrl, file, {
            headers: ticket.data.headers || { 'Content-Type': file.type || 'video/mp4' },
            onUploadProgress: (value) => setProgress(value.total ? Math.round((value.loaded / value.total) * 100) : 0)
          });
        } catch (uploadError) {
          const error = new Error('The secure video upload could not start. Please retry or contact support.');
          error.cause = uploadError;
          throw error;
        }
        response = await axios.post(apiUrl(`/api/scorm/videos/${encodeURIComponent(ticket.data.videoId)}/upload-complete`), {}, { headers });
      } else {
        response = await axios.post(apiUrl('/api/scorm/videos/upload'), file, {
          headers: { ...headers, 'Content-Type': file.type || 'video/mp4', 'X-Video-Metadata': encodeUploadMetadata(metadata) },
          onUploadProgress: (value) => setProgress(value.total ? Math.round((value.loaded / value.total) * 100) : 0)
        });
      }
      setVideos((current) => [response.data.video, ...current]);
      setFile(null); setTitle(''); setDescription(''); setProgress(0);
      if (fileRef.current) fileRef.current.value = '';
      setMessage('Trackable video uploaded. It is now available in campaign creation.');
    } catch (err) {
      setError(err.response?.data?.message || 'The video service became temporarily unavailable. Your file is still selected—please retry the upload.');
    }
    finally { setBusy(false); }
  };

  const remove = async (video) => {
    if (!window.confirm(`Delete “${video.title}”?`)) return;
    try {
      await axios.delete(apiUrl(`/api/scorm/videos/${video.id}`), { headers });
      setVideos((current) => current.filter((item) => item.id !== video.id));
    } catch (err) { setError(err.response?.data?.message || 'Unable to delete video.'); }
  };

  const openPreview = async (video) => {
    try {
      setError('');
      const response = await axios.post(apiUrl(`/api/scorm/videos/${video.id}/preview`), {}, { headers });
      setPreview({ item: video, streamUrl: response.data?.streamUrl });
    } catch (err) { setError(err.response?.data?.message || 'Unable to preview video.'); }
  };

  return (
    <div className="p-4 md:p-7 lg:p-8 w-full">
      {preview && <LearnerVideoModal item={preview.item} streamUrl={preview.streamUrl} onClose={() => setPreview(null)} />}
      <div className="max-w-[1320px] mx-auto">
        <div className="mb-6 pb-6 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
          <div className="scorm-micro text-[10px] uppercase font-semibold">Trackable media</div>
          <h1 className="text-[28px] md:text-[34px] font-semibold tracking-[-.03em] mt-1.5">Video library</h1>
          <p className="text-sm mt-2 max-w-2xl leading-relaxed" style={{ color: 'var(--scorm-ink-soft)' }}>Upload reusable video lessons, assign them inside campaigns, and measure genuine watched coverage and active viewing time.</p>
        </div>
        {error && <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: '#f5c4cc', background: 'rgba(251,113,133,.08)' }}>{error}</div>}
        {message && <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(79,201,191,.35)', background: 'rgba(79,201,191,.08)' }}>{message}</div>}
        <div className="grid xl:grid-cols-[420px_1fr] gap-5 items-start">
          <form onSubmit={upload} className="scorm-panel rounded-2xl border p-5 space-y-4" style={{ borderColor: 'var(--scorm-line)' }}>
            <div className="flex items-center gap-3"><span className="w-10 h-10 rounded-xl border grid place-items-center"><UploadCloud size={18} /></span><div><h2 className="font-semibold">Upload video</h2><p className="text-[10px] mt-1 opacity-60">MP4, WebM, OGG or MOV · up to {maxUploadMb} MB</p></div></div>
            <button type="button" onClick={() => fileRef.current?.click()} className="w-full rounded-2xl border border-dashed p-5 text-left" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}><strong className="block text-sm truncate">{file?.name || 'Choose a video file'}</strong><span className="block text-[10px] mt-1 opacity-60">{file ? fileSize(file.size) : 'The original file stays private and streams only to assigned learners.'}</span></button>
            <input ref={fileRef} hidden type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime" onChange={(event) => pick(event.target.files?.[0])} />
            <label className="block"><span className="scorm-micro text-[9px] uppercase">Title</span><input className="mt-1.5 w-full px-3 py-2.5 text-sm" value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} /></label>
            <label className="block"><span className="scorm-micro text-[9px] uppercase">Description · optional</span><textarea className="mt-1.5 w-full px-3 py-2.5 text-sm min-h-24" value={description} maxLength={1200} onChange={(event) => setDescription(event.target.value)} /></label>
            {busy && <div><div className="flex justify-between text-[10px] mb-1"><span>Uploading securely</span><strong>{progress}%</strong></div><div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--scorm-line)' }}><div className="h-full bg-[#4FC9BF]" style={{ width: `${progress}%` }} /></div></div>}
            <button disabled={busy || !file || !title.trim()} className="scorm-button-primary w-full h-11 inline-flex justify-center items-center gap-2 text-xs font-semibold disabled:opacity-50"><Plus size={14} /> {busy ? 'Uploading…' : 'Add trackable video'}</button>
          </form>
          <section className="scorm-panel rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--scorm-line)' }}>
            <div className="px-5 py-4 border-b flex justify-between" style={{ borderColor: 'var(--scorm-line)' }}><div><h2 className="font-semibold">Ready to assign</h2><p className="text-[10px] mt-1 opacity-60">{videos.length} video{videos.length === 1 ? '' : 's'}</p></div><Film size={18} /></div>
            {videos.length ? <div className="divide-y" style={{ borderColor: 'var(--scorm-line)' }}>{videos.map((video) => <div key={video.id} className="p-4 flex items-center gap-3"><span className="w-12 h-12 rounded-xl grid place-items-center shrink-0" style={{ background: 'var(--scorm-surface-soft)' }}><Film size={18} /></span><div className="min-w-0 flex-1"><div className="font-semibold text-sm truncate">{video.title}</div><div className="text-[10px] mt-1 opacity-60">{fileSize(video.byteSize)}{video.durationSeconds ? ` · ${durationLabel(video.durationSeconds)}` : ''} · Ready</div></div><button type="button" onClick={() => openPreview(video)} className="scorm-button-secondary w-9 h-9 grid place-items-center" aria-label={`Preview ${video.title}`}><Play size={13} /></button><button type="button" onClick={() => remove(video)} className="scorm-button-secondary w-9 h-9 grid place-items-center" aria-label={`Delete ${video.title}`}><Trash2 size={13} /></button></div>)}</div> : <div className="p-12 text-center"><Film size={25} className="mx-auto opacity-50" /><div className="font-semibold mt-3">No videos yet</div><p className="text-xs mt-1 opacity-60">Upload your first reusable video lesson.</p></div>}
          </section>
        </div>
      </div>
    </div>
  );
}
