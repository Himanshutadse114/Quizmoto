import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  CirclePlay,
  Clock3,
  FileText,
  Library,
  MonitorUp,
  Play,
  QrCode,
  Radio,
  ScanText,
  ShieldCheck,
  Sparkles,
  Trophy,
  Upload,
  Users,
  WandSparkles,
  Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './WebsitePreviewDual.css';

const SHIFTING_MESSAGES = [
  { kind: 'course', text: 'DOCUMENT → AI COURSE → LMS → TRACKING' },
  { kind: 'quiz', text: 'LIVE QUIZ → PIN JOIN → PLAY → PODIUM' },
  { kind: 'course', text: 'TURN EXISTING KNOWLEDGE INTO MEASURABLE LEARNING' },
  { kind: 'quiz', text: 'TURN ANY ROOM INTO A LIVE LEARNING EXPERIENCE' }
];

const COURSE_FEATURES = [
  [Upload, 'Any document in', 'Start from the PDF, handbook, SOP, guide or source document you already have.'],
  [Sparkles, 'AI course generation', 'Generate learning objectives, visual screens, interactions and knowledge checks.'],
  [BookOpen, 'SCORM-ready output', 'Create a trackable course package ready for browser delivery.'],
  [MonitorUp, 'Built-in LMS', 'Publish, invite learners and manage the complete learning journey in SCORM World.'],
  [Activity, 'Instant learner tracking', 'Track completion, last location, score, time, status and resume state.'],
  [BarChart3, 'Reports & evidence', 'Turn learning activity into operational PDF and Excel reporting.']
];

const QUIZ_FEATURES = [
  [WandSparkles, 'Create a quiz', 'Build or reuse a quiz and launch it from the host workspace.'],
  [QrCode, 'PIN-based joining', 'Learners join the room quickly from their own device.'],
  [Radio, 'Real-time multiplayer', 'Keep every player synchronized with the current question and timer.'],
  [Zap, 'Instant feedback', 'Use countdowns, sound, answer feedback and scoring to keep energy high.'],
  [Trophy, 'Leaderboard & podium', 'Finish the session with rankings and a polished top-three podium.'],
  [BarChart3, 'Session reporting', 'Review participation and performance after the live session ends.']
];

const reveal = {
  hidden: { opacity: 0, y: 36 },
  visible: { opacity: 1, y: 0, transition: { duration: .72, ease: [0.16, 1, 0.3, 1] } }
};

function Reveal({ children, className = '', delay = 0 }) {
  return (
    <motion.div
      className={className}
      variants={reveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: .16 }}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

function HeroShift() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % SHIFTING_MESSAGES.length), 3600);
    return () => window.clearInterval(timer);
  }, []);

  const current = SHIFTING_MESSAGES[index];

  return (
    <div className={`dual-shift dual-shift-${current.kind}`} aria-live="polite">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.text}
          initial={{ opacity: 0, y: 24, filter: 'blur(7px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -24, filter: 'blur(7px)' }}
          transition={{ duration: .46, ease: [0.16, 1, 0.3, 1] }}
        >
          <span>{current.kind === 'course' ? <Sparkles size={14} /> : <Radio size={14} />}</span>
          {current.text}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function CoursePhoneState({ stage }) {
  if (stage === 0) {
    return (
      <motion.div className="dual-phone-state" key="course-upload" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
        <div className="dual-phone-kicker">01 · SOURCE DOCUMENT</div>
        <h3>Start with what you already have.</h3>
        <div className="dual-doc-main">
          <div className="dual-doc-icon"><FileText size={22} /></div>
          <div><strong>Employee Handbook.pdf</strong><small>32 pages · uploaded successfully</small></div>
          <Check size={18} />
        </div>
        <div className="dual-doc-types">
          {['Policy.pdf', 'SOP.pdf', 'Handbook.pdf', 'Training Guide.pdf', 'Manual.pdf'].map((item) => <span key={item}>{item}</span>)}
        </div>
        <div className="dual-phone-note"><Upload size={15} /> Any source document can become the starting point.</div>
      </motion.div>
    );
  }

  if (stage === 1) {
    const rows = [
      ['Reading document', 100],
      ['Extracting key concepts', 100],
      ['Creating learning objectives', 92],
      ['Building visual screens', 76],
      ['Generating knowledge checks', 58],
      ['Packaging SCORM', 31]
    ];
    return (
      <motion.div className="dual-phone-state" key="course-ai" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
        <div className="dual-phone-kicker">02 · AI COURSE GENERATION</div>
        <div className="dual-ai-symbol"><Sparkles size={28} /></div>
        <h3>Building the learning experience.</h3>
        <div className="dual-ai-rows">
          {rows.map(([label, progress], index) => (
            <div key={label}>
              <div><span>{label}</span><b>{progress === 100 ? 'Done' : `${progress}%`}</b></div>
              <i><motion.span initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: .7, delay: index * .07 }} /></i>
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  if (stage === 2) {
    return (
      <motion.div className="dual-phone-state" key="course-ready" initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .98 }}>
        <div className="dual-ready-check"><Check size={30} /></div>
        <div className="dual-phone-kicker">03 · COURSE READY</div>
        <h3>Employee Handbook Essentials</h3>
        <p className="dual-phone-copy">Structured visual learning with knowledge checks, ready for SCORM delivery and learner tracking.</p>
        <div className="dual-ready-grid">
          <div><strong>SCORM 1.2</strong><span>Trackable output</span></div>
          <div><strong>8</strong><span>Learning screens</span></div>
          <div><strong>5</strong><span>Knowledge checks</span></div>
          <div><strong>~10 min</strong><span>Typical generation flow</span></div>
        </div>
        <div className="dual-ready-status"><Activity size={16} /> TRACKING READY</div>
      </motion.div>
    );
  }

  return (
    <motion.div className="dual-phone-state" key="course-tracking" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
      <div className="dual-phone-kicker">04 · LMS TRACKING</div>
      <h3>Know exactly where learning stands.</h3>
      <div className="dual-track-stats">
        <div><strong>186</strong><span>Learners</span></div>
        <div><strong>72%</strong><span>Avg. progress</span></div>
        <div><strong>124</strong><span>Completed</span></div>
      </div>
      <div className="dual-track-rows">
        {[
          ['Aarav Mehta', 'Access control', 88],
          ['Meera Shah', 'Knowledge check', 100],
          ['Rohan Patel', 'Data handling', 64]
        ].map(([name, location, progress]) => (
          <div key={name}>
            <span><strong>{name}</strong><small>{location}</small></span>
            <i><b style={{ width: `${progress}%` }} /></i>
            <em>{progress}%</em>
          </div>
        ))}
      </div>
      <div className="dual-phone-note"><CirclePlay size={15} /> Completion · last location · score · time · resume state</div>
    </motion.div>
  );
}

function QuizPhoneState({ stage }) {
  if (stage === 0) {
    return (
      <motion.div className="dual-phone-state dual-quiz-state" key="quiz-lobby" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
        <div className="dual-phone-kicker">01 · LIVE QUIZ LOBBY</div>
        <h3>Cybersecurity Challenge</h3>
        <div className="dual-pin-card"><small>JOIN PIN</small><strong>482 916</strong></div>
        <div className="dual-player-count"><Users size={16} /><strong>38</strong> players joined</div>
        <div className="dual-player-cloud">
          {['Aarav', 'Meera', 'Rohan', 'Nisha', 'Arjun', 'Priya', 'Karan', '+31'].map((name, index) => (
            <motion.span key={name} initial={{ opacity: 0, scale: .7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * .06 }}>{name}</motion.span>
          ))}
        </div>
      </motion.div>
    );
  }

  if (stage === 1) {
    return (
      <motion.div className="dual-phone-state dual-quiz-countdown" key="quiz-countdown" initial={{ opacity: 0, scale: .92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }}>
        <div className="dual-phone-kicker">02 · GET READY</div>
        <motion.strong initial={{ scale: .5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 190 }}>3</motion.strong>
        <h3>Question incoming.</h3>
        <div className="dual-countdown-ring" />
      </motion.div>
    );
  }

  if (stage === 2 || stage === 3) {
    return (
      <motion.div className="dual-phone-state dual-quiz-state" key={stage === 2 ? 'quiz-question' : 'quiz-result'} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }}>
        <div className="dual-question-meta"><span>QUESTION 04 / 10</span><b>18</b></div>
        <h3>What should you do after a suspicious sign-in alert?</h3>
        <div className="dual-answer-list">
          <div><span>A</span> Ignore it if the password still works</div>
          <div className={stage === 3 ? 'correct' : 'selected'}><span>B</span> Change the password & review active sessions</div>
          <div><span>C</span> Forward the alert to colleagues</div>
          <div><span>D</span> Disable browser updates</div>
        </div>
        {stage === 3 && <motion.div className="dual-correct-banner" initial={{ scale: .92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}><Check size={17} /> CORRECT · +860 POINTS</motion.div>}
        <div className="dual-live-footer"><span><Users size={14} /> 38 playing</span><span><Radio size={14} /> LIVE</span></div>
      </motion.div>
    );
  }

  if (stage === 4) {
    return (
      <motion.div className="dual-phone-state dual-quiz-state" key="quiz-leaderboard" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
        <div className="dual-phone-kicker">05 · LIVE LEADERBOARD</div>
        <h3>The room moves together.</h3>
        <div className="dual-leader-list">
          {[
            ['1', 'Meera', '3,420'], ['2', 'Aarav', '3,280'], ['3', 'Rohan', '3,010'], ['4', 'Nisha', '2,840']
          ].map(([rank, name, score], index) => (
            <motion.div key={name} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .09 }}><i>{rank}</i><span>{name}</span><b>{score}</b></motion.div>
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div className="dual-phone-state dual-podium-state" key="quiz-podium" initial={{ opacity: 0, scale: .94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .98 }}>
      <div className="dual-phone-kicker">06 · FINAL PODIUM</div>
      <h3>Finish with a moment.</h3>
      <div className="dual-podium">
        <div className="second"><span>A</span><strong>Aarav</strong><i>2</i></div>
        <div className="first"><span>M</span><strong>Meera</strong><i>1</i></div>
        <div className="third"><span>R</span><strong>Rohan</strong><i>3</i></div>
      </div>
      <div className="dual-phone-note"><Trophy size={15} /> Rankings, podium and session report included</div>
    </motion.div>
  );
}

function HeroPhone() {
  const [mode, setMode] = useState('course');
  const [courseStage, setCourseStage] = useState(0);
  const [quizStage, setQuizStage] = useState(0);
  const manualPauseUntil = useRef(0);

  const selectMode = (nextMode) => {
    manualPauseUntil.current = Date.now() + 12000;
    setMode(nextMode);
    if (nextMode === 'course') setCourseStage(0);
    else setQuizStage(0);
  };

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = window.setInterval(() => {
      if (Date.now() < manualPauseUntil.current) return;
      if (mode === 'course') {
        setCourseStage((current) => {
          if (current >= 3) {
            setMode('quiz');
            setQuizStage(0);
            return 0;
          }
          return current + 1;
        });
      } else {
        setQuizStage((current) => {
          if (current >= 5) {
            setMode('course');
            setCourseStage(0);
            return 0;
          }
          return current + 1;
        });
      }
    }, 2400);
    return () => window.clearInterval(timer);
  }, [mode]);

  const productProgress = mode === 'course' ? ((courseStage + 1) / 4) * 100 : ((quizStage + 1) / 6) * 100;

  return (
    <div className="dual-device-wrap" data-scroll data-scroll-speed="0.04">
      <div className="dual-device-halo" />
      <div className="dual-phone">
        <div className="dual-phone-notch" />
        <div className="dual-phone-screen">
          <div className="dual-phone-topbar">
            <div className="dual-app-mark">Q</div>
            <div><strong>QUIZMOTO</strong><small>ONE LEARNING PLATFORM</small></div>
            <i />
          </div>
          <div className="dual-phone-tabs" role="tablist" aria-label="Quizmoto product walkthrough">
            <button type="button" role="tab" aria-selected={mode === 'course'} className={mode === 'course' ? 'active course' : ''} onClick={() => selectMode('course')}><Sparkles size={13} /> AI COURSE + LMS</button>
            <button type="button" role="tab" aria-selected={mode === 'quiz'} className={mode === 'quiz' ? 'active quiz' : ''} onClick={() => selectMode('quiz')}><Radio size={13} /> LIVE QUIZ</button>
          </div>
          <div className="dual-phone-progress"><motion.i animate={{ width: `${productProgress}%` }} transition={{ duration: .35 }} /></div>
          <AnimatePresence mode="wait">
            {mode === 'course' ? <CoursePhoneState key={`course-${courseStage}`} stage={courseStage} /> : <QuizPhoneState key={`quiz-${quizStage}`} stage={quizStage} />}
          </AnimatePresence>
        </div>
      </div>

      <div className="dual-float dual-float-course" data-scroll data-scroll-speed="0.07"><Sparkles size={15} /><span><strong>AI COURSE + LMS</strong><small>Document → course → tracking</small></span></div>
      <div className="dual-float dual-float-live" data-scroll data-scroll-speed="-0.06"><Radio size={15} /><span><strong>LIVE QUIZ</strong><small>PIN → play → podium</small></span></div>
      <div className="dual-float dual-float-proof" data-scroll data-scroll-speed="0.05"><Check size={15} /><span><strong>ONE PLATFORM</strong><small>Before, during & after learning</small></span></div>
    </div>
  );
}

function MiniCourseVisual() {
  return (
    <div className="dual-mini-product dual-mini-course">
      <div className="dual-mini-toolbar"><span>SCORM WORLD</span><b>TRACKING ACTIVE</b></div>
      <div className="dual-mini-course-body">
        <aside>{['Overview', 'Courses', 'Tracking', 'Reports'].map((item, index) => <span className={index === 2 ? 'active' : ''} key={item}>{item}</span>)}</aside>
        <main>
          <small>EMPLOYEE HANDBOOK ESSENTIALS</small>
          <h4>See exactly where learning stops.</h4>
          <div className="dual-mini-stats"><span><b>186</b>Learners</span><span><b>72%</b>Progress</span><span><b>124</b>Complete</span></div>
          <div className="dual-mini-bars">{[88, 100, 64].map((value, index) => <i key={index}><b style={{ width: `${value}%` }} /></i>)}</div>
        </main>
      </div>
    </div>
  );
}

function MiniQuizVisual() {
  return (
    <div className="dual-mini-product dual-mini-quiz">
      <div className="dual-mini-toolbar"><span>LIVE QUIZ · PIN 482 916</span><b>38 PLAYERS</b></div>
      <div className="dual-mini-quiz-body">
        <small>QUESTION 04 / 10</small>
        <h4>Which action best protects an account after a suspicious sign-in?</h4>
        <div className="dual-mini-answer-grid"><span>A</span><span className="selected">B</span><span>C</span><span>D</span></div>
        <div className="dual-mini-quiz-foot"><span><Radio size={13} /> LIVE</span><strong>18</strong></div>
      </div>
    </div>
  );
}

function DualWorkflow() {
  const course = ['Document', 'AI understands', 'Course generated', 'SCORM package', 'Published', 'Tracked'];
  const quiz = ['Quiz created', 'PIN generated', 'Players join', 'Question live', 'Scores update', 'Podium'];

  return (
    <section className="dual-workflow" id="workflow" data-scroll-section>
      <Reveal className="dual-section-head centered">
        <span>ONE PLATFORM · TWO CONTINUOUS FLOWS</span>
        <h2>Different learning moments.<br /><em>One connected system.</em></h2>
      </Reveal>
      <div className="dual-workflow-lanes">
        <Reveal className="dual-workflow-lane course">
          <div className="dual-lane-label"><Sparkles size={17} /><strong>AI COURSE + LMS</strong></div>
          <div className="dual-lane-track"><motion.i initial={{ width: 0 }} whileInView={{ width: '100%' }} viewport={{ once: true, amount: .4 }} transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }} /></div>
          <div className="dual-lane-steps">{course.map((item, index) => <div key={item}><b>{String(index + 1).padStart(2, '0')}</b><span>{item}</span></div>)}</div>
        </Reveal>
        <Reveal className="dual-workflow-lane quiz">
          <div className="dual-lane-label"><Radio size={17} /><strong>LIVE QUIZ</strong></div>
          <div className="dual-lane-track"><motion.i initial={{ width: 0 }} whileInView={{ width: '100%' }} viewport={{ once: true, amount: .4 }} transition={{ duration: 1.8, delay: .18, ease: [0.16, 1, 0.3, 1] }} /></div>
          <div className="dual-lane-steps">{quiz.map((item, index) => <div key={item}><b>{String(index + 1).padStart(2, '0')}</b><span>{item}</span></div>)}</div>
        </Reveal>
      </div>
    </section>
  );
}

function WebsitePreviewDual() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const locomotiveRef = useRef(null);
  const [scrollReady, setScrollReady] = useState(false);

  useEffect(() => {
    if (!token) navigate('/login');
  }, [token, navigate]);

  useEffect(() => {
    let cancelled = false;
    let cssLink = document.querySelector('link[data-quizmoto-locomotive]');
    if (!cssLink) {
      cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = 'https://cdn.jsdelivr.net/npm/locomotive-scroll@5.0.1/dist/locomotive-scroll.css';
      cssLink.dataset.quizmotoLocomotive = 'true';
      document.head.appendChild(cssLink);
    }

    const boot = async () => {
      try {
        const mod = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/locomotive-scroll@5.0.1/dist/locomotive-scroll.modern.mjs');
        if (cancelled) return;
        const LocomotiveScroll = mod.default;
        locomotiveRef.current = new LocomotiveScroll({ lenisOptions: { duration: 1, smoothWheel: true, wheelMultiplier: .9 } });
        setScrollReady(true);
      } catch (error) {
        console.warn('Locomotive Scroll unavailable; native scrolling remains active.', error);
      }
    };

    boot();
    return () => {
      cancelled = true;
      locomotiveRef.current?.destroy?.();
      locomotiveRef.current = null;
    };
  }, []);

  const scrollTo = (selector) => {
    const target = document.querySelector(selector);
    if (!target) return;
    if (locomotiveRef.current?.scrollTo) locomotiveRef.current.scrollTo(target, { offset: -70, duration: 1 });
    else target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="dual-site" data-scroll-container>
      <header className="dual-nav">
        <button type="button" className="dual-brand" onClick={() => navigate('/dashboard')}><span>Q</span><strong>quizmoto</strong></button>
        <nav>
          <button type="button" onClick={() => scrollTo('#two-engines')}>Two products</button>
          <button type="button" onClick={() => scrollTo('#workflow')}>How it works</button>
          <button type="button" onClick={() => scrollTo('#course-lms')}>AI Course + LMS</button>
          <button type="button" onClick={() => scrollTo('#live-quiz')}>Live Quiz</button>
        </nav>
        <div className="dual-nav-actions"><span className={scrollReady ? 'ready' : ''}><i />{scrollReady ? 'Smooth scroll' : 'Preview'}</span><button type="button" onClick={() => navigate('/dashboard')}><ArrowLeft size={15} /> Platform</button></div>
      </header>

      <main>
        <section className="dual-hero" data-scroll-section>
          <div className="dual-hero-art dual-art-a" data-scroll data-scroll-speed="0.08" />
          <div className="dual-hero-art dual-art-b" data-scroll data-scroll-speed="-0.06" />
          <motion.div className="dual-hero-eyebrow" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>AI LMS + LIVE QUIZ PLATFORM</motion.div>
          <h1>
            <span><motion.b initial={{ y: '115%' }} animate={{ y: 0 }} transition={{ duration: .8, ease: [0.16, 1, 0.3, 1] }}>TURN DOCUMENTS INTO </motion.b><motion.em initial={{ opacity: 0, rotate: -5, scale: .88 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} transition={{ delay: .34, duration: .7 }}>COURSES.</motion.em></span>
            <span><motion.b initial={{ y: '115%' }} animate={{ y: 0 }} transition={{ delay: .1, duration: .8, ease: [0.16, 1, 0.3, 1] }}>TURN LEARNING INTO </motion.b><motion.em className="live-word" initial={{ opacity: 0, rotate: 5, scale: .88 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} transition={{ delay: .48, duration: .7 }}>LIVE</motion.em><motion.b initial={{ y: '115%' }} animate={{ y: 0 }} transition={{ delay: .14, duration: .8, ease: [0.16, 1, 0.3, 1] }}> MOMENTS.</motion.b></span>
          </h1>
          <HeroShift />
          <motion.p className="dual-hero-copy" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .48, duration: .64 }}>
            Generate tracking-ready SCORM courses from documents in minutes, or run live quizzes with real-time participation, answer feedback, countdowns and podium results — all inside one connected learning platform.
          </motion.p>
          <motion.div className="dual-hero-actions" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .58, duration: .6 }}>
            <button type="button" className="dual-btn dual-btn-course" onClick={() => navigate('/scorm/author')}><Sparkles size={17} /> Explore AI Course + LMS <ArrowRight size={17} /></button>
            <button type="button" className="dual-btn dual-btn-quiz" onClick={() => scrollTo('#live-quiz')}><Radio size={17} /> Explore Live Quiz <ArrowRight size={17} /></button>
          </motion.div>
          <motion.div className="dual-hero-proof" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .7 }}>
            <span><Check size={14} /> Any document</span><span><Check size={14} /> SCORM-ready</span><span><Activity size={14} /> LMS tracking</span><span><Radio size={14} /> Real-time Live Quiz</span>
          </motion.div>
          <motion.div className="dual-hero-device" initial={{ opacity: 0, y: 44, scale: .95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: .35, duration: .95, ease: [0.16, 1, 0.3, 1] }}><HeroPhone /></motion.div>
        </section>

        <section className="dual-proof-strip" data-scroll-section>
          <div><strong>ANY DOCUMENT</strong><span>Source to structured learning</span></div>
          <div><strong>~10 MIN</strong><span>Typical AI generation flow</span></div>
          <div><strong>REAL TIME</strong><span>PIN-based multiplayer quiz</span></div>
          <div><strong>ONE PLATFORM</strong><span>Course, tracking, quiz & reports</span></div>
        </section>

        <section className="dual-two-engines" id="two-engines" data-scroll-section>
          <Reveal className="dual-section-head centered"><span>TWO EXPERIENCES · ONE LEARNING PLATFORM</span><h2>Build the course.<br /><em>Bring the room alive.</em></h2><p>Quizmoto covers both asynchronous learning and live participation without forcing teams into separate tools.</p></Reveal>
          <div className="dual-engine-grid">
            <Reveal className="dual-engine-card course">
              <div className="dual-engine-top"><span><Sparkles size={18} /> AI COURSE + LMS</span><b>01</b></div>
              <h3>Turn existing knowledge into structured, visual and measurable learning.</h3>
              <div className="dual-journey">{['DOCUMENT', 'AI', 'COURSE', 'SCORM', 'LMS', 'TRACKING'].map((item, index) => <React.Fragment key={item}><span>{item}</span>{index < 5 && <i>→</i>}</React.Fragment>)}</div>
              <MiniCourseVisual />
              <Link to="/scorm/author">Build a course <ArrowRight size={16} /></Link>
            </Reveal>
            <Reveal className="dual-engine-card quiz">
              <div className="dual-engine-top"><span><Radio size={18} /> LIVE QUIZ</span><b>02</b></div>
              <h3>Turn learning sessions into live, competitive participation.</h3>
              <div className="dual-journey">{['CREATE', 'PIN', 'JOIN', 'PLAY', 'RANK', 'PODIUM'].map((item, index) => <React.Fragment key={item}><span>{item}</span>{index < 5 && <i>→</i>}</React.Fragment>)}</div>
              <MiniQuizVisual />
              <Link to="/dashboard">Start a Live Quiz <ArrowRight size={16} /></Link>
            </Reveal>
          </div>
        </section>

        <DualWorkflow />

        <section className="dual-product-story course" id="course-lms" data-scroll-section>
          <div className="dual-story-copy"><Reveal className="dual-section-head"><span>AI COURSE + LMS</span><h2>From source document<br />to learner evidence.</h2><p>Upload any supported source, let AI create the learning experience, publish it in SCORM World and start tracking progress without a separate LMS handoff.</p></Reveal><Reveal className="dual-story-points">{['Learning objectives & visual screens', 'Knowledge checks & SCORM packaging', 'Learner invites & browser delivery', 'Completion, location, score, time & resume', 'PDF / Excel reporting'].map((item) => <span key={item}><Check size={15} />{item}</span>)}</Reveal><Reveal><Link className="dual-text-link" to="/scorm/author">Open AI Visual Author <ArrowRight size={16} /></Link></Reveal></div>
          <Reveal className="dual-story-visual"><MiniCourseVisual /></Reveal>
        </section>

        <section className="dual-product-story quiz" id="live-quiz" data-scroll-section>
          <Reveal className="dual-story-visual"><MiniQuizVisual /></Reveal>
          <div className="dual-story-copy"><Reveal className="dual-section-head"><span>LIVE QUIZ</span><h2>When learning needs<br /><em>energy in the room.</em></h2><p>Create the quiz, share the PIN and run a synchronized session with countdowns, answer feedback, sound, rankings and a final podium.</p></Reveal><Reveal className="dual-story-points">{['Real-time multiplayer', 'PIN-based joining', 'Synchronized questions & countdowns', 'Answer feedback, scoring & recovery', 'Leaderboard, podium & session reports'].map((item) => <span key={item}><Check size={15} />{item}</span>)}</Reveal><Reveal><Link className="dual-text-link" to="/dashboard">Open Live Quiz <ArrowRight size={16} /></Link></Reveal></div>
        </section>

        <section className="dual-data-section" data-scroll-section>
          <Reveal className="dual-section-head centered"><span>MEASURABLE BY DESIGN</span><h2>Know what happened.<br /><em>In courses and live sessions.</em></h2></Reveal>
          <div className="dual-data-grid">
            <Reveal className="dual-data-card course"><div className="dual-data-title"><Activity size={20} /><span>LEARNER TRACKING</span><b>LIVE</b></div><strong className="dual-big-number">72<span>%</span></strong><small>average course completion</small><div className="dual-data-bars">{[42,58,51,67,62,78,72,86,82,94].map((value,index)=><i key={index} style={{height:`${value}%`}} />)}</div><div className="dual-data-meta"><span>186 learners</span><span>124 completed</span><span>Last location tracked</span></div></Reveal>
            <Reveal className="dual-data-card quiz"><div className="dual-data-title"><Trophy size={20} /><span>LIVE QUIZ RESULTS</span><b>FINAL</b></div><strong className="dual-big-number">38</strong><small>players in the session</small><div className="dual-result-list"><span><b>1</b> Meera <em>3,420</em></span><span><b>2</b> Aarav <em>3,280</em></span><span><b>3</b> Rohan <em>3,010</em></span></div><div className="dual-data-meta"><span>10 questions</span><span>82% accuracy</span><span>Session report ready</span></div></Reveal>
          </div>
        </section>

        <section className="dual-features" data-scroll-section>
          <Reveal className="dual-section-head centered"><span>THE PLATFORM</span><h2>Everything each experience<br /><em>needs to work.</em></h2></Reveal>
          <div className="dual-feature-columns">
            <div><div className="dual-feature-heading course"><Sparkles size={18} /> AI COURSE + LMS</div>{COURSE_FEATURES.map(([Icon,title,copy],index)=><Reveal key={title} delay={index*.025}><article><div><Icon size={20}/></div><span><h3>{title}</h3><p>{copy}</p></span></article></Reveal>)}</div>
            <div><div className="dual-feature-heading quiz"><Radio size={18} /> LIVE QUIZ</div>{QUIZ_FEATURES.map(([Icon,title,copy],index)=><Reveal key={title} delay={index*.025}><article><div><Icon size={20}/></div><span><h3>{title}</h3><p>{copy}</p></span></article></Reveal>)}</div>
          </div>
        </section>

        <section className="dual-final" data-scroll-section>
          <div className="dual-final-art" data-scroll data-scroll-speed="0.06" />
          <Reveal><span>QUIZMOTO</span><h2>TWO WAYS TO MAKE<br /><em>LEARNING MATTER.</em></h2><p>Build measurable courses from the knowledge you already have. Or bring people together in a live Quizmoto session. One platform for learning before, during and after the moment.</p><div className="dual-final-actions"><button type="button" className="dual-btn dual-btn-course" onClick={() => navigate('/scorm/author')}>BUILD A COURSE <ArrowRight size={17}/></button><button type="button" className="dual-btn dual-btn-quiz" onClick={() => navigate('/dashboard')}>START A LIVE QUIZ <ArrowRight size={17}/></button></div></Reveal>
        </section>
      </main>

      <footer className="dual-footer"><div className="dual-brand"><span>Q</span><strong>quizmoto</strong></div><span>Internal website preview</span><button type="button" onClick={() => scrollTo('body')}>Back to top ↑</button></footer>
    </div>
  );
}

export default WebsitePreviewDual;
