import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(scriptDir, '..');
const distRoot = path.join(clientRoot, 'dist');
const landingRoot = path.join(distRoot, 'landing');
const SITE_URL = 'https://www.lmsgen.in';
const BRAND = 'LMSGEN';

const BLOG_POSTS = [
  ['why-scorm-courses-go-unfinished', 'Why Most SCORM Courses Go Unfinished (And How to Fix It)'],
  ['live-quizzes-vs-static-assessments', 'Live Quizzes vs. Static Assessments: What Actually Improves Retention'],
  ['scorm-1-2-vs-scorm-2004', 'SCORM 1.2 vs. SCORM 2004: What Actually Matters for Course Authors'],
  ['ai-assisted-authoring-course-timeline', 'How AI-Assisted Authoring Changes the Course Creation Timeline'],
  ['signs-security-awareness-training-needs-refresh', '5 Signs Your Security Awareness Training Needs a Refresh'],
  ['slide-deck-to-scorm-migration-guide', 'From Slide Deck to SCORM Package: A Practical Migration Guide'],
  ['quizmoto-as-a-full-learning-platform', 'What We Learned Building Quizmoto Into a Full Learning Platform'],
  ['designing-knowledge-checks-that-dont-feel-like-a-test', "Designing Knowledge Checks That Don't Feel Like a Test"],
];

const PAGES = [
  {
    file: 'index.html',
    route: '/',
    title: 'AI LMS for SCORM Course Creation & Learner Tracking | LMSGEN',
    description: 'Create SCORM-ready training with AI and publish presentations, comics, guides and visual stories through LMSGEN Publica with audience engagement analytics.',
    type: 'home',
  },
  {
    file: 'solutions/index.html',
    route: '/solutions',
    title: 'AI Course Authoring, SCORM LMS & Learner Tracking | LMSGEN',
    description: 'Replace disconnected learning tools with LMSGEN: AI course authoring, SCORM 1.2/2004 delivery, learner campaigns, live quizzes, tracking and reporting.',
    type: 'solutions',
  },
  {
    file: 'about/index.html',
    route: '/about',
    title: 'About LMSGEN | AI-Powered Learning Management Platform',
    description: 'LMSGEN helps L&D, compliance and security awareness teams create training faster, deliver SCORM learning and measure learner progress from one platform.',
    type: 'about',
  },
  {
    file: 'blog/index.html',
    route: '/blog',
    title: 'LMSGEN Blog | SCORM, AI Course Authoring & Learning Analytics',
    description: 'Practical guides for L&D and security awareness teams on SCORM, AI course creation, learner engagement, training delivery and learning analytics.',
    type: 'blog',
  },
  {
    file: 'contact/index.html',
    route: '/contact',
    title: 'Contact LMSGEN | Explore the AI Learning Platform',
    description: 'Talk to LMSGEN about AI course authoring, SCORM delivery, learner campaigns, live quizzes and training analytics for your organisation.',
    type: 'contact',
  },
  ...BLOG_POSTS.map(([slug, title]) => ({
    file: `blog/${slug}.html`,
    route: `/blog/${slug}`,
    title: `${title} | LMSGEN`,
    description: null,
    type: 'article',
  })),
];

const HOME_HERO_HEADING = 'AI-powered LMS for SCORM course creation, delivery and learner tracking.';
const HOME_HERO_EYEBROW = 'For L&D, compliance and security awareness teams';
const HOME_HERO_DESCRIPTION = 'Turn policies, documents and ideas into structured learning, publish visual content through LMSGEN Publica, launch learner campaigns, run live Quizmoto sessions and measure engagement from one connected workspace.';

const PAIN_SECTION = `
<section class="lmsgen-seo-section lmsgen-pain-section" aria-labelledby="lmsgen-pain-title">
  <div class="lmsgen-seo-inner">
    <div class="lmsgen-seo-kicker">WHY LEARNING OPERATIONS GET STUCK</div>
    <h2 id="lmsgen-pain-title">Training should not require five tools, three spreadsheets and constant learner chasing.</h2>
    <p class="lmsgen-seo-lead">L&D, compliance and security awareness teams are expected to create more training, launch it faster and prove it worked. LMSGEN brings the workflow together so the admin effort does not grow with every course or campaign.</p>
    <div class="lmsgen-pain-grid">
      <article class="lmsgen-pain-card"><span>01</span><h3>Course requests pile up</h3><p>Policies, PDFs and subject-matter expertise can sit in a production queue for weeks before they become usable learning.</p><strong>Use AI-assisted authoring to move from source material to a structured course faster.</strong></article>
      <article class="lmsgen-pain-card"><span>02</span><h3>SCORM becomes a compatibility headache</h3><p>Teams waste time wondering which package to export, whether it will launch and what learner data the LMS will actually receive.</p><strong>Upload and deliver SCORM 1.2 or SCORM 2004 packages and keep SCORM tracking in the same workspace.</strong></article>
      <article class="lmsgen-pain-card"><span>03</span><h3>Assignments turn into manual chasing</h3><p>CSV lists, links, reminders and status checks become repetitive admin work as the learner population grows.</p><strong>Create campaigns, add or remove learners while they are running and send reminders from the campaign workflow.</strong></article>
      <article class="lmsgen-pain-card"><span>04</span><h3>Completion alone does not prove learning</h3><p>A 100% completion badge tells you that a course ended. It does not always tell you what a learner understood.</p><strong>Track progress, score, time, attempts and compatible question-level interaction evidence when the course sends it.</strong></article>
      <article class="lmsgen-pain-card"><span>05</span><h3>Mandatory learning feels passive</h3><p>Static training is easy to click through and difficult to remember, especially when every programme looks and feels the same.</p><strong>Use Quizmoto as a separate live-quiz experience for real-time participation and knowledge checks.</strong></article>
      <article class="lmsgen-pain-card"><span>06</span><h3>Your learning stack is fragmented</h3><p>Authoring, SCORM delivery, learner management, live quizzes and reporting often live in different systems with repeated hand-offs.</p><strong>Bring course creation, delivery, campaigns, engagement and analytics into one LMSGEN workspace.</strong></article>
    </div>
  </div>
</section>`;

const PDF_COURSE_SECTION = `
<section class="lmsgen-seo-section lmsgen-pdf-course-section" aria-labelledby="lmsgen-pdf-course-title">
  <div class="lmsgen-seo-inner">
    <div class="lmsgen-publica-layout">
      <div class="lmsgen-pdf-course-proof publica-demo-shell" data-publica-demo>
        <div class="publica-demo-topbar">
          <div><span class="publica-demo-mark">P</span><strong>LMSGEN Publica</strong><small>Interactive comic preview</small></div>
          <span class="publica-demo-live"><i></i> Page-level tracking</span>
        </div>
        <div class="publica-reader-stage">
          <button type="button" class="publica-turn-control publica-prev" aria-label="Previous publication page"><span aria-hidden="true">‹</span><b>Previous</b></button>
          <div class="publica-book-viewport">
            <div class="publica-comic-book is-fallback" data-publica-book aria-live="polite">
              <article class="publica-comic-page publica-front-cover"><div class="publica-cover"><span>ORBITAL INK · ISSUE 01</span><h4>The Signal<br>in Sector 9</h4><p>A short comic about one message that changed an entire city.</p><b>READ NOW →</b></div></article>
            </div>
          </div>
          <button type="button" class="publica-turn-control publica-next" aria-label="Next publication page"><b>Next</b><span aria-hidden="true">›</span></button>
          <button type="button" class="publica-book-switch" data-publica-switch data-next-set="archive" aria-label="Open The Midnight Archive">
            <small>SWITCH STORY</small>
            <span class="publica-mini-cover"><i aria-hidden="true"></i><b data-publica-switch-title>The Midnight Archive</b></span>
          </button>
        </div>
        <div class="publica-reader-footer">
          <span data-publica-status>Page 1 of 6</span>
          <div class="publica-reader-dots" aria-hidden="true"><i></i><i></i><i></i></div>
          <strong>Tap or click to turn the page</strong>
        </div>
        <template data-publica-page data-publica-set="signal"><div class="publica-cover"><span>ORBITAL INK · ISSUE 01</span><h4>The Signal<br>in Sector 9</h4><p>A short comic about one message that changed an entire city.</p><b>READ NOW →</b></div></template>
        <template data-publica-page data-publica-set="signal"><div class="publica-panel-grid"><div class="publica-panel publica-night"><em>09:17 PM</em><strong>The city went silent.</strong></div><div class="publica-panel publica-hero"><span class="publica-bubble">Did anyone else hear that?</span><b>!</b></div><div class="publica-caption">Every great story deserves a reading experience that pulls the audience forward.</div></div></template>
        <template data-publica-page data-publica-set="signal"><div class="publica-panel-grid publica-action-grid"><div class="publica-panel publica-signal"><em>SECTOR 9</em><strong>THE SIGNAL<br>RETURNED.</strong></div><div class="publica-panel publica-run"><span class="publica-bubble">Move—now!</span><b>RUN</b></div><div class="publica-sfx">KRRR—SHHH!</div></div></template>
        <template data-publica-page data-publica-set="signal"><div class="publica-panel-grid"><div class="publica-panel publica-lab"><em>ARCHIVE 404</em><strong>It was never a warning.</strong></div><div class="publica-panel publica-face"><span class="publica-bubble">It was an invitation.</span></div><div class="publica-caption publica-caption-teal">Publica preserves every designed page while making the whole story effortless to explore.</div></div></template>
        <template data-publica-page data-publica-set="signal"><div class="publica-panel-grid publica-action-grid"><div class="publica-panel publica-portal"><em>FINAL TRANSMISSION</em><strong>OPEN<br>THE GATE</strong></div><div class="publica-panel publica-impact"><b>WHAM!</b><span class="publica-bubble">We write the ending.</span></div><div class="publica-sfx publica-sfx-yellow">TO BE CONTINUED…</div></div></template>
        <template data-publica-page data-publica-set="signal"><div class="publica-back-cover"><span>YOUR AUDIENCE IS WAITING</span><h4>Publish your next world with LMSGEN Publica.</h4><ul><li>One branded library</li><li>Beautiful page-turn reading</li><li>Real audience insight</li></ul><b>LMSGEN PUBLICA</b></div></template>
        <template data-publica-page data-publica-set="archive"><div class="publica-novel-cover"><span>A MOONLIT MYSTERY · BOOK ONE</span><h4>The Midnight Archive</h4><p>Every lost story waits for someone brave enough to open it.</p><b>ENTER THE ARCHIVE →</b></div></template>
        <template data-publica-page data-publica-set="archive"><div class="publica-novel-page publica-novel-chapter"><span>CHAPTER ONE</span><h4>The door appeared at midnight.</h4><p>Mara had passed the empty wall a thousand times. Tonight, a brass handle waited beneath the moonlight.</p><b>01</b></div></template>
        <template data-publica-page data-publica-set="archive"><div class="publica-novel-page publica-novel-city"><span>THE CITY BELOW</span><h4>Every window held a different century.</h4><p>Above the rooftops, paper birds carried unfinished sentences into the stars.</p><b>02</b></div></template>
        <template data-publica-page data-publica-set="archive"><div class="publica-novel-page publica-novel-letter"><span>FOUND BETWEEN PAGES</span><blockquote>“The story remembers the reader.”</blockquote><p>The ink was still warm.</p><b>03</b></div></template>
        <template data-publica-page data-publica-set="archive"><div class="publica-novel-page publica-novel-library"><span>THE LAST SHELF</span><h4>One book carried her name.</h4><p>Its final page was blank—and the archive was waiting.</p><b>04</b></div></template>
        <template data-publica-page data-publica-set="archive"><div class="publica-novel-cover publica-novel-back"><span>DISCOVER WHAT COMES NEXT</span><h4>Your story belongs in motion.</h4><p>Publish novels, comics and visual worlds with LMSGEN Publica.</p><b>LMSGEN PUBLICA</b></div></template>
      </div>
      <div class="lmsgen-publica-copy">
        <div class="lmsgen-pdf-course-header">
          <div class="lmsgen-seo-kicker">INTRODUCING LMSGEN PUBLICA</div>
          <h2 id="lmsgen-pdf-course-title">Publish beautifully. Build an audience. Know what keeps them reading.</h2>
        </div>
        <div class="lmsgen-pdf-course-summary">
          <p>Give presentations, comics, guides and visual stories a premium digital home—with a shareable library and meaningful audience insight built in.</p>
          <a class="lmsgen-conversion-cta" href="/contact">Let's discuss LMSGEN Publica <span aria-hidden="true">→</span></a>
        </div>
        <ul class="lmsgen-pdf-course-benefits" aria-label="Benefits of LMSGEN Publica">
          <li><span class="publica-benefit-index" aria-hidden="true">01</span><strong>Build a library your audience remembers.</strong><p>Bring every issue, chapter or collection together under one professional link.</p></li>
          <li><span class="publica-benefit-index" aria-hidden="true">02</span><strong>Keep every page visually powerful.</strong><p>Present the work in a polished reader designed for every screen.</p></li>
          <li><span class="publica-benefit-index" aria-hidden="true">03</span><strong>Understand what readers value.</strong><p>See page attention, active reading time and completion without guessing.</p></li>
        </ul>
      </div>
    </div>
  </div>
</section>
<script src="https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.min.js"></script>
<script id="lmsgen-publica-demo-script">
(function () {
  document.querySelectorAll('[data-publica-demo]').forEach(function (demo) {
    if (demo.dataset.ready) return;
    demo.dataset.ready = '1';

    var bookSets = {};
    Array.from(demo.querySelectorAll('template[data-publica-page]')).forEach(function (item) {
      var setName = item.getAttribute('data-publica-set') || 'signal';
      if (!bookSets[setName]) bookSets[setName] = [];
      bookSets[setName].push(item.innerHTML);
    });

    var titles = {
      signal: 'The Signal in Sector 9',
      archive: 'The Midnight Archive'
    };
    var book = demo.querySelector('[data-publica-book]');
    var viewport = demo.querySelector('.publica-book-viewport');
    var status = demo.querySelector('[data-publica-status]');
    var prev = demo.querySelector('.publica-prev');
    var next = demo.querySelector('.publica-next');
    var switcher = demo.querySelector('[data-publica-switch]');
    var switchTitle = demo.querySelector('[data-publica-switch-title]');
    var dots = Array.from(demo.querySelectorAll('.publica-reader-dots i'));
    var portrait = window.matchMedia('(max-width:760px)').matches;
    var currentSet = portrait ? 'archive' : 'signal';
    var pages = bookSets[currentSet] || [];
    var pageFlip = null;
    var current = 0;
    var resizeTimer = null;
    var switchTimer = null;

    function alternateSet() {
      return currentSet === 'signal' ? 'archive' : 'signal';
    }

    function updateSwitcher() {
      var alternate = alternateSet();
      switcher.setAttribute('data-next-set', alternate);
      switcher.setAttribute('aria-label', 'Open ' + titles[alternate]);
      switchTitle.textContent = titles[alternate];
    }

    function dimensions() {
      var isPortrait = window.matchMedia('(max-width:760px)').matches;
      var available = Math.max(220, viewport.parentElement.clientWidth - (isPortrait ? 24 : 96));
      var width = isPortrait ? Math.min(430, available) : Math.min(420, Math.floor(available / 2));
      return {
        width: Math.max(220, width),
        height: Math.max(306, Math.round(width / .72)),
        portrait: isPortrait
      };
    }

    function update(index) {
      current = Math.max(0, Math.min(pages.length - 1, Number(index) || 0));
      status.textContent = titles[currentSet] + ' · Page ' + (current + 1) + ' of ' + pages.length;
      prev.disabled = current === 0;
      next.disabled = current >= pages.length - 1;
      dots.forEach(function (dot, dotIndex) {
        dot.classList.toggle('is-active', dotIndex === Math.min(dots.length - 1, Math.floor(current / 2)));
      });
    }

    function pageMarkup(index) {
      return '<article class="publica-comic-page' +
        (index === 0 ? ' publica-front-cover' : '') +
        (index === pages.length - 1 ? ' publica-back-cover-page' : '') +
        '">' + (pages[index] || '') + '</article>';
    }

    function renderMobilePage(index) {
      if (!portrait || !book) return;
      var target = Math.max(0, Math.min(pages.length - 1, Number(index) || 0));
      book.classList.remove('is-mobile-entering');
      book.innerHTML = pageMarkup(target);
      update(target);
      void book.offsetWidth;
      book.classList.add('is-mobile-entering');
    }

    function build() {
      var dims = dimensions();
      portrait = dims.portrait;
      if (pageFlip) {
        try { pageFlip.destroy(); } catch (_) {}
      }
      pageFlip = null;
      viewport.innerHTML = '';
      book = document.createElement('div');
      book.className = 'publica-comic-book';
      book.setAttribute('data-publica-book', '');
      book.setAttribute('aria-live', 'polite');
      viewport.appendChild(book);
      book.setAttribute('aria-label', titles[currentSet] + ' interactive preview');
      viewport.style.width = (dims.width * (dims.portrait ? 1 : 2)) + 'px';
      viewport.style.height = dims.height + 'px';

      if (dims.portrait) {
        book.classList.add('is-mobile-book');
        renderMobilePage(current);
        demo.classList.remove('is-changing-book');
        return;
      }

      book.innerHTML = pages.map(function (_, index) { return pageMarkup(index); }).join('');

      if (!window.St || !window.St.PageFlip) {
        book.classList.add('is-fallback');
        update(0);
        demo.classList.remove('is-changing-book');
        return;
      }

      pageFlip = new window.St.PageFlip(book, {
        width: dims.width,
        height: dims.height,
        size: 'fixed',
        minWidth: dims.width,
        maxWidth: dims.width,
        minHeight: dims.height,
        maxHeight: dims.height,
        drawShadow: true,
        flippingTime: window.matchMedia('(prefers-reduced-motion:reduce)').matches ? 0 : 900,
        usePortrait: dims.portrait,
        startPage: current,
        autoSize: false,
        maxShadowOpacity: .5,
        showCover: true,
        mobileScrollSupport: true,
        swipeDistance: 24,
        clickEventForward: true,
        useMouseEvents: true,
        showPageCorners: true,
        disableFlipByClick: false
      });
      pageFlip.on('init', function (event) {
        book.classList.add('is-ready');
        update(event.data && event.data.page);
        demo.classList.remove('is-changing-book');
      });
      pageFlip.on('flip', function (event) { update(event.data); });
      pageFlip.loadFromHTML(Array.from(book.querySelectorAll('.publica-comic-page')));
    }

    prev.addEventListener('click', function () {
      if (portrait) renderMobilePage(current - 1);
      else if (pageFlip) pageFlip.flipPrev('top');
    });
    next.addEventListener('click', function () {
      if (portrait) renderMobilePage(current + 1);
      else if (pageFlip) pageFlip.flipNext('top');
    });
    switcher.addEventListener('click', function () {
      clearTimeout(switchTimer);
      demo.classList.add('is-changing-book');
      currentSet = alternateSet();
      pages = bookSets[currentSet] || [];
      current = 0;
      updateSwitcher();
      switchTimer = setTimeout(build, 180);
    });
    demo.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') {
        if (portrait) renderMobilePage(current - 1);
        else if (pageFlip) pageFlip.flipPrev('top');
      }
      if (event.key === 'ArrowRight') {
        if (portrait) renderMobilePage(current + 1);
        else if (pageFlip) pageFlip.flipNext('top');
      }
    });
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        var nextPortrait = window.matchMedia('(max-width:760px)').matches;
        if (nextPortrait !== portrait) {
          currentSet = nextPortrait ? 'archive' : 'signal';
          pages = bookSets[currentSet] || [];
          current = 0;
          updateSwitcher();
          build();
        }
      }, 180);
    });

    updateSwitcher();
    build();
  });
})();
</script>`;

const FAQ_ITEMS = [
  ['What is LMSGEN?', 'LMSGEN is an AI-powered learning management platform for creating, delivering and tracking workplace learning. It combines AI-assisted course authoring, SCORM delivery, learner campaigns, live Quizmoto sessions and reporting in one workspace.'],
  ['Who is LMSGEN built for?', 'LMSGEN is designed for L&D teams, compliance and training managers, security awareness teams and organisations that need to create custom learning quickly and track learner outcomes without stitching together multiple tools.'],
  ['Does LMSGEN support SCORM 1.2 and SCORM 2004?', 'Yes. LMSGEN can upload and deliver SCORM 1.2 and SCORM 2004 packages. Externally authored Articulate courses can be uploaded as SCORM ZIP packages, while LMSGEN-generated courses can also be delivered and tracked inside the platform.'],
  ['Can LMSGEN track learner answers and scores?', 'LMSGEN tracks the SCORM data a course sends. Depending on the package, this can include completion, score, learning time, attempts, learner response, correct response, result and compatible question-level interaction data.'],
  ['How do learner campaigns work in LMSGEN?', 'Admins can create a campaign, assign published courses and learners, start or stop the campaign, add or remove learners while it is running and send reminder emails. Campaign analytics are kept separate from direct course-link tracking.'],
  ['Is Quizmoto part of the SCORM course player?', 'Quizmoto is a separate live-quiz feature inside the LMSGEN workspace. Hosts run a real-time session, participants join with a code and the group plays together live.'],
  ['What is LMSGEN Publica?', 'LMSGEN Publica is a digital publication experience for presentations, visual guides, magazines, comics and illustrated stories. Creators can publish their work in a polished reader, bring multiple titles together in one shareable library and understand audience engagement through page-level analytics.'],
  ['How do I turn a presentation into a trackable course?', 'Create the presentation in your preferred tool, export it as a landscape PDF, then upload the PDF to LMSGEN. Each PDF page becomes a preserved course slide, LMSGEN adds an editable AI-generated quiz, and learner progress, scores and time spent per slide are tracked.'],
];

const FAQ_SECTION = `
<section class="lmsgen-seo-section lmsgen-faq-section" aria-labelledby="lmsgen-faq-title">
  <div class="lmsgen-seo-inner lmsgen-seo-inner-narrow">
    <div class="lmsgen-seo-kicker">LMSGEN FAQ</div>
    <h2 id="lmsgen-faq-title">Questions learning teams ask before choosing an LMS</h2>
    <div class="lmsgen-faq-list">
      ${FAQ_ITEMS.map(([question, answer]) => `<details class="lmsgen-faq-item"><summary>${question}</summary><p>${answer}</p></details>`).join('\n      ')}
    </div>
  </div>
</section>`;

const SOLUTIONS_AUDIENCE_SECTION = `
<section class="lmsgen-seo-section lmsgen-audience-section" aria-labelledby="lmsgen-audience-title">
  <div class="lmsgen-seo-inner">
    <div class="lmsgen-seo-kicker">BUILT AROUND THE WORK YOU ALREADY DO</div>
    <h2 id="lmsgen-audience-title">One learning platform for the teams carrying the training workload.</h2>
    <p class="lmsgen-seo-lead">LMSGEN is designed around the operational problems behind corporate training: content backlogs, SCORM delivery, campaign administration, learner engagement and evidence that training actually happened.</p>
    <div class="lmsgen-audience-grid">
      <article><h3>L&D teams</h3><p>Create custom courses faster, manage a central learning library and reduce hand-offs between authoring and delivery.</p></article>
      <article><h3>Compliance managers</h3><p>Launch required training, follow learner progress, send reminders and keep completion and score evidence easier to review.</p></article>
      <article><h3>Security awareness teams</h3><p>Turn fast-changing risks and policies into learning, campaigns and live knowledge checks without rebuilding the workflow each time.</p></article>
      <article><h3>Training teams and providers</h3><p>Upload existing SCORM packages, create new learning with AI and deliver through LMSGEN or export content for another LMS.</p></article>
    </div>
  </div>
</section>`;

const SEO_STYLE = `<style id="lmsgen-seo-content-style">
  .lmsgen-seo-section{padding:9rem 2.4rem;background:#f6f5ef;color:#003f3a;font-family:inherit}.lmsgen-seo-inner{width:min(128rem,100%);margin:0 auto}.lmsgen-seo-inner-narrow{width:min(102rem,100%)}.lmsgen-seo-kicker{font-size:1.35rem;font-weight:700;letter-spacing:.14em;color:#177e78;margin-bottom:1.8rem}.lmsgen-seo-section h2{max-width:98rem;font-size:clamp(3.4rem,5vw,6.4rem);line-height:1.02;letter-spacing:-.035em;margin:0;color:#003f3a}.lmsgen-seo-lead{max-width:86rem;margin:2.4rem 0 0;font-size:2rem;line-height:1.55;color:#385c58}.lmsgen-pain-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1.6rem;margin-top:5rem}.lmsgen-pain-card{min-height:31rem;padding:2.8rem;border:1px solid rgba(0,63,58,.16);border-radius:2.4rem;background:#fff;display:flex;flex-direction:column}.lmsgen-pain-card>span{display:inline-flex;width:4.2rem;height:4.2rem;align-items:center;justify-content:center;border-radius:999px;background:#d9f4ef;color:#0b6259;font-weight:800;font-size:1.35rem}.lmsgen-pain-card h3,.lmsgen-audience-grid h3{font-size:2.5rem;line-height:1.12;margin:2.2rem 0 1.2rem;color:#003f3a}.lmsgen-pain-card p,.lmsgen-audience-grid p,.lmsgen-faq-item p{font-size:1.65rem;line-height:1.55;color:#496763}.lmsgen-pain-card strong{display:block;margin-top:auto;padding-top:2rem;font-size:1.5rem;line-height:1.5;color:#0b6259}.lmsgen-faq-section{background:#fff}.lmsgen-faq-list{margin-top:4.5rem;border-top:1px solid rgba(0,63,58,.16)}.lmsgen-faq-item{border-bottom:1px solid rgba(0,63,58,.16);padding:0}.lmsgen-faq-item summary{cursor:pointer;list-style:none;padding:2.4rem 4rem 2.4rem 0;font-size:2rem;font-weight:700;color:#003f3a;position:relative}.lmsgen-faq-item summary::-webkit-details-marker{display:none}.lmsgen-faq-item summary:after{content:'+';position:absolute;right:.4rem;top:2.2rem;font-size:2.6rem;color:#177e78}.lmsgen-faq-item[open] summary:after{content:'–'}.lmsgen-faq-item p{max-width:84rem;padding:0 0 2.5rem;margin:0}.lmsgen-audience-section{background:#e7f7f4}.lmsgen-audience-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1.6rem;margin-top:4rem}.lmsgen-audience-grid article{padding:2.8rem;border-radius:2.2rem;background:#fff;border:1px solid rgba(0,63,58,.14)}.lmsgen-audience-grid h3{margin-top:0}@media(max-width:991px){.lmsgen-pain-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.lmsgen-audience-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:640px){.lmsgen-seo-section{padding:6.5rem 1.8rem}.lmsgen-pain-grid,.lmsgen-audience-grid{grid-template-columns:1fr}.lmsgen-seo-section h2{font-size:3.8rem}.lmsgen-seo-lead{font-size:1.7rem}.lmsgen-pain-card{min-height:0}.lmsgen-faq-item summary{font-size:1.75rem}}
</style>`;

const PDF_COURSE_STYLE = `<style id="lmsgen-pdf-course-style">
  .lmsgen-pdf-course-section{position:relative;isolation:isolate;overflow:hidden;background:radial-gradient(circle at 15% 44%,rgba(101,212,202,.16),transparent 31%),radial-gradient(circle at 83% 18%,rgba(255,221,104,.08),transparent 25%),linear-gradient(135deg,#032f2c 0%,#064942 58%,#073b37 100%);color:#fff;font-family:"Open Sans",Arial,sans-serif!important}
  .lmsgen-pdf-course-section:before{content:'';position:absolute;z-index:-2;width:72rem;height:72rem;left:-25rem;top:50%;border:1px solid rgba(124,227,217,.12);border-radius:50%;transform:translateY(-50%);box-shadow:0 0 0 8rem rgba(124,227,217,.025),0 0 0 18rem rgba(124,227,217,.018)}
  .lmsgen-pdf-course-section:after{content:'';position:absolute;z-index:-1;inset:0;opacity:.18;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:6rem 6rem;mask-image:linear-gradient(90deg,#000,transparent 48%,transparent)}
  .lmsgen-pdf-course-section .lmsgen-seo-inner{position:relative;z-index:1}
  .lmsgen-pdf-course-section .lmsgen-seo-kicker{display:inline-flex;align-items:center;gap:.8rem;margin-bottom:2.2rem;padding:.72rem 1.1rem;border:1px solid rgba(124,227,217,.34);border-radius:999px;background:rgba(4,38,35,.48);color:#8bf0e6;font-size:1.05rem;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
  .lmsgen-pdf-course-section .lmsgen-seo-kicker:before{content:'';width:.7rem;height:.7rem;border-radius:50%;background:#70e0d5;box-shadow:0 0 0 .45rem rgba(112,224,213,.12)}
  .lmsgen-publica-layout{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(34rem,.88fr);gap:clamp(5rem,6vw,9rem);align-items:center}
  .lmsgen-publica-copy{min-width:0;padding:2rem 0 2rem 1rem}
  .lmsgen-pdf-course-section h2{max-width:58rem;color:#fff;font-family:"Montserrat",Arial,sans-serif!important;font-size:clamp(3.4rem,3.45vw,5.2rem)!important;font-weight:650!important;line-height:1.02!important;letter-spacing:-.045em!important;text-transform:none!important;text-wrap:balance}
  .lmsgen-pdf-course-header{display:block}
  .lmsgen-pdf-course-summary{margin-top:2.6rem}
  .lmsgen-pdf-course-summary p{max-width:54rem;margin:0 0 2.6rem;font-size:1.6rem;line-height:1.65;color:#c8dedb}
  .lmsgen-pdf-course-summary a{display:inline-flex;align-items:center;gap:1rem;padding:1.5rem 2.2rem;border:1px solid rgba(255,255,255,.28);border-radius:999px;background:#70d9cf;color:#003f3a;text-decoration:none;font-family:"Montserrat",Arial,sans-serif!important;font-size:1.45rem;font-weight:750;box-shadow:0 1.2rem 2.8rem rgba(0,25,23,.28);transition:transform .2s ease,box-shadow .2s ease,background .2s ease}.lmsgen-pdf-course-summary a:hover{transform:translateY(-.25rem);background:#89e8df;box-shadow:0 1.6rem 3.4rem rgba(0,25,23,.34)}
  .lmsgen-pdf-course-benefits{display:grid;grid-template-columns:1fr;gap:1.05rem;margin:3.2rem 0 0;padding:0;list-style:none}
  .lmsgen-pdf-course-benefits li{position:relative;min-height:0;padding:1.65rem 1.8rem 1.65rem 6.3rem;overflow:hidden;border:1px solid rgba(124,227,217,.22);border-radius:1.6rem;background:linear-gradient(110deg,rgba(255,255,255,.095),rgba(255,255,255,.035));box-shadow:inset 0 1px 0 rgba(255,255,255,.055);transition:transform .2s ease,border-color .2s ease,background .2s ease}.lmsgen-pdf-course-benefits li:hover{transform:translateX(.5rem);border-color:rgba(124,227,217,.5);background:linear-gradient(110deg,rgba(255,255,255,.13),rgba(255,255,255,.045))}.publica-benefit-index{position:absolute;left:1.6rem;top:50%;display:grid;width:3.4rem;height:3.4rem;place-items:center;border-radius:1rem;background:#79ddd3;color:#003f3a;font:800 1rem/1 "Montserrat",Arial,sans-serif;transform:translateY(-50%);box-shadow:0 .8rem 1.8rem rgba(0,20,18,.24)}
  .lmsgen-pdf-course-benefits strong{display:block;font-family:"Montserrat",Arial,sans-serif!important;font-size:1.6rem;font-weight:600;line-height:1.28;letter-spacing:-.015em;color:#fff}
  .lmsgen-pdf-course-benefits p{margin:.65rem 0 0;font-size:1.25rem;line-height:1.5;color:#bad2cf}
  .lmsgen-pdf-course-proof{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(30rem,.65fr);gap:4rem;align-items:center;margin-top:2rem;padding:2rem;border-radius:2.8rem;background:#f4fbfa;color:#003f3a}
  .lmsgen-pdf-proof-screen{min-height:43rem;display:grid;grid-template-columns:14rem 1fr;overflow:hidden;border-radius:1.8rem;background:#fff;box-shadow:0 2rem 5rem rgba(0,31,29,.18)}
  .lmsgen-pdf-proof-rail{padding:2.4rem 1.7rem;background:#062f2c;color:#fff}
  .lmsgen-pdf-proof-rail small{color:#7ce3d9;font-size:.9rem;font-weight:800;letter-spacing:.12em}
  .lmsgen-pdf-proof-rail strong{display:block;margin-top:1.2rem;font-family:"Montserrat",Arial,sans-serif!important;font-size:1.45rem;font-weight:600;line-height:1.25}
  .lmsgen-pdf-proof-progress{height:.7rem;margin:3rem 0 1rem;border-radius:99px;background:rgba(255,255,255,.13)}
  .lmsgen-pdf-proof-progress i{display:block;width:68%;height:100%;border-radius:inherit;background:#65d4ca}
  .lmsgen-pdf-proof-rail span{font-size:1rem;color:#b8d2cf}
  .lmsgen-pdf-proof-slide{display:grid;grid-template-rows:auto 1fr;padding:2rem;background:#eaf8f6}
  .lmsgen-pdf-proof-toolbar{display:flex;justify-content:space-between;gap:1rem;color:#4c6f6b;font-size:1.05rem}
  .lmsgen-pdf-proof-toolbar b{color:#087d73}
  .lmsgen-pdf-proof-page{align-self:center;min-height:29rem;padding:4rem;display:flex;flex-direction:column;justify-content:center;background:#fff8e8;box-shadow:0 1.5rem 4rem rgba(0,63,58,.12)}
  .lmsgen-pdf-proof-page small{font-size:1rem;font-weight:800;letter-spacing:.12em;color:#087d73}
  .lmsgen-pdf-proof-page strong{max-width:46rem;margin-top:1.4rem;font-family:"Montserrat",Arial,sans-serif!important;font-size:clamp(3.2rem,4vw,5.5rem);font-weight:600;line-height:.96;letter-spacing:-.03em}
  .lmsgen-pdf-proof-page p{margin:2rem 0 0;font-size:1.3rem;color:#496763}
  .lmsgen-pdf-proof-copy{padding:2rem 2rem 2rem 0}
  .lmsgen-pdf-proof-copy>span{font-size:1.1rem;font-weight:800;letter-spacing:.12em;color:#087d73}
  .lmsgen-pdf-proof-copy h3{margin:1.2rem 0 2.4rem;font-family:"Montserrat",Arial,sans-serif!important;font-size:3rem;font-weight:600;line-height:1.12;letter-spacing:-.025em;color:#003f3a}
  .lmsgen-pdf-proof-copy ul{display:grid;gap:1.15rem;margin:0;padding:0;list-style:none}
  .lmsgen-pdf-proof-copy li{position:relative;padding-left:2.6rem;font-size:1.4rem;line-height:1.45;color:#385c58}
  .lmsgen-pdf-proof-copy li:before{content:'✓';position:absolute;left:0;top:-.1rem;display:grid;width:1.8rem;height:1.8rem;place-items:center;border-radius:50%;background:#d2f3ef;color:#087d73;font-size:1rem;font-weight:900}
  .publica-demo-shell{position:relative;isolation:isolate;display:block!important;width:100%;max-width:none;margin:0!important;padding:0!important;border-radius:0!important;background:transparent!important;overflow:visible;box-sizing:border-box;transform:translateX(-7rem)}
  .publica-demo-topbar{position:absolute;z-index:12;left:5.8rem;right:5.8rem;top:1.2rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.75rem .9rem;border:1px solid rgba(139,240,230,.2);border-radius:999px;background:rgba(3,35,33,.68);box-shadow:0 1.2rem 3rem rgba(0,20,18,.22),inset 0 1px 0 rgba(255,255,255,.08);backdrop-filter:blur(1.2rem)}
  .publica-demo-topbar>div{display:flex;align-items:center;gap:.8rem}.publica-demo-topbar strong{font-family:"Montserrat",Arial,sans-serif!important;font-size:1.05rem;color:#fff}.publica-demo-topbar small{font-size:.78rem;color:#9dcac5}
  .publica-demo-mark{width:2.6rem;height:2.6rem;display:grid;place-items:center;border-radius:.8rem;background:#72dbd1;color:#003f3a;font-family:"Montserrat",Arial,sans-serif;font-size:1rem;font-weight:900;box-shadow:0 .6rem 1.4rem rgba(0,0,0,.18)}
  .publica-demo-live{display:inline-flex;align-items:center;gap:.65rem;padding:.65rem .9rem;border:1px solid rgba(139,240,230,.2);border-radius:999px;background:rgba(255,255,255,.08);font-size:.78rem;font-weight:750;color:#d2f5f1}.publica-demo-live i{width:.65rem;height:.65rem;border-radius:50%;background:#79e5da;box-shadow:0 0 0 .4rem rgba(121,229,218,.12)}
  .publica-reader-stage{position:relative;min-height:60rem;display:grid;grid-template-columns:4.5rem minmax(0,1fr) 4.5rem;grid-template-areas:"prev book next";align-items:center;gap:1rem;padding:5.5rem 0 1.5rem;border-radius:0;background:transparent;overflow:visible;perspective:180rem}
  .publica-reader-stage:before{content:'';position:absolute;z-index:-1;width:54rem;height:48rem;left:50%;top:54%;border-radius:50%;background:radial-gradient(circle,rgba(112,217,207,.22) 0%,rgba(112,217,207,.08) 42%,transparent 70%);filter:blur(.2rem);transform:translate(-50%,-50%)}
  .publica-reader-stage:after{content:'INTERACTIVE READER  ·  TURN THE PAGE';position:absolute;left:50%;bottom:.2rem;color:rgba(199,239,235,.68);font:750 .72rem/1 "Montserrat",Arial,sans-serif;letter-spacing:.14em;white-space:nowrap;transform:translateX(-50%)}
  .publica-book-viewport{grid-area:book;position:relative;z-index:2;display:flex;align-items:center;justify-content:center;width:min(100%,41.5rem);max-width:100%;aspect-ratio:.72;margin:auto;border:.1rem solid rgba(255,255,255,.22);box-shadow:0 3rem 6rem rgba(0,18,17,.46),-.9rem .9rem 0 rgba(112,217,207,.1);filter:none;transform:rotateY(-2deg) rotateZ(-.35deg);transform-origin:center left;transition:width .2s ease,height .2s ease,opacity .18s ease,transform .22s ease,box-shadow .22s ease}.publica-book-viewport:hover{transform:rotateY(0) rotateZ(0) translateY(-.5rem);box-shadow:0 3.6rem 7rem rgba(0,18,17,.52),-.9rem .9rem 0 rgba(112,217,207,.15)}
  .publica-demo-shell.is-changing-book .publica-book-viewport{opacity:0;transform:translateY(.8rem) scale(.96)}
  .publica-comic-book{width:100%;height:100%;opacity:1;transition:opacity .2s ease}
  .publica-comic-page{position:relative;width:100%;height:100%;min-width:0;overflow:hidden;background:#f8f1dd;color:#092f31;border:1px solid rgba(0,0,0,.12)}.publica-front-cover,.publica-back-cover-page{box-shadow:inset 0 0 2rem rgba(7,27,53,.18)}.publica-comic-book.is-fallback .publica-comic-page:not(:first-child){display:none}
  .publica-book-switch{position:absolute;z-index:9;top:7.2rem;right:.2rem;width:8.6rem;padding:0;border:0;background:transparent;color:#fff;text-align:left;cursor:pointer;transform:rotate(3deg);transition:transform .24s ease,filter .24s ease}.publica-book-switch:hover{transform:translateY(-.6rem) rotate(0) scale(1.04);filter:brightness(1.08)}.publica-book-switch:focus-visible{outline:.2rem solid #8af0e5;outline-offset:.5rem;border-radius:.8rem}.publica-book-switch small{display:block;margin:0 0 .55rem;padding:.35rem .5rem;border-radius:999px;background:rgba(3,35,33,.78);font:800 .64rem/1.2 "Montserrat",Arial,sans-serif;letter-spacing:.11em;color:#9be8e1;text-align:center}.publica-mini-cover{position:relative;display:flex;min-height:11.8rem;padding:1rem .75rem;box-sizing:border-box;align-items:flex-end;overflow:hidden;border:.12rem solid rgba(255,255,255,.72);border-radius:.55rem;box-shadow:0 1.6rem 3rem rgba(0,0,0,.46);background:#17324a}.publica-mini-cover:before{content:'';position:absolute;inset:0;opacity:.95}.publica-mini-cover i{position:absolute;z-index:1;width:3rem;height:3rem;right:.65rem;top:.8rem;border-radius:50%;background:#f7d76d;box-shadow:0 0 0 .8rem rgba(247,215,109,.12)}.publica-mini-cover b{position:relative;z-index:2;font:800 .78rem/.95 "Montserrat",Arial,sans-serif;letter-spacing:-.02em;text-transform:uppercase;color:#fff}.publica-book-switch[data-next-set="archive"] .publica-mini-cover:before{background:linear-gradient(155deg,transparent,rgba(5,7,28,.84)),linear-gradient(135deg,#684c9d,#16264a 65%,#07101e)}.publica-book-switch[data-next-set="signal"] .publica-mini-cover:before{background:linear-gradient(155deg,transparent,rgba(0,20,37,.88)),radial-gradient(circle at 70% 25%,#ef5d43 0 18%,transparent 19%),linear-gradient(145deg,#16a89a,#08647c 48%,#071b35)}.publica-book-switch[data-next-set="signal"] .publica-mini-cover i{background:#ef5d43;box-shadow:0 0 0 .8rem rgba(239,93,67,.16)}
  .publica-turn-control{position:relative;z-index:6;width:4.5rem;height:4.5rem;border:1px solid rgba(137,239,229,.34);border-radius:50%;background:rgba(2,34,32,.62);box-shadow:0 1.2rem 2.4rem rgba(0,18,17,.26),inset 0 1px 0 rgba(255,255,255,.08);backdrop-filter:blur(1rem);color:#8af0e5;display:inline-flex;align-items:center;justify-content:center;gap:.6rem;cursor:pointer;transition:transform .2s ease,background .2s ease,border-color .2s ease}.publica-turn-control span{font:400 2.7rem/1 Arial}.publica-turn-control b{display:none;font:750 1rem/1 "Montserrat",Arial,sans-serif}.publica-prev{grid-area:prev}.publica-next{grid-area:next}.publica-turn-control:hover:not(:disabled){transform:scale(1.09);background:#0b6b62;border-color:#8af0e5}.publica-turn-control:disabled{opacity:.2;cursor:default}
  .publica-cover,.publica-back-cover{height:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:flex-end;padding:8%;color:#fff;background:linear-gradient(155deg,rgba(1,18,30,.08),rgba(1,18,30,.88)),radial-gradient(circle at 72% 25%,#ffcf42 0 5%,#ef5d43 6% 18%,transparent 19%),linear-gradient(145deg,#16a89a,#08647c 48%,#071b35);position:relative;overflow:hidden}.publica-cover:before{content:'';position:absolute;width:65%;aspect-ratio:1;right:-15%;top:-10%;border:2rem solid rgba(255,255,255,.12);transform:rotate(24deg)}
  .publica-cover span,.publica-back-cover span{position:relative;font-size:clamp(.75rem,1vw,1.2rem);font-weight:900;letter-spacing:.14em;color:#ffdf68}.publica-cover h4,.publica-back-cover h4{position:relative;margin:1rem 0;font-family:"Montserrat",Arial,sans-serif!important;font-size:clamp(2.5rem,4.2vw,6rem);font-weight:800;line-height:.88;letter-spacing:-.045em;text-transform:uppercase}.publica-cover p{position:relative;max-width:38rem;margin:.8rem 0 2rem;font-size:clamp(.9rem,1.2vw,1.4rem);line-height:1.45;color:#d8f5f1}.publica-cover>b,.publica-back-cover>b{position:relative;align-self:flex-start;padding:.8rem 1.1rem;border:1px solid rgba(255,255,255,.45);font-size:.9rem;letter-spacing:.1em}
  .publica-novel-cover{position:relative;height:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;padding:9%;color:#fff;background:radial-gradient(circle at 72% 20%,#f7db87 0 7%,rgba(247,219,135,.18) 8% 17%,transparent 18%),linear-gradient(160deg,transparent 48%,rgba(3,7,24,.94)),linear-gradient(135deg,#76569e,#253560 52%,#070e1e)}.publica-novel-cover:before{content:'';position:absolute;left:-10%;right:-10%;bottom:13%;height:25%;background:linear-gradient(145deg,transparent 18%,#090d1d 19% 33%,transparent 34%),linear-gradient(35deg,transparent 58%,#11172d 59% 70%,transparent 71%);opacity:.95}.publica-novel-cover:after{content:'✦  ·  ✧  ·  ✦';position:absolute;left:8%;top:8%;font-size:1.1rem;letter-spacing:.7rem;color:rgba(255,255,255,.68)}.publica-novel-cover span,.publica-novel-cover h4,.publica-novel-cover p,.publica-novel-cover>b{position:relative;z-index:2}.publica-novel-cover span{font-size:clamp(.68rem,.9vw,1rem);font-weight:800;letter-spacing:.14em;color:#f7db87}.publica-novel-cover h4{max-width:90%;margin:1rem 0;font:700 clamp(2.3rem,3.4vw,4.8rem)/.92 Georgia,"Times New Roman",serif;letter-spacing:-.04em}.publica-novel-cover p{max-width:85%;margin:.6rem 0 1.8rem;font:400 clamp(.85rem,1.05vw,1.25rem)/1.5 Georgia,"Times New Roman",serif;color:#e8e4f2}.publica-novel-cover>b{align-self:flex-start;padding:.75rem 1rem;border:1px solid rgba(247,219,135,.58);font-size:.78rem;letter-spacing:.12em;color:#f7db87}.publica-novel-back{justify-content:center;background:radial-gradient(circle at 50% 25%,rgba(247,219,135,.2),transparent 28%),linear-gradient(145deg,#19294d,#5c3f79)}
  .publica-novel-page{position:relative;height:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;overflow:hidden;padding:11%;background:#f4eedf;color:#1d2740}.publica-novel-page span{position:relative;z-index:2;font:800 clamp(.65rem,.8vw,.9rem)/1.2 "Montserrat",Arial,sans-serif;letter-spacing:.16em;color:#75538d}.publica-novel-page h4{position:relative;z-index:2;max-width:92%;margin:1.2rem 0;font:700 clamp(2rem,3vw,4rem)/.98 Georgia,"Times New Roman",serif;letter-spacing:-.03em}.publica-novel-page p{position:relative;z-index:2;max-width:85%;margin:0;font:400 clamp(.82rem,1vw,1.15rem)/1.6 Georgia,"Times New Roman",serif;color:#4c5161}.publica-novel-page>b{position:absolute;z-index:2;right:8%;bottom:6%;font:700 1rem/1 Georgia,serif;color:#8b7795}.publica-novel-chapter:after{content:'';position:absolute;width:52%;aspect-ratio:1;right:-12%;top:-8%;border-radius:50%;background:radial-gradient(circle,#f7db87 0 18%,#7e669b 19% 32%,transparent 33%),repeating-radial-gradient(circle,rgba(117,83,141,.14) 0 .25rem,transparent .3rem 1.1rem)}.publica-novel-city{justify-content:flex-end;color:#fff;background:linear-gradient(180deg,rgba(7,15,34,.06),rgba(7,15,34,.9)),radial-gradient(circle at 70% 18%,#f7db87 0 7%,transparent 8%),linear-gradient(145deg,#895c8f,#24365c 55%,#071326)}.publica-novel-city:after{content:'';position:absolute;left:-5%;right:-5%;bottom:0;height:48%;background:repeating-linear-gradient(90deg,#0b142a 0 9%,transparent 9% 12%);clip-path:polygon(0 32%,8% 38%,8% 16%,18% 29%,18% 8%,29% 35%,39% 17%,49% 39%,58% 6%,67% 34%,78% 18%,88% 38%,100% 22%,100% 100%,0 100%)}.publica-novel-city span,.publica-novel-city p{color:#e8e4f2}.publica-novel-letter{background:linear-gradient(135deg,rgba(117,83,141,.08),transparent),#f7f0df}.publica-novel-letter:before{content:'';position:absolute;inset:8%;border:.1rem solid rgba(117,83,141,.28);box-shadow:inset 0 0 0 .5rem rgba(255,255,255,.42)}.publica-novel-letter blockquote{position:relative;z-index:2;margin:1.8rem 0;font:italic 700 clamp(2.1rem,3vw,4.2rem)/1.05 Georgia,serif;color:#433252}.publica-novel-library{color:#fff;background:linear-gradient(90deg,rgba(5,10,25,.88),rgba(5,10,25,.18)),repeating-linear-gradient(90deg,#392849 0 10%,#a67c52 10% 12%,#59406a 12% 21%,#d2a76a 21% 23%)}.publica-novel-library:after{content:'';position:absolute;inset:9% 7%;border:.15rem solid rgba(247,219,135,.7);box-shadow:0 0 3rem rgba(247,219,135,.28)}.publica-novel-library span,.publica-novel-library p{color:#f3e9d4}
  .publica-panel-grid{height:100%;box-sizing:border-box;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr auto;gap:1.1%;padding:2%;background:#fff8df}.publica-panel{position:relative;overflow:hidden;border:.3rem solid #0b2529;padding:7%;display:flex;flex-direction:column;justify-content:flex-end}.publica-panel:after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(125deg,transparent 0 1rem,rgba(255,255,255,.04) 1rem 1.2rem);pointer-events:none}.publica-panel em{font-size:clamp(.65rem,.8vw,.95rem);font-style:normal;font-weight:900;letter-spacing:.12em;color:#72e3d7}.publica-panel strong{margin-top:.5rem;font-family:"Montserrat",Arial,sans-serif!important;font-size:clamp(1.5rem,2.25vw,3rem);line-height:.95;color:#fff;text-shadow:0 .2rem 0 rgba(0,0,0,.2)}.publica-night{grid-row:span 2;background:linear-gradient(160deg,transparent 45%,rgba(2,10,27,.9)),radial-gradient(circle at 70% 22%,#ffd75e 0 4%,transparent 5%),linear-gradient(145deg,#174d69,#08182d)}.publica-hero{background:radial-gradient(circle at 55% 72%,#ffbd3f 0 9%,transparent 10%),linear-gradient(145deg,#db4b3c,#6d1433)}.publica-hero>b{font:900 clamp(5rem,8vw,10rem)/.7 "Montserrat",Arial;color:#ffdd55;transform:rotate(-9deg)}
  .publica-bubble{position:absolute;z-index:2;top:8%;left:8%;max-width:75%;padding:.8rem 1rem;border:.22rem solid #102b30;border-radius:50%;background:#fff;color:#102b30;font-size:clamp(.72rem,1vw,1.15rem);font-weight:800;line-height:1.2}.publica-caption{grid-column:1/-1;padding:1rem 1.2rem;background:#0c292e;color:#fff;font-size:clamp(.75rem,1vw,1.1rem);font-weight:700;line-height:1.35}.publica-caption-teal{background:#087d73}
  .publica-action-grid{grid-template-rows:1fr 1fr auto}.publica-signal{grid-column:1/-1;background:linear-gradient(25deg,rgba(0,0,0,.7),transparent),repeating-radial-gradient(circle at 78% 45%,#ffdb49 0 .4rem,#e64c35 .5rem 1.2rem,#172d43 1.3rem 2rem)}.publica-run{background:linear-gradient(135deg,#0f766e,#062f43)}.publica-run>b{font:900 clamp(3rem,6vw,8rem)/.8 "Montserrat",Arial;color:#fff;transform:skew(-10deg)}.publica-sfx{display:grid;place-items:center;padding:1rem;background:#e83f36;color:#fff;font:900 clamp(1.1rem,2vw,2.4rem)/1 "Montserrat",Arial;letter-spacing:.08em}.publica-sfx-yellow{background:#ffd34e;color:#102b30}.publica-lab{grid-row:span 2;background:linear-gradient(160deg,transparent,rgba(0,0,0,.85)),linear-gradient(135deg,#427d88,#102d43)}.publica-face{background:radial-gradient(circle at 50% 70%,#ffc252 0 16%,#db503e 17% 32%,#202040 33%)}.publica-portal{grid-column:1/-1;background:radial-gradient(circle at 70% 48%,#fff 0 3%,#6ff0e1 4% 14%,#146a72 15% 30%,#081b35 31%)}.publica-impact{background:linear-gradient(145deg,#f24b3e,#ffcb48)}.publica-impact>b{font:900 clamp(2.5rem,5vw,6rem)/.8 "Montserrat",Arial;color:#fff;transform:rotate(-12deg);text-shadow:.4rem .4rem 0 #122b36}.publica-back-cover{justify-content:center;background:linear-gradient(145deg,#062f2c,#0b6e65)}.publica-back-cover h4{font-size:clamp(2rem,3vw,4rem);line-height:1}.publica-back-cover ul{margin:1.5rem 0 2rem;padding-left:1.8rem;font-size:clamp(.85rem,1.1vw,1.25rem);line-height:1.7;color:#c9f4ef}
  .publica-reader-footer{display:none}.publica-reader-footer>strong{text-align:right;color:#087d73}.publica-reader-dots{display:flex;gap:.6rem}.publica-reader-dots i{width:.7rem;height:.7rem;border-radius:50%;background:#bad7d3}.publica-reader-dots i.is-active{width:2rem;border-radius:99px;background:#18aa9d}
  @media(max-width:1450px) and (min-width:1101px){.publica-demo-shell{transform:translateX(-2rem)}.publica-demo-topbar{left:5rem;right:5rem}}
  @media(max-width:1100px){.lmsgen-publica-layout{grid-template-columns:1fr;gap:4rem}.lmsgen-publica-copy{order:1;padding:0}.publica-demo-shell{order:2;max-width:86rem;margin:0 auto!important;transform:none}.publica-demo-topbar{left:6rem;right:6rem}.lmsgen-pdf-course-section h2{max-width:82rem}.lmsgen-pdf-course-summary{max-width:76rem}.lmsgen-pdf-course-benefits{grid-template-columns:repeat(3,minmax(0,1fr))}.lmsgen-pdf-course-benefits li{padding:5.8rem 1.6rem 1.6rem}.publica-benefit-index{left:1.5rem;top:1.4rem;transform:none}.lmsgen-pdf-course-proof{grid-template-columns:1fr}.lmsgen-pdf-proof-copy{padding:1rem 1rem 2rem}}
  @media(max-width:760px){.lmsgen-pdf-course-benefits{grid-template-columns:1fr}.lmsgen-pdf-course-benefits li{padding:1.6rem 1.6rem 1.6rem 6.2rem}.publica-benefit-index{left:1.5rem;top:50%;transform:translateY(-50%)}.publica-demo-topbar{display:none}.publica-reader-stage{min-height:0;grid-template-columns:4rem minmax(0,1fr) 4rem;gap:.7rem;padding:1.5rem}.publica-reader-stage:before{width:42rem;height:38rem}.publica-reader-stage:after{display:none}.publica-book-viewport,.publica-book-viewport:hover{transform:none}.publica-turn-control{width:3.8rem;height:3.8rem}.publica-turn-control span{font-size:2.5rem}}
  @media(max-width:760px){.lmsgen-publica-layout{gap:2.8rem}.lmsgen-pdf-course-summary{margin-top:2rem}.lmsgen-pdf-course-benefits{margin-top:2.5rem}.lmsgen-pdf-course-benefits li{padding:1.6rem 1.6rem 1.6rem 6.2rem}.lmsgen-pdf-course-proof{padding:1rem;gap:1.5rem}.lmsgen-pdf-proof-screen{min-height:29rem;grid-template-columns:7.5rem 1fr}.lmsgen-pdf-proof-rail{padding:1.3rem .8rem}.lmsgen-pdf-proof-rail strong{font-size:.9rem}.lmsgen-pdf-proof-rail span{font-size:.75rem}.lmsgen-pdf-proof-slide{padding:.8rem}.lmsgen-pdf-proof-toolbar{font-size:.75rem}.lmsgen-pdf-proof-page{min-height:20rem;padding:1.8rem}.lmsgen-pdf-proof-page strong{font-size:2.7rem}.lmsgen-pdf-proof-page p{font-size:.9rem}.lmsgen-pdf-proof-copy{padding:1.5rem}.lmsgen-pdf-proof-copy h3{font-size:2.5rem}.publica-demo-shell{width:100%;max-width:100%;padding:0!important;overflow:hidden}.publica-demo-topbar{padding:.2rem .2rem 1rem;gap:.7rem}.publica-demo-topbar strong{font-size:1.1rem}.publica-demo-mark{width:3rem;height:3rem;border-radius:.8rem}.publica-demo-live{padding:.6rem .75rem;font-size:.75rem}.publica-reader-stage{width:100%;max-width:100%;grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-areas:"book book" "prev next";gap:1rem;padding:0;overflow:hidden}.publica-reader-stage:before{width:31rem;height:35rem;background:radial-gradient(circle,rgba(243,224,184,.18),transparent 70%)}.publica-book-viewport{width:min(calc(100% - 2.4rem),38rem)!important;max-width:calc(100% - 2.4rem);height:auto!important;aspect-ratio:.72;overflow:hidden;isolation:isolate;border:.1rem solid rgba(80,60,35,.22);background:#f5eedf;box-shadow:0 1.5rem 3rem rgba(0,25,22,.3),-.45rem .45rem 0 #d9c9aa;filter:none}.publica-comic-book.is-mobile-book{display:block;width:100%!important;height:100%!important;overflow:hidden}.publica-comic-book.is-mobile-book .publica-comic-page{display:block!important;width:100%!important;height:100%!important;min-width:0!important;overflow:hidden}.publica-comic-book.is-mobile-entering .publica-comic-page{animation:publica-mobile-page-in .22s ease both}.publica-book-switch{display:none}.publica-novel-cover,.publica-novel-back,.publica-novel-page,.publica-novel-city,.publica-novel-letter,.publica-novel-library{justify-content:flex-start;padding:13% 11%;background:linear-gradient(90deg,rgba(114,85,45,.08),transparent 8%,transparent 92%,rgba(114,85,45,.08)),linear-gradient(180deg,#fffdf7,#f1e7d2);color:#30281f;box-shadow:inset 0 0 2.4rem rgba(112,84,45,.1)}.publica-novel-cover:before,.publica-novel-cover:after,.publica-novel-page:before,.publica-novel-page:after{display:none}.publica-novel-cover span,.publica-novel-page span,.publica-novel-city span,.publica-novel-library span{color:#806a4e;font:700 1rem/1.4 Georgia,"Times New Roman",serif;letter-spacing:.14em}.publica-novel-cover h4,.publica-novel-page h4,.publica-novel-letter blockquote{max-width:100%;margin:2.2rem 0 1.6rem;color:#30281f;font:600 clamp(2.7rem,9vw,3.6rem)/1.08 Georgia,"Times New Roman",serif;letter-spacing:-.025em;text-transform:none}.publica-novel-cover p,.publica-novel-page p,.publica-novel-city p,.publica-novel-library p{max-width:100%;margin:0;color:#514638;font:400 clamp(1.35rem,4.2vw,1.6rem)/1.75 Georgia,"Times New Roman",serif}.publica-novel-cover>b{margin-top:2.4rem;padding:.8rem 0;border:0;border-top:1px solid rgba(80,60,35,.25);color:#806a4e;font:700 1rem/1.4 Georgia,"Times New Roman",serif;letter-spacing:.12em}.publica-novel-page>b{right:10%;bottom:7%;color:#806a4e;font-family:Georgia,"Times New Roman",serif}.publica-turn-control{position:static;width:100%;height:4rem;border-radius:.9rem;border-color:rgba(246,234,211,.42);background:rgba(4,72,66,.9);color:#fff}.publica-turn-control span{font-size:1.8rem}.publica-turn-control b{display:inline;font-size:.95rem}.publica-turn-control:hover:not(:disabled){transform:none}.publica-reader-footer{grid-template-columns:1fr auto;padding:1rem .3rem .2rem}.publica-reader-footer>strong{display:none}.publica-reader-dots{justify-self:end}.publica-panel-grid{gap:.8%;padding:1.5%}.publica-panel{border-width:.22rem}}
  @keyframes publica-mobile-page-in{from{opacity:.35;transform:translateX(1rem)}to{opacity:1;transform:none}}
</style>`;

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function attr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function replaceTitle(html, title) {
  const tag = `<title>${title}</title>`;
  return /<title>[\s\S]*?<\/title>/i.test(html)
    ? html.replace(/<title>[\s\S]*?<\/title>/i, tag)
    : html.replace(/<\/head>/i, `  ${tag}\n</head>`);
}

function upsertMeta(html, attribute, key, content) {
  if (!content) return html;
  const pattern = new RegExp(`<meta\\s+[^>]*${attribute}=["']${escapeRegExp(key)}["'][^>]*>`, 'i');
  const tag = `<meta ${attribute}="${key}" content="${attr(content)}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace(/<\/head>/i, `  ${tag}\n</head>`);
}

function upsertCanonical(html, route) {
  const url = `${SITE_URL}${route === '/' ? '/' : route}`;
  const canonical = `<link rel="canonical" href="${url}" />`;
  const pattern = /<link\s+[^>]*rel=["']canonical["'][^>]*>/i;
  html = pattern.test(html) ? html.replace(pattern, canonical) : html.replace(/<\/head>/i, `  ${canonical}\n</head>`);
  html = html.replace(/<link\s+[^>]*rel=["']alternate["'][^>]*hreflang=["'](?:x-default|en)["'][^>]*>/gi, '');
  return html.replace(/<\/head>/i, `  <link rel="alternate" hreflang="en" href="${url}" />\n  <link rel="alternate" hreflang="x-default" href="${url}" />\n</head>`);
}

function removeJsonLd(html) {
  return html.replace(/<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '');
}

function addJsonLd(html, data) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return html.replace(/<\/head>/i, `  <script type="application/ld+json">${json}</script>\n</head>`);
}

function productSchema() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: BRAND,
        url: SITE_URL,
        logo: `${SITE_URL}/branding/lmsgen-logo-dark.png`,
        description: 'AI-powered learning management platform for course authoring, SCORM delivery, learner campaigns, live quizzes and learning analytics.',
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: BRAND,
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE_URL}/#software`,
        name: BRAND,
        url: SITE_URL,
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'Learning Management System',
        operatingSystem: 'Web',
        provider: { '@id': `${SITE_URL}/#organization` },
        audience: [
          { '@type': 'Audience', audienceType: 'Learning and Development teams' },
          { '@type': 'Audience', audienceType: 'Compliance training teams' },
          { '@type': 'Audience', audienceType: 'Security awareness teams' },
        ],
        featureList: [
          'AI-assisted course authoring',
          'Trackable presentation courses from landscape PDF files',
          'Per-slide viewing time and visit tracking for presentation courses',
          'SCORM 1.2 and SCORM 2004 package delivery',
          'Learner campaigns and reminders',
          'Direct learner tracking',
          'Campaign analytics',
          'Question-level SCORM interaction evidence when provided by the course',
          'Live Quizmoto quiz sessions',
          'Learner roster and role-based administration',
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQ_ITEMS.map(([question, answer]) => ({
          '@type': 'Question',
          name: question,
          acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
      },
    ],
  };
}

function webpageSchema(page) {
  return {
    '@context': 'https://schema.org',
    '@type': page.type === 'article' ? 'Article' : 'WebPage',
    name: page.title,
    url: `${SITE_URL}${page.route}`,
    description: page.description || undefined,
    isPartOf: { '@type': 'WebSite', name: BRAND, url: SITE_URL },
    publisher: { '@type': 'Organization', name: BRAND, url: SITE_URL },
  };
}

function setPageHead(html, page) {
  html = html
    .replace(/https:\/\/quizmoto-frontend\.onrender\.com/gi, SITE_URL)
    .replace(/\bAtelora\b/g, BRAND)
    .replace(/\bATELORA\b/g, BRAND);

  html = replaceTitle(html, page.title);
  if (page.description) html = upsertMeta(html, 'name', 'description', page.description);
  html = upsertMeta(html, 'name', 'robots', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
  html = upsertMeta(html, 'property', 'og:title', page.title);
  if (page.description) html = upsertMeta(html, 'property', 'og:description', page.description);
  html = upsertMeta(html, 'property', 'og:url', `${SITE_URL}${page.route}`);
  html = upsertMeta(html, 'property', 'og:site_name', BRAND);
  html = upsertMeta(html, 'name', 'twitter:title', page.title);
  if (page.description) html = upsertMeta(html, 'name', 'twitter:description', page.description);
  html = upsertMeta(html, 'name', 'twitter:card', 'summary_large_image');
  html = upsertCanonical(html, page.route);

  if (!html.includes('id="lmsgen-seo-content-style"')) {
    html = html.replace(/<\/head>/i, `  ${SEO_STYLE}\n</head>`);
  }
  if (page.type === 'home' && !html.includes('id="lmsgen-pdf-course-style"')) {
    html = html.replace(/<\/head>/i, `  ${PDF_COURSE_STYLE}\n</head>`);
  }

  html = removeJsonLd(html);
  html = addJsonLd(html, page.type === 'home' ? productSchema() : webpageSchema(page));
  return html;
}

function insertAfterSection(html, sectionClass, content) {
  const start = html.indexOf(`<section class="${sectionClass}`);
  if (start === -1) return html;
  const end = html.indexOf('</section>', start);
  if (end === -1) return html;
  const insertAt = end + '</section>'.length;
  return `${html.slice(0, insertAt)}\n${content}\n${html.slice(insertAt)}`;
}

function prepareHome(html) {
  html = html.replace(
    /<div class="caption text-color-lemon font-weight-normal">[\s\S]*?<\/div>/,
    `<div class="caption text-color-lemon font-weight-normal">${HOME_HERO_EYEBROW}</div>`,
  );
  html = html.replace(
    /<h1 class="hp-hero-h1">[\s\S]*?<\/h1>/,
    `<h1 class="hp-hero-h1">${HOME_HERO_HEADING}</h1>`,
  );
  html = html.replace(
    /<p class="hp-hero-p">[\s\S]*?<\/p>/,
    `<p class="hp-hero-p">${HOME_HERO_DESCRIPTION}</p>`,
  );
  html = html.split('Explore Atelora').join('Explore LMSGEN');
  html = html.split('EXPLORE ATELORA').join('EXPLORE LMSGEN');
  html = html.split('WHY ATELORA').join('WHY LMSGEN');
  html = html.split('Built for Real Learning Challenges').join('Built for the work behind every training programme');
  html = html.split('Faster Course Creation').join('Clear the course creation backlog');
  html = html.split('Turn a brief into structured, SCORM-ready learning content with AI-assisted authoring.').join('Turn policies, documents and ideas into structured learning with AI-assisted authoring, then publish or package it for SCORM delivery.');
  html = html.split('Scalable Learning').join('Run learning campaigns without spreadsheet admin');
  html = html.split('Manage learners, courses and access across teams from one central platform.').join('Create campaigns, manage learners, send reminders and keep campaign progress separate from direct course-link tracking.');
  html = html.split('Explore the Atelora Platform').join('Explore the LMSGEN platform');

  if (!html.includes('id="lmsgen-pain-title"')) {
    html = insertAfterSection(html, 'hp-hero-s', PAIN_SECTION);
  }
  if (!html.includes('id="lmsgen-pdf-course-title"')) {
    html = insertAfterSection(html, 'hp-platform-s', PDF_COURSE_SECTION);
  }
  if (!html.includes('id="lmsgen-faq-title"')) {
    html = html.replace(/<\/main>/i, `${FAQ_SECTION}\n</main>`);
  }
  return html;
}

function prepareSolutions(html) {
  html = html.replace(
    /<h1><span class="text-color-lemon">[\s\S]*?<\/span><\/h1>/,
    '<h1><span class="text-color-lemon">One LMS for course creation, SCORM delivery, campaigns and learning analytics</span></h1>',
  );
  html = html.replace(
    /<div class="nsl-hero-title-w">([\s\S]*?)<p class="paragraph-l">[\s\S]*?<\/p>/,
    (match, before) => `<div class="nsl-hero-title-w">${before}<p class="paragraph-l">Built for L&D, compliance and security awareness teams that want fewer disconnected tools, less learner chasing and clearer evidence of training outcomes.</p>`,
  );
  html = html.split('Cut Production Time').join('Clear the course creation backlog');
  html = html.split('Boost Learner Engagement').join('Make mandatory learning less passive');
  if (!html.includes('id="lmsgen-audience-title"')) {
    html = insertAfterSection(html, 'sl-hero-s', SOLUTIONS_AUDIENCE_SECTION);
  }
  return html;
}

async function preparePage(page) {
  const filePath = path.join(landingRoot, page.file);
  let html = await fs.readFile(filePath, 'utf8');
  html = setPageHead(html, page);
  if (page.type === 'home') html = prepareHome(html);
  if (page.type === 'solutions') html = prepareSolutions(html);
  await fs.writeFile(filePath, html, 'utf8');
  console.log(`SEO prepared: ${page.route}`);
}

async function writeRobots() {
  const robots = `User-agent: *\nAllow: /\nDisallow: /login\nDisallow: /scorm/\nDisallow: /campaign/\nDisallow: /learn/\nDisallow: /player/\nDisallow: /host/\nDisallow: /join\nDisallow: /landing/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
  await fs.writeFile(path.join(distRoot, 'robots.txt'), robots, 'utf8');
}

async function writeSitemap() {
  const routes = PAGES.map((page) => page.route);
  const urls = routes.map((route) => `  <url><loc>${SITE_URL}${route === '/' ? '/' : route}</loc><changefreq>${route.startsWith('/blog/') ? 'monthly' : route === '/blog' ? 'weekly' : 'monthly'}</changefreq><priority>${route === '/' ? '1.0' : route === '/solutions' ? '0.9' : route.startsWith('/blog/') ? '0.7' : '0.8'}</priority></url>`).join('\n');
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  await fs.writeFile(path.join(distRoot, 'sitemap.xml'), sitemap, 'utf8');
}

async function writeLlms() {
  const text = `# LMSGEN\n\nLMSGEN is an AI-powered learning management platform for L&D, compliance and security awareness teams.\n\n## Core capabilities\n- AI-assisted course authoring from briefs and source material\n- Trackable presentation courses made by exporting slides as a landscape PDF and uploading the PDF\n- Exact PDF-page slide preservation, editable AI-generated quizzes and per-slide viewing-time analytics\n- SCORM 1.2 and SCORM 2004 package upload and delivery\n- Direct course-link learner tracking\n- Learner campaigns with add/remove learner management and reminders\n- Campaign analytics kept separate from direct learner tracking\n- Completion, score, time, attempts and compatible SCORM interaction evidence\n- Live Quizmoto sessions for real-time quiz engagement\n- Learner roster, reports and role-based administration\n\n## Important pages\n- Home: ${SITE_URL}/\n- Solutions: ${SITE_URL}/solutions\n- About: ${SITE_URL}/about\n- Blog: ${SITE_URL}/blog\n- Contact: ${SITE_URL}/contact\n\n## Product notes\nLMSGEN stores the SCORM data a course sends. Question-level reporting depends on the interaction data exposed by the SCORM package. Quizmoto is a separate live-quiz feature inside the LMSGEN workspace.\n`;
  await fs.writeFile(path.join(distRoot, 'llms.txt'), text, 'utf8');
}

try {
  await Promise.all(PAGES.map(preparePage));
  await Promise.all([writeRobots(), writeSitemap(), writeLlms()]);
  console.log('LMSGEN SEO marketing build pass complete.');
} catch (error) {
  console.error('LMSGEN SEO build pass failed:', error);
  process.exitCode = 1;
}
