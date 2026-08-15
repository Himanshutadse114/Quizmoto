import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Gamepad2, LockKeyhole, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getScormFeature } from './scormFeatureCatalog';

export default function ScormFeatureLocked({ featureId }) {
  const feature = getScormFeature(featureId);
  const { user, refreshScormAccess } = useAuth();
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState('');

  const checkAccess = async () => {
    setChecking(true);
    setNotice('');
    try {
      const result = await refreshScormAccess();
      if (result?.scormAccess && !result?.pendingApproval) {
        setNotice('Access approved. Opening the feature…');
      } else {
        setNotice('Approval is still pending. Quizmoto remains available while you wait.');
      }
    } catch (err) {
      setNotice(err.response?.data?.message || err.message || 'Could not refresh approval status.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="p-4 md:p-7 lg:p-8 max-w-[1180px] mx-auto">
      <section className="scorm-page-hero mb-5">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div className="max-w-3xl">
            <div className="scorm-eyebrow inline-flex items-center gap-2"><LockKeyhole size={12} /> Approval required</div>
            <h1 className="scorm-display mt-3"><span>{feature.label}</span></h1>
            <p className="mt-3 text-sm md:text-[15px] max-w-2xl">{feature.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/scorm/quizmoto" className="scorm-button-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold">
              <Gamepad2 size={15} /> Open Quizmoto
            </Link>
            <button type="button" onClick={checkAccess} disabled={checking} className="scorm-button-secondary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold disabled:opacity-50">
              <RefreshCw size={14} className={checking ? 'animate-spin' : ''} /> {checking ? 'Checking…' : 'Refresh approval'}
            </button>
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-[1.15fr_.85fr] gap-5 items-start">
        <section className="scorm-panel overflow-hidden">
          <div className="scorm-panel-header">
            <div className="scorm-eyebrow">What unlocks</div>
            <h2 className="text-[19px] mt-1">{feature.short}</h2>
          </div>
          <div className="p-5 md:p-6 space-y-3">
            {feature.capabilities.map((capability) => (
              <div key={capability} className="rounded-2xl border border-[#5a3b22] bg-[#24160d] px-4 py-4 flex items-start gap-3">
                <span className="mt-0.5 w-7 h-7 rounded-lg grid place-items-center shrink-0 bg-[#3b240f] border border-[#7d5427] text-[#ffc45c]"><CheckCircle2 size={15} /></span>
                <div className="text-sm leading-relaxed text-[#ead5b8]">{capability}</div>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="scorm-panel p-5 md:p-6">
            <div className="w-11 h-11 rounded-xl grid place-items-center bg-[#3b240f] border border-[#7d5427] text-[#ffc45c]"><ShieldCheck size={19} /></div>
            <div className="scorm-eyebrow mt-5">Your access state</div>
            <h3 className="text-lg mt-1">SCORM AI approval pending</h3>
            <p className="mt-3 text-xs leading-relaxed text-[#b99670]">
              Your platform account is active. SCORM AI authoring, course operations, tracking and reporting remain locked until the administrator approves your account.
            </p>
            <div className="mt-4 rounded-xl border border-[#5a3b22] bg-[#1b120c] px-3.5 py-3">
              <div className="text-[10px] uppercase tracking-[.12em] font-semibold text-[#a98259]">Administrator</div>
              <div className="mt-1 text-xs font-mono break-all text-[#f2d8b2]">{user?.adminContact || 'tadsehimanshu@gmail.com'}</div>
            </div>
            {notice && <div className="mt-3 text-xs leading-relaxed text-[#ffc45c]">{notice}</div>}
          </section>

          <section className="rounded-2xl border border-[#895817] bg-[linear-gradient(145deg,#4b270d,#2b1a0e)] p-5">
            <div className="flex items-center gap-2 text-[#ffd27b] text-xs font-semibold"><Sparkles size={15} /> Available now</div>
            <h3 className="text-lg mt-3 text-[#fff1d5]">Quizmoto Live Quiz</h3>
            <p className="mt-2 text-xs leading-relaxed text-[#e5bd84]">Create quizzes, generate questions with AI, launch live sessions and review Quizmoto reports while your SCORM AI approval is pending.</p>
            <Link to="/scorm/quizmoto" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#ffd27b]">Open Quizmoto →</Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
