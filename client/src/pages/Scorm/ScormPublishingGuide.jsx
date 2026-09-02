import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpenCheck, CheckCircle2, Clock3, FileArchive, ListChecks, Printer, ShieldCheck, Trophy } from 'lucide-react';

const trackingRows = [
  ['Completion & success', 'Yes', 'Completion status, success/pass-fail status and final state when the SCO sends them.'],
  ['Score', 'Yes', 'Raw score plus score range when provided by the course.'],
  ['Learning time', 'Yes', 'Session/total time plus LMSGEN wall-clock launch tracking.'],
  ['Bookmark / resume', 'Yes', 'Location and suspend data are retained so compatible courses can resume.'],
  ['Attempts', 'Yes', 'Launch attempts and finish/exit events are retained.'],
  ['Question text', 'Yes · SCORM 2004 recommended', 'Captured from cmi.interactions.n.description when Articulate sends it.'],
  ['Learner answer', 'Yes', 'Learner/student response is retained per interaction.'],
  ['Correct answer', 'Yes', 'Correct-response pattern is retained when sent by the course.'],
  ['Question result', 'Yes', 'Correct/incorrect result is retained per interaction.'],
  ['Response time', 'Yes', 'Interaction latency is retained when Articulate sends it.'],
  ['Answered at', 'Yes', 'SCORM 2004 interaction timestamp is retained when sent.']
];

const storySteps = [
  'In Storyline 360, choose Publish and select LMS/LRS distribution.',
  'Open Reporting and Tracking and set Report to an LMS to SCORM 2004.',
  'Choose 4th Edition.',
  'For assessment-led courses, track using the final Results slide / quiz result that should determine completion.',
  'Use Passed/Incomplete or Passed/Failed according to your completion policy.',
  'For freeform questions, place the actual question text in a title box so Storyline can send meaningful question text.',
  'Publish the course and use Articulate’s ZIP option. Upload the resulting ZIP directly to LMSGEN without extracting it.'
];

const riseSteps = [
  'In Rise 360, open the course and choose Publish, then LMS.',
  'Select SCORM 2004 and choose 4th Edition when the edition selector is available.',
  'For detailed assessment reporting, use a native Rise Quiz and select quiz-result tracking when that quiz should determine completion.',
  'Choose Passed/Incomplete or Passed/Failed according to your completion policy.',
  'Publish/export the LMS package and upload the generated ZIP directly to LMSGEN.',
  'Do not rely on an embedded Storyline block inside Rise for individual quiz-response reporting; use a native Rise Quiz when granular answers are required.'
];

function StepList({ items }) {
  return <div className="space-y-2.5">{items.map((item, index) => <div key={item} className="flex gap-3 rounded-xl border p-3.5" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}><div className="w-7 h-7 rounded-lg border grid place-items-center shrink-0 text-[11px] font-semibold" style={{ borderColor: 'var(--scorm-line)', color: 'var(--scorm-accent-strong)' }}>{index + 1}</div><div className="text-[12px] leading-relaxed" style={{ color: 'var(--scorm-ink-soft)' }}>{item}</div></div>)}</div>;
}

export default function ScormPublishingGuide() {
  return (
    <div className="p-4 md:p-7 lg:p-8 w-full max-w-none">
      <div className="max-w-[1320px] mx-auto">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-5 mb-6 pb-6 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
          <div className="max-w-3xl">
            <Link to="/scorm/library" className="inline-flex items-center gap-2 text-xs font-semibold mb-4" style={{ color: 'var(--scorm-accent-strong)' }}><ArrowLeft size={14} /> Back to Upload Course</Link>
            <div className="scorm-micro text-[10px] uppercase font-semibold">Articulate publishing guide</div>
            <h1 className="text-[30px] md:text-[38px] font-semibold tracking-[-.035em] mt-1.5">Choose our LMS and build like a pro</h1>
            <p className="text-sm mt-3 leading-relaxed" style={{ color: 'var(--scorm-ink-soft)' }}>For the richest standard question-level reporting from Articulate Storyline 360 or Rise 360, publish for <strong>SCORM 2004 · 4th Edition</strong>. LMSGEN supports SCORM 1.2 and SCORM 2004, but SCORM 2004 gives Articulate more standard fields for question text, learner responses and interaction timing.</p>
          </div>
          <button type="button" onClick={() => window.print()} className="scorm-button-secondary h-10 px-4 inline-flex items-center justify-center gap-2 text-xs font-semibold shrink-0"><Printer size={14} /> Print / save guide</button>
        </div>

        <section className="rounded-2xl border p-5 md:p-6 mb-5" style={{ borderColor: 'rgba(79,201,191,.34)', background: 'rgba(79,201,191,.08)' }}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div className="flex gap-3"><div className="w-11 h-11 rounded-xl border grid place-items-center shrink-0" style={{ borderColor: 'rgba(79,201,191,.34)', color: 'var(--scorm-accent-strong)', background: 'var(--scorm-surface)' }}><ShieldCheck size={19} /></div><div><div className="scorm-micro text-[9px] uppercase font-semibold">Recommended LMS package</div><h2 className="text-xl font-semibold mt-1">SCORM 2004 · 4th Edition</h2><p className="text-xs mt-1.5 leading-relaxed max-w-3xl" style={{ color: 'var(--scorm-ink-soft)' }}>Use this for externally authored Articulate packages when you want LMSGEN to receive the fullest SCORM interaction data that Articulate exposes.</p></div></div><div className="grid grid-cols-2 md:grid-cols-4 gap-2 lg:min-w-[480px]">{[['Questions', BookOpenCheck], ['Answers', ListChecks], ['Score', Trophy], ['Time', Clock3]].map(([label, Icon]) => <div key={label} className="rounded-xl border p-3 text-center" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface)' }}><Icon size={15} className="mx-auto" /><div className="text-[10px] font-semibold mt-1.5">{label}</div></div>)}</div></div>
        </section>

        <div className="grid xl:grid-cols-2 gap-5 mb-5">
          <section className="scorm-panel rounded-2xl border p-5 md:p-6" style={{ borderColor: 'var(--scorm-line)' }}><div className="flex items-center gap-2 mb-4"><BookOpenCheck size={17} style={{ color: 'var(--scorm-accent-strong)' }} /><div><div className="scorm-micro text-[9px] uppercase font-semibold">Storyline 360</div><h2 className="text-lg font-semibold mt-1">Recommended export workflow</h2></div></div><StepList items={storySteps} /></section>
          <section className="scorm-panel rounded-2xl border p-5 md:p-6" style={{ borderColor: 'var(--scorm-line)' }}><div className="flex items-center gap-2 mb-4"><FileArchive size={17} style={{ color: 'var(--scorm-accent-strong)' }} /><div><div className="scorm-micro text-[9px] uppercase font-semibold">Rise 360</div><h2 className="text-lg font-semibold mt-1">Recommended export workflow</h2></div></div><StepList items={riseSteps} /></section>
        </div>

        <section className="scorm-panel rounded-2xl border overflow-hidden mb-5" style={{ borderColor: 'var(--scorm-line)' }}>
          <div className="p-4 md:p-5 border-b" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}><div className="scorm-micro text-[9px] uppercase font-semibold">Tracking capability</div><h2 className="text-lg font-semibold mt-1">What LMSGEN can capture</h2><p className="text-[11px] mt-1.5" style={{ color: 'var(--scorm-muted)' }}>LMSGEN persists the CMI data that the course actually sends. Authoring and publishing settings determine which question-level fields are available.</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-[11px]"><thead><tr style={{ background: 'var(--scorm-surface-soft)' }}><th className="text-left px-4 py-3">Data</th><th className="text-left px-4 py-3">LMSGEN</th><th className="text-left px-4 py-3">Notes</th></tr></thead><tbody>{trackingRows.map(([field, support, note]) => <tr key={field} className="border-t" style={{ borderColor: 'var(--scorm-line)' }}><td className="px-4 py-3 font-semibold">{field}</td><td className="px-4 py-3"><span className="inline-flex items-center gap-1.5"><CheckCircle2 size={12} style={{ color: 'var(--scorm-accent-strong)' }} />{support}</span></td><td className="px-4 py-3" style={{ color: 'var(--scorm-muted)' }}>{note}</td></tr>)}</tbody></table></div>
        </section>

        <div className="grid lg:grid-cols-2 gap-5 mb-5">
          <section className="scorm-panel rounded-2xl border p-5" style={{ borderColor: 'var(--scorm-line)' }}><div className="scorm-micro text-[9px] uppercase font-semibold">Why not SCORM 1.2?</div><h2 className="text-base font-semibold mt-1.5">Supported, but not our first choice for external Articulate quizzes</h2><p className="text-xs leading-relaxed mt-2" style={{ color: 'var(--scorm-ink-soft)' }}>LMSGEN fully supports SCORM 1.2 and our own AI-generated courses currently use SCORM 1.2 with additional LMSGEN answer-tracking fields. For an external Articulate course, however, SCORM 2004 is preferred when readable question text and richer standard interaction evidence are important.</p></section>
          <section className="scorm-panel rounded-2xl border p-5" style={{ borderColor: 'var(--scorm-line)' }}><div className="scorm-micro text-[9px] uppercase font-semibold">Before upload</div><h2 className="text-base font-semibold mt-1.5">Final package checklist</h2><div className="mt-3 space-y-2 text-xs" style={{ color: 'var(--scorm-ink-soft)' }}>{['The ZIP contains imsmanifest.xml at the package root.', 'Upload the ZIP itself; do not upload an extracted folder.', 'Use a scored Results slide / native quiz when score and question evidence matter.', 'Give questions clear text and meaningful titles.', 'Test one learner end-to-end before assigning the package widely.', 'Exit the course normally so SCORM 2004 completion/success is committed.'].map((item) => <div key={item} className="flex gap-2"><CheckCircle2 size={13} className="shrink-0 mt-0.5" style={{ color: 'var(--scorm-accent-strong)' }} /><span>{item}</span></div>)}</div></section>
        </div>

        <div className="rounded-xl border p-4 text-[11px] leading-relaxed" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)', color: 'var(--scorm-muted)' }}><strong style={{ color: 'var(--scorm-ink)' }}>Important:</strong> No LMS can invent interaction data that an authoring tool never sends. LMSGEN stores the SCORM values it receives, so the publishing standard, quiz type and Articulate tracking configuration directly affect the detail visible in Learner Tracking and Reports.</div>
      </div>
    </div>
  );
}
