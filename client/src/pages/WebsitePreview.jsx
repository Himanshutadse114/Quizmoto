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
  ChevronRight,
  CirclePlay,
  Clock3,
  FileText,
  Gamepad2,
  Library,
  MonitorUp,
  Palette,
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
import './WebsitePreview.css';

const SCORM_FEATURES = [
  ['Policy PDF → course', 'Upload a policy PDF and let AI turn dense source material into a structured learning experience.', FileText, 'mint'],
  ['AI Visual Author', 'AI builds the course flow, learning screens, interactions and quiz content from the document.', Sparkles, 'lilac'],
  ['SCORM-ready output', 'The generated learning package is prepared for browser delivery and SCORM tracking.', BookOpen, 'sky'],
  ['Instant learner tracking', 'Track completion percentage, last location, status, score and time as soon as learners start.', Activity, 'rose'],
  ['Built-in LMS delivery', 'Publish a course, share an invite link and let learners start without a separate LMS account.', Users, 'yellow'],
  ['Resume-aware learning', 'Learners can continue from saved state instead of restarting the course from the beginning.', CirclePlay, 'mint'],
  ['Visual Studio', 'Refine layouts, interactions and visual hierarchy before rebuilding the package.', Palette, 'lilac'],
  ['PDF & Excel reports', 'Generate learner and course audit reports from the same tracked data.', BarChart3, 'sky']
];

const LIVE_FEATURES = [
  ['Real-time multiplayer', 'Keep host and players synchronized through every question state.', Radio, 'mint'],
  ['PIN-based joining', 'Players join fast through a simple browser flow.', QrCode, 'sky'],
  ['Quiz builder', 'Create, edit, search and reuse live quizzes from one host workspace.', WandSparkles, 'lilac'],
  ['Game-show countdowns', 'Countdown cues, answer-lock feedback and timer urgency make every question feel live.', Clock3, 'yellow'],
  ['Instant feedback', 'Players get clear correct, wrong and timeout feedback after answering.', Zap, 'rose'],
  ['Final podium', 'Finish sessions with a polished ranked podium rather than a plain result table.', Trophy, 'mint'],
  ['Session recovery', 'Reconnect flows restore live state when a host or player loses connection.', ShieldCheck, 'sky'],
  ['Live Quiz reports', 'Review participation and performance after the session ends.', BarChart3, 'lilac']
];

const PLATFORM_FEATURES = [
  ['Browser based', 'Authors, hosts and learners work directly in the browser.', MonitorUp, 'cobalt'],
  ['Responsive journeys', 'The website, SCORM workspace, learner flows and Live Quiz adapt across phones, tablets and desktop.', Gamepad2, 'rose'],
  ['Package validation', 'SCORM imports are validated before becoming deliverable learning packages.', Upload, 'mint'],
  ['Visual learning', 'Generated courses use layouts, diagrams and interactions instead of wall-of-text slides.', ScanText, 'lilac'],
  ['Authenticated sessions', 'Host and Live Quiz answer flows use authenticated session identity.', ShieldCheck, 'yellow'],
  ['Real-time updates', 'Socket-powered state keeps live sessions and learner operations current.', Radio, 'sky']
];

const POLICY_STEPS = [
  ['01', 'UPLOAD', 'Drop in the policy PDF. No manual slide building.', FileText, 'mint'],
  ['02', 'AI STRUCTURES', 'AI extracts the policy, organizes learning objectives and builds a course blueprint.', Sparkles, 'lilac'],
  ['03', 'COURSE GENERATED', 'Visual screens, interactions and knowledge checks are generated automatically.', WandSparkles, 'sky'],
  ['04', 'PUBLISH', 'The SCORM course is packaged, added to the LMS workspace and ready to invite learners.', BookOpen, 'yellow'],
  ['05', 'TRACK', 'Completion, location, status, score and time start flowing into tracking immediately.', Activity, 'rose']
];

const MARQUEE = [
  'POLICY PDF → SCORM',
  'AI COURSE GENERATION',
  'ABOUT 10 MINUTES',
  'INSTANT TRACKING',
  'BUILT-IN LMS',
  'LEARNER PROGRESS',
  'SCORM REPORTS',
  'LIVE QUIZ'
];

const reveal = {
  hidden: { opacity: 0, y: 42 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.68, ease: [0.16, 1, 0.3, 1] } }
};

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

function FeatureIcon({ icon: Icon, tint = 'mint' }) {
  return (
    <div className={`preview-feature-icon preview-solid-${tint}`}>
      <Icon size={21} strokeWidth={2.2} />
    </div>
  );
}

function PolicyPipelineMockup() {
  return (
    <div className="preview-policy-machine" data-scroll data-scroll-speed="0.055">
      <div className="preview-machine-topbar">
        <div className="preview-machine-brand"><span>Q</span> POLICY → SCORM</div>
        <div className="preview-machine-time"><Clock3 size={14} /> ~10 MIN</div>
      </div>
      <div className="preview-machine-source">
        <div className="preview-pdf-card">
          <FileText size={30} />
          <div><strong>Information Security Policy.pdf</strong><span>42 pages · uploaded</span></div>
          <Check size={18} />
        </div>
        <div className="preview-ai-pulse">
          <Sparkles size={22} />
          <span>AI is building the learning experience</span>
          <i /><i /><i />
        </div>
      </div>
      <div className="preview-machine-flow">
        {[
          ['Policy parsed', '00:42'],
          ['Learning blueprint', '02:10'],
          ['Visual course', '06:48'],
          ['SCORM packaged', '09:12']
        ].map(([label, time], index) => (
          <div key={label} className="preview-machine-step">
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{label}</strong>
            <b>{time}</b>
          </div>
        ))}
      </div>
      <div className="preview-machine-ready">
        <div>
          <span>COURSE READY</span>
          <strong>Security Policy Essentials</strong>
        </div>
        <div className="preview-machine-ready-meta">
          <span>SCORM 1.2</span>
          <span>8 learning screens</span>
          <span>5 questions</span>
        </div>
        <div className="preview-machine-track"><Activity size={16} /> TRACKING READY</div>
      </div>
    </div>
  );
}

function CourseGenerationMockup() {
  return (
    <div className="preview-course-window" data-scroll data-scroll-speed="-0.04">
      <div className="preview-course-browser">
        <span /><span /><span />
        <b>AI VISUAL AUTHOR</b>
      </div>
      <div className="preview-course-content">
        <aside>
          <div className="active">01 · Policy overview</div>
          <div>02 · Access control</div>
          <div>03 · Data handling</div>
          <div>04 · Reporting incidents</div>
          <div>05 · Knowledge check</div>
        </aside>
        <main>
          <div className="preview-course-kicker">SECTION 03 / 08</div>
          <h3>HANDLE SENSITIVE DATA<br />WITH INTENT.</h3>
          <p>The policy has been transformed into concise learner-facing guidance with visual hierarchy and interaction.</p>
          <div className="preview-course-cards">
            <div className="preview-solid-mint"><strong>01</strong><span>Classify before sharing</span></div>
            <div className="preview-solid-lilac"><strong>02</strong><span>Use approved channels</span></div>
            <div className="preview-solid-sky"><strong>03</strong><span>Report exposure quickly</span></div>
          </div>
          <div className="preview-course-navline"><span>◀ BACK</span><b>3 / 8</b><span>NEXT ▶</span></div>
        </main>
      </div>
    </div>
  );
}

function TrackingMockup() {
  return (
    <div className="preview-tracking-window" data-scroll data-scroll-speed="0.035">
      <div className="preview-tracking-head">
        <div><span>SCORM WORLD</span><strong>LEARNER TRACKING</strong></div>
        <b><i /> LIVE</b>
      </div>
      <div className="preview-tracking-stats">
        <div className="preview-solid-mint"><strong>186</strong><span>Learners</span></div>
        <div className="preview-solid-lilac"><strong>72%</strong><span>Avg progress</span></div>
        <div className="preview-solid-sky"><strong>124</strong><span>Completed</span></div>
        <div className="preview-solid-yellow"><strong>38</strong><span>Active</span></div>
      </div>
      <div className="preview-tracking-table">
        <div className="preview-tracking-row heading"><span>Learner</span><span>Progress</span><span>Last location</span><span>Status</span></div>
        {[
          ['Aarav Mehta', 88, 'Data handling', 'In progress'],
          ['Meera Shah', 64, 'Access control', 'In progress'],
          ['Rohan Patel', 100, 'Completed', 'Completed']
        ].map(([name, progress, location, status]) => (
          <div className="preview-tracking-row" key={name}>
            <span><strong>{name}</strong><small>learner</small></span>
            <span><b>{progress}%</b><i><em style={{ width: `${progress}%` }} /></i></span>
            <span>{location}</span>
            <span className={progress === 100 ? 'done' : ''}>{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuizMockup() {
  return (
    <div className="preview-quiz-window" data-scroll data-scroll-speed="-0.035">
      <div className="preview-quiz-bar"><span>LIVE QUIZ · 482 916</span><b>38 PLAYING</b></div>
      <div className="preview-quiz-stage">
        <div className="preview-quiz-topline"><span>QUESTION 04 / 10</span><span className="preview-timer-pill">18</span></div>
        <h3>Which action best protects an account after a suspicious sign-in alert?</h3>
        <div className="preview-answer-grid">
          <div className="preview-answer-card preview-solid-rose">A <span>Ignore it if the password still works</span></div>
          <div className="preview-answer-card preview-solid-mint">B <span>Change the password and review active sessions</span></div>
          <div className="preview-answer-card preview-solid-sky">C <span>Forward the alert to colleagues</span></div>
          <div className="preview-answer-card preview-solid-lilac">D <span>Disable browser updates</span></div>
        </div>
        <div className="preview-player-row"><span><Users size={15} /> 38 playing</span><span><Radio size={15} /> Live</span></div>
      </div>
    </div>
  );
}

function WebsitePreview() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const locomotiveRef = useRef(null);
  const [activeProduct, setActiveProduct] = useState('scorm');
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
          lenisOptions: {
            duration: 1.05,
            smoothWheel: true,
            wheelMultiplier: 0.92
          }
        });
        setScrollReady(true);
      } catch (error) {
        console.warn('Locomotive Scroll preview enhancement unavailable; native scrolling remains active.', error);
        setScrollReady(false);
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
    if (locomotiveRef.current?.scrollTo) {
      locomotiveRef.current.scrollTo(target, { offset: -72, duration: 1.05 });
    } else {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const activeFeatures = activeProduct === 'scorm' ? SCORM_FEATURES : LIVE_FEATURES;

  return (
    <div className="website-preview" data-scroll-container>
      <div className="preview-progress-line" />
      <header className="preview-nav">
        <button type="button" onClick={() => navigate('/dashboard')} className="preview-brand" aria-label="Back to platform dashboard">
          <span className="preview-brand-mark">Q</span>
          <span>QUIZMOTO</span>
        </button>
        <nav className="preview-nav-links" aria-label="Website preview navigation">
          <button type="button" onClick={() => scrollTo('#policy-to-scorm')}>Policy → SCORM</button>
          <button type="button" onClick={() => scrollTo('#tracking')}>Tracking</button>
          <button type="button" onClick={() => scrollTo('#features')}>Features</button>
          <button type="button" onClick={() => scrollTo('#live-quiz')}>Live Quiz</button>
        </nav>
        <div className="preview-nav-actions">
          <span className={`preview-scroll-status ${scrollReady ? 'ready' : ''}`}><i /> {scrollReady ? 'Smooth scroll' : 'Preview'}</span>
          <button type="button" onClick={() => navigate('/dashboard')} className="preview-nav-back"><ArrowLeft size={15} /> Platform</button>
        </div>
      </header>

      <main>
        <section className="preview-hero" data-scroll-section>
          <div className="preview-shape preview-shape-mint" data-scroll data-scroll-speed="0.13" />
          <div className="preview-shape preview-shape-lilac" data-scroll data-scroll-speed="-0.1" />
          <div className="preview-hero-copy">
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="preview-internal-badge">
              INTERNAL WEBSITE PREVIEW
            </motion.div>
            <h1 aria-label="Policy PDF to tracking ready SCORM">
              {['POLICY PDF', 'TO TRACKING-', 'READY SCORM.', '~10 MIN.'].map((word, index) => (
                <motion.span
                  key={word}
                  className={index === 3 ? 'accent-line' : ''}
                  initial={{ y: '112%' }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.76, delay: 0.06 + index * 0.085, ease: [0.16, 1, 0.3, 1] }}
                >
                  {word}
                </motion.span>
              ))}
            </h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.44 }}>
              Upload a policy PDF. Quizmoto AI turns it into a visual, interactive SCORM course, publishes it inside the built-in LMS workspace and makes learner tracking available immediately — typically in about ten minutes.
            </motion.p>
            <motion.div className="preview-hero-proof" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.62 }}>
              <span><Check size={14} /> No manual slide building</span>
              <span><Check size={14} /> SCORM-ready</span>
              <span><Check size={14} /> Tracking-ready</span>
            </motion.div>
            <motion.div className="preview-hero-actions" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.7 }}>
              <button type="button" onClick={() => scrollTo('#policy-to-scorm')} className="preview-btn preview-btn-dark">See the 10-minute flow <ArrowRight size={17} /></button>
              <button type="button" onClick={() => navigate('/scorm')} className="preview-btn preview-btn-mint"><BookOpen size={16} /> Open SCORM World</button>
            </motion.div>
          </div>
          <motion.div className="preview-hero-stage" initial={{ opacity: 0, scale: 0.95, y: 34 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.88, delay: 0.26, ease: [0.16, 1, 0.3, 1] }}>
            <PolicyPipelineMockup />
            <div className="preview-hero-sticker" data-scroll data-scroll-speed="0.12">PDF IN.<br />COURSE OUT.<br />TRACK IT.</div>
          </motion.div>
        </section>

        <section className="preview-marquee" aria-label="Platform highlights" data-scroll-section>
          <div className="preview-marquee-track">
            {[...MARQUEE, ...MARQUEE].map((item, index) => <span key={`${item}-${index}`}>{item}<i>✦</i></span>)}
          </div>
        </section>

        <section className="preview-policy-story" id="policy-to-scorm" data-scroll-section>
          <Reveal className="preview-section-kicker preview-solid-yellow">THE PRIMARY WORKFLOW</Reveal>
          <Reveal className="preview-policy-heading">
            <h2>ONE PDF.<br />ONE AI WORKFLOW.<br /><span>A TRACKABLE COURSE.</span></h2>
            <p>Instead of turning every policy update into a manual instructional-design project, upload the source document once. Quizmoto handles the conversion from source material to learner-ready SCORM and gives the admin team a tracking layer from day one.</p>
          </Reveal>
          <div className="preview-policy-steps">
            {POLICY_STEPS.map(([number, title, copy, Icon, tint], index) => (
              <Reveal key={number} delay={index * 0.04}>
                <article className={`preview-policy-step preview-solid-${tint}`} data-scroll data-scroll-speed={String(index % 2 ? -0.018 : 0.018)}>
                  <div className="preview-policy-step-number">{number}</div>
                  <Icon size={27} strokeWidth={2.1} />
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              </Reveal>
            ))}
          </div>
          <Reveal className="preview-ten-minute-band">
            <div><span>FROM UPLOAD TO READY</span><strong>~10 MIN</strong></div>
            <p>Policy ingestion, AI structure, visual course generation, SCORM packaging and LMS readiness happen in one connected workflow.</p>
            <Link to="/scorm/author">Start from a policy <ArrowRight size={16} /></Link>
          </Reveal>
        </section>

        <section className="preview-ai-author" data-scroll-section>
          <div className="preview-ai-copy">
            <Reveal><div className="preview-section-kicker preview-kicker-light">AI COURSE GENERATION</div></Reveal>
            <Reveal><h2>NOT A PDF<br />IN A PLAYER.<br /><span>A REAL COURSE.</span></h2></Reveal>
            <Reveal><p>AI converts the source into a course structure, visual screens, learning points, interactions and knowledge checks. Admins can review the blueprint and refine the experience before publishing.</p></Reveal>
            <Reveal className="preview-inline-points light">
              {['Visual learning screens', 'Interactions & knowledge checks', 'Editable course blueprint', 'SCORM 1.2 delivery'].map((item) => <span key={item}><Check size={15} /> {item}</span>)}
            </Reveal>
            <Reveal><Link className="preview-text-link light" to="/scorm/author">Open AI Visual Author <ArrowRight size={16} /></Link></Reveal>
          </div>
          <div className="preview-ai-demo"><CourseGenerationMockup /></div>
        </section>

        <section className="preview-tracking-section" id="tracking" data-scroll-section>
          <div className="preview-tracking-copy">
            <Reveal><div className="preview-section-kicker preview-solid-rose">BUILT-IN LMS + TRACKING</div></Reveal>
            <Reveal><h2>COURSE READY.<br />TRACKING READY.<br /><span>AT THE SAME TIME.</span></h2></Reveal>
            <Reveal><p>Publish the generated course, share the learner invite and immediately see completion, last known location, lesson status, score, time and activity. Resume support keeps learner state persistent.</p></Reveal>
            <Reveal className="preview-tracking-pills">
              {['Completion %', 'Last location', 'Score', 'Time', 'Resume state', 'Live activity'].map((item) => <span key={item}>{item}</span>)}
            </Reveal>
          </div>
          <div className="preview-tracking-demo"><TrackingMockup /></div>
        </section>

        <section className="preview-feature-universe" id="features" data-scroll-section>
          <Reveal className="preview-feature-head">
            <div className="preview-section-kicker preview-solid-mint">THE PLATFORM</div>
            <h2>SCORM FIRST.<br /><span>LIVE ENGAGEMENT TOO.</span></h2>
            <p>The core value starts with policy-to-course automation and learner tracking. Live Quiz adds synchronous participation when the learning moment needs energy.</p>
          </Reveal>
          <div className="preview-product-switch" role="tablist" aria-label="Product features">
            <button type="button" className={activeProduct === 'scorm' ? 'active' : ''} onClick={() => setActiveProduct('scorm')}>SCORM + LMS</button>
            <button type="button" className={activeProduct === 'live' ? 'active' : ''} onClick={() => setActiveProduct('live')}>Live Quiz</button>
          </div>
          <motion.div key={activeProduct} initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42 }} className="preview-feature-panel">
            <div className={`preview-feature-panel-intro ${activeProduct === 'scorm' ? 'scorm' : 'live'}`}>
              <span>{activeProduct === 'scorm' ? 'PRIMARY PRODUCT' : 'SECOND PRODUCT'}</span>
              <h3>{activeProduct === 'scorm' ? 'Policy to learning. In one workflow.' : 'Make live learning participate.'}</h3>
            </div>
            <div className="preview-feature-grid">
              {activeFeatures.map(([title, copy, Icon, tint], index) => (
                <motion.article key={title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.035 }}>
                  <FeatureIcon icon={Icon} tint={tint} />
                  <h4>{title}</h4>
                  <p>{copy}</p>
                </motion.article>
              ))}
            </div>
          </motion.div>
        </section>

        <section className="preview-live-section" id="live-quiz" data-scroll-section>
          <div className="preview-live-copy">
            <Reveal><div className="preview-section-kicker preview-solid-sky">LIVE QUIZ · SECONDARY PRODUCT</div></Reveal>
            <Reveal><h2>WHEN LEARNING<br />NEEDS A ROOM<br />TO WAKE UP.</h2></Reveal>
            <Reveal><p>Run synchronous quizzes with PIN joining, game-show countdowns, answer feedback, rankings, session recovery and a professional final podium. Live Quiz complements the LMS rather than competing with it.</p></Reveal>
            <Reveal className="preview-inline-points">
              {['Real-time multiplayer', 'Authenticated answers', 'Countdown & sound design', 'Podium & reports'].map((item) => <span key={item}><Check size={15} /> {item}</span>)}
            </Reveal>
            <Reveal><Link className="preview-text-link" to="/dashboard">Open Live Quiz <ArrowRight size={16} /></Link></Reveal>
          </div>
          <div className="preview-live-demo"><QuizMockup /></div>
        </section>

        <section className="preview-platform-grid" data-scroll-section>
          <Reveal className="preview-platform-grid-title">
            <div className="preview-section-kicker preview-solid-lilac">BUILT AS A PLATFORM</div>
            <h2>THE INFRASTRUCTURE<br />BEHIND THE EXPERIENCE.</h2>
          </Reveal>
          <div className="preview-platform-cards">
            {PLATFORM_FEATURES.map(([title, copy, Icon, tint], index) => (
              <Reveal key={title} delay={index * 0.035}>
                <article className={`preview-platform-card preview-solid-${tint}`}>
                  <Icon size={27} />
                  <h3>{title}</h3>
                  <p>{copy}</p>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="preview-reporting" data-scroll-section>
          <Reveal className="preview-reporting-copy">
            <div className="preview-section-kicker preview-solid-yellow">REPORTING</div>
            <h2>FROM POLICY<br />TO PROOF.</h2>
            <p>The same workflow that creates the course also creates the data trail. Review progress operationally, then generate course-level PDF and Excel reports when you need evidence.</p>
          </Reveal>
          <Reveal className="preview-reporting-board">
            <div className="preview-reporting-top"><span>LEARNER TRACKING</span><strong>LIVE</strong></div>
            <div className="preview-reporting-score">72<span>%</span></div>
            <div className="preview-reporting-sub">average completion</div>
            <div className="preview-reporting-chart">{[42, 58, 51, 67, 62, 78, 72, 86, 82, 94].map((value, index) => <i key={index} style={{ height: `${value}%` }} />)}</div>
            <div className="preview-reporting-footer"><span>186 learners</span><span>124 completed</span><span>38 active</span></div>
          </Reveal>
        </section>

        <section className="preview-final" data-scroll-section>
          <div className="preview-final-shape" data-scroll data-scroll-speed="0.1" />
          <Reveal><div className="preview-section-kicker preview-kicker-light">QUIZMOTO</div></Reveal>
          <Reveal><h2>UPLOAD POLICY.<br />GENERATE COURSE.<br />TRACK LEARNING.</h2></Reveal>
          <Reveal><p>Turn a source policy into a SCORM course and a tracking-ready LMS experience in one connected workflow. Live Quiz is there when the same audience needs real-time participation.</p></Reveal>
          <Reveal className="preview-final-actions">
            <button type="button" onClick={() => navigate('/scorm/author')} className="preview-btn preview-btn-cream">Generate from a PDF <ArrowRight size={17} /></button>
            <button type="button" onClick={() => navigate('/scorm')} className="preview-btn preview-btn-outline-cream">Open SCORM World <ChevronRight size={17} /></button>
          </Reveal>
        </section>
      </main>

      <footer className="preview-footer">
        <div><span className="preview-brand-mark">Q</span><strong>QUIZMOTO</strong></div>
        <span>INTERNAL WEBSITE PREVIEW</span>
        <button type="button" onClick={() => scrollTo('body')}>Back to top ↑</button>
      </footer>
    </div>
  );
}

export default WebsitePreview;
