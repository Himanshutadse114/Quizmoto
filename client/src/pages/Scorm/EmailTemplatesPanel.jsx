import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Braces,
  CheckCircle2,
  Code2,
  Eye,
  Mail,
  RefreshCw,
  RotateCcw,
  Save
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';

function Notice({ notice }) {
  if (!notice) return null;
  const success = notice.type === 'success';
  return (
    <div
      className="rounded-xl border px-3.5 py-3 text-[11px] leading-relaxed"
      style={{
        borderColor: success ? 'rgba(74,222,128,.25)' : 'rgba(251,113,133,.28)',
        background: success ? 'rgba(74,222,128,.06)' : 'rgba(251,113,133,.07)',
        color: success ? '#86efac' : '#fda4af'
      }}
    >
      {notice.text}
    </div>
  );
}

export default function EmailTemplatesPanel() {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [templates, setTemplates] = useState([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);

  const selected = useMemo(
    () => templates.find((template) => template.key === selectedKey) || null,
    [templates, selectedKey]
  );

  const applyTemplate = (template) => {
    if (!template) return;
    setSubject(template.subjectTemplate || '');
    setHtml(template.htmlTemplate || '');
    setPreview(null);
    setNotice(null);
  };

  const loadTemplates = async ({ preserveSelection = true } = {}) => {
    setLoading(true);
    setNotice(null);
    try {
      const response = await axios.get(apiUrl('/api/scorm/mail/templates'), { headers });
      const rows = response.data?.templates || [];
      setTemplates(rows);
      const nextKey = preserveSelection && selectedKey && rows.some((row) => row.key === selectedKey)
        ? selectedKey
        : rows[0]?.key || '';
      setSelectedKey(nextKey);
      const next = rows.find((row) => row.key === nextKey) || rows[0] || null;
      applyTemplate(next);
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.message || 'Unable to load email templates.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadTemplates({ preserveSelection: false });
  }, [token]);

  const selectTemplate = (template) => {
    setSelectedKey(template.key);
    applyTemplate(template);
  };

  const buildPreview = async () => {
    if (!selected) return;
    setBusy('preview');
    setNotice(null);
    try {
      const response = await axios.post(
        apiUrl(`/api/scorm/mail/templates/${selected.key}/preview`),
        { subjectTemplate: subject, htmlTemplate: html },
        { headers }
      );
      setPreview(response.data?.preview || null);
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.message || 'Unable to preview this email.' });
    } finally {
      setBusy('');
    }
  };

  const saveTemplate = async () => {
    if (!selected) return;
    setBusy('save');
    setNotice(null);
    try {
      const response = await axios.put(
        apiUrl(`/api/scorm/mail/templates/${selected.key}`),
        { subjectTemplate: subject, htmlTemplate: html },
        { headers }
      );
      const saved = response.data?.template;
      if (saved) {
        setTemplates((current) => current.map((item) => item.key === saved.key ? saved : item));
        setSubject(saved.subjectTemplate || '');
        setHtml(saved.htmlTemplate || '');
      }
      setNotice({ type: 'success', text: 'Email template saved. New outgoing emails will use this version immediately.' });
      await buildPreview();
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.message || 'Unable to save this email template.' });
    } finally {
      setBusy('');
    }
  };

  const resetTemplate = async () => {
    if (!selected) return;
    if (!window.confirm(`Reset “${selected.name}” to the LMSGEN default template?`)) return;
    setBusy('reset');
    setNotice(null);
    try {
      const response = await axios.delete(apiUrl(`/api/scorm/mail/templates/${selected.key}`), { headers });
      const reset = response.data?.template;
      if (reset) {
        setTemplates((current) => current.map((item) => item.key === reset.key ? reset : item));
        setSubject(reset.subjectTemplate || '');
        setHtml(reset.htmlTemplate || '');
        setPreview(null);
      }
      setNotice({ type: 'success', text: 'Template reset to the LMSGEN default.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.message || 'Unable to reset this template.' });
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="scorm-panel rounded-2xl border overflow-hidden">
      <div className="p-4 md:p-5 border-b flex flex-col lg:flex-row lg:items-center justify-between gap-3" style={{ borderColor: 'var(--scorm-line)' }}>
        <div>
          <div className="flex items-center gap-2 text-[#4FC9BF]"><Mail size={16} /><span className="text-[9px] uppercase tracking-[.09em] font-bold">Platform email templates</span></div>
          <h2 className="text-lg font-semibold mt-1.5">Edit every outgoing email</h2>
          <p className="text-[11px] mt-1 max-w-3xl leading-relaxed" style={{ color: 'var(--scorm-muted)' }}>
            Change the subject and full HTML used for platform emails. Dynamic fields use double-curly variables such as {'{{learner_name}}'} and {'{{campaign_url}}'}.
          </p>
        </div>
        <button type="button" onClick={() => loadTemplates()} disabled={loading || Boolean(busy)} className="scorm-button-secondary h-9 px-3 inline-flex items-center justify-center gap-2 text-[10px] font-semibold disabled:opacity-50">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh templates
        </button>
      </div>

      {loading && !templates.length ? (
        <div className="p-12 text-center text-xs" style={{ color: 'var(--scorm-muted)' }}>Loading email templates…</div>
      ) : (
        <div className="grid xl:grid-cols-[270px_minmax(0,1fr)] min-h-[690px]">
          <aside className="border-r p-3 md:p-4" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>
            <div className="text-[9px] uppercase tracking-[.08em] font-semibold mb-2.5" style={{ color: 'var(--scorm-muted)' }}>{templates.length} templates</div>
            <div className="space-y-1.5 max-h-[640px] overflow-y-auto pr-1">
              {templates.map((template) => {
                const active = template.key === selectedKey;
                return (
                  <button
                    key={template.key}
                    type="button"
                    onClick={() => selectTemplate(template)}
                    className="w-full rounded-xl border px-3 py-3 text-left transition"
                    style={{
                      borderColor: active ? 'rgba(79,201,191,.5)' : 'var(--scorm-line)',
                      background: active ? 'rgba(79,201,191,.10)' : 'transparent'
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold leading-snug">{template.name}</span>
                      {template.customised && <span className="rounded-full px-1.5 py-0.5 text-[7px] uppercase font-bold border shrink-0" style={{ borderColor: 'rgba(79,201,191,.35)', color: '#4FC9BF' }}>Custom</span>}
                    </div>
                    <div className="mt-1.5 text-[9px] leading-relaxed" style={{ color: 'var(--scorm-muted)' }}>{template.description}</div>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="p-4 md:p-5 min-w-0">
            {selected ? (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{selected.name}</h3>
                      {selected.customised
                        ? <span className="rounded-full border px-2 py-1 text-[8px] font-semibold" style={{ borderColor: 'rgba(79,201,191,.3)', background: 'rgba(79,201,191,.08)', color: '#4FC9BF' }}>Custom version active</span>
                        : <span className="rounded-full border px-2 py-1 text-[8px] opacity-55">LMSGEN default</span>}
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--scorm-muted)' }}>{selected.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={resetTemplate} disabled={!selected.customised || Boolean(busy)} className="scorm-button-secondary h-9 px-3 inline-flex items-center gap-2 text-[10px] font-semibold disabled:opacity-35"><RotateCcw size={13} /> Reset</button>
                    <button type="button" onClick={buildPreview} disabled={Boolean(busy)} className="scorm-button-secondary h-9 px-3 inline-flex items-center gap-2 text-[10px] font-semibold disabled:opacity-50"><Eye size={13} /> {busy === 'preview' ? 'Building…' : 'Preview'}</button>
                    <button type="button" onClick={saveTemplate} disabled={Boolean(busy)} className="scorm-button-primary h-9 px-3 inline-flex items-center gap-2 text-[10px] font-semibold disabled:opacity-50"><Save size={13} /> {busy === 'save' ? 'Saving…' : 'Save template'}</button>
                  </div>
                </div>

                <Notice notice={notice} />

                <div className="rounded-xl border p-3.5" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>
                  <div className="flex items-center gap-2 mb-2"><Braces size={13} style={{ color: '#4FC9BF' }} /><span className="text-[9px] uppercase tracking-[.08em] font-semibold">Available variables</span></div>
                  <div className="flex flex-wrap gap-1.5">
                    {(selected.variables || []).map((variable) => (
                      <button
                        key={variable}
                        type="button"
                        title="Insert into HTML at the current cursor position by copying this variable"
                        onClick={() => navigator.clipboard?.writeText(`{{${variable}}}`)}
                        className="rounded-lg border px-2 py-1.5 text-[9px] font-mono hover:border-[#4FC9BF] transition"
                        style={{ borderColor: 'var(--scorm-line)' }}
                      >
                        {'{{'}{variable}{'}}'}
                      </button>
                    ))}
                  </div>
                  <div className="text-[9px] mt-2" style={{ color: 'var(--scorm-muted)' }}>Click a variable to copy it. Variable values are HTML-escaped before delivery.</div>
                </div>

                <label className="block">
                  <span className="text-[9px] uppercase tracking-[.08em] font-semibold">Email subject</span>
                  <input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={240} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-xs bg-transparent outline-none focus:border-[#4FC9BF]" />
                </label>

                <div className="grid 2xl:grid-cols-2 gap-4 items-start">
                  <label className="block min-w-0">
                    <span className="flex items-center gap-2 text-[9px] uppercase tracking-[.08em] font-semibold"><Code2 size={13} /> HTML editor</span>
                    <textarea
                      value={html}
                      onChange={(event) => setHtml(event.target.value)}
                      spellCheck={false}
                      className="mt-1.5 w-full min-h-[430px] rounded-xl border p-3.5 text-[11px] leading-relaxed font-mono bg-transparent outline-none focus:border-[#4FC9BF] resize-y"
                      style={{ tabSize: 2 }}
                    />
                  </label>

                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="flex items-center gap-2 text-[9px] uppercase tracking-[.08em] font-semibold"><Eye size={13} /> Email preview</span>
                      {preview?.subject && <span className="text-[9px] truncate max-w-[70%]" style={{ color: 'var(--scorm-muted)' }}>Subject: {preview.subject}</span>}
                    </div>
                    <div className="rounded-xl border overflow-hidden min-h-[430px]" style={{ borderColor: 'var(--scorm-line)', background: '#f4f7f6' }}>
                      {preview?.html ? (
                        <iframe title={`${selected.name} preview`} sandbox="" srcDoc={preview.html} className="w-full h-[520px] bg-white" />
                      ) : (
                        <button type="button" onClick={buildPreview} className="w-full h-[430px] grid place-items-center text-center p-6">
                          <span>
                            <Eye size={22} className="mx-auto mb-2" style={{ color: '#24A99D' }} />
                            <span className="block text-xs font-semibold" style={{ color: '#17312f' }}>Build a sample preview</span>
                            <span className="block text-[10px] mt-1" style={{ color: '#6a7e7b' }}>Preview uses sample data for the selected template.</span>
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {selected.customised && selected.updatedAt && (
                  <div className="flex items-center gap-2 text-[9px]" style={{ color: 'var(--scorm-muted)' }}><CheckCircle2 size={12} /> Last saved {new Date(selected.updatedAt).toLocaleString()}</div>
                )}
              </div>
            ) : (
              <div className="p-10 text-center text-xs" style={{ color: 'var(--scorm-muted)' }}>No email template selected.</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
