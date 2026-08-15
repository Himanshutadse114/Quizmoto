import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Gamepad2, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SCORM_FEATURE_ORDER, getScormFeature } from './scormFeatureCatalog';

const FEATURE_ROUTES = {
  author: '/scorm/author',
  courses: '/scorm/courses',
  visualStudio: '/scorm/visual-studio',
  library: '/scorm/library',
  tracking: '/scorm/tracking',
  reports: '/scorm/reports'
};

export default function PendingScormHome() {
  const { user } = useAuth();

  return (
    <div className="p-4 md:p-7 lg:p-8 max-w-[1440px] mx-auto">
      <section className="scorm-page-hero mb-6 md:mb-7">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="scorm-eyebrow">SCORM AI Platform</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#7d5427] bg-[#2b1b10] px-2.5 py-1 text-[9px] font-semibold text-[#ffc45c]"><LockKeyhole size={11} /> Approval pending</span>
            </div>
            <h1 className="scorm-display"><span>Welcome to</span> <span className="wb-accent">SCORM AI</span></h1>
            <p className="mt-3 text-sm md:text-[15px] max-w-2xl">
              Your platform account is active. Quizmoto is ready now, while SCORM AI authoring, course operations and learner intelligence unlock after administrator approval.
            </p>
          </div>
          <Link to="/scorm/quizmoto" className="scorm-button-primary inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-semibold">
            <Gamepad2 size={16} /> Open Quizmoto
          </Link>
        </div>
      </section>

      <div className="grid lg:grid-cols-[1.15fr_.85fr] gap-5 mb-6">
        <section className="rounded-3xl border border-[#9a661f] bg-[radial-gradient(circle_at_85%_15%,rgba(255,181,55,.19),transparent_35%),linear-gradient(145deg,#4c290f,#2b190e)] p-6 md:p-7 min-h-[260px] flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[.12em] font-semibold text-[#ffd27b]"><Gamepad2 size={14} /> Unlocked now</div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-[-.045em] text-[#fff1d5] mt-3">Quizmoto Live Quiz</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#e7c99b]">Create live quizzes, generate quiz drafts with AI, host real-time sessions and review Quizmoto reports while your SCORM AI approval is pending.</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/scorm/quizmoto" className="scorm-button-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold">Launch workspace <ArrowUpRight size={14} /></Link>
            <Link to="/scorm/quizmoto/create" className="scorm-button-secondary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold">Create quiz <Sparkles size={14} /></Link>
          </div>
        </section>

        <section className="scorm-panel p-5 md:p-6">
          <div className="w-11 h-11 rounded-xl grid place-items-center bg-[#3b240f] border border-[#7d5427] text-[#ffc45c]"><ShieldCheck size={19} /></div>
          <div className="scorm-eyebrow mt-5">Approval status</div>
          <h3 className="text-xl mt-1">SCORM AI features are protected</h3>
          <p className="mt-3 text-xs leading-relaxed text-[#b99670]">You can explore every capability below. Opening a locked module shows what it provides instead of blocking you at the login page.</p>
          <div className="mt-4 rounded-xl border border-[#5a3b22] bg-[#1b120c] px-3.5 py-3">
            <div className="text-[10px] uppercase tracking-[.12em] font-semibold text-[#a98259]">Approval administrator</div>
            <div className="mt-1 text-xs font-mono break-all text-[#f2d8b2]">{user?.adminContact || 'tadsehimanshu@gmail.com'}</div>
          </div>
        </section>
      </div>

      <section className="scorm-panel overflow-hidden">
        <div className="scorm-panel-header">
          <div className="scorm-eyebrow">SCORM AI capability map</div>
          <h2 className="text-[19px] mt-1">What your account unlocks after approval</h2>
          <p className="text-xs mt-2 max-w-2xl text-[#9f7c58]">The modules stay visible so you can understand the complete platform before access is granted.</p>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 p-4 md:p-5">
          {SCORM_FEATURE_ORDER.map((id) => {
            const feature = getScormFeature(id);
            return (
              <Link key={id} to={FEATURE_ROUTES[id]} className="group rounded-2xl border border-[#4e3522] bg-[#1e1510] p-4 md:p-5 transition-transform hover:-translate-y-0.5 hover:border-[#8a5a2c]">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-9 h-9 rounded-xl grid place-items-center bg-[#322013] border border-[#604020] text-[#e1a958]"><LockKeyhole size={15} /></div>
                  <span className="text-[9px] uppercase tracking-[.1em] font-semibold text-[#a98259]">Locked</span>
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-[#f4e2c5]">{feature.label}</h3>
                <p className="mt-2 text-xs leading-relaxed text-[#a98259]">{feature.short}</p>
                <div className="mt-4 text-[10px] font-semibold text-[#ffc45c] inline-flex items-center gap-1.5">Explore capability <ArrowUpRight size={12} /></div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
