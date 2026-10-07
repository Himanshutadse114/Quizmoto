import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, CheckCircle2, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getScormFeature } from './scormFeatureCatalog';
import './freeDemo.css';

const SALES_CONTACT_URL = 'https://www.lmsgen.in/contact';

export default function ScormFeatureLocked({ featureId }) {
  const feature = getScormFeature(featureId);
  const { refreshScormAccess } = useAuth();
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState('');

  const checkAccess = async () => {
    setChecking(true);
    setNotice('');
    try {
      const result = await refreshScormAccess();
      setNotice(result?.scormAccess && !result?.pendingApproval
        ? 'Access approved. Reloading your workspace…'
        : 'This module is still in demo mode. Contact LMSGEN to activate a tenant.');
      if (result?.scormAccess && !result?.pendingApproval) window.location.reload();
    } catch (err) {
      setNotice(err.response?.data?.message || err.message || 'Could not refresh access status.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="lmsgen-feature-preview scorm-light-adapted p-4 md:p-6 lg:p-7 max-w-[1120px] mx-auto">
      <section className="scorm-page-hero mb-5">
        <Link to="/scorm" className="inline-flex items-center gap-1.5 text-[10px] font-semibold mb-4" style={{ color: 'var(--scorm-muted)' }}><ArrowLeft size={12} /> Back to platform tour</Link>
        <div className="grid lg:grid-cols-[1fr_auto] gap-5 lg:items-end">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 mb-3"><span className="scorm-eyebrow">{feature.category} module</span><span className="demo-status-pill"><LockKeyhole size={11} /> Locked demo</span></div>
            <h1 className="demo-title">{feature.label}</h1>
            <p className="demo-lead">{feature.description}</p>
          </div>
          <a href={SALES_CONTACT_URL} className="scorm-button-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold">Unlock this module <ArrowUpRight size={14} /></a>
        </div>
      </section>

      <div className="grid lg:grid-cols-[1.35fr_.65fr] gap-5 items-start">
        <section className="scorm-panel overflow-hidden">
          <div className="demo-group-heading"><div><div className="scorm-eyebrow">Included capability</div><h2>What your team can do here</h2></div><span>{feature.capabilities.length} capabilities</span></div>
          <div className="p-4 md:p-5 grid sm:grid-cols-2 gap-3">
            {feature.capabilities.map((capability) => (
              <div key={capability} className="rounded-xl border px-4 py-3.5 flex items-start gap-3" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>
                <span className="mt-0.5 w-7 h-7 rounded-lg grid place-items-center shrink-0 border" style={{ borderColor: 'var(--scorm-line)', color: 'var(--scorm-accent-strong)' }}><CheckCircle2 size={14} /></span>
                <div className="text-xs leading-relaxed" style={{ color: 'var(--scorm-ink-soft)' }}>{capability}</div>
              </div>
            ))}
          </div>
        </section>

        <aside className="scorm-panel p-5">
          <div className="w-10 h-10 rounded-xl grid place-items-center border" style={{ borderColor: 'var(--scorm-line)', color: 'var(--scorm-accent-strong)' }}><ShieldCheck size={18} /></div>
          <div className="scorm-eyebrow mt-4">Safe product tour</div>
          <h2 className="text-[17px] mt-1 font-semibold">Explore without changing data</h2>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--scorm-muted)' }}>The navigation and capability details stay visible, while creation, uploads, learner data and live sessions remain protected until your tenant is active.</p>
          <button type="button" onClick={checkAccess} disabled={checking} className="scorm-button-secondary mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold disabled:opacity-50"><RefreshCw size={13} className={checking ? 'animate-spin' : ''} /> {checking ? 'Checking…' : 'Refresh access'}</button>
          {notice && <div className="mt-3 text-[10px] leading-relaxed" style={{ color: 'var(--scorm-accent-strong)' }}>{notice}</div>}
        </aside>
      </div>
    </div>
  );
}
