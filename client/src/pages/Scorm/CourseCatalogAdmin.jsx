import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { BookOpen, Building2, Check, LoaderCircle, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

export default function CourseCatalogAdmin() {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [data, setData] = useState({ courses: [], tenants: [] });
  const [query, setQuery] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const response = await axios.get(apiUrl('/api/scorm/course-catalog'), { headers });
    const next = response.data || { courses: [], tenants: [] };
    setData(next);
    setTenantId((current) => current || next.tenants?.[0]?.id || '');
  }, [headers]);

  useEffect(() => { if (token) load().catch((err) => setError(err.response?.data?.message || 'Unable to load course distribution.')); }, [token, load]);

  const change = async ({ course, scope, enabled }) => {
    const key = `${scope}:${course.id}`;
    setBusy(key);
    setError('');
    setMessage('');
    try {
      const path = scope === 'default'
        ? `/api/scorm/course-catalog/defaults/${course.id}`
        : `/api/scorm/course-catalog/tenants/${tenantId}/courses/${course.id}`;
      await axios({ method: enabled ? 'put' : 'delete', url: apiUrl(path), headers });
      setMessage(enabled
        ? `“${course.title}” is now available ${scope === 'default' ? 'to every tenant and free user' : 'to the selected tenant'}.`
        : `“${course.title}” was removed from ${scope === 'default' ? 'the default catalogue' : 'the selected tenant'}.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update course availability.');
    } finally {
      setBusy('');
    }
  };

  const currentTenant = data.tenants.find((tenant) => tenant.id === tenantId) || null;
  const tenantCourses = new Set(currentTenant?.courseIds || []);
  const filtered = data.courses.filter((course) => `${course.title} ${course.description || ''}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="platform-admin-section px-4 py-6 md:px-8 md:py-8 max-w-[1280px] mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-[#4FC9BF] text-[9px] uppercase tracking-[.15em] font-semibold">Course distribution</div>
          <h1 className="mt-2 text-xl md:text-2xl font-semibold tracking-[-.02em]">Default and tenant courses</h1>
          <p className="mt-2 text-xs max-w-3xl leading-relaxed" style={{ color: 'var(--scorm-muted)' }}>Use a ready course from the Super Admin library. Default courses appear for every tenant and free account; tenant courses appear only in the selected tenant. Content files are reused while learner data stays isolated.</p>
        </div>
        <button type="button" onClick={() => load()} className="scorm-button-secondary min-h-10 px-4 inline-flex items-center gap-2 text-xs font-semibold"><RefreshCw size={14} /> Refresh</button>
      </div>

      {message && <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(20,184,166,.28)', background: 'rgba(20,184,166,.08)' }}>{message}</div>}
      {error && <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(251,113,133,.3)', background: 'rgba(251,113,133,.08)' }}>{error}</div>}

      <section className="scorm-panel rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--scorm-line)' }}>
        <div className="p-4 md:p-5 border-b grid lg:grid-cols-[1fr_360px] gap-3" style={{ borderColor: 'var(--scorm-line)' }}>
          <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--scorm-muted)' }} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Super Admin courses" className="scorm-search-input w-full min-h-11 pl-10 pr-3 text-sm" /></div>
          <label className="relative"><Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--scorm-muted)' }} /><select value={tenantId} onChange={(event) => setTenantId(event.target.value)} className="scorm-search-input w-full min-h-11 pl-10 pr-3 text-sm"><option value="">Choose a tenant</option>{data.tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}</select></label>
        </div>

        <div className="divide-y" style={{ borderColor: 'var(--scorm-line)' }}>
          {filtered.map((course) => {
            const tenantEnabled = tenantCourses.has(String(course.id));
            const tenantIncluded = course.isDefault || tenantEnabled;
            return (
              <div key={course.id} className="p-4 md:p-5 grid lg:grid-cols-[minmax(0,1fr)_220px_260px] gap-4 lg:items-center">
                <div className="min-w-0"><div className="flex items-center gap-2"><BookOpen size={15} className="shrink-0" /><h2 className="text-sm font-semibold truncate">{course.title}</h2></div><p className="text-xs mt-1.5 line-clamp-2" style={{ color: 'var(--scorm-muted)' }}>{course.description || 'Ready trackable course'}</p></div>
                <button type="button" disabled={Boolean(busy)} onClick={() => change({ course, scope: 'default', enabled: !course.isDefault })} className={`min-h-10 px-3 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-2 ${course.isDefault ? 'scorm-button-primary' : 'scorm-button-secondary'}`}>
                  {busy === `default:${course.id}` ? <LoaderCircle size={14} className="animate-spin" /> : course.isDefault ? <Check size={14} /> : <ShieldCheck size={14} />} {course.isDefault ? 'Default for everyone' : 'Make default'}
                </button>
                <button type="button" disabled={!tenantId || Boolean(busy) || course.isDefault} onClick={() => change({ course, scope: 'tenant', enabled: !tenantEnabled })} className={`min-h-10 px-3 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-45 ${tenantIncluded ? 'scorm-button-primary' : 'scorm-button-secondary'}`}>
                  {busy === `tenant:${course.id}` ? <LoaderCircle size={14} className="animate-spin" /> : tenantIncluded ? <Check size={14} /> : <Building2 size={14} />} {course.isDefault ? 'Included by default' : tenantEnabled ? 'Assigned to tenant' : 'Assign to selected tenant'}
                </button>
              </div>
            );
          })}
          {!filtered.length && <div className="p-10 text-center text-sm" style={{ color: 'var(--scorm-muted)' }}>No ready Super Admin courses match this view. Create or upload a course first, then return here.</div>}
        </div>
      </section>
    </div>
  );
}
