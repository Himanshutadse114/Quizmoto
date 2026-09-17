import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { BarChart3, Copy, ExternalLink, Globe2, Library, Link2, RefreshCw, Save, Share2 } from 'lucide-react';
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState('');
  const [shareSlug, setShareSlug] = useState('');
  const [subdomain, setSubdomain] = useState('');

  const acceptLibrary = useCallback((next) => {
    setLibrary(next);
    setName(next?.title || '');
    setShareSlug(next?.shareSlug || '');
    setSubdomain(next?.customSubdomain || '');
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await axios.get(apiUrl(`${API}/library`), { headers });
      acceptLibrary(res.data?.library || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your shared Publica library.');
    } finally { setLoading(false); }
  }, [headers, acceptLibrary]);

  useEffect(() => { load(); }, [load]);

  const copy = async () => {
    if (!library?.shareUrl) return;
    try { await navigator.clipboard.writeText(library.shareUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1300); } catch { setError('Could not copy the library link.'); }
  };

  const share = async () => {
    if (!library?.shareUrl) return;
    try {
      if (navigator.share) await navigator.share({ title: library.title, url: library.shareUrl });
      else await copy();
    } catch { return; }
  };

  const saveBranding = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      const res = await axios.patch(apiUrl(`${API}/library`), {
        title: name,
        shareSlug,
        customSubdomain: subdomain
      }, { headers });
      acceptLibrary(res.data?.library || null);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save your Publica library settings.');
    } finally { setSaving(false); }
  };

  if (loading) return <section className="flip-admin-panel"><div className="flip-admin-loading"><RefreshCw size={16} className="animate-spin" /> Preparing your library share link…</div></section>;
  if (error) return <section className="flip-admin-panel"><div className="flip-error">{error}</div></section>;
  if (!library) return null;

  return (
    <section className="flip-admin-panel flip-library-share-panel">
      <div className="flip-section-heading">
        <div><div className="flip-kicker"><Library size={13} /> Shared Publica library</div><h2>{library.title}</h2><p>One permanent link that automatically shows all of your published publications. Individual publication links continue to work as before.</p></div>
        <div className="flip-header-actions">
          <Link to="/scorm/publica/analytics" className="flip-button-secondary"><BarChart3 size={14} /> Library analytics</Link>
          <button type="button" onClick={copy} className="flip-button-secondary"><Copy size={14} /> {copied ? 'Copied' : 'Copy library link'}</button>
          <button type="button" onClick={share} className="flip-button-secondary"><Share2 size={14} /> Share</button>
          {library.shareUrl && <a href={library.shareUrl} target="_blank" rel="noreferrer" className="flip-button-primary"><ExternalLink size={14} /> Open library</a>}
        </div>
      </div>
      <div className="flip-library-settings">
        <label className="flip-library-setting"><span>Gallery name</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={180} placeholder="Your publication library" /></label>
        <label className="flip-library-setting"><span><Link2 size={12} /> Custom library link</span><div className="flip-library-input-affix"><em>/publica-library/</em><input value={shareSlug} onChange={(event) => setShareSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} maxLength={64} placeholder={library.shareToken?.slice(0, 12)} /></div></label>
        <label className={`flip-library-setting ${library.canUseCustomSubdomain ? '' : 'is-locked'}`}><span><Globe2 size={12} /> LMSGEN subdomain {!library.canUseCustomSubdomain && <b>Paid</b>}</span><div className="flip-library-input-affix"><input value={subdomain} onChange={(event) => setSubdomain(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} maxLength={63} placeholder="yourbrand" disabled={!library.canUseCustomSubdomain} /><em>.{library.customDomainRoot}</em></div></label>
        <button type="button" className="flip-library-save" onClick={saveBranding} disabled={saving}><Save size={14} /> {saving ? 'Saving…' : saved ? 'Saved' : 'Save settings'}</button>
      </div>
      <div className="flip-library-link-preview"><Globe2 size={13} /><span>{library.shareUrl}</span></div>
      <div className="flip-library-share-summary"><strong>{library.bookCount}</strong><span>published publication{library.bookCount === 1 ? '' : 's'} currently visible in this shared library</span></div>
    </section>
  );
}
