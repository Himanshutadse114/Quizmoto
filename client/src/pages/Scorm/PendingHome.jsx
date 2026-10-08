import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpen, BookOpenCheck, Check, Layers3, LockKeyhole, Sparkles } from 'lucide-react';
import { SCORM_FEATURE_GROUPS, getScormFeature } from './scormFeatureCatalog';
import './freeDemo.css';

const SALES_CONTACT_URL = 'https://www.lmsgen.in/contact';

export default function PendingScormHome() {
  return (
    <div className="lmsgen-demo-overview scorm-light-adapted p-4 md:p-6 lg:p-7 max-w-[1380px] mx-auto">
      <section className="scorm-page-hero mb-5">
        <div className="grid xl:grid-cols-[1fr_auto] gap-5 xl:items-end">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="scorm-eyebrow">Interactive platform tour</span>
              <span className="demo-status-pill"><LockKeyhole size={11} /> Demo mode</span>
            </div>
            <h1 className="demo-title">See the complete LMSGEN platform</h1>
            <p className="demo-lead">Explore every module and understand the workflow before your tenant is activated. Open the Super Admin’s demo course as a learner, use your Publica starter allowance, and inspect locked-module capabilities safely.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/scorm/courses" className="scorm-button-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold"><BookOpen size={14} /> Try demo course</Link>
            <Link to="/scorm/publica" className="scorm-button-secondary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold"><BookOpenCheck size={14} /> Open Publica</Link>
            <a href={SALES_CONTACT_URL} className="scorm-button-secondary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold">Activate LMSGEN <ArrowUpRight size={14} /></a>
          </div>
        </div>
      </section>

      <section className="demo-summary-grid mb-6" aria-label="Demo access summary">
        <div className="demo-summary-card"><Layers3 size={16} /><div><strong>{SCORM_FEATURE_GROUPS.reduce((total, group) => total + group.ids.length, 0)} modules</strong><span>Visible in this guided product tour</span></div></div>
        <div className="demo-summary-card"><LockKeyhole size={16} /><div><strong>Protected demo</strong><span>No tenant course content, learner or campaign records can be changed</span></div></div>
        <div className="demo-summary-card"><Sparkles size={16} /><div><strong>One workspace</strong><span>Create, deliver, measure and administer learning</span></div></div>
      </section>

      <div className="space-y-5">
        {SCORM_FEATURE_GROUPS.map((group) => (
          <section key={group.label} className="scorm-panel overflow-hidden">
            <div className="demo-group-heading">
              <div>
                <div className="scorm-eyebrow">{group.label}</div>
                <h2>{group.label === 'Create' ? 'Build learning content' : group.label === 'Deliver' ? 'Reach learners at scale' : group.label === 'Measure' ? 'Turn activity into evidence' : group.label === 'Engage' ? 'Make learning interactive' : 'Control the workspace'}</h2>
              </div>
              <span>{group.ids.length} module{group.ids.length === 1 ? '' : 's'}</span>
            </div>
            <div className="demo-feature-grid">
              {group.ids.map((id) => {
                const feature = getScormFeature(id);
                const isOpen = feature.demoAccess === 'open';
                return (
                  <Link key={id} to={feature.route} className="demo-feature-card group">
                    <div className="flex items-start justify-between gap-3">
                      <span className={`demo-feature-icon ${isOpen ? 'is-open' : ''}`}>{isOpen ? <Check size={14} /> : <LockKeyhole size={14} />}</span>
                      <span className={`demo-access-label ${isOpen ? 'is-open' : ''}`}>{isOpen ? (feature.demoLabel || 'Starter access') : 'Locked demo'}</span>
                    </div>
                    <h3>{feature.label}</h3>
                    <p>{feature.short}</p>
                    <span className="demo-feature-link">{isOpen ? 'Open module' : 'See capabilities'} <ArrowUpRight size={12} /></span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
