import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const homePath = path.resolve(scriptDir, '..', 'dist', 'landing', 'index.html');

let html = await fs.readFile(homePath, 'utf8');

const section = `
<section class="lmsgen-seo-section lmsgen-pain-section lmsgen-pain-section-v2" aria-labelledby="lmsgen-pain-title">
  <div class="lmsgen-pain-shell">
    <div class="lmsgen-pain-intro">
      <div class="lmsgen-pain-kicker">THE WORK BEHIND TRAINING SHOULD BE EASIER</div>
      <h2 id="lmsgen-pain-title">Less admin. Fewer tools. Clearer learning outcomes.</h2>
      <p>Learning teams are expected to create more content, launch it faster and prove it worked. LMSGEN brings authoring, SCORM delivery, campaigns, engagement and reporting into one connected workflow.</p>
      <a href="/solutions" class="lmsgen-pain-cta">See how LMSGEN works <span aria-hidden="true">→</span></a>
    </div>

    <div class="lmsgen-pain-grid-v2">
      <article class="lmsgen-pain-item">
        <div class="lmsgen-pain-number">01</div>
        <div class="lmsgen-pain-item-copy">
          <h3>Course requests keep piling up</h3>
          <p>Policies, PDFs and subject-matter knowledge can spend weeks waiting to become usable learning.</p>
          <div class="lmsgen-pain-outcome"><span>LMSGEN</span> Create structured learning faster with AI-assisted authoring.</div>
        </div>
      </article>

      <article class="lmsgen-pain-item">
        <div class="lmsgen-pain-number">02</div>
        <div class="lmsgen-pain-item-copy">
          <h3>Learner follow-up becomes manual work</h3>
          <p>Assignments, reminders and status checks quickly turn into repetitive admin as learner numbers grow.</p>
          <div class="lmsgen-pain-outcome"><span>LMSGEN</span> Run campaigns, manage learners and send reminders from one place.</div>
        </div>
      </article>

      <article class="lmsgen-pain-item">
        <div class="lmsgen-pain-number">03</div>
        <div class="lmsgen-pain-item-copy">
          <h3>Completion does not tell the whole story</h3>
          <p>A completed course is useful, but teams also need score, time, attempts and learning evidence.</p>
          <div class="lmsgen-pain-outcome"><span>LMSGEN</span> Track the SCORM learning data your course actually sends.</div>
        </div>
      </article>

      <article class="lmsgen-pain-item">
        <div class="lmsgen-pain-number">04</div>
        <div class="lmsgen-pain-item-copy">
          <h3>Your learning stack is fragmented</h3>
          <p>Authoring, delivery, learner management, quizzes and reporting often live in separate systems.</p>
          <div class="lmsgen-pain-outcome"><span>LMSGEN</span> Keep creation, delivery, campaigns, engagement and analytics connected.</div>
        </div>
      </article>
    </div>
  </div>
</section>`;

const sectionPattern = /<section class="lmsgen-seo-section lmsgen-pain-section"[\s\S]*?<\/section>/i;
if (!sectionPattern.test(html)) {
  throw new Error('Could not find generated LMSGEN pain-point section.');
}
html = html.replace(sectionPattern, section);

const style = `
<style id="lmsgen-pain-section-v2-style">
  .lmsgen-pain-section-v2 {
    position: relative !important;
    z-index: 5 !important;
    isolation: isolate;
    clear: both;
    overflow: visible !important;
    min-height: 0 !important;
    height: auto !important;
    margin: 0 !important;
    padding: clamp(7rem, 8vw, 11rem) 2.4rem !important;
    background: #073f3a !important;
    color: #ffffff !important;
    font-family: "Open Sauce One", sans-serif !important;
  }

  .lmsgen-pain-section-v2::before,
  .lmsgen-pain-section-v2::after {
    content: none !important;
  }

  .lmsgen-pain-shell {
    width: min(128rem, 100%);
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(0, 0.78fr) minmax(0, 1.22fr);
    gap: clamp(4rem, 7vw, 9rem);
    align-items: start;
  }

  .lmsgen-pain-intro {
    position: sticky;
    top: 4rem;
    align-self: start;
  }

  .lmsgen-pain-kicker {
    margin-bottom: 1.8rem;
    color: #fafa45;
    font-family: "Open Sauce One", sans-serif !important;
    font-size: 1.3rem;
    line-height: 1.25;
    font-weight: 700;
    letter-spacing: .13em;
  }

  .lmsgen-pain-section-v2 .lmsgen-pain-intro h2 {
    max-width: 58rem !important;
    margin: 0 !important;
    color: #ffffff !important;
    font-family: "Open Sauce One", sans-serif !important;
    font-size: clamp(4rem, 4.25vw, 6rem) !important;
    font-weight: 520 !important;
    line-height: 1.04 !important;
    letter-spacing: -.045em !important;
    text-transform: none !important;
  }

  .lmsgen-pain-intro > p {
    max-width: 55rem;
    margin: 2.4rem 0 0;
    color: #c7d9d6;
    font-family: "Open Sauce One", sans-serif !important;
    font-size: 1.8rem;
    font-weight: 400;
    line-height: 1.6;
  }

  .lmsgen-pain-cta {
    display: inline-flex;
    align-items: center;
    gap: 1rem;
    margin-top: 3rem;
    color: #ffffff !important;
    font-family: "Open Sauce One", sans-serif !important;
    font-size: 1.55rem;
    font-weight: 650;
    letter-spacing: -.01em;
    text-decoration: none !important;
    border-bottom: 1px solid rgba(255,255,255,.45);
    padding-bottom: .5rem;
  }

  .lmsgen-pain-cta span {
    transition: transform .2s ease;
  }

  .lmsgen-pain-cta:hover span {
    transform: translateX(.4rem);
  }

  .lmsgen-pain-grid-v2 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.6rem;
    margin: 0;
  }

  .lmsgen-pain-item {
    min-width: 0;
    min-height: 0 !important;
    height: auto !important;
    padding: 2.6rem;
    border: 1px solid rgba(255,255,255,.16);
    border-radius: 2.2rem;
    background: #f7f5ee;
    color: #073f3a;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 1.8rem;
    align-items: start;
    overflow: visible;
    font-family: "Open Sauce One", sans-serif !important;
  }

  .lmsgen-pain-number {
    width: 4rem;
    height: 4rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    border-radius: 999px;
    background: #d7f3ee;
    color: #0b6259;
    font-family: "Open Sauce One", sans-serif !important;
    font-size: 1.2rem;
    line-height: 1;
    font-weight: 750;
  }

  .lmsgen-pain-section-v2 .lmsgen-pain-item h3 {
    margin: .35rem 0 1.2rem !important;
    color: #073f3a !important;
    font-family: "Open Sauce One", sans-serif !important;
    font-size: clamp(1.9rem, 1.5vw, 2.35rem) !important;
    font-weight: 680 !important;
    line-height: 1.25 !important;
    letter-spacing: -.028em !important;
    text-transform: none !important;
  }

  .lmsgen-pain-item-copy > p {
    margin: 0;
    color: #4a6662;
    font-family: "Open Sauce One", sans-serif !important;
    font-size: 1.55rem;
    font-weight: 400;
    line-height: 1.55;
  }

  .lmsgen-pain-outcome {
    margin-top: 2rem;
    padding-top: 1.8rem;
    border-top: 1px solid rgba(7,63,58,.12);
    color: #0b6259;
    font-family: "Open Sauce One", sans-serif !important;
    font-size: 1.42rem;
    line-height: 1.5;
    font-weight: 650;
  }

  .lmsgen-pain-outcome span {
    display: inline-block;
    margin-right: .7rem;
    padding: .45rem .7rem;
    border-radius: .7rem;
    background: #073f3a;
    color: #fafa45;
    font-family: "Open Sauce One", sans-serif !important;
    font-size: 1rem;
    line-height: 1;
    font-weight: 750;
    letter-spacing: .08em;
  }

  @media (max-width: 991px) {
    .lmsgen-pain-shell {
      grid-template-columns: 1fr;
      gap: 4.5rem;
    }
    .lmsgen-pain-intro {
      position: static;
    }
  }

  @media (max-width: 680px) {
    .lmsgen-pain-section-v2 {
      padding: 6.5rem 1.8rem !important;
    }
    .lmsgen-pain-grid-v2 {
      grid-template-columns: 1fr;
    }
    .lmsgen-pain-item {
      padding: 2.2rem;
    }
    .lmsgen-pain-section-v2 .lmsgen-pain-intro h2 {
      font-size: 3.8rem !important;
    }
  }
</style>`;

if (html.includes('id="lmsgen-pain-section-v2-style"')) {
  html = html.replace(/<style id="lmsgen-pain-section-v2-style">[\s\S]*?<\/style>/i, style);
} else {
  html = html.replace(/<\/head>/i, `${style}\n</head>`);
}

await fs.writeFile(homePath, html, 'utf8');
console.log('Refined homepage pain-point section layout.');
