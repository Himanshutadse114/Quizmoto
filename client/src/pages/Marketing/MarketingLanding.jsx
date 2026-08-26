import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './marketingLanding.css';

const workflow = [
  ['01', 'Brief', 'Start with a topic, document, policy, presentation, or learning objective. Define the audience, expected outcomes, and the level of depth you want.'],
  ['02', 'Plan', 'Atelora structures the material into a clear learning flow, sections, knowledge checks, and supporting content before production begins.'],
  ['03', 'Produce', 'Course content and visuals are assembled into a polished digital learning experience that follows one consistent design system.'],
  ['04', 'Publish', 'Prepare the course for delivery, package the learning experience, and make it ready for your learners or SCORM-oriented workflow.'],
  ['05', 'Measure', 'Track learner progress, completion, engagement, live quiz activity, and reporting from the same Atelora workspace.']
];

const comparison = [
  ['Manual course creation across disconnected tools', 'One connected AI-assisted workflow'],
  ['Hours of repetitive authoring and formatting', 'Structured course creation from a topic or source file'],
  ['Separate quiz and engagement products', 'Live quizzes inside the same learning platform'],
  ['Fragmented learner tracking and reporting', 'Progress, activity, and reporting in one workbench'],
  ['A learning experience that feels like an export', 'A modern learner-facing course experience']
];

const Arrow = () => <span aria-hidden="true">→</span>;

export default function MarketingLanding() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const nodes = [...document.querySelectorAll('.mk-reveal')];
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('is-visible'));
    }, { threshold: 0.08 });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="atelora-marketing">
      <header className="mk-nav-wrap" id="top">
        <div className="mk-container mk-container-nav">
          <nav className="mk-nav" aria-label="Primary navigation">
            <a className="mk-brand" href="#top" onClick={closeMenu} aria-label="Atelora home">
              <span className="mk-brand-mark" aria-hidden="true"><i/><i/><i/></span>
              <span>Atelora</span>
            </a>

            <div className={`mk-nav-links ${menuOpen ? 'is-open' : ''}`}>
              <a href="#how" onClick={closeMenu}>How it works <Arrow /></a>
              <a href="#what" onClick={closeMenu}>What you get <Arrow /></a>
              <a href="#platform" onClick={closeMenu}>The platform <Arrow /></a>
              <a href="#origin" onClick={closeMenu}>Origin <Arrow /></a>
            </div>

            <div className="mk-nav-actions">
              <Link className="mk-login" to="/login">Log in</Link>
              <Link className="mk-primary-cta" to="/login">Explore Atelora <Arrow /></Link>
              <button className="mk-menu-btn" type="button" onClick={() => setMenuOpen((value) => !value)} aria-label="Toggle navigation"><i/></button>
            </div>
          </nav>
        </div>
      </header>

      <main>
        <section className="mk-hero">
          <div className="mk-container">
            <div className="mk-trust mk-reveal">Built for modern learning teams</div>
            <h1 className="mk-display mk-reveal">Create better learning in a fraction of the time.</h1>
            <div className="mk-hero-bottom mk-reveal">
              <p>Turn a brief, policy, presentation, or source file into structured learning, launch live engagement, and track learner progress from one connected Atelora platform.</p>
              <div className="mk-hero-action-line">
                <Link className="mk-primary-cta mk-primary-cta-large" to="/login">Explore Atelora <Arrow /></Link>
                <span>AI authoring · learner delivery · live quizzes</span>
              </div>
            </div>
            <div className="mk-hero-media mk-reveal">
              <img src="/atelora-marketing/hero.webp" alt="Atelora learning workbench dashboard" fetchPriority="high" />
            </div>
          </div>
        </section>

        <section className="mk-editorial-section mk-shift">
          <div className="mk-container">
            <div className="mk-section-label mk-reveal">The shift</div>
            <div className="mk-section-heading-wrap mk-reveal">
              <h2>The traditional learning stack was built for a different way of working.</h2>
              <p>Authoring, learner delivery, engagement, and reporting have traditionally lived in separate tools. Atelora brings those workflows into one product so teams can move from source material to learner outcomes with less friction.</p>
            </div>

            <div className="mk-compare mk-reveal">
              <div className="mk-compare-head"><span>The legacy stack</span><span>Atelora</span></div>
              {comparison.map(([oldWay, ateloraWay]) => (
                <div className="mk-compare-row" key={oldWay}><span>{oldWay}</span><span>{ateloraWay}</span></div>
              ))}
            </div>
          </div>
        </section>

        <section className="mk-editorial-section" id="how">
          <div className="mk-container">
            <div className="mk-section-label mk-reveal">How it works</div>
            <div className="mk-section-heading-wrap mk-reveal">
              <h2>One platform, five phases, no broken handoffs.</h2>
            </div>
            <ol className="mk-workflow mk-reveal">
              {workflow.map(([num, title, copy]) => (
                <li key={num}>
                  <div className="mk-step-number">{num}</div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mk-editorial-section" id="what">
          <div className="mk-container">
            <div className="mk-section-label mk-reveal">What you get</div>
            <div className="mk-section-heading-wrap mk-reveal">
              <h2>Three connected surfaces. Everything else stays out of the way.</h2>
            </div>

            <article className="mk-deliverable mk-reveal">
              <div className="mk-deliverable-index">01 · The course workspace</div>
              <div className="mk-deliverable-media"><img src="/atelora-marketing/author.webp" alt="Atelora course authoring workspace" loading="lazy" /></div>
              <p>Build structured learning from a topic or source file, choose the level of detail, and keep the authoring workflow focused from start to publish.</p>
            </article>

            <article className="mk-deliverable mk-reveal">
              <div className="mk-deliverable-index">02 · The learner experience</div>
              <div className="mk-deliverable-media"><img src="/atelora-marketing/player.webp" alt="Atelora learner course experience" loading="lazy" /></div>
              <p>Give learners a clean, modern course surface with clear progression, supporting visuals, knowledge checks, and a focused path through the material.</p>
            </article>

            <article className="mk-deliverable mk-reveal">
              <div className="mk-deliverable-index">03 · The reporting surface</div>
              <div className="mk-deliverable-media"><img src="/atelora-marketing/analytics.webp" alt="Atelora learner reporting dashboard" loading="lazy" /></div>
              <p>See courses, learners, progress, completion, and activity from one learning workbench so follow-up and improvement happen faster.</p>
            </article>
          </div>
        </section>

        <section className="mk-platform-section" id="platform">
          <div className="mk-container">
            <div className="mk-section-label mk-section-label-light mk-reveal">The platform · Atelora workspace</div>
            <div className="mk-platform-heading mk-reveal">
              <h2>Today, Atelora runs as one connected learning platform.</h2>
              <p>Create learning, engage learners live, manage course access, and review progress without leaving the same workspace.</p>
            </div>

            <div className="mk-platform-grid mk-reveal">
              <div className="mk-platform-copy">
                <div className="mk-platform-list-block"><h3>You provide</h3><ul><li>Topic, source material, or learning goal</li><li>Learner audience and course depth</li><li>Your preferred content and visual direction</li></ul></div>
                <div className="mk-platform-list-block"><h3>Atelora gives you</h3><ul><li>AI-assisted course authoring</li><li>Interactive live quiz engagement</li><li>Learner delivery, tracking, and reporting</li></ul></div>
                <div className="mk-platform-meta"><span>Access</span><strong>Self-serve platform</strong></div>
                <div className="mk-platform-meta"><span>Workflow</span><strong>Create → deliver → engage → measure</strong></div>
              </div>

              <div className="mk-offer-card">
                <div className="mk-offer-kicker">Atelora platform</div>
                <div className="mk-offer-title">One workspace</div>
                <p>Course creation, learner delivery, live engagement, progress tracking, and reporting are designed to work together from day one.</p>
                <ul><li>AI Course Author</li><li>Course Library and learner roster</li><li>Live quiz engagement</li><li>Progress and completion tracking</li><li>Reports and insights</li></ul>
                <Link className="mk-primary-cta mk-primary-cta-light" to="/login">Explore Atelora <Arrow /></Link>
              </div>
            </div>

            <div className="mk-platform-peek mk-reveal">
              <div className="mk-peek-label">A peek at the platform</div>
              <img src="/atelora-marketing/live.webp" alt="Atelora live engagement dashboard" loading="lazy" />
            </div>
          </div>
        </section>

        <section className="mk-editorial-section mk-access-modes">
          <div className="mk-container">
            <div className="mk-section-label mk-reveal">Where this goes</div>
            <div className="mk-section-heading-wrap mk-reveal"><h2>One product, two sides of the learning experience.</h2></div>
            <div className="mk-mode-grid mk-reveal">
              <article><div className="mk-mode-kicker">Author & admin</div><h3>Build and manage</h3><p>Create courses, manage learners, publish content, run live sessions, and review the performance of your learning program.</p></article>
              <article><div className="mk-mode-kicker">Learner</div><h3>Learn and engage</h3><p>Enter through a simple learner flow, complete modern courses, participate in live quizzes, and keep progress saved along the way.</p></article>
            </div>
            <div className="mk-access-note mk-reveal">The value of Atelora is not another isolated authoring tool. It is the continuity between what your team creates and what your learners actually experience.</div>
          </div>
        </section>

        <section className="mk-editorial-section mk-origin" id="origin">
          <div className="mk-container">
            <div className="mk-section-label mk-reveal">Origin</div>
            <div className="mk-section-heading-wrap mk-reveal">
              <h2>Atelora was built around a simple problem: learning workflows are too fragmented.</h2>
            </div>
            <div className="mk-origin-copy mk-reveal">
              <p>Course authoring, quizzes, learner management, delivery, and reporting often force teams into a collection of disconnected systems. That creates repetitive work for administrators and an inconsistent experience for learners.</p>
              <p>Atelora brings those surfaces together around one learning workflow—so a course can move from idea to delivery, engagement, and reporting without losing context between each stage.</p>
            </div>
          </div>
        </section>

        <section className="mk-final-brief">
          <div className="mk-container mk-reveal">
            <div className="mk-section-label">Final brief</div>
            <h2>Bring your next training brief.</h2>
            <p>The policy update that needs a course. The onboarding module that needs rebuilding. The awareness topic your team wants to turn into something learners will actually complete. Start it in Atelora.</p>
            <Link className="mk-primary-cta mk-primary-cta-large" to="/login">Explore Atelora <Arrow /></Link>
          </div>
        </section>
      </main>

      <footer className="mk-footer">
        <div className="mk-container mk-footer-grid">
          <div className="mk-footer-brand">
            <a className="mk-brand" href="#top"><span className="mk-brand-mark"><i/><i/><i/></span><span>Atelora</span></a>
            <p>An AI-powered platform for course authoring, learner delivery, live engagement, and learning insights.</p>
          </div>
          <div><h4>Platform</h4><Link to="/login">Log in</Link><a href="#how">How it works</a><a href="#what">What you get</a></div>
          <div><h4>Site</h4><a href="#platform">The platform</a><a href="#origin">Origin</a><a href="#top">Back to top</a></div>
        </div>
        <div className="mk-container mk-footer-bottom"><span>© 2026 Atelora</span><span>Learning, built smarter.</span></div>
      </footer>
    </div>
  );
}
