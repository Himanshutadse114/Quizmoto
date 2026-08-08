import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
  WandSparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './WebsitePreview.css';
import './WebsitePreviewHero.css';
import './WebsitePreviewHeroLive.css';

const reveal = {
  hidden: { opacity: 0, y: 34 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.72, ease: [0.16, 1, 0.3, 1] }
  }
};

const HERO_LIVE_MESSAGES = [
  'RUN LIVE QUIZZES IN REAL TIME.',
  'LET LEARNERS JOIN WITH A PIN.',
  'SHOW INSTANT ANSWER FEEDBACK.',
  'BUILD ENERGY WITH COUNTDOWNS & SOUND.',
  'FINISH WITH A LIVE PODIUM.'
];

function Reveal({ children, className = '', delay = 0 }) {
  return (
    <motion.div
      className={className}
      variants={reveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.16 }}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

function StatusPill({ icon: Icon, children, className = '' }) {
  return (
    <div className={`slice-status-pill ${className}`}>
      {Icon && <Icon size={15} strokeWidth={2.2} />}
      <span>{children}</span>
    </div>
  );
}

function HeroLiveShift() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % HERO_LIVE_MESSAGES.length);
    }, 2800);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <motion.div
      className="slice-hero-live-shift"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: .32, duration: .58 }}
    >
      <div className="slice-hero-live-label"><Radio size={13} /> ALSO BUILT FOR LIVE LEARNING</div>
      <div className="slice-hero-live-window" aria-live="polite">
        <motion.span
          key={HERO_LIVE_MESSAGES[index]}
          initial={{ opacity: 0, y: 22, rotateX: 22 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: .48, ease: [0.16, 1, 0.3, 1] }}
        >
          {HERO_LIVE_MESSAGES[index]}
        </motion.span>
      </div>
    </motion.div>
  );
}

function HeroPhone() {
  const [mode, setMode] = useState('course');
  const steps = [
    ['Document understood', '100%'],
    ['Learning flow', 'Ready'],
    ['Visual course', 'Ready'],
    ['SCORM package', 'Ready']
  ];

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setMode((current) => (current === 'course' ? 'quiz' : 'course'));
    }, 6200);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="slice-phone-wrap" data-scroll data-scroll-speed="0.055">
      <div className="slice-phone">
        <div className="slice-phone-speaker" />
        <div className="slice-phone-screen">
          <div className="slice-app-topline">
            <span className="slice-app-logo">Q</span>
            <span>QUIZMOTO LEARNING PLATFORM</span>
            <i />
          </div>

          <div className="slice-phone-product-tabs" role="tablist" aria-label="Quizmoto product preview">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'course'}
              className={mode === 'course' ? 'active' : ''}
              onClick={() => setMode('course')}
            >
              <Sparkles size={13} /> AI Course
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'quiz'}
              className={mode === 'quiz' ? 'active' : ''}
              onClick={() => setMode('quiz')}
            >
              <Radio size={13} /> Live Quiz
            </button>
          </div>

          {mode === 'course' ? (
            <motion.div
              key="course-mode"
              className="slice-phone-mode slice-phone-mode-course"
              initial={{ opacity: 0, x: -18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: .46, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="slice-pdf-chip">
                <div><FileText size={21} /></div>
                <span><strong>Employee Handbook.pdf</strong><small>42 pages · uploaded</small></span>
                <Check size={18} />
              </div>

              <div className="slice-ai-orbit">
                <span><Sparkles size={30} /></span>
                <div>Building your course</div>
                <small>AI is turning your document into learning</small>
              </div>

              <div className="slice-build-steps">
                {steps.map(([name, value], index) => (
                  <div key={name}>
                    <i>{index + 1}</i>
                    <span>{name}</span>
                    <b>{value}</b>
                  </div>
                ))}
              </div>

              <div className="slice-course-ready">
                <small>COURSE READY</small>
                <strong>Employee Handbook Essentials</strong>
                <div><span>SCORM 1.2</span><span>8 screens</span><span>5 checks</span></div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="quiz-mode"
              className="slice-phone-mode slice-phone-live"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: .46, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="slice-phone-live-head">
                <div>
                  <small>LIVE SESSION</small>
                  <strong>Cybersecurity Challenge</strong>
                </div>
                <span className="slice-phone-live-pin">PIN 482 916</span>
              </div>

              <div className="slice-phone-live-question-meta">
                <span>QUESTION 04 / 10</span>
                <span className="slice-phone-live-timer">18</span>
              </div>

              <h3>What should you do after a suspicious sign-in alert?</h3>

              <div className="slice-phone-live-answers">
                <div><span>A</span> Ignore it if the password still works</div>
                <div className="selected"><span>B</span> Change the password & review active sessions</div>
                <div><span>C</span> Forward the alert to colleagues</div>
                <div><span>D</span> Disable browser updates</div>
              </div>

              <div className="slice-phone-live-stats">
                <span><Users size={13} /> 38 playing</span>
                <span><Radio size={13} /> Live</span>
              </div>

              <div className="slice-phone-live-leaderboard">
                <small>LIVE LEADERBOARD</small>
                <div><i>1</i><span>Meera</span><b>3,420</b></div>
                <div><i>2</i><span>Aarav</span><b>3,280</b></div>
                <div><i>3</i><span>Rohan</span><b>3,010</b></div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {mode === 'course' ? (
        <>
          <StatusPill icon={Clock3} className="slice-float-pill slice-float-time">~10 min to tracking-ready</StatusPill>
          <StatusPill icon={Activity} className="slice-float-pill slice-float-track">Tracking active</StatusPill>
          <StatusPill icon={Check} className="slice-float-pill slice-float-scorm">SCORM ready</StatusPill>
        </>
      ) : (
        <>
          <StatusPill icon={Users} className="slice-float-pill slice-float-players">38 players joined</StatusPill>
          <StatusPill icon={QrCode} className="slice-float-pill slice-float-pin">PIN 482 916</StatusPill>
          <StatusPill icon={Radio} className="slice-float-pill slice-float-live">Live session</StatusPill>
        </>
      )}
    </div>
  );
}

function CourseMockup() {
  return (
    <div className="slice-course-window" data-scroll data-scroll-speed="-0.04">
      <div className="slice-window-top">
        <div><span /> <span /> <span /></div>
        <strong>Security Policy Essentials</strong>
        <small>04 / 08</small>
      </div>
      <div className="slice-course-body">
        <aside>
          <div className="active"><i>01</i><span>Policy overview</span></div>
          <div><i>02</i><span>Access control</span></div>
          <div><i>03</i><span>Data handling</span></div>
          <div><i>04</i><span>Report incidents</span></div>
          <div><i>05</i><span>Knowledge check</span></div>
        </aside>
        <main>
          <div className="slice-course-kicker">DATA HANDLING</div>
          <h3>Handle sensitive information with intent.</h3>
          <p>The source document is transformed into focused learning moments instead of being placed inside a document viewer.</p>
          <div className="slice-learning-cards">
            <article><span>01</span><strong>Classify</strong><small>Know what type of information you are handling.</small></article>
            <article><span>02</span><strong>Protect</strong><small>Use approved storage, sharing and access controls.</small></article>
            <article><span>03</span><strong>Report</strong><small>Escalate loss, exposure or suspicious access quickly.</small></article>
          </div>
          <div className="slice-course-progress"><i style={{ width: '58%' }} /></div>
          <div className="slice-course-nav"><span>58% complete</span><button type="button">Continue <ArrowRight size={14} /></button></div>
        </main>
      </div>
    </div>
  );
}

function TrackingMockup() {
  const people = [
    ['Aarav Mehta', 'Access control', 88, 'In progress'],
    ['Meera Shah', 'Knowledge check', 100, 'Completed'],
    ['Rohan Patel', 'Data handling', 64, 'In progress'],
    ['Nisha Rao', 'Policy overview', 24, 'In progress']
  ];

  return (
    <div className="slice-tracking-window" data-scroll data-scroll-speed="0.035">
      <div className="slice-track-head">
        <div><small>LEARNER TRACKING</small><strong>Security Policy Essentials</strong></div>
        <StatusPill icon={Radio}>Live</StatusPill>
      </div>
      <div className="slice-track-stats">
        <div><strong>186</strong><span>Learners</span></div>
        <div><strong>72%</strong><span>Average progress</span></div>
        <div><strong>124</strong><span>Completed</span></div>
      </div>
      <div className="slice-track-list">
        {people.map(([name, location, progress, status]) => (
          <div className="slice-track-row" key={name}>
            <div className="slice-avatar">{name.split(' ').map((part) => part[0]).join('')}</div>
            <div className="slice-track-person"><strong>{name}</strong><small>{location}</small></div>
            <div className="slice-track-bar"><i style={{ width: `${progress}%` }} /></div>
            <b>{progress}%</b>
            <span className={status === 'Completed' ? 'complete' : ''}>{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuizMockup() {
  return (
    <div className="slice-quiz-card" data-scroll data-scroll-speed="-0.035">
      <div className="slice-quiz-meta"><span>LIVE QUIZ · QUESTION 4/10</span><b>18</b></div>
      <h3>What should you do after a suspicious sign-in alert?</h3>
      <div className="slice-quiz-answers">
        <div>Ignore it</div><div className="selected">Change the password & review sessions</div><div>Forward the alert</div><div>Disable updates</div>
      </div>
      <div className="slice-quiz-footer"><span><Users size={15} /> 38 playing</span><span><Radio size={15} /> Live</span></div>
    </div>
  );
}

const SCORM_FEATURES = [
  [Upload, 'Document upload', 'Start with the source document your teams already use.'],
  [Sparkles, 'AI course generation', 'AI structures the source into learning objectives, visual screens and knowledge checks.'],
  [BookOpen, 'SCORM-ready output', 'Generate a standards-based package ready for delivery and tracking.'],
  [MonitorUp, 'Built-in LMS', 'Publish courses, invite learners and manage delivery from SCORM World.'],
  [Activity, 'Instant tracking', 'Completion, location, status, score and time begin flowing as learners progress.'],
  [CirclePlay, 'Resume-aware learning', 'Learners can continue where they stopped instead of restarting.'],
  [Library, 'Package library', 'Upload, validate, organize and reuse learning packages.'],
  [BarChart3, 'Audit-ready reports', 'Turn learner activity into PDF and Excel reporting.']
];

const LIVE_FEATURES = [
  [Radio, 'Real-time multiplayer'],
  [QrCode, 'PIN-based joining'],
  [ShieldCheck, 'Authenticated answers'],
  [Clock3, 'Countdown & urgency'],
  [Trophy, 'Final podium'],
  [BarChart3, 'Session reporting']
];

function WebsitePreview() {
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
        locomotiveRef.current = new LocomotiveScroll({
          lenisOptions: { duration: 1, smoothWheel: true, wheelMultiplier: 0.9 }
        });
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
    <div className="website-preview slice-site" data-scroll-container>
      <header className="slice-nav">
        <button type="button" className="slice-brand" onClick={() => navigate('/dashboard')} aria-label="Back to Quizmoto dashboard">
          <span>Q</span><strong>quizmoto</strong>
        </button>
        <nav aria-label="Website preview navigation">
          <button type="button" onClick={() => scrollTo('#document-to-course')}>Document to course</button>
          <button type="button" onClick={() => scrollTo('#tracking')}>LMS & tracking</button>
          <button type="button" onClick={() => scrollTo('#live-quiz')}>Live Quiz</button>
        </nav>
        <div className="slice-nav-actions">
          <span className={scrollReady ? 'ready' : ''}><i />{scrollReady ? 'Smooth scroll' : 'Preview'}</span>
          <button type="button" onClick={() => navigate('/dashboard')}><ArrowLeft size={15} /> Platform</button>
        </div>
      </header>

      <main>
        <section className="slice-hero" data-scroll-section>
          <div className="slice-watercolor slice-watercolor-hero" aria-hidden="true" />
          <div className="slice-hero-copy">
            <motion.div className="slice-eyebrow" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>DOCUMENT → AI COURSE → TRACKING · + LIVE QUIZ</motion.div>
            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .08, duration: .75, ease: [0.16, 1, 0.3, 1] }}>
              Turn any document into a <em>trackable course.</em>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2, duration: .65 }}>
              Upload the document you already have. Quizmoto AI turns it into a visual SCORM course, publishes it through SCORM World and makes learner tracking ready in around ten minutes. When you need live participation, launch a real-time Live Quiz from the same platform.
            </motion.p>

            <HeroLiveShift />

            <motion.div className="slice-hero-actions" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .42, duration: .6 }}>
              <button type="button" className="slice-primary-btn" onClick={() => navigate('/scorm/author')}>Create from document <ArrowRight size={17} /></button>
              <button type="button" className="slice-secondary-btn" onClick={() => scrollTo('#live-quiz')}><Play size={15} /> Explore Live Quiz</button>
            </motion.div>
            <motion.div className="slice-hero-proof" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .58 }}>
              <span><Check size={14} /> SCORM-ready</span>
              <span><Check size={14} /> Built-in LMS</span>
              <span><Check size={14} /> Instant tracking</span>
              <span><Radio size={14} /> Live Quiz</span>
            </motion.div>
          </div>
          <motion.div className="slice-hero-product" initial={{ opacity: 0, y: 38, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: .25, duration: .9, ease: [0.16, 1, 0.3, 1] }}>
            <HeroPhone />
          </motion.div>
        </section>

        <section className="slice-simple-strip" data-scroll-section>
          <div><strong>1 document</strong><span>your source content</span></div>
          <div><strong>~10 min</strong><span>typical generation flow</span></div>
          <div><strong>1 course</strong><span>SCORM-ready output</span></div>
          <div><strong>Live</strong><span>tracking + quiz sessions</span></div>
        </section>

        <section className="slice-process" id="document-to-course" data-scroll-section>
          <div className="slice-watercolor slice-watercolor-blue" aria-hidden="true" />
          <Reveal className="slice-section-heading light">
            <span>FROM DOCUMENT TO LEARNING</span>
            <h2>Five steps.<br />One continuous flow.</h2>
            <p>No manual slide building, package handoffs or separate tracking setup.</p>
          </Reveal>
          <div className="slice-process-cards">
            {[
              ['01', Upload, 'Upload', 'Drop in the source document you already use.'],
              ['02', ScanText, 'Understand', 'AI extracts the rules, themes and learning objectives.'],
              ['03', WandSparkles, 'Generate', 'Visual screens, interactions and knowledge checks are created.'],
              ['04', BookOpen, 'Publish', 'The course is packaged and becomes learner-ready inside SCORM World.'],
              ['05', Activity, 'Track', 'Completion, location, status, score and time start flowing immediately.']
            ].map(([number, Icon, title, copy], index) => (
              <Reveal key={number} delay={index * .04}>
                <article className="slice-process-card" data-scroll data-scroll-speed={String(index % 2 ? -0.018 : 0.018)}>
                  <div className="slice-process-number">{number}</div>
                  <div className="slice-process-icon"><Icon size={23} /></div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="slice-course-section" data-scroll-section>
          <Reveal className="slice-section-heading">
            <span>AI COURSE GENERATION</span>
            <h2>Not a document in a player.<br /><em>A real learning experience.</em></h2>
            <p>Quizmoto turns source material into structured, visual learning that people can actually move through.</p>
          </Reveal>
          <Reveal className="slice-course-demo"><CourseMockup /></Reveal>
          <div className="slice-floating-copy slice-floating-copy-left" data-scroll data-scroll-speed="0.06"><Sparkles size={16} /> AI structured</div>
          <div className="slice-floating-copy slice-floating-copy-right" data-scroll data-scroll-speed="-0.05"><Check size={16} /> Knowledge checks included</div>
        </section>

        <section className="slice-tracking-section" id="tracking" data-scroll-section>
          <div className="slice-watercolor slice-watercolor-green" aria-hidden="true" />
          <div className="slice-tracking-copy">
            <Reveal className="slice-section-heading light">
              <span>BUILT-IN LMS + TRACKING</span>
              <h2>Course ready.<br />Tracking ready.<br />At the same time.</h2>
              <p>Publish once and see the learning state that matters: completion, where someone stopped, score, time, status and resume state.</p>
            </Reveal>
            <Reveal className="slice-tracking-points">
              {['Completion percentage', 'Last learning location', 'Score & total time', 'Resume-aware progress', 'Live learner activity'].map((item) => <span key={item}><Check size={15} />{item}</span>)}
            </Reveal>
          </div>
          <Reveal className="slice-tracking-demo"><TrackingMockup /></Reveal>
        </section>

        <section className="slice-feature-story" data-scroll-section>
          <Reveal className="slice-section-heading centered">
            <span>SCORM WORLD</span>
            <h2>Everything around the course,<br /><em>already connected.</em></h2>
          </Reveal>
          <div className="slice-feature-list">
            {SCORM_FEATURES.map(([Icon, title, copy], index) => (
              <Reveal key={title} delay={index * .025}>
                <article className={`slice-feature-item slice-feature-${(index % 4) + 1}`}>
                  <div><Icon size={23} /></div><h3>{title}</h3><p>{copy}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="slice-report-section" data-scroll-section>
          <div className="slice-report-art" data-scroll data-scroll-speed="0.04">
            <div className="slice-report-card">
              <div className="slice-report-title"><BarChart3 size={20} /><span>Course report</span><b>PDF</b></div>
              <strong>72<span>%</span></strong>
              <small>average completion</small>
              <div className="slice-report-bars">{[56, 72, 64, 84, 78, 92, 88].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>
              <div className="slice-report-meta"><span>186 learners</span><span>124 complete</span></div>
            </div>
            <StatusPill icon={FileText} className="slice-report-pill">PDF + Excel exports</StatusPill>
          </div>
          <Reveal className="slice-report-copy">
            <span>REPORTING</span>
            <h2>See what happened.<br />Share what matters.</h2>
            <p>Operational learner state becomes clear reporting for managers, compliance teams and learning owners.</p>
            <Link to="/scorm/reports" className="slice-text-link">Open SCORM reports <ArrowRight size={16} /></Link>
          </Reveal>
        </section>

        <section className="slice-live-section" id="live-quiz" data-scroll-section>
          <div className="slice-live-copy">
            <Reveal className="slice-section-heading">
              <span>LIVE QUIZ</span>
              <h2>When learning needs<br /><em>a room to wake up.</em></h2>
              <p>Run real-time quizzes with PIN joining, synchronized questions, sound, answer feedback, rankings and a final podium.</p>
            </Reveal>
            <Reveal className="slice-live-features">
              {LIVE_FEATURES.map(([Icon, title]) => <span key={title}><Icon size={16} />{title}</span>)}
            </Reveal>
            <Reveal><Link to="/dashboard" className="slice-text-link">Open Live Quiz <ArrowRight size={16} /></Link></Reveal>
          </div>
          <Reveal className="slice-live-demo"><QuizMockup /></Reveal>
        </section>

        <section className="slice-safe-section" data-scroll-section>
          <div className="slice-watercolor slice-watercolor-safe" aria-hidden="true" />
          <Reveal className="slice-safe-card">
            <div className="slice-safe-icon"><ShieldCheck size={34} /></div>
            <span>BUILT FOR LEARNING OPERATIONS</span>
            <h2>Simple for learners.<br />Useful for teams.</h2>
            <p>Browser-based delivery, validated packages, learner identity, persistent progress and reporting keep the operational side connected without making the learner experience feel heavy.</p>
            <div>{['Browser based', 'SCORM delivery', 'Persistent progress', 'Reporting'].map((item) => <span key={item}><Check size={14} />{item}</span>)}</div>
          </Reveal>
        </section>

        <section className="slice-final" data-scroll-section>
          <Reveal>
            <span>QUIZMOTO</span>
            <h2>Your document already has the knowledge.<br /><em>Turn it into learning.</em></h2>
            <p>Upload the source. Let AI build the course. Publish it. Track it. Then use Live Quiz when you want the whole room participating together.</p>
            <div className="slice-final-actions">
              <button type="button" className="slice-primary-btn" onClick={() => navigate('/scorm/author')}>Create from document <ArrowRight size={17} /></button>
              <button type="button" className="slice-secondary-btn" onClick={() => navigate('/dashboard')}>Open Live Quiz</button>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="slice-footer">
        <div className="slice-brand"><span>Q</span><strong>quizmoto</strong></div>
        <span>Internal website preview</span>
        <button type="button" onClick={() => scrollTo('body')}>Back to top ↑</button>
      </footer>
    </div>
  );
}

export default WebsitePreview;