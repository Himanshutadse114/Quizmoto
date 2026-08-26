import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './marketingLanding.css';

const features = [
  ['01', 'Generate', 'Start from a prompt, document, or learning goal and turn it into a usable course structure.'],
  ['02', 'Publish', 'Prepare content for modern digital learning delivery with structured course workflows.'],
  ['03', 'Engage', 'Run live quiz moments that add participation, energy, and active recall to learning.'],
  ['04', 'Improve', 'Track learner progress, completion, and engagement to keep improving the experience.']
];

const Check = ({ children }) => <div className="mk-check"><span>✓</span><div>{children}</div></div>;

export default function MarketingLanding() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const nodes = [...document.querySelectorAll('.mk-reveal')];
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('is-visible'));
    }, { threshold: 0.1 });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="atelora-marketing">
      <header className="mk-nav-wrap" id="top">
        <div className="mk-container">
          <nav className="mk-nav" aria-label="Primary navigation">
            <a className="mk-brand" href="#top" onClick={closeMenu} aria-label="Atelora home">
              <span className="mk-brand-mark" aria-hidden="true"><i/><i/><i/></span>
              <span>Atelora</span>
            </a>
            <div className={`mk-nav-links ${menuOpen ? 'is-open' : ''}`}>
              <a href="#platform" onClick={closeMenu}>Platform</a>
              <a href="#author" onClick={closeMenu}>Course Author</a>
              <a href="#live" onClick={closeMenu}>Live Quizzes</a>
              <a href="#learner" onClick={closeMenu}>Learner Experience</a>
              <a href="#insights" onClick={closeMenu}>Reporting</a>
              <a href="#faq" onClick={closeMenu}>FAQ</a>
            </div>
            <div className="mk-nav-actions">
              <Link className="mk-btn mk-btn-soft mk-hide-mobile" to="/login">Log in</Link>
              <Link className="mk-btn mk-btn-dark" to="/login">Explore Atelora <span>→</span></Link>
              <button className="mk-menu-btn" type="button" onClick={() => setMenuOpen((value) => !value)} aria-label="Toggle navigation"><i/></button>
            </div>
          </nav>
        </div>
      </header>

      <main>
        <section className="mk-hero">
          <div className="mk-container">
            <div className="mk-kicker mk-reveal"><span className="mk-dot"/> AI authoring · SCORM-ready delivery · Live engagement</div>
            <h1 className="mk-display mk-reveal">Build learning faster. Deliver it beautifully. Measure the impact.</h1>
            <div className="mk-hero-copy mk-reveal">
              <p className="mk-lead">Atelora helps teams create courses with AI, publish polished learning experiences, run live quizzes, manage learners, and track progress from one connected platform.</p>
              <div className="mk-actions">
                <Link className="mk-btn mk-btn-mint" to="/login">Explore Atelora <span>→</span></Link>
                <a className="mk-btn mk-btn-soft" href="#learner">See learner experience</a>
              </div>
            </div>
            <div className="mk-hero-stage mk-reveal">
              <div className="mk-hero-media"><img src="/atelora-marketing/hero.webp" alt="Atelora Learning Workbench dashboard" fetchPriority="high" /></div>
              <div className="mk-floating-card">
                <strong>Everything connected</strong>
                <p>Create courses, launch learning, engage learners live, and review performance without splitting work across different tools.</p>
                <div><span>AI Course Author</span><span>Live Quizzes</span><span>Learner Insights</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="mk-proof-strip">
          <div className="mk-container">
            <div className="mk-proof-grid mk-reveal">
              <span>AI course generation</span><span>SCORM-ready workflows</span><span>Interactive live quizzes</span><span>Learner management</span><span>Reporting & progress</span>
            </div>
          </div>
        </section>

        <section className="mk-section" id="platform">
          <div className="mk-container">
            <div className="mk-intro mk-reveal">
              <div className="mk-eyebrow">One connected platform</div>
              <div><h2 className="mk-title">From source material to learner outcomes in one clear workflow.</h2><p className="mk-lead">Atelora brings course creation, learner delivery, live engagement, and reporting together so teams can build and improve learning without operational friction.</p></div>
            </div>
            <div className="mk-capabilities mk-reveal">
              {features.map(([num, title, copy]) => <article key={num}><div className="mk-cap-num">{num}</div><h3>{title}</h3><p>{copy}</p></article>)}
            </div>
          </div>
        </section>

        <section className="mk-feature" id="author">
          <div className="mk-container mk-feature-grid">
            <div className="mk-feature-copy mk-reveal">
              <div className="mk-eyebrow">AI Course Author</div>
              <h2>Turn topics, goals, and source files into structured learning.</h2>
              <p>Give Atelora a topic, upload supporting material, choose the depth you want, and let the authoring workflow prepare a structured learning foundation in the background.</p>
              <div className="mk-checks"><Check>Topic-led and source-file-led course creation</Check><Check>Concise, detailed, and comprehensive depth options</Check><Check>Background generation that lets authors keep working</Check></div>
            </div>
            <div className="mk-feature-media mk-reveal"><img src="/atelora-marketing/author.webp" alt="Atelora AI course author interface" loading="lazy" /></div>
          </div>
        </section>

        <section className="mk-feature mk-feature-alt" id="live">
          <div className="mk-container mk-feature-grid">
            <div className="mk-feature-copy mk-reveal">
              <div className="mk-eyebrow">Live Quiz Engagement</div>
              <h2>Keep learners active with live quizzes and instant feedback.</h2>
              <p>Build quiz libraries, launch real-time sessions, review participation, and bring more energy into learning from the same Atelora environment.</p>
              <div className="mk-checks"><Check>Interactive live sessions for active recall and participation</Check><Check>AI-assisted question creation and reusable quiz workflows</Check><Check>Real-time visibility into participation, scores, and engagement</Check></div>
            </div>
            <div className="mk-feature-media mk-reveal"><img src="/atelora-marketing/live.webp" alt="Atelora live quiz engagement dashboard" loading="lazy" /></div>
          </div>
        </section>

        <section className="mk-feature" id="learner">
          <div className="mk-container mk-feature-grid">
            <div className="mk-feature-copy mk-reveal">
              <div className="mk-eyebrow">Learner Experience</div>
              <h2>Give learners a clean path from invitation to course completion.</h2>
              <p>Make the entry experience simple, move learners directly into the course, and keep progress visible through the learning journey.</p>
              <div className="mk-checks"><Check>Simple learner invite and identification flow</Check><Check>Focused transition from enrolment to course launch</Check><Check>Clear progress-aware delivery designed for completion</Check></div>
            </div>
            <div className="mk-feature-media mk-reveal"><img src="/atelora-marketing/learner.webp" alt="Atelora learner invitation to course journey" loading="lazy" /></div>
          </div>
        </section>

        <section className="mk-dark">
          <div className="mk-container">
            <div className="mk-eyebrow mk-reveal">Why Atelora</div>
            <h2 className="mk-title mk-reveal">A complete learning workflow—without the patchwork.</h2>
            <p className="mk-lead mk-reveal">Creation, delivery, engagement, and visibility stay connected instead of living in separate tools.</p>
            <div className="mk-dark-grid mk-reveal">
              <article><span>CREATE</span><h3>Structured authoring</h3><p>Move faster from topic or source material to usable learning structure.</p></article>
              <article><span>DELIVER</span><h3>Modern learner experience</h3><p>Present learning in a clean, product-like interface rather than a static exported feel.</p></article>
              <article><span>MEASURE</span><h3>Visible outcomes</h3><p>Bring learner activity, progress, and engagement together for faster follow-up.</p></article>
            </div>
          </div>
        </section>

        <section className="mk-feature mk-feature-alt" id="insights">
          <div className="mk-container mk-feature-grid">
            <div className="mk-feature-copy mk-reveal">
              <div className="mk-eyebrow">Learning Workbench</div>
              <h2>See progress and performance while they still matter.</h2>
              <p>Monitor learner activity, course performance, progress trends, and completion visibility from one operating view for learning teams and administrators.</p>
              <div className="mk-checks"><Check>Course, learner, and progress visibility in one dashboard</Check><Check>High-level operational insight for timely follow-up</Check><Check>Reporting built for authors, admins, and learning managers</Check></div>
            </div>
            <div className="mk-feature-media mk-reveal"><img src="/atelora-marketing/analytics.webp" alt="Atelora analytics dashboard" loading="lazy" /></div>
          </div>
        </section>

        <section className="mk-section" id="experience">
          <div className="mk-container mk-delivery mk-reveal">
            <div>
              <div className="mk-eyebrow">Course Delivery</div>
              <h2 className="mk-title">Deliver learning in a way that feels modern—not like a static slide export.</h2>
              <p className="mk-lead">Atelora keeps content, progress, supporting visuals, and navigation inside one learner-focused interface.</p>
              <div className="mk-checks"><Check>Readable layouts with clear progress context</Check><Check>Section-based learning with room for knowledge checks</Check><Check>Responsive course delivery for desktop and mobile</Check></div>
            </div>
            <img src="/atelora-marketing/player.webp" alt="Atelora course player" loading="lazy" />
          </div>
        </section>

        <section className="mk-section" id="faq">
          <div className="mk-container">
            <div className="mk-eyebrow mk-reveal">FAQ</div>
            <h2 className="mk-title mk-reveal">Common questions about Atelora.</h2>
            <div className="mk-faq mk-reveal">
              <details open><summary>What does Atelora help teams do?</summary><p>Atelora helps teams create courses with AI, deliver structured learning, run live quizzes, manage learners, and review progress and reporting from one place.</p></details>
              <details><summary>Does Atelora support SCORM-oriented learning workflows?</summary><p>Yes. Atelora is designed around modern course delivery and SCORM-oriented workflows while keeping the learner experience and platform branding focused on Atelora.</p></details>
              <details><summary>Is live engagement part of the same platform?</summary><p>Yes. Live quiz engagement sits inside the same Atelora platform, keeping authoring, delivery, learner activity, and engagement connected.</p></details>
              <details><summary>Who is Atelora for?</summary><p>Learning teams, internal training teams, onboarding programs, compliance functions, enablement teams, and organizations that want a cleaner end-to-end learning workflow.</p></details>
            </div>
          </div>
        </section>

        <section className="mk-final">
          <div className="mk-container mk-reveal">
            <div className="mk-eyebrow">Atelora</div>
            <h2 className="mk-title">A modern learning platform built around the complete journey.</h2>
            <p className="mk-lead">From AI course authoring to learner delivery, live engagement, and reporting, Atelora helps teams run learning as one connected experience.</p>
            <div className="mk-final-row"><span>AI Course Author · Live Quizzes · Learner Experience · Learning Workbench</span><Link className="mk-btn mk-btn-dark" to="/login">Explore Atelora <span>→</span></Link></div>
          </div>
        </section>
      </main>

      <footer className="mk-footer">
        <div className="mk-container">
          <div className="mk-footer-grid">
            <div><a className="mk-brand" href="#top"><span className="mk-brand-mark"><i/><i/><i/></span><span>Atelora</span></a><p>AI-powered course authoring, learner delivery, live quiz engagement, and reporting in one connected learning platform.</p></div>
            <div><h4>Platform</h4><a href="#author">AI Course Author</a><a href="#live">Live Quizzes</a><a href="#insights">Learning Workbench</a></div>
            <div><h4>Experience</h4><a href="#learner">Learner Journey</a><a href="#experience">Course Delivery</a><Link to="/login">Log in</Link></div>
          </div>
          <div className="mk-copy"><span>© 2026 Atelora</span><span>Learning, built smarter.</span></div>
        </div>
      </footer>
    </div>
  );
}
