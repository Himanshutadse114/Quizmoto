import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Archive,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  Download,
  FileArchive,
  FileUp,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UploadCloud
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

const MAX_SCORM_UPLOAD_MB = 100;

const Metric = ({ label, value, icon: Icon }) => (
  <div className="scorm-course-metric rounded-xl border p-4 md:p-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="scorm-display text-2xl md:text-[30px] leading-none">{value}</div>
        <div className="scorm-micro mt-2 text-[9px] uppercase font-bold">{label}</div>
      </div>
      <div className="scorm-course-metric-icon w-9 h-9 rounded-lg border grid place-items-center"><Icon size={16} /></div>
    </div>
  </div>
);

export default function ScormLibrary() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [packages, setPackages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [selectedFile, setSelectedFile] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };
  const load = () => axios.get(apiUrl('/api/scorm/packages'), { headers }).then((r) => setPackages(r.data || []));

  useEffect(() => {
    if (!token) return navigate('/login');
    load().catch((e) => setMsg(e.response?.data?.message || e.message));
  }, [token]);

  useEffect(() => {
    if (!token || !packages.some((p) => p.status === 'processing')) return undefined;
    const timer = window.setInterval(() => { load().catch(() => {}); }, 2000);
    return () => window.clearInterval(timer);
  }, [token, packages]);

  const isQuizmotoAi = (p) => p?.source === 'ai_author' || (p?.analysisJson && String(p.analysisJson).includes('quizmoto'));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return packages.filter((pkg) => {
      if (status === 'ready' && pkg.status !== 'ready') return false;
      if (status === 'processing' && pkg.status !== 'processing') return false;
      if (status === 'ai' && !isQuizmotoAi(pkg)) return false;
      if (status === 'external' && isQuizmotoAi(pkg)) return false;
      if (!q) return true;
      return `${pkg.title || ''} ${pkg.standard || ''} ${pkg.source || ''} ${pkg.entryHref || ''}`.toLowerCase().includes(q);
    });
  }, [packages, query, status]);

  const uploadFile = async (file) => {
    if (!file) return;
    const maxBytes = MAX_SCORM_UPLOAD_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      setMsg(`Maximum SCORM ZIP size is ${MAX_SCORM_UPLOAD_MB} MB.`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    setMsg('Uploading SCORM package…');
    try {
      const packageTitle = title || file.name.replace(/\.zip$/i, '');
      const res = await axios.post(apiUrl('/api/scorm/packages/upload'), file, {
        headers: { ...headers, 'Content-Type': 'application/zip', 'X-SCORM-Title': packageTitle },
        timeout: 300000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      });
      setMsg(res.data.status === 'processing' ? 'Upload complete. The package is being validated in the background.' : `Package ${res.data.status}${res.data.errorMessage ? ` · ${res.data.errorMessage}` : ''}`);
      setTitle('');
      setSelectedFile(null);
      await load();
    } catch (err) {
      setMsg(err.response?.data?.message || err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onFile = (e) => setSelectedFile(e.target.files?.[0] || null);

  const createCourse = async (packageId, defaultTitle) => {
    try {
      const res = await axios.post(apiUrl('/api/scorm/courses'), { packageId, title: defaultTitle || 'New course' }, { headers });
      navigate(`/scorm/courses/${res.data.id}`);
    } catch (err) { setMsg(err.response?.data?.message || err.message); }
  };

  const downloadPkg = async (id, packageTitle) => {
    try {
      const res = await axios.get(apiUrl(`/api/scorm/packages/${id}/download`), { headers, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/zip' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(packageTitle || 'scorm-package').replace(/[^a-zA-Z0-9._-]+/g, '_')}.zip`;
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
    } catch (err) { setMsg(err.response?.data?.message || err.message || 'Download failed'); }
  };

  const editPkg = (p) => {
    if (!isQuizmotoAi(p)) {
      setMsg('This package was not created by Quizmoto AI Author, so it cannot be edited here. Download the ZIP and edit it in the original authoring tool, or create a new course from policy.');
      return;
    }
    navigate(`/scorm/author?edit=${p.id}`);
  };

  const removePkg = async (id) => {
    if (!window.confirm('Delete this package? Linked courses are archived and files are removed from storage.')) return;
    try { await axios.delete(apiUrl(`/api/scorm/packages/${id}`), { headers }); await load(); }
    catch (err) { setMsg(err.response?.data?.message || err.message); }
  };

  const readyCount = packages.filter((p) => p.status === 'ready').length;
  const processingCount = packages.filter((p) => p.status === 'processing').length;
  const aiCount = packages.filter((p) => isQuizmotoAi(p)).length;
  const ink = { color: 'var(--scorm-ink)' };
  const muted = { color: 'var(--scorm-muted)' };
  const softSurface = { background: 'var(--scorm-surface-soft)', borderColor: 'var(--scorm-line)' };
  const surface = { background: 'var(--scorm-surface)', borderColor: 'var(--scorm-line-strong)' };

  return (
    <div className="p-4 md:p-7 lg:p-9 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-7 pb-7 border-b border-white/10">
        <div className="max-w-3xl">
          <div className="scorm-micro text-[10px] uppercase font-semibold">Content operations</div>
          <h1 className="scorm-display text-[42px] md:text-[56px] mt-2">SCORM Library</h1>
          <p className="text-sm mt-3 leading-relaxed max-w-2xl">Upload, validate and manage SCORM packages. Generated packages can be edited here, while external packages remain available for launch and download.</p>
        </div>
        <Link to="/scorm/author" className="scorm-button-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold"><Sparkles size={15} /> Create course</Link>
      </div>

      {msg && <div className="mb-5 rounded-xl border px-4 py-3 text-xs flex items-start justify-between gap-4" style={softSurface}><span style={{ color: 'var(--scorm-ink-soft)' }}>{msg}</span><button type="button" onClick={() => setMsg(null)} className="shrink-0 font-semibold" style={muted}>Dismiss</button></div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Metric label="Total packages" value={packages.length} icon={Archive} />
        <Metric label="Ready" value={readyCount} icon={CheckCircle2} />
        <Metric label="Processing" value={processingCount} icon={Clock3} />
        <Metric label="Generated" value={aiCount} icon={Sparkles} />
      </div>

      <section className="scorm-course-list-shell rounded-xl overflow-hidden border mb-6">
        <div className="scorm-course-toolbar p-4 md:p-5 border-b flex items-center justify-between gap-3">
          <div><div className="scorm-micro text-[9px] uppercase font-semibold">Upload package</div><div className="mt-1 text-base font-semibold" style={ink}>Add a SCORM ZIP</div><p className="mt-1 text-xs">ZIP files up to {MAX_SCORM_UPLOAD_MB} MB are validated before becoming available.</p></div>
          <div className="hidden sm:grid w-10 h-10 place-items-center rounded-lg border" style={{ ...softSurface, color: 'var(--scorm-accent)' }}><UploadCloud size={18} /></div>
        </div>

        <div className="p-4 md:px-5 md:pt-5 pb-0">
          <Link to="/scorm/library/publishing-guide" className="group flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border p-4 transition hover:border-[var(--scorm-accent-strong)]" style={{ borderColor: 'rgba(79,201,191,.30)', background: 'rgba(79,201,191,.07)' }}>
            <div className="flex items-start gap-3 min-w-0"><div className="w-10 h-10 rounded-xl border grid place-items-center shrink-0" style={{ borderColor: 'rgba(79,201,191,.32)', color: 'var(--scorm-accent-strong)', background: 'var(--scorm-surface)' }}><BookOpenCheck size={17} /></div><div className="min-w-0"><div className="scorm-micro text-[8px] uppercase font-semibold">Before publishing from Articulate</div><div className="text-sm font-semibold mt-1" style={ink}>Choose our LMS and build like a pro</div><p className="text-[11px] mt-1 leading-relaxed" style={muted}>Open the Storyline / Rise guide for SCORM 2004 4th Edition settings that enable richer question, answer, score and time tracking.</p></div></div><span className="scorm-button-secondary h-9 px-3 inline-flex items-center justify-center text-[10px] font-semibold shrink-0">Open guide</span>
          </Link>
        </div>

        <div className="p-4 md:p-5 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] gap-3 items-end">
          <label className="block"><span className="scorm-micro text-[9px] uppercase">Package title</span><input type="text" placeholder="Optional title" value={title} onChange={(e) => setTitle(e.target.value)} className="scorm-course-search mt-1.5 w-full px-3 py-2.5 text-sm" /></label>
          <label className="block"><span className="scorm-micro text-[9px] uppercase">SCORM ZIP</span><div className="mt-1.5 min-h-[42px] rounded-lg border px-3 flex items-center gap-3" style={surface}><FileArchive size={16} className="shrink-0" style={{ color: 'var(--scorm-accent)' }} /><span className="text-xs truncate flex-1" style={{ color: 'var(--scorm-ink-soft)' }}>{selectedFile ? selectedFile.name : 'Choose a .zip file'}</span><label className="scorm-button-secondary cursor-pointer px-3 py-2 text-[10px] font-semibold shrink-0">Browse<input ref={fileInputRef} type="file" accept=".zip,application/zip" disabled={uploading} onChange={onFile} className="sr-only" /></label></div></label>
          <button type="button" disabled={!selectedFile || uploading} onClick={() => uploadFile(selectedFile)} className="scorm-button-primary min-h-[42px] px-4 text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><FileUp size={15} /> {uploading ? 'Uploading…' : 'Upload ZIP'}</button>
        </div>
      </section>

      <section className="scorm-course-list-shell rounded-xl overflow-hidden border">
        <div className="scorm-course-toolbar p-4 md:p-5 border-b flex flex-col xl:flex-row gap-3 xl:items-center justify-between">
          <div><div className="scorm-micro text-[9px] uppercase font-semibold">Package inventory</div><div className="mt-1 text-base font-semibold" style={ink}>Available packages</div></div>
          <div className="flex flex-col md:flex-row gap-3 md:items-center flex-1 xl:justify-end"><div className="relative flex-1 max-w-md"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={muted} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search packages" className="scorm-course-search w-full pl-9 pr-3 py-2.5 text-sm" /></div><select value={status} onChange={(e) => setStatus(e.target.value)} className="scorm-course-search min-w-[170px] px-3 py-2.5 text-xs"><option value="all">All packages</option><option value="ready">Ready</option><option value="processing">Processing</option><option value="ai">Generated</option><option value="external">External</option></select></div>
        </div>

        <div className="scorm-course-rows divide-y">
          {filtered.length === 0 && <div className="p-10 text-center"><FileArchive size={24} className="mx-auto mb-3" style={muted} /><div className="text-sm font-semibold" style={ink}>No packages match this view</div><div className="text-xs mt-1" style={muted}>Try another search or upload a SCORM ZIP.</div></div>}
          {filtered.map((p) => {
            const generated = isQuizmotoAi(p);
            return <div key={p.id} className="scorm-course-row px-5 md:px-6 py-5 transition-colors"><div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_130px_150px_auto] gap-4 xl:items-center"><div className="min-w-0"><div className="flex items-center gap-2 flex-wrap min-w-0"><h3 className="font-semibold text-[14px] truncate max-w-full" title={p.title}>{p.title}</h3><span className={`scorm-course-status scorm-micro shrink-0 px-2 py-1 rounded-md text-[8px] uppercase font-semibold border ${p.status === 'ready' ? 'is-published' : 'is-draft'}`}>{p.status}</span></div><div className="scorm-micro text-[9px] mt-1 flex flex-wrap gap-x-1"><span>{p.standard || 'scorm_1_2'}</span><span>·</span><span>{generated ? 'Generated' : 'External'}</span>{p.fileCount != null && <><span>·</span><span>{p.fileCount} files</span></>}{p.entryHref && <><span>·</span><span className="truncate max-w-[260px]">{p.entryHref}</span></>}</div>{p.status === 'processing' && <div className="text-[10px] mt-2" style={{ color: 'var(--scorm-amber)' }}>Validating and extracting package…</div>}{p.errorMessage && <div className="text-[10px] mt-2" style={{ color: 'var(--scorm-red)' }}>{p.errorMessage}</div>}</div><div><div className="text-xs font-semibold" style={ink}>{generated ? 'Generated' : 'Uploaded'}</div><div className="scorm-micro text-[8px] uppercase mt-1">Source</div></div><div><div className="text-xs font-semibold" style={ink}>{p.fileCount != null ? p.fileCount : '—'}</div><div className="scorm-micro text-[8px] uppercase mt-1">Files</div></div><div className="flex flex-wrap gap-2 xl:justify-end">{p.status === 'ready' && <button onClick={() => createCourse(p.id, p.title)} className="scorm-button-primary px-3 py-2 text-[10px] font-semibold inline-flex items-center gap-1.5"><Plus size={13} /> Create course</button>}{(p.status === 'ready' || p.storageKeyZip) && <button onClick={() => downloadPkg(p.id, p.title)} className="scorm-button-secondary px-3 py-2 text-[10px] font-semibold inline-flex items-center gap-1.5"><Download size={13} /> Download</button>}<button onClick={() => editPkg(p)} disabled={!generated} title={generated ? 'Edit generated package' : 'Only generated packages can be edited'} className="scorm-button-secondary px-3 py-2 text-[10px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"><Pencil size={13} /> Edit</button><button onClick={() => removePkg(p.id)} className="px-3 py-2 rounded-lg border text-[10px] font-semibold inline-flex items-center gap-1.5" style={{ color: 'var(--scorm-red)', borderColor: 'color-mix(in srgb, var(--scorm-red) 28%, transparent)', background: 'var(--scorm-red-soft)' }}><Trash2 size={13} /> Delete</button></div></div></div>;
          })}
        </div>
      </section>
    </div>
  );
}
