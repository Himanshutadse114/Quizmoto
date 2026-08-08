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

const FEATURE_GROUPS = [
  {
    eyebrow: 'LIVE QUIZ',
    title: 'Make the room participate.',
    tint: 'mint',
    features: [
      ['Real-time multiplayer', 'Host a live session and keep every player synchronized in the same question state.', Radio],
      ['PIN-based joining', 'Players enter through a simple join flow without complicated setup.', QrCode],
      ['Quiz builder', 'Create, edit, search and reuse quizzes from one host workspace.', WandSparkles],
      ['Game-show countdowns', 'Question launches, countdowns, answer-lock feedback and timer urgency are built into the experience.', Clock3],
      ['Instant answer feedback', 'Players know when an answer is locked and receive clear correct, wrong or timeout feedback.', Zap],
      ['Final podium', 'A polished ranked finish gives every session a real ending instead of a plain score table.', Trophy],
      ['Session recovery', 'Reconnect and recovery flows restore live state when a host or player loses connection.', ShieldCheck],
      ['Live Quiz reports', 'Review session history and performance after the game ends.', BarChart3]
    ]
  },
  {
    eyebrow: 'SCORM WORLD',
    title: 'Turn learning into something people finish.',
    tint: 'lilac',
    features: [
      ['SCORM package library', 'Upload, validate, organize and reuse learning packages from one library.', Library],
      ['AI Visual Author', 'Turn a PDF or PowerPoint into a structured visual SCORM learning experience.', Sparkles],
      ['Visual Studio', 'Refine screen layouts, interactions and presentation before rebuilding a course package.', Palette],
      ['Course publishing', 'Create courses from packages, publish them and share learner invite links.', BookOpen],
      ['Learner access', 'Learners join through a lightweight browser flow with no separate LMS account required.', Users],
      ['Progress tracking', 'See completion percentage, last course location, status, score and time.', Activity],
      ['Resume-aware learning', 'Course state and progress are persisted so learners can continue instead of restarting.', CirclePlay],
      ['PDF & Excel reports', 'Generate branded learning audit reports for course and learner review.', FileText]
    ]
  }
];

const PLATFORM_FEATURES = [
  ['Browser based', 'No specialist client app for hosts or learners.', MonitorUp, 'sky'],
  ['Responsive UI', 'Host, player and learner journeys adapt from desktop to mobile.', Gamepad2, 'rose'],
  ['Authenticated sessions', 'Live Quiz answer identity and host actions are protected by authenticated session flows.', ShieldCheck, 'mint'],
  ['Real-time updates', 'Socket-powered state keeps the live experience responsive and current.', Radio, 'lilac'],
  ['Package validation', 'SCORM imports are validated before becoming deliverable learning packages.', Upload, 'sky'],
  ['Visual learning', 'Generated courses use diagrams, structured layouts and interactions instead of wall-of-text slides.', ScanText, 'rose']
];

const MARQUEE = [
  'LIVE QUIZ',
  'SCORM WORLD',
  'REAL-TIME PLAY',
  'AI VISUAL AUTHOR',
  'LEARNER TRACKING',
  'REPORTING',
  'COURSE DELIVERY',
  'FINAL PODIUM'
];

const reveal = {
  hidden: { opacity: 0, y: 44 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.72, ease: [0.16, 1, 0.3, 1] } }
};

function Reveal({ children, className = '', delay = 0 }) {
  return (
    <motion.div
      className={className}
      variants={reveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.18 }}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

function FeatureIcon({ icon: Icon, tint = 'mint' }) {
  return (
    <div className={`preview-feature-icon preview-tint-${tint}`}>
      <Icon size={21} strokeWidth={2.2} />
    </div>
  );
}

function QuizMockup() {
  return (
    <div className="preview-product-window preview-quiz-window" data-scroll data-scroll-speed="0.08">
      <div className="preview-window-bar">
        <span className="preview-window-dot" />
        <span className="preview-window-dot" />
        <span className="preview-window-dot" />
        <span className="preview-window-label">LIVE SESSION · 482 916</span>
      </div>
      <div className="preview-quiz-stage">
        <div className="preview-quiz-topline">
          <span>QUESTION 04 / 10</span>
          <span className="preview-timer-pill">18</span>
        </div>
        <h3>Which action best protects an account after a suspicious sign-in alert?</h3>
        <div className="preview-answer-grid">
          <div className="preview-answer-card preview-answer-a">A <span>Ignore it if the password still works</span></div>
          <div className="preview-answer-card preview-answer-b">B <span>Change the password and review active sessions</span></div>
          <div className="preview-answer-card preview-answer-c">C <span>Forward the alert to colleagues</span></div>
          <div className="preview-answer-card preview-answer-d">D <span>Disable browser updates</span></div>
        </div>
        <div className="preview-player-row">
          <span><Users size={15} /> 38 playing</span>
          <span><Radio size={15} /> Live</span>
        </div>
      </div>
    </div>
  );
}

function ScormMockup() {
  return (
    <div className="preview-product-window preview-scorm-window" data-scroll data-scroll-speed="-0.06">
      <div className="preview-window-bar dark">
        <div className="preview-window-brand">Q</div>
        <span className="preview-window-label">SCORM WORLD</span>
        <span className="preview-window-status">TRACKING ACTIVE</span>
      </div>
      <div className="preview-scorm-shell">
        <aside>
          {['Overview', 'Courses', 'Learner tracking', 'Reports', 'Package library'].map((item, index) => (
            <div key={item} className={index === 2 ? 'active' : ''}><span>{String(index + 1).padStart(2, '0')}</span>{item}</div>
          ))}
        </aside>
        <main>
          <div className="preview-scorm-kicker">LEARNING OPERATIONS</div>
          <h3>See exactly where learning stops.</h3>
          <div className="preview-scorm-metrics">
            <div><strong>186</strong><span>Learners</span></div>
            <div><strong>72%</strong><span>Average progress</span></div>
            <div><strong>124</strong><span>Completed</span></div>
          </div>
          <div className="preview-progress-list">
            {[['Aarav Mehta', 88], ['Meera Shah', 64], ['Rohan Patel', 100]].map(([name, progress]) => (
              <div className="preview-progress-row" key={name}>
                <span>{name}</span>
                <div><i style={{ width: `${progress}%` }} /></div>
                <b>{progress}%</b>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

function WebsitePreview() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const locomotiveRef = useRef(null);
  const [activeProduct, setActiveProduct] = useState('live');
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

  return (
    <div className="website-preview" data-scroll-container>
      <div className="preview-progress-line" />
      <header className="preview-nav">
        <button type="button" onClick={() => navigate('/dashboard')} className="preview-brand" aria-label="Back to platform dashboard">
          <span className="preview-brand-mark">Q</span>
          <span>QUIZMOTO</span>
        </button>
        <nav className="preview-nav-links" aria-label="Website preview navigation">
          <button type="button" onClick={() => scrollTo('#products')}>Products</button>
          <button type="button" onClick={() => scrollTo('#features')}>Features</button>
          <button type="button" onClick={() => scrollTo('#workflow')}>How it works</button>
        </nav>
        <div className="preview-nav-actions">
          <span className={`preview-scroll-status ${scrollReady ? 'ready' : ''}`}><i /> {scrollReady ? 'Smooth scroll' : 'Preview'}</span>
          <button type="button" onClick={() => navigate('/dashboard')} className="preview-nav-back"><ArrowLeft size={15} /> Platform</button>
        </div>
      </header>

      <main>
        <section className="preview-hero" data-scroll-section>
          <div className="preview-orb preview-orb-mint" data-scroll data-scroll-speed="0.16" />
          <div className="preview-orb preview-orb-lilac" data-scroll data-scroll-speed="-0.12" />
          <div className="preview-orb preview-orb-rose" data-scroll data-scroll-speed="0.1" />
          <div className="preview-hero-copy">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="preview-internal-badge"
            >
              INTERNAL WEBSITE PREVIEW
            </motion.div>
            <h1 aria-label="Make learning feel live">
              {['MAKE', 'LEARNING', 'FEEL', 'LIVE.'].map((word, index) => (
                <motion.span
                  key={word}
                  initial={{ y: '110%', rotate: index % 2 ? 1 : -1 }}
                  animate={{ y: 0, rotate: 0 }}
                  transition={{ duration: 0.78, delay: 0.08 + index * 0.08, ease: [0.16, 1, 0.3, 1] }}
                >
                  {word}
                </motion.span>
              ))}
            </h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.48 }}
            >
              One platform for live participation and trackable learning. Run real-time quizzes, build visual SCORM courses, follow learner progress and turn results into reports that actually tell you something.
            </motion.p>
            <motion.div
              className="preview-hero-actions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.58 }}
            >
              <button type="button" onClick={() => scrollTo('#products')} className="preview-btn preview-btn-dark">Explore the platform <ArrowRight size={17} /></button>
              <button type="button" onClick={() => navigate('/dashboard')} className="preview-btn preview-btn-light"><Play size={16} /> Open Live Quiz</button>
            </motion.div>
          </div>

          <motion.div
            className="preview-hero-stage"
            initial={{ opacity: 0, scale: 0.94, y: 35 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="preview-stage-card preview-stage-live" data-scroll data-scroll-speed="0.08">
              <div className="preview-stage-label"><Radio size={14} /> LIVE QUIZ</div>
              <div className="preview-stage-pin">482 916</div>
              <div className="preview-stage-players"><span>38</span> players joined</div>
              <div className="preview-stage-avatars"><i>A</i><i>M</i><i>R</i><i>+</i></div>
            </div>
            <div className="preview-stage-card preview-stage-scorm" data-scroll data-scroll-speed="-0.06">
              <div className="preview-stage-label"><BookOpen size={14} /> SCORM WORLD</div>
              <div className="preview-stage-course">Cybersecurity Essentials</div>
              <div className="preview-stage-progress"><i style={{ width: '72%' }} /></div>
              <div className="preview-stage-meta"><span>186 learners</span><strong>72%</strong></div>
            </div>
            <div className="preview-stage-sticker" data-scroll data-scroll-speed="0.14">PLAY.<br />LEARN.<br />TRACK.</div>
          </motion.div>
        </section>

        <section className="preview-marquee" aria-label="Platform features" data-scroll-section>
          <div className="preview-marquee-track">
            {[...MARQUEE, ...MARQUEE].map((item, index) => (
              <span key={`${item}-${index}`}>{item}<i>✦</i></span>
            ))}
          </div>
        </section>

        <section className="preview-intro" id="products" data-scroll-section>
          <Reveal className="preview-section-kicker">TWO PRODUCTS. ONE LEARNING LOOP.</Reveal>
          <Reveal className="preview-intro-grid">
            <h2>ENERGY WHEN IT'S LIVE.<br /><span>DEPTH WHEN IT'S LEARNING.</span></h2>
            <p>Quizmoto connects the moments that usually live in separate tools: participation, course delivery, learner state and reporting. The result feels more like one product and less like a pile of LMS tabs.</p>
          </Reveal>
        </section>

        <section className="preview-product-section preview-product-live" data-scroll-section>
          <div className="preview-product-copy">
            <Reveal><div className="preview-section-kicker">01 · LIVE QUIZ</div></Reveal>
            <Reveal><h2>TURN A ROOM<br />INTO A GAME.</h2></Reveal>
            <Reveal><p>Start with a quiz, share a PIN and watch the session move in real time. Countdown audio, answer feedback, rankings and a final podium make the interaction feel intentional from start to finish.</p></Reveal>
            <Reveal className="preview-inline-points">
              {['Real-time multiplayer', 'Authenticated answers', 'Reconnect & recovery', 'Reports after every session'].map((item) => <span key={item}><Check size={15} /> {item}</span>)}
            </Reveal>
            <Reveal><Link className="preview-text-link" to="/dashboard">Open Live Quiz <ArrowRight size={16} /></Link></Reveal>
          </div>
          <div className="preview-product-demo"><QuizMockup /></div>
        </section>

        <section className="preview-product-section preview-product-scorm" data-scroll-section>
          <div className="preview-product-demo"><ScormMockup /></div>
          <div className="preview-product-copy">
            <Reveal><div className="preview-section-kicker">02 · SCORM WORLD</div></Reveal>
            <Reveal><h2>KNOW WHAT<br />LEARNERS DO.</h2></Reveal>
            <Reveal><p>Author or upload learning, publish a course and follow progress all the way down to the learner's last known location. Preview sessions stay visible for QA without polluting operational learner metrics.</p></Reveal>
            <Reveal className="preview-inline-points">
              {['AI Visual Author', 'Package library', 'Completion & location tracking', 'PDF / Excel reporting'].map((item) => <span key={item}><Check size={15} /> {item}</span>)}
            </Reveal>
            <Reveal><Link className="preview-text-link" to="/scorm">Open SCORM World <ArrowRight size={16} /></Link></Reveal>
          </div>
        </section>

        <section className="preview-feature-universe" id="features" data-scroll-section>
          <Reveal className="preview-feature-head">
            <div className="preview-section-kicker">THE FEATURE UNIVERSE</div>
            <h2>EVERYTHING THE PLATFORM<br />CAN DO, IN ONE PLACE.</h2>
          </Reveal>

          <div className="preview-product-switch" role="tablist" aria-label="Product features">
            <button type="button" className={activeProduct === 'live' ? 'active' : ''} onClick={() => setActiveProduct('live')}>Live Quiz</button>
            <button type="button" className={activeProduct === 'scorm' ? 'active' : ''} onClick={() => setActiveProduct('scorm')}>SCORM World</button>
          </div>

          {FEATURE_GROUPS.map((group, groupIndex) => {
            const key = groupIndex === 0 ? 'live' : 'scorm';
            if (key !== activeProduct) return null;
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
                className="preview-feature-panel"
              >
                <div className="preview-feature-panel-intro">
                  <span>{group.eyebrow}</span>
                  <h3>{group.title}</h3>
                </div>
                <div className="preview-feature-grid">
                  {group.features.map(([title, copy, Icon], index) => (
                    <motion.article
                      key={title}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.045 }}
                    >
                      <FeatureIcon icon={Icon} tint={index % 4 === 0 ? group.tint : ['sky', 'rose', 'mint', 'lilac'][index % 4]} />
                      <h4>{title}</h4>
                      <p>{copy}</p>
                    </motion.article>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </section>

        <section className="preview-platform-grid" data-scroll-section>
          <Reveal className="preview-platform-grid-title">
            <div className="preview-section-kicker">BUILT AS A PLATFORM</div>
            <h2>THE DETAILS THAT MAKE<br />THE BIG FEATURES WORK.</h2>
          </Reveal>
          <div className="preview-platform-cards">
            {PLATFORM_FEATURES.map(([title, copy, Icon, tint], index) => (
              <Reveal key={title} delay={index * 0.04}>
                <article className={`preview-platform-card preview-tint-${tint}`}>
                  <Icon size={26} />
                  <h3>{title}</h3>
                  <p>{copy}</p>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="preview-workflow" id="workflow" data-scroll-section>
          <div className="preview-workflow-sticky">
            <Reveal><div className="preview-section-kicker light">ONE CONTINUOUS WORKFLOW</div></Reveal>
            <Reveal><h2>FROM A QUESTION<br />TO A REPORT.</h2></Reveal>
            <Reveal><p>Build the experience, invite people in, capture what happens and use the result. The platform keeps those stages connected.</p></Reveal>
          </div>
          <div className="preview-workflow-steps">
            {[
              ['01', 'CREATE', 'Build a Live Quiz, upload a SCORM package or turn a source document into a visual course.', WandSparkles],
              ['02', 'DELIVER', 'Run a live room or publish a learner invite. Everything happens in the browser.', CirclePlay],
              ['03', 'TRACK', 'Capture answers, scores, completion, time and last known learning location.', Activity],
              ['04', 'REPORT', 'Review Live Quiz results or generate course-level PDF and Excel learning reports.', BarChart3]
            ].map(([number, title, copy, Icon], index) => (
              <Reveal key={number}>
                <article className="preview-workflow-card" data-scroll data-scroll-speed={String(index % 2 ? -0.025 : 0.025)}>
                  <div className="preview-workflow-number">{number}</div>
                  <FeatureIcon icon={Icon} tint={['mint', 'lilac', 'sky', 'rose'][index]} />
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="preview-reporting" data-scroll-section>
          <Reveal className="preview-reporting-copy">
            <div className="preview-section-kicker">VISIBLE PROGRESS</div>
            <h2>DON'T JUST KNOW<br />WHO FINISHED.</h2>
            <p>See where learners are, where they stopped and how far they got. Then turn that operational view into a report that can be shared with the people who need it.</p>
          </Reveal>
          <Reveal className="preview-reporting-board">
            <div className="preview-reporting-top">
              <span>LEARNER TRACKING</span>
              <strong>LIVE</strong>
            </div>
            <div className="preview-reporting-score">72<span>%</span></div>
            <div className="preview-reporting-sub">average completion</div>
            <div className="preview-reporting-chart">
              {[42, 58, 51, 67, 62, 78, 72, 86, 82, 94].map((value, index) => <i key={index} style={{ height: `${value}%` }} />)}
            </div>
            <div className="preview-reporting-footer"><span>186 learners</span><span>124 completed</span><span>38 active</span></div>
          </Reveal>
        </section>

        <section className="preview-final" data-scroll-section>
          <div className="preview-final-orb" data-scroll data-scroll-speed="0.12" />
          <Reveal><div className="preview-section-kicker light">QUIZMOTO</div></Reveal>
          <Reveal><h2>PLAY IT LIVE.<br />TEACH IT WELL.<br />KNOW WHAT HAPPENED.</h2></Reveal>
          <Reveal><p>This page is an internal website preview. It is available inside the platform for review and is not being used as the public homepage.</p></Reveal>
          <Reveal className="preview-final-actions">
            <button type="button" onClick={() => navigate('/dashboard')} className="preview-btn preview-btn-cream">Back to platform <ArrowRight size={17} /></button>
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
