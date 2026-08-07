import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || '');
      const i = s.indexOf(',');
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ScormLibrary() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [packages, setPackages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [title, setTitle] = useState('');
  const [courseTitle, setCourseTitle] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const load = () =>
    axios.get(apiUrl('/api/scorm/packages'), { headers }).then((r) => setPackages(r.data || []));

  useEffect(() => {
    if (!token) return navigate('/login');
    load().catch((e) => setMsg(e.response?.data?.message || e.message));
  }, [token]);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg('Uploading & validating SCORM package…');
    try {
      const zipBase64 = await fileToBase64(file);
      const res = await axios.post(
        apiUrl('/api/scorm/packages/upload-json'),
        { zipBase64, title: title || file.name.replace(/\.zip$/i, '') },
        { headers, timeout: 120000 }
      );
      setMsg(
        `Package ${res.data.status}${res.data.entryHref ? ` · entry ${res.data.entryHref}` : ''}${
          res.data.errorMessage ? ` · ${res.data.errorMessage}` : ''
        }`
      );
      await load();
    } catch (err) {
      setMsg(err.response?.data?.message || err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const createCourse = async (packageId, defaultTitle) => {
    try {
      const res = await axios.post(
        apiUrl('/api/scorm/courses'),
        { packageId, title: courseTitle || defaultTitle || 'New course' },
        { headers }
      );
      navigate(`/scorm/courses/${res.data.id}`);
    } catch (err) {
      setMsg(err.response?.data?.message || err.message);
    }
  };

  const downloadPkg = async (id, title) => {
    try {
      const res = await axios.get(apiUrl(`/api/scorm/packages/${id}/download`), {
        headers,
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/zip' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(title || 'scorm-package').replace(/[^a-zA-Z0-9._-]+/g, '_')}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setMsg(err.response?.data?.message || err.message || 'Download failed');
    }
  };

  const editPkg = (id) => {
    navigate(`/scorm/author?edit=${id}`);
  };

  const removePkg = async (id) => {
    if (!window.confirm('Delete this package? Linked courses are archived and files are removed from storage.')) return;
    try {
      await axios.delete(apiUrl(`/api/scorm/packages/${id}`), { headers });
      await load();
    } catch (err) {
      setMsg(err.response?.data?.message || err.message);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto relative z-10">
      <button onClick={() => navigate('/scorm')} className="text-sm text-white/60 hover:text-white mb-4">
        ← SCORM World
      </button>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter mb-2">Package library</h1>
          <p className="text-white/50 text-sm">Upload SCORM ZIP or create from policy (PDF/PPT). AI ZIPs can be downloaded, re-uploaded, and edited.</p>
        </div>
        <Link
          to="/scorm/author"
          className="px-4 py-2.5 rounded-xl bg-quizmoto-yellow text-black font-black text-sm text-center"
        >
          Create from policy
        </Link>
      </div>

      <div className="rounded-2xl bg-white/5 border border-white/10 p-5 mb-8">
        <h2 className="font-black text-sm uppercase tracking-widest mb-3">Upload SCORM ZIP</h2>
        <input
          type="text"
          placeholder="Package title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full mb-3 bg-white/10 border border-white/10 rounded-xl py-2.5 px-4 font-bold text-sm text-white placeholder:text-white/30 focus:outline-none"
        />
        <label className="block">
          <span className="sr-only">Choose ZIP</span>
          <input
            type="file"
            accept=".zip,application/zip"
            disabled={uploading}
            onChange={onFile}
            className="block w-full text-sm text-white/70 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-quizmoto-blue file:text-white file:font-black file:cursor-pointer"
          />
        </label>
        {msg && <p className="mt-3 text-sm text-white/70">{msg}</p>}
        {uploading && <p className="mt-2 text-xs text-quizmoto-yellow animate-pulse">Processing…</p>}
      </div>

      <div className="space-y-3">
        {packages.length === 0 && <p className="text-white/40 text-sm">No packages yet.</p>}
        {packages.map((p) => (
          <div key={p.id} className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="font-black">{p.title}</div>
                <div className="text-xs text-white/50 mt-1">
                  {p.status} · {p.standard || 'scorm_1_2'}
                  {p.source === 'ai_author' ? ' · AI author' : ''}
                  {p.entryHref ? ` · ${p.entryHref}` : ''}
                  {p.fileCount != null ? ` · ${p.fileCount} files` : ''}
                </div>
                {p.errorMessage && <div className="text-xs text-red-300 mt-1">{p.errorMessage}</div>}
              </div>
              <div className="flex flex-wrap gap-2">
                {p.status === 'ready' && (
                  <button
                    onClick={() => createCourse(p.id, p.title)}
                    className="px-3 py-2 rounded-xl bg-quizmoto-green text-white text-xs font-black"
                  >
                    Create course
                  </button>
                )}
                {(p.status === 'ready' || p.storageKeyZip) && (
                  <button
                    onClick={() => downloadPkg(p.id, p.title)}
                    className="px-3 py-2 rounded-xl bg-quizmoto-blue text-white text-xs font-black"
                  >
                    Download ZIP
                  </button>
                )}
                {(p.source === 'ai_author' || p.analysisJson) && (
                  <button
                    onClick={() => editPkg(p.id)}
                    className="px-3 py-2 rounded-xl bg-quizmoto-yellow text-black text-xs font-black"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => removePkg(p.id)}
                  className="px-3 py-2 rounded-xl bg-white/10 text-white/60 text-xs font-bold hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <Link to="/scorm" className="text-sm text-white/50 hover:text-white">
          ← Back to SCORM home
        </Link>
      </div>
    </div>
  );
}
