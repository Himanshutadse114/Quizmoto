import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { BookOpenCheck, Camera, CheckCircle2, Cloud, Database, ImageOff, RefreshCw, Save, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import { peekScormData, setScormData } from '../../services/scormDataCache';

function initials(value) {
  return String(value || 'U').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function resizeAvatar(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(?:png|jpeg|webp)$/i.test(file?.type || '')) {
      reject(new Error('Choose a PNG, JPEG, or WebP image.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Could not open that image.'));
      image.onload = () => {
        const side = Math.min(image.naturalWidth, image.naturalHeight);
        const size = Math.min(512, side);
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        context.drawImage(
          image,
          Math.max(0, (image.naturalWidth - side) / 2),
          Math.max(0, (image.naturalHeight - side) / 2),
          side,
          side,
          0,
          0,
          size,
          size
        );
        resolve(canvas.toDataURL('image/webp', 0.84));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function InfrastructureStatus({ icon, label, value, loading }) {
  const status = loading ? 'checking' : value?.status || 'unknown';
  const connected = status === 'connected';
  const notConfigured = status === 'not_configured';
  const statusLabel = loading
    ? 'Checking…'
    : connected
      ? 'Connected'
      : notConfigured
        ? 'Not configured'
        : 'Connection issue';
  const badgeClass = connected
    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500'
    : notConfigured
      ? 'border-amber-500/25 bg-amber-500/10 text-amber-500'
      : status === 'checking'
        ? 'border-slate-500/20 bg-slate-500/10 opacity-65'
        : 'border-rose-500/25 bg-rose-500/10 text-rose-500';

  return (
    <div className="rounded-xl border p-4 flex items-center gap-3" style={{ background: 'var(--scorm-surface-soft)' }}>
      <div className="w-10 h-10 rounded-xl grid place-items-center bg-[#4FC9BF]/10 text-[#4FC9BF] shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold">{label}</div>
        <div className="mt-1 text-[10px] opacity-55">
          {!loading && value?.latencyMs != null ? `${value.latencyMs} ms response` : value?.message || 'Verifying connection'}
        </div>
      </div>
      <span className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold whitespace-nowrap ${badgeClass}`}>
        {statusLabel}
      </span>
    </div>
  );
}

export default function AccountSettings() {
  const { token, user, updateCurrentUser } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [form, setForm] = useState({ displayName: '', avatar: null, publicaLibraryName: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [infrastructure, setInfrastructure] = useState(null);
  const [infrastructureLoading, setInfrastructureLoading] = useState(false);
  const [infrastructureError, setInfrastructureError] = useState('');
  const isSuperAdmin = Boolean(user?.isSuperAdmin || user?.role === 'super_admin');

  const loadInfrastructure = useCallback(async () => {
    if (!isSuperAdmin || !token) return;
    setInfrastructureLoading(true);
    setInfrastructureError('');
    try {
      const response = await axios.get(apiUrl('/api/scorm/access/infrastructure-health'), { headers });
      setInfrastructure(response.data || null);
    } catch (err) {
      setInfrastructureError(err.response?.data?.message || 'Could not verify platform infrastructure right now.');
    } finally {
      setInfrastructureLoading(false);
    }
  }, [headers, isSuperAdmin, token]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    axios.get(apiUrl('/api/account'), { headers })
      .then((response) => {
        if (!active) return;
        const profile = response.data?.profile || {};
        setForm({
          displayName: profile.displayName || user?.username || '',
          avatar: profile.avatar || null,
          publicaLibraryName: profile.publicaLibraryName || ''
        });
      })
      .catch((err) => active && setError(err.response?.data?.message || 'Could not load account settings.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [headers, user?.username]);

  useEffect(() => {
    loadInfrastructure();
  }, [loadInfrastructure]);

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    try {
      const avatar = await resizeAvatar(file);
      setForm((current) => ({ ...current, avatar }));
    } catch (err) {
      setError(err.message);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await axios.patch(apiUrl('/api/account'), form, { headers });
      const profile = response.data?.profile || {};
      setForm({
        displayName: profile.displayName || form.displayName,
        avatar: profile.avatar ?? form.avatar,
        publicaLibraryName: profile.publicaLibraryName || form.publicaLibraryName
      });
      updateCurrentUser({
        username: profile.displayName,
        displayName: profile.displayName,
        avatar: profile.avatar
      });
      const cachedLibrary = peekScormData('flipbook-library', token);
      if (cachedLibrary?.library) {
        setScormData('flipbook-library', token, {
          ...cachedLibrary,
          library: {
            ...cachedLibrary.library,
            title: profile.publicaLibraryName || form.publicaLibraryName
          }
        });
      }
      setMessage('Your profile and Publica library name have been updated.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save account settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-[55vh] grid place-items-center"><RefreshCw className="animate-spin opacity-40" /></div>;

  return (
    <div className="px-4 py-6 md:px-8 md:py-9 max-w-[1080px] mx-auto">
      <div className="mb-6">
        <div className="scorm-micro text-[9px] uppercase font-semibold">Personal settings</div>
        <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-[-.025em]">Your account</h1>
        <p className="mt-2 text-xs md:text-sm max-w-2xl leading-relaxed" style={{ color: 'var(--scorm-muted)' }}>Control the name and avatar people see across LMSGEN, plus the title shown on your shared Publica library.</p>
      </div>

      {message && <div className="mb-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-500"><CheckCircle2 size={14} className="inline mr-2" />{message}</div>}
      {error && <div className="mb-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-xs text-rose-500">{error}</div>}

      <form onSubmit={save} className="space-y-4">
        <section className="scorm-panel rounded-2xl border overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2"><UserRound size={16} className="text-[#4FC9BF]" /><h2 className="text-sm font-semibold">Profile</h2></div>
          <div className="p-5 grid md:grid-cols-[180px_1fr] gap-6 md:gap-8">
            <div>
              <div className="w-28 h-28 rounded-3xl border overflow-hidden grid place-items-center bg-[#4FC9BF]/10 text-[#4FC9BF] text-2xl font-semibold">
                {form.avatar ? <img src={form.avatar} alt="Avatar preview" className="w-full h-full object-cover" /> : initials(form.displayName)}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="scorm-button-secondary min-h-9 px-3 text-[10px] font-semibold inline-flex items-center gap-2 cursor-pointer"><Camera size={13} /> Upload<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={uploadAvatar} /></label>
                {form.avatar && <button type="button" onClick={() => setForm((current) => ({ ...current, avatar: null }))} className="scorm-button-secondary min-h-9 px-3 text-[10px] font-semibold inline-flex items-center gap-2"><ImageOff size={13} /> Remove</button>}
              </div>
              <p className="mt-2 text-[9px] leading-relaxed opacity-55">Square images work best. LMSGEN safely resizes your upload.</p>
            </div>

            <div className="space-y-4">
              <label className="block"><span className="text-[9px] uppercase tracking-[.08em] opacity-55">Display name</span><input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} minLength={2} maxLength={80} required className="mt-1.5 w-full h-11 rounded-xl border bg-transparent px-3.5 text-sm outline-none focus:border-[#4FC9BF]" /></label>
              <label className="block"><span className="text-[9px] uppercase tracking-[.08em] opacity-55">Email</span><input value={user?.email || ''} disabled className="mt-1.5 w-full h-11 rounded-xl border bg-transparent px-3.5 text-sm opacity-55" /></label>
              <p className="text-[10px] leading-relaxed opacity-55">Your email is your account identity and cannot be changed here.</p>
            </div>
          </div>
        </section>

        <section className="scorm-panel rounded-2xl border overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2"><BookOpenCheck size={16} className="text-[#4FC9BF]" /><div><h2 className="text-sm font-semibold">LMSGEN Publica</h2><p className="mt-0.5 text-[10px] opacity-55">This is the gallery name readers see when they open your shared library.</p></div></div>
          <div className="p-5">
            <label className="block"><span className="text-[9px] uppercase tracking-[.08em] opacity-55">Publica library name</span><input value={form.publicaLibraryName} onChange={(event) => setForm((current) => ({ ...current, publicaLibraryName: event.target.value }))} minLength={2} maxLength={180} required placeholder="My Publica Library" className="mt-1.5 w-full h-11 rounded-xl border bg-transparent px-3.5 text-sm outline-none focus:border-[#4FC9BF]" /></label>
            <p className="mt-2 text-[10px] leading-relaxed opacity-55">Your secure library link is generated automatically and remains unique to your account.</p>
          </div>
        </section>

        {isSuperAdmin && (
          <section className="scorm-panel rounded-2xl border overflow-hidden">
            <div className="px-5 py-4 border-b flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Database size={16} className="text-[#4FC9BF]" />
                <div>
                  <h2 className="text-sm font-semibold">Platform infrastructure</h2>
                  <p className="mt-0.5 text-[10px] opacity-55">Visible only to the Super Admin. Connection details and credentials are never displayed.</p>
                </div>
              </div>
              <button type="button" onClick={loadInfrastructure} disabled={infrastructureLoading} className="scorm-button-secondary min-h-9 px-3 text-[10px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
                <RefreshCw size={13} className={infrastructureLoading ? 'animate-spin' : ''} /> Refresh status
              </button>
            </div>
            <div className="p-5">
              {infrastructureError && <div className="mb-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-xs text-rose-500">{infrastructureError}</div>}
              <div className="grid gap-3 md:grid-cols-2">
                <InfrastructureStatus icon={<Database size={18} />} label="Database" value={infrastructure?.database} loading={infrastructureLoading && !infrastructure} />
                <InfrastructureStatus icon={<Cloud size={18} />} label="R2 storage" value={infrastructure?.objectStorage} loading={infrastructureLoading && !infrastructure} />
              </div>
              {infrastructure?.checkedAt && (
                <p className="mt-3 text-[9px] opacity-45">Last checked {new Date(infrastructure.checkedAt).toLocaleString()}</p>
              )}
            </div>
          </section>
        )}

        <div className="flex justify-end"><button type="submit" disabled={saving} className="scorm-button-primary min-h-11 px-5 text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50">{saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}{saving ? 'Saving…' : 'Save settings'}</button></div>
      </form>
    </div>
  );
}
