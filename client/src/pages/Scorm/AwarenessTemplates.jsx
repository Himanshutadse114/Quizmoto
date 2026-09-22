import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Mail,
  Plus,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Trash2,
  WandSparkles,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import './awarenessTemplates.css';

const EMPTY_GENERATOR = {
  topic: '',
  audience: 'All employees',
  goal: '',
  tone: 'clear',
  layoutId: 'auto',
  ctaUrl: '',
  organisationContext: '',
  language: 'English'
};

function apiError(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function templateDraft(template) {
  if (!template) return null;
  return {
    title: template.title || '',
    subject: template.subject || '',
    preheader: template.preheader || '',
    heroAltText: template.heroAltText || '',
    content: {
      headline: template.content?.headline || '',
      intro: template.content?.intro || '',
      bodyParagraphs: Array.isArray(template.content?.bodyParagraphs) ? [...template.content.bodyParagraphs] : [],
      keyPoints: Array.isArray(template.content?.keyPoints)
        ? template.content.keyPoints.map((item) => ({ title: item.title || '', body: item.body || '' }))
        : [],
      ctaLabel: template.content?.ctaLabel || '',
      ctaUrl: template.content?.ctaUrl || '',
      footerNote: template.content?.footerNote || ''
    }
  };
}

function Notice({ notice, dismiss }) {
  if (!notice) return null;
  return (
    <div className={`awareness-notice ${notice.type === 'success' ? 'is-success' : 'is-error'}`}>
      <span>{notice.text}</span>
      <button type="button" onClick={dismiss} aria-label="Dismiss"><X size={14} /></button>
    </div>
  );
}

function Field({ label, value, onChange, maxLength = 500, textarea = false, rows = 3, placeholder = '' }) {
  return (
    <label className="awareness-field">
      <span>{label}</span>
      {textarea
        ? <textarea rows={rows} maxLength={maxLength} value={value || ''} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
        : <input maxLength={maxLength} value={value || ''} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />}
    </label>
  );
}

function LayoutCard({ layout, active, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`awareness-layout-card ${active ? 'is-active' : ''}`}>
      <span className="awareness-layout-swatch" style={{ background: `linear-gradient(135deg, ${layout.accentSoft}, ${layout.background})` }}>
        <i style={{ background: layout.accent }} />
        <b style={{ background: layout.accent }} />
      </span>
      <span><strong>{layout.name}</strong><small>{layout.description}</small></span>
    </button>
  );
}

export default function AwarenessTemplates() {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [layouts, setLayouts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState(null);
  const [preview, setPreview] = useState(null);
  const [generator, setGenerator] = useState(EMPTY_GENERATOR);
  const [creating, setCreating] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [recipients, setRecipients] = useState('');
  const [mail, setMail] = useState({ configured: false, provider: null });
  const [maxRecipients, setMaxRecipients] = useState(50);
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);

  const selected = useMemo(
    () => templates.find((item) => item.id === selectedId) || null,
    [templates, selectedId]
  );

  const activeLayout = useMemo(
    () => layouts.find((item) => item.id === selected?.layoutId) || null,
    [layouts, selected]
  );

  const loadPreview = async (id) => {
    if (!id) return;
    const response = await axios.get(apiUrl(`/api/scorm/awareness-templates/${id}/preview`), { headers });
    setPreview(response.data?.preview || null);
  };

  const openTemplate = async (template) => {
    setSelectedId(template?.id || '');
    setDraft(templateDraft(template));
    setPreview(null);
    setCreating(false);
    setSendOpen(false);
    setRecipients('');
    if (template?.id) {
      try {
        await loadPreview(template.id);
      } catch (error) {
        setNotice({ type: 'error', text: apiError(error, 'Unable to load the email preview.') });
      }
    }
  };

  const loadWorkspace = async (keepSelection = true) => {
    setLoading(true);
    try {
      const [catalogueResponse, listResponse] = await Promise.all([
        axios.get(apiUrl('/api/scorm/awareness-templates/catalog'), { headers }),
        axios.get(apiUrl('/api/scorm/awareness-templates'), { headers })
      ]);
      const nextLayouts = catalogueResponse.data?.layouts || [];
      const nextTemplates = listResponse.data?.templates || [];
      setLayouts(nextLayouts);
      setTemplates(nextTemplates);
      setMail(catalogueResponse.data?.mail || { configured: false, provider: null });
      setMaxRecipients(catalogueResponse.data?.maxRecipientsPerSend || 50);
      const next = keepSelection
        ? nextTemplates.find((item) => item.id === selectedId) || nextTemplates[0]
        : nextTemplates[0];
      if (next) await openTemplate(next);
      else {
        setSelectedId('');
        setDraft(null);
        setPreview(null);
        setCreating(true);
      }
    } catch (error) {
      setNotice({ type: 'error', text: apiError(error, 'Unable to load Awareness Email Studio.') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadWorkspace(false);
  }, [token]);

  const generateTemplate = async () => {
    if (!generator.topic.trim()) {
      setNotice({ type: 'error', text: 'Enter an awareness topic before generating.' });
      return;
    }
    setBusy('generate');
    setNotice(null);
    try {
      const response = await axios.post(apiUrl('/api/scorm/awareness-templates/generate'), generator, { headers });
      const created = response.data?.template;
      if (!created) throw new Error('The generated template was not returned.');
      setTemplates((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setGenerator(EMPTY_GENERATOR);
      await openTemplate(created);
      setNotice({
        type: 'success',
        text: created.imageAvailable
          ? 'Awareness email created with AI copy and visual.'
          : 'Awareness email text created. The image service was unavailable, so the email uses a text-first fallback.'
      });
    } catch (error) {
      setNotice({ type: 'error', text: apiError(error, 'Unable to generate the awareness email.') });
    } finally {
      setBusy('');
    }
  };

  const persistDraft = async () => {
    if (!selected || !draft) return null;
    const response = await axios.put(
      apiUrl(`/api/scorm/awareness-templates/${selected.id}`),
      draft,
      { headers }
    );
    const saved = response.data?.template;
    if (saved) {
      setTemplates((current) => current.map((item) => item.id === saved.id ? saved : item));
      setDraft(templateDraft(saved));
    }
    return saved;
  };

  const saveAndPreview = async () => {
    setBusy('save');
    setNotice(null);
    try {
      const saved = await persistDraft();
      if (saved) await loadPreview(saved.id);
      setNotice({ type: 'success', text: 'Template text saved and preview updated.' });
    } catch (error) {
      setNotice({ type: 'error', text: apiError(error, 'Unable to save the template.') });
    } finally {
      setBusy('');
    }
  };

  const exportEml = async () => {
    if (!selected) return;
    setBusy('export');
    setNotice(null);
    try {
      await persistDraft();
      const response = await axios.post(
        apiUrl(`/api/scorm/awareness-templates/${selected.id}/export-eml`),
        {},
        { headers, responseType: 'blob' }
      );
      const disposition = response.headers?.['content-disposition'] || '';
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] || 'awareness-email.eml';
      const url = URL.createObjectURL(new Blob([response.data], { type: 'message/rfc822' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setNotice({ type: 'success', text: 'EML exported with the design and generated image embedded.' });
    } catch (error) {
      setNotice({ type: 'error', text: apiError(error, 'Unable to export the EML file.') });
    } finally {
      setBusy('');
    }
  };

  const sendTemplate = async () => {
    if (!recipients.trim()) {
      setNotice({ type: 'error', text: 'Add at least one recipient email address.' });
      return;
    }
    setBusy('send');
    setNotice(null);
    try {
      await persistDraft();
      const response = await axios.post(
        apiUrl(`/api/scorm/awareness-templates/${selected.id}/send`),
        { recipients },
        { headers }
      );
      const delivery = response.data?.delivery || {};
      setNotice({
        type: delivery.failed ? 'error' : 'success',
        text: delivery.failed
          ? `${delivery.sent || 0} sent and ${delivery.failed || 0} failed.`
          : `${delivery.sent || 0} awareness email${delivery.sent === 1 ? '' : 's'} sent successfully.`
      });
      if (!delivery.failed) {
        setSendOpen(false);
        setRecipients('');
      }
    } catch (error) {
      setNotice({ type: 'error', text: apiError(error, 'Unable to send the awareness email.') });
    } finally {
      setBusy('');
    }
  };

  const deleteTemplate = async () => {
    if (!selected || !window.confirm(`Delete “${selected.title}”? This cannot be undone.`)) return;
    setBusy('delete');
    try {
      await axios.delete(apiUrl(`/api/scorm/awareness-templates/${selected.id}`), { headers });
      const remaining = templates.filter((item) => item.id !== selected.id);
      setTemplates(remaining);
      if (remaining[0]) await openTemplate(remaining[0]);
      else {
        setSelectedId('');
        setDraft(null);
        setPreview(null);
        setCreating(true);
      }
      setNotice({ type: 'success', text: 'Awareness email deleted.' });
    } catch (error) {
      setNotice({ type: 'error', text: apiError(error, 'Unable to delete the awareness email.') });
    } finally {
      setBusy('');
    }
  };

  const setContent = (key, value) => {
    setDraft((current) => ({
      ...current,
      content: { ...current.content, [key]: value }
    }));
  };

  const updateParagraph = (index, value) => {
    setDraft((current) => {
      const list = [...current.content.bodyParagraphs];
      list[index] = value;
      return { ...current, content: { ...current.content, bodyParagraphs: list } };
    });
  };

  const updatePoint = (index, key, value) => {
    setDraft((current) => {
      const list = current.content.keyPoints.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      );
      return { ...current, content: { ...current.content, keyPoints: list } };
    });
  };

  if (loading && !layouts.length) {
    return (
      <div className="awareness-loading">
        <RefreshCw size={20} className="animate-spin" />
        Loading Awareness Email Studio…
      </div>
    );
  }

  return (
    <div className="awareness-page">
      <header className="awareness-topbar">
        <div>
          <div className="awareness-kicker"><Mail size={15} /> Awareness Email Studio</div>
          <h1>AI awareness email templates</h1>
          <p>Create an educational email, edit only its text, export an EML or send it through the platform.</p>
        </div>
        <div className="awareness-actions">
          <button type="button" className="scorm-button-secondary" onClick={() => loadWorkspace()} disabled={Boolean(busy)}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button type="button" className="scorm-button-primary" onClick={() => setCreating(true)} disabled={Boolean(busy)}>
            <Plus size={14} /> New template
          </button>
        </div>
      </header>

      <Notice notice={notice} dismiss={() => setNotice(null)} />

      <div className="awareness-workspace">
        <aside className="awareness-library">
          <div className="awareness-library-title">
            <span>Saved templates</span><strong>{templates.length}</strong>
          </div>
          <div className="awareness-library-list">
            {templates.map((template) => {
              const layout = layouts.find((item) => item.id === template.layoutId);
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => openTemplate(template)}
                  className={`awareness-template-row ${template.id === selectedId && !creating ? 'is-active' : ''}`}
                >
                  <span className="awareness-thumb" style={{ background: layout?.background || '#eef2f4' }}>
                    {template.imageUrl ? <img src={template.imageUrl} alt="" /> : <ImageIcon size={17} />}
                  </span>
                  <span>
                    <strong>{template.title}</strong>
                    <small>{layout?.name || template.layoutId}</small>
                  </span>
                </button>
              );
            })}
            {!templates.length && <div className="awareness-empty-small">No templates yet.</div>}
          </div>
        </aside>

        <main className="awareness-main">
          {creating ? (
            <section className="awareness-generator">
              <div className="awareness-section-head">
                <div>
                  <div className="awareness-kicker"><WandSparkles size={14} /> AI generator</div>
                  <h2>What should the email teach?</h2>
                  <p>AI writes structured copy and creates a topic-specific image. LMSGEN controls the email HTML and layout.</p>
                </div>
                {selected && <button type="button" className="awareness-close" onClick={() => setCreating(false)}><X size={16} /></button>}
              </div>

              <div className="awareness-generator-grid">
                <div className="awareness-form-stack">
                  <Field label="Topic *" value={generator.topic} maxLength={220} placeholder="QR code phishing, fire evacuation, data privacy…" onChange={(value) => setGenerator((current) => ({ ...current, topic: value }))} />
                  <div className="awareness-two">
                    <Field label="Audience" value={generator.audience} maxLength={160} onChange={(value) => setGenerator((current) => ({ ...current, audience: value }))} />
                    <label className="awareness-field">
                      <span>Tone</span>
                      <select value={generator.tone} onChange={(event) => setGenerator((current) => ({ ...current, tone: event.target.value }))}>
                        <option value="clear">Clear & practical</option>
                        <option value="friendly">Friendly</option>
                        <option value="calm">Calm</option>
                        <option value="executive">Executive</option>
                        <option value="urgent">High attention</option>
                      </select>
                    </label>
                  </div>
                  <Field textarea rows={3} label="Learning goal" value={generator.goal} maxLength={360} placeholder="What should readers understand or do?" onChange={(value) => setGenerator((current) => ({ ...current, goal: value }))} />
                  <Field textarea rows={3} label="Organisation context" value={generator.organisationContext} maxLength={500} placeholder="Optional policy or campaign context" onChange={(value) => setGenerator((current) => ({ ...current, organisationContext: value }))} />
                  <Field label="CTA URL (optional)" value={generator.ctaUrl} maxLength={1200} placeholder="https://…" onChange={(value) => setGenerator((current) => ({ ...current, ctaUrl: value }))} />
                </div>

                <div>
                  <div className="awareness-picker-title">
                    <strong>Choose a style</strong>
                    <small>The design stays locked after generation. Only text remains editable.</small>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGenerator((current) => ({ ...current, layoutId: 'auto' }))}
                    className={`awareness-layout-card awareness-auto ${generator.layoutId === 'auto' ? 'is-active' : ''}`}
                  >
                    <span className="awareness-layout-swatch"><Sparkles size={18} /></span>
                    <span><strong>AI choose</strong><small>Match the design to the topic.</small></span>
                  </button>
                  <div className="awareness-layout-grid">
                    {layouts.map((layout) => (
                      <LayoutCard
                        key={layout.id}
                        layout={layout}
                        active={generator.layoutId === layout.id}
                        onClick={() => setGenerator((current) => ({ ...current, layoutId: layout.id }))}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="awareness-generate-footer">
                <span><Sparkles size={14} /> Structured copy + one AI hero image + protected email layout</span>
                <button type="button" className="scorm-button-primary" onClick={generateTemplate} disabled={busy === 'generate'}>
                  {busy === 'generate' ? <RefreshCw size={14} className="animate-spin" /> : <WandSparkles size={14} />}
                  {busy === 'generate' ? 'Generating…' : 'Generate email'}
                </button>
              </div>
            </section>
          ) : selected && draft ? (
            <section className="awareness-editor">
              <div className="awareness-editor-head">
                <div>
                  <div className="awareness-kicker"><FileText size={14} /> Text-only editor</div>
                  <h2>{selected.title}</h2>
                  <div className="awareness-meta">
                    <span>{activeLayout?.name || selected.layoutId}</span>
                    <span>{selected.imageAvailable ? 'AI visual ready' : 'Text-first fallback'}</span>
                    <span>{mail.configured ? `${String(mail.provider || '').toUpperCase()} connected` : 'Mail not configured'}</span>
                  </div>
                </div>
                <div className="awareness-actions">
                  <button type="button" className="scorm-button-secondary" onClick={deleteTemplate} disabled={Boolean(busy)}><Trash2 size={14} /> Delete</button>
                  <button type="button" className="scorm-button-secondary" onClick={exportEml} disabled={Boolean(busy)}><Download size={14} /> Export EML</button>
                  <button type="button" className="scorm-button-secondary" onClick={() => setSendOpen((value) => !value)} disabled={Boolean(busy)}><Send size={14} /> Send</button>
                  <button type="button" className="scorm-button-primary" onClick={saveAndPreview} disabled={Boolean(busy)}><Save size={14} /> Save & preview</button>
                </div>
              </div>

              {sendOpen && (
                <div className="awareness-send-panel">
                  <div>
                    <strong>Send from LMSGEN</strong>
                    <small>{mail.configured ? `Using ${String(mail.provider || '').toUpperCase()}. Recipients are delivered individually for privacy.` : 'Configure SMTP or Brevo before sending.'}</small>
                  </div>
                  <Field textarea rows={3} label={`Recipients (up to ${maxRecipients})`} value={recipients} placeholder="alex@example.com, sam@example.com" onChange={setRecipients} />
                  <button type="button" className="scorm-button-primary" onClick={sendTemplate} disabled={!mail.configured || busy === 'send'}>
                    <Send size={14} /> {busy === 'send' ? 'Sending…' : 'Send email'}
                  </button>
                </div>
              )}

              <div className="awareness-editor-grid">
                <div className="awareness-copy">
                  <div className="awareness-lock-note"><FileText size={14} /> Layout and image are protected. Only the content below can be edited.</div>
                  <Field label="Template name" value={draft.title} maxLength={180} onChange={(value) => setDraft((current) => ({ ...current, title: value }))} />
                  <Field label="Email subject" value={draft.subject} maxLength={240} onChange={(value) => setDraft((current) => ({ ...current, subject: value }))} />
                  <Field label="Preheader" value={draft.preheader} maxLength={240} onChange={(value) => setDraft((current) => ({ ...current, preheader: value }))} />
                  <Field label="Headline" value={draft.content.headline} maxLength={220} onChange={(value) => setContent('headline', value)} />
                  <Field textarea rows={4} label="Introduction" value={draft.content.intro} maxLength={900} onChange={(value) => setContent('intro', value)} />

                  <div className="awareness-repeat">
                    <strong>Body copy</strong>
                    {draft.content.bodyParagraphs.map((item, index) => (
                      <Field key={`paragraph-${index}`} textarea rows={4} label={`Paragraph ${index + 1}`} value={item} maxLength={1200} onChange={(value) => updateParagraph(index, value)} />
                    ))}
                  </div>

                  <div className="awareness-repeat">
                    <strong>Key learning points</strong>
                    {draft.content.keyPoints.map((point, index) => (
                      <div className="awareness-point" key={`point-${index}`}>
                        <Field label={`Point ${index + 1} heading`} value={point.title} maxLength={120} onChange={(value) => updatePoint(index, 'title', value)} />
                        <Field textarea rows={3} label="Explanation" value={point.body} maxLength={520} onChange={(value) => updatePoint(index, 'body', value)} />
                      </div>
                    ))}
                  </div>

                  <div className="awareness-two">
                    <Field label="CTA label" value={draft.content.ctaLabel} maxLength={80} onChange={(value) => setContent('ctaLabel', value)} />
                    <Field label="CTA URL" value={draft.content.ctaUrl} maxLength={1200} onChange={(value) => setContent('ctaUrl', value)} />
                  </div>
                  <Field textarea rows={3} label="Footer note" value={draft.content.footerNote} maxLength={500} onChange={(value) => setContent('footerNote', value)} />
                  <Field label="Image alt text" value={draft.heroAltText} maxLength={320} onChange={(value) => setDraft((current) => ({ ...current, heroAltText: value }))} />
                </div>

                <div className="awareness-preview">
                  <div className="awareness-preview-title"><span><Eye size={14} /> Email preview</span><small>{preview?.subject || 'Save to refresh'}</small></div>
                  <div className="awareness-preview-frame">
                    {preview?.html
                      ? <iframe title="Awareness email preview" sandbox="allow-same-origin" srcDoc={preview.html} />
                      : <div><Eye size={24} /> Preview will appear here.</div>}
                  </div>
                  {selected.imageAvailable && (
                    <div className="awareness-lock-note"><ImageIcon size={13} /> Generated image is locked. Alt text remains editable for accessibility.</div>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <div className="awareness-empty">
              <Sparkles size={30} />
              <h2>Create your first awareness email</h2>
              <button type="button" className="scorm-button-primary" onClick={() => setCreating(true)}><Plus size={14} /> New template</button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
