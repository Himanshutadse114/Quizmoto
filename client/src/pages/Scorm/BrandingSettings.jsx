import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { ImagePlus, RefreshCw, Save, Trash2, UploadCloud } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

const MAX_LOGO_BYTES = 300 * 1024;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Unable to read file.'));
    reader.readAsDataURL(file);
  });
}

export default function BrandingSettings() {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const fileInputRef = useRef(null);

  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [savedLogoDataUrl, setSavedLogoDataUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(apiUrl('/api/scorm/branding'), { headers });
      setLogoDataUrl(res.data?.logoDataUrl || null);
      setSavedLogoDataUrl(res.data?.logoDataUrl || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load branding settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) load(); }, [token]);

  const onPickFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setMessage('');

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Logo must be a PNG, JPEG, WebP or SVG image.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError('Logo file is too large. Please upload an image under 200KB.');
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setLogoDataUrl(dataUrl);
    } catch {
      setError('Unable to read that file. Please try a different image.');
    }
  };

  const removeLogo = () => {
    setLogoDataUrl(null);
    setError('');
    setMessage('');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await axios.put(apiUrl('/api/scorm/branding'), { logoDataUrl }, { headers });
      setLogoDataUrl(res.data?.logoDataUrl || null);
      setSavedLogoDataUrl(res.data?.logoDataUrl || null);
      setMessage('Branding saved. New and rebuilt courses will show this logo automatically.');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save branding settings.');
    } finally {
      setSaving(false);
    }
  };

  const dirty = logoDataUrl !== savedLogoDataUrl;

  if (loading) {
    return <div className="p-10 text-center text-sm" style={{ color: 'var(--scorm-muted)' }}><RefreshCw className="animate-spin mx-auto mb-3" size={18} />Loading branding settings…</div>;
  }

  return (
    <div className="p-4 md:p-7 lg:p-9 max-w-4xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-7 pb-7 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
        <div className="max-w-2xl">
          <div className="scorm-micro text-[10px] uppercase font-semibold">Workspace administration</div>
          <h1 className="scorm-display text-[36px] md:text-[50px] mt-2">Branding</h1>
          <p className="text-sm mt-3 leading-relaxed" style={{ color: 'var(--scorm-ink-soft)' }}>
            Upload your organisation's logo. It appears in the top-left of every course header — new generations and rebuilds of existing courses alike — alongside the title and progress bar, without covering either.
          </p>
        </div>
        <button type="button" onClick={save} disabled={saving || !dirty} className="scorm-button-primary inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-semibold disabled:opacity-50">
          <Save size={14} /> {saving ? 'Saving…' : 'Save branding'}
        </button>
      </div>

      {message && <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(20,184,166,.28)', background: 'rgba(20,184,166,.08)' }}>{message}</div>}
      {error && <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(251,113,133,.3)', background: 'rgba(251,113,133,.08)' }}>{error}</div>}

      <section className="scorm-panel rounded-2xl border p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4"><ImagePlus size={17} /><h2 className="font-semibold">Course logo</h2></div>

        <div className="flex flex-col sm:flex-row items-start gap-5">
          <div
            className="w-full sm:w-48 h-28 rounded-xl border grid place-items-center shrink-0 overflow-hidden"
            style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}
          >
            {logoDataUrl
              ? <img src={logoDataUrl} alt="Course logo preview" style={{ height: 34, width: 'auto', maxWidth: 150, objectFit: 'contain' }} />
              : <span className="text-[11px]" style={{ color: 'var(--scorm-muted)' }}>No logo set</span>}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--scorm-muted)' }}>
              PNG, JPEG, WebP or SVG, under 200KB. The preview above shows the actual size courses will render it at.
            </p>
            <div className="flex flex-wrap gap-2">
              <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES.join(',')} className="hidden" onChange={onPickFile} />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="scorm-button-secondary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold">
                <UploadCloud size={14} /> {logoDataUrl ? 'Replace logo' : 'Upload logo'}
              </button>
              {logoDataUrl && (
                <button type="button" onClick={removeLogo} className="scorm-button-secondary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold">
                  <Trash2 size={14} /> Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
