import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Laptop,
  MousePointer2,
  Smartphone,
  Tablet,
  X
} from 'lucide-react';
import { templateById, templatesForProfile } from './courseTemplateCatalog';

function sampleItems(title) {
  const topic = String(title || 'Phishing Awareness').trim() || 'Phishing Awareness';
  return [
    { label: 'Signal 01', text: `Inspect the first important signal in ${topic}.` },
    { label: 'Signal 02', text: 'Check the context before taking action.' },
    { label: 'Signal 03', text: 'Verify unusual requests through a trusted channel.' },
    { label: 'Signal 04', text: 'Report suspicious activity through the approved process.' }
  ];
}

function TemplateInteractionDemo({ template, title, description }) {
  const items = useMemo(() => sampleItems(title), [title]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(0);
  const [revealed, setRevealed] = useState([]);
  const [choice, setChoice] = useState('');
  const [sorted, setSorted] = useState([]);
  const [sequence, setSequence] = useState([2, 0, 3, 1]);

  useEffect(() => {
    setActive(0);
    setOpen(0);
    setRevealed([]);
    setChoice('');
    setSorted([]);
    setSequence([2, 0, 3, 1]);
  }, [template.id]);

  const toggleReveal = (index) => {
    setRevealed((value) => value.includes(index) ? value.filter((item) => item !== index) : [...value, index]);
  };

  if (template.previewKind === 'flip') {
    return (
      <div className="qmx-v7-demo-grid">
        {items.map((item, index) => {
          const isOpen = revealed.includes(index);
          return (
            <button key={item.label} type="button" onClick={() => toggleReveal(index)} className={`qmx-v7-flip ${isOpen ? 'is-open' : ''}`} aria-pressed={isOpen}>
              <span className="qmx-v7-demo-index">{String(index + 1).padStart(2, '0')}</span>
              <strong>{isOpen ? item.text : item.label}</strong>
              <small>{isOpen ? 'Select to close' : 'Select to reveal'}</small>
            </button>
          );
        })}
      </div>
    );
  }

  if (template.previewKind === 'tabs') {
    return (
      <div className="qmx-v7-tabs-demo">
        <div className="qmx-v7-tab-list" role="tablist" aria-label="Template preview tabs">
          {items.map((item, index) => (
            <button key={item.label} type="button" role="tab" aria-selected={active === index} className={active === index ? 'is-active' : ''} onClick={() => setActive(index)}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="qmx-v7-tab-panel" role="tabpanel">
          <span className="qmx-v7-demo-index">{String(active + 1).padStart(2, '0')}</span>
          <h4>{items[active].label}</h4>
          <p>{items[active].text}</p>
        </div>
      </div>
    );
  }

  if (template.previewKind === 'accordion') {
    return (
      <div className="qmx-v7-accordion-demo">
        {items.map((item, index) => (
          <div key={item.label} className={open === index ? 'is-open' : ''}>
            <button type="button" onClick={() => setOpen(open === index ? -1 : index)} aria-expanded={open === index}>
              <span>{item.label}</span><span>{open === index ? '−' : '+'}</span>
            </button>
            {open === index && <p>{item.text}</p>}
          </div>
        ))}
      </div>
    );
  }

  if (template.previewKind === 'process' || template.previewKind === 'timeline') {
    return (
      <div className={`qmx-v7-step-demo ${template.previewKind === 'timeline' ? 'is-timeline' : ''}`}>
        <div className="qmx-v7-step-rail" aria-hidden="true" />
        {items.map((item, index) => (
          <button key={item.label} type="button" className={active === index ? 'is-active' : ''} onClick={() => setActive(index)}>
            <span>{index + 1}</span>
            <strong>{item.label}</strong>
          </button>
        ))}
        <div className="qmx-v7-step-copy">
          <strong>{items[active].label}</strong>
          <p>{items[active].text}</p>
        </div>
      </div>
    );
  }

  if (template.previewKind === 'hotspot') {
    return (
      <div className="qmx-v7-hotspot-demo">
        <div className="qmx-v7-mail-mock" aria-hidden="true">
          <div className="qmx-v7-mail-bar" />
          <div className="qmx-v7-mail-line short" />
          <div className="qmx-v7-mail-line" />
          <div className="qmx-v7-mail-line" />
          <div className="qmx-v7-mail-button" />
        </div>
        {[['18%', '18%'], ['78%', '31%'], ['48%', '66%'], ['82%', '78%']].map(([left, top], index) => (
          <button key={index} type="button" style={{ left, top }} className={active === index ? 'is-active' : ''} onClick={() => setActive(index)} aria-label={`Open hotspot ${index + 1}`}>
            {index + 1}
          </button>
        ))}
        <div className="qmx-v7-hotspot-copy"><strong>{items[active].label}</strong><span>{items[active].text}</span></div>
      </div>
    );
  }

  if (template.previewKind === 'scenario' || template.previewKind === 'branch') {
    const good = choice === 'verify';
    return (
      <div className="qmx-v7-scenario-demo">
        <div className="qmx-v7-scenario-message">
          <span>Urgent request</span>
          <p>A senior colleague asks you to bypass the usual process and send sensitive information immediately.</p>
        </div>
        <div className="qmx-v7-choice-grid">
          <button type="button" className={choice === 'send' ? 'is-selected' : ''} onClick={() => setChoice('send')}>Send it now</button>
          <button type="button" className={choice === 'verify' ? 'is-selected' : ''} onClick={() => setChoice('verify')}>Verify independently</button>
        </div>
        {choice && (
          <div className={`qmx-v7-feedback ${good ? 'is-good' : 'is-risk'}`}>
            <strong>{good ? 'Safer decision' : 'Risky decision'}</strong>
            <span>{good ? 'Independent verification reduces impersonation risk.' : 'Urgency should not replace the approved verification process.'}</span>
          </div>
        )}
      </div>
    );
  }

  if (template.previewKind === 'sorting') {
    return (
      <div className="qmx-v7-sort-demo">
        <div className="qmx-v7-sort-items">
          {items.slice(0, 3).map((item, index) => (
            <button key={item.label} type="button" disabled={sorted.includes(index)} onClick={() => setSorted((value) => [...value, index])}>
              {sorted.includes(index) ? <Check size={14} /> : <MousePointer2 size={14} />}{item.label}
            </button>
          ))}
        </div>
        <div className="qmx-v7-sort-targets"><span>Safe</span><span>Review</span><span>Report</span></div>
        <small>{sorted.length}/3 classified</small>
      </div>
    );
  }

  if (template.previewKind === 'sequence') {
    const move = (index, direction) => {
      const target = index + direction;
      if (target < 0 || target >= sequence.length) return;
      setSequence((current) => {
        const next = [...current];
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      });
    };
    return (
      <div className="qmx-v7-sequence-demo">
        {sequence.map((itemIndex, index) => (
          <div key={itemIndex}>
            <span>{index + 1}</span><strong>{items[itemIndex].label}</strong>
            <div><button type="button" onClick={() => move(index, -1)} disabled={index === 0}>↑</button><button type="button" onClick={() => move(index, 1)} disabled={index === sequence.length - 1}>↓</button></div>
          </div>
        ))}
      </div>
    );
  }

  if (template.previewKind === 'quiz') {
    return (
      <div className="qmx-v7-quiz-demo">
        <strong>What is the safest response?</strong>
        <div>
          {['Act immediately', 'Verify independently', 'Forward the request', 'Ignore all messages'].map((label, index) => (
            <button key={label} type="button" className={choice === String(index) ? 'is-selected' : ''} onClick={() => setChoice(String(index))}>{label}</button>
          ))}
        </div>
        {choice && <p>{choice === '1' ? 'Correct — verify through a trusted channel.' : 'Review the request before taking action.'}</p>}
      </div>
    );
  }

  return <p className="qmx-v7-demo-copy">{description || items[0].text}</p>;
}

export default function CourseTemplatePreviewModal({
  open,
  profileId = 'auto',
  initialTemplateId = '',
  topic = '',
  description = '',
  onClose,
  onUseTemplate
}) {
  const templates = useMemo(() => templatesForProfile(profileId), [profileId]);
  const initialIndex = Math.max(0, templates.findIndex((item) => item.id === initialTemplateId));
  const [index, setIndex] = useState(initialIndex);
  const [device, setDevice] = useState('desktop');

  useEffect(() => {
    if (!open) return;
    const next = Math.max(0, templates.findIndex((item) => item.id === initialTemplateId));
    setIndex(next);
    setDevice('desktop');
  }, [open, initialTemplateId, templates]);

  if (!open || typeof document === 'undefined' || !templates.length) return null;
  const template = templateById(templates[index]?.id);
  const deviceIcon = { desktop: Laptop, tablet: Tablet, mobile: Smartphone };

  return createPortal(
    <div className="qmx-v7-modal-backdrop" role="dialog" aria-modal="true" aria-label="Interaction template preview">
      <div className="qmx-v7-modal">
        <header className="qmx-v7-modal-header">
          <div>
            <span className="qmx-v7-kicker">Template preview</span>
            <h2>{template.name}</h2>
          </div>
          <button type="button" className="qmx-v7-icon-btn" onClick={onClose} aria-label="Close template preview"><X size={18} /></button>
        </header>

        <div className="qmx-v7-modal-body">
          <aside className="qmx-v7-template-rail" aria-label="Available templates">
            {templates.map((item, itemIndex) => (
              <button key={item.id} type="button" className={itemIndex === index ? 'is-active' : ''} onClick={() => setIndex(itemIndex)}>
                <span>{item.category}</span>
                <strong>{item.name}</strong>
              </button>
            ))}
          </aside>

          <main className="qmx-v7-preview-stage-wrap">
            <div className="qmx-v7-preview-toolbar">
              <div className="qmx-v7-device-switch" role="group" aria-label="Preview device">
                {Object.entries(deviceIcon).map(([id, Icon]) => (
                  <button key={id} type="button" className={device === id ? 'is-active' : ''} onClick={() => setDevice(id)} aria-label={`${id} preview`} title={`${id} preview`}>
                    <Icon size={15} /><span>{id}</span>
                  </button>
                ))}
              </div>
              <span className="qmx-v7-live-badge"><Eye size={13} /> Live preview</span>
            </div>

            <div className={`qmx-v7-device-frame is-${device}`}>
              <div className="qmx-v7-learner-preview">
                <span className="qmx-v7-learner-kicker">Interactive learning</span>
                <h3>{topic.trim() || 'Spot the warning signs'}</h3>
                <p>{description.trim() || template.description}</p>
                <TemplateInteractionDemo template={template} title={topic} description={description} />
              </div>
            </div>

            <div className="qmx-v7-preview-meta">
              <div><span>Best for</span><strong>{template.bestFor.slice(0, 2).join(' · ')}</strong></div>
              <div><span>Items</span><strong>{template.recommendedItems}</strong></div>
              <div><span>Completion</span><strong>{template.completion}</strong></div>
            </div>
          </main>
        </div>

        <footer className="qmx-v7-modal-footer">
          <div className="qmx-v7-preview-nav">
            <button type="button" className="scorm-button-secondary" onClick={() => setIndex((value) => (value - 1 + templates.length) % templates.length)}><ChevronLeft size={15} /> Previous</button>
            <span>{index + 1} / {templates.length}</span>
            <button type="button" className="scorm-button-secondary" onClick={() => setIndex((value) => (value + 1) % templates.length)}>Next <ChevronRight size={15} /></button>
          </div>
          <button type="button" className="scorm-button-primary qmx-v7-use-btn" onClick={() => onUseTemplate?.(template.id)}>
            Use this template
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
