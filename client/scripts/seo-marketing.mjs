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
    <div class="lmsgen-pdf-course-header">
      <div>
        <div class="lmsgen-seo-kicker">INTRODUCING LMSGEN PUBLICA</div>
        <h2 id="lmsgen-pdf-course-title">Publish beautifully. Build an audience. Know what keeps them reading.</h2>
      </div>
      <div class="lmsgen-pdf-course-summary">
        <p>Give presentations, comics, guides and visual stories a premium digital home—with a shareable library and meaningful audience insight built in.</p>
        <a class="lmsgen-conversion-cta" href="/contact">Let's discuss LMSGEN Publica <span aria-hidden="true">→</span></a>
      </div>
    </div>
    <ul class="lmsgen-pdf-course-benefits" aria-label="Benefits of LMSGEN Publica">
      <li><strong>Build a library your audience remembers.</strong><p>Writers, comic creators and publishers can bring every issue, chapter or collection together under one professional link.</p></li>
      <li><strong>Let the work keep its visual impact.</strong><p>Present every page as designed in an elegant, mobile-ready reading experience that feels made for the content.</p></li>
      <li><strong>See what a download can never tell you.</strong><p>Understand reader reach, page-by-page attention, active reading time and completion without guessing.</p></li>
    </ul>
    <div class="lmsgen-pdf-course-proof publica-demo-shell" data-publica-demo>
      <div class="publica-demo-topbar">
        <div><span class="publica-demo-mark">P</span><strong>LMSGEN Publica</strong><small>Interactive comic preview</small></div>
        <span class="publica-demo-live"><i></i> Page-level tracking</span>
      </div>
      <div class="publica-reader-stage">
        <button type="button" class="publica-turn-control publica-prev" aria-label="Previous comic page"><span aria-hidden="true">‹</span><b>Previous</b></button>
        <div class="publica-book-viewport">
          <div class="publica-comic-book" data-publica-book aria-live="polite"></div>
        </div>
        <button type="button" class="publica-turn-control publica-next" aria-label="Next comic page"><b>Next</b><span aria-hidden="true">›</span></button>
      </div>
      <div class="publica-reader-footer">
        <span data-publica-status>Pages 1–2 of 6</span>
        <div class="publica-reader-dots" aria-hidden="true"><i></i><i></i><i></i></div>
        <strong>Tap or click to turn the page</strong>
      </div>
      <template data-publica-page><div class="publica-cover"><span>ORBITAL INK · ISSUE 01</span><h4>The Signal<br>in Sector 9</h4><p>A short comic about one message that changed an entire city.</p><b>READ NOW →</b></div></template>
      <template data-publica-page><div class="publica-panel-grid"><div class="publica-panel publica-night"><em>09:17 PM</em><strong>The city went silent.</strong></div><div class="publica-panel publica-hero"><span class="publica-bubble">Did anyone else hear that?</span><b>!</b></div><div class="publica-caption">Every great story deserves a reading experience that pulls the audience forward.</div></div></template>
      <template data-publica-page><div class="publica-panel-grid publica-action-grid"><div class="publica-panel publica-signal"><em>SECTOR 9</em><strong>THE SIGNAL<br>RETURNED.</strong></div><div class="publica-panel publica-run"><span class="publica-bubble">Move—now!</span><b>RUN</b></div><div class="publica-sfx">KRRR—SHHH!</div></div></template>
      <template data-publica-page><div class="publica-panel-grid"><div class="publica-panel publica-lab"><em>ARCHIVE 404</em><strong>It was never a warning.</strong></div><div class="publica-panel publica-face"><span class="publica-bubble">It was an invitation.</span></div><div class="publica-caption publica-caption-teal">Publica preserves every designed page while making the whole story effortless to explore.</div></div></template>
      <template data-publica-page><div class="publica-panel-grid publica-action-grid"><div class="publica-panel publica-portal"><em>FINAL TRANSMISSION</em><strong>OPEN<br>THE GATE</strong></div><div class="publica-panel publica-impact"><b>WHAM!</b><span class="publica-bubble">We write the ending.</span></div><div class="publica-sfx publica-sfx-yellow">TO BE CONTINUED…</div></div></template>
      <template data-publica-page><div class="publica-back-cover"><span>YOUR AUDIENCE IS WAITING</span><h4>Publish your next world with LMSGEN Publica.</h4><ul><li>One branded library</li><li>Beautiful page-turn reading</li><li>Real audience insight</li></ul><b>LMSGEN PUBLICA</b></div></template>
    </div>
  </div>
</section>
<script src="https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.min.js"></script>
<script id="lmsgen-publica-demo-script">(function(){document.querySelectorAll('[data-publica-demo]').forEach(function(demo){if(demo.dataset.ready)return;demo.dataset.ready='1';var pages=Array.from(demo.querySelectorAll('template[data-publica-page]')).map(function(item){return item.innerHTML});var book=demo.querySelector('[data-publica-book]');var viewport=demo.querySelector('.publica-book-viewport');var status=demo.querySelector('[data-publica-status]');var prev=demo.querySelector('.publica-prev');var next=demo.querySelector('.publica-next');var dots=Array.from(demo.querySelectorAll('.publica-reader-dots i'));var pageFlip=null;var current=0;var portrait=window.matchMedia('(max-width:640px)').matches;var resizeTimer=null;function dimensions(){var isPortrait=window.matchMedia('(max-width:640px)').matches;var available=Math.max(220,viewport.parentElement.clientWidth-(isPortrait?24:150));var width=isPortrait?Math.min(430,available):Math.min(390,Math.floor(available/2));return{width:Math.max(220,width),height:Math.max(306,Math.round(width/.72)),portrait:isPortrait}}function update(index){current=Math.max(0,Math.min(pages.length-1,Number(index)||0));status.textContent='Page '+(current+1)+' of '+pages.length;prev.disabled=current===0;next.disabled=current>=pages.length-1;dots.forEach(function(dot,dotIndex){dot.classList.toggle('is-active',dotIndex===Math.min(dots.length-1,Math.floor(current/2)))})}function build(){var dims=dimensions();portrait=dims.portrait;if(pageFlip){try{pageFlip.destroy()}catch(_){}}book.classList.remove('is-ready','is-fallback');book.innerHTML=pages.map(function(content,index){return '<article class="publica-comic-page'+(index===0?' publica-front-cover':'')+(index===pages.length-1?' publica-back-cover-page':'')+'">'+content+'</article>'}).join('');viewport.style.width=(dims.width*(dims.portrait?1:2))+'px';viewport.style.height=dims.height+'px';if(!window.St||!window.St.PageFlip){book.classList.add('is-fallback');update(0);return}pageFlip=new window.St.PageFlip(book,{width:dims.width,height:dims.height,size:'fixed',minWidth:dims.width,maxWidth:dims.width,minHeight:dims.height,maxHeight:dims.height,drawShadow:true,flippingTime:window.matchMedia('(prefers-reduced-motion:reduce)').matches?0:900,usePortrait:dims.portrait,startPage:current,autoSize:false,maxShadowOpacity:.5,showCover:true,mobileScrollSupport:true,swipeDistance:24,clickEventForward:true,useMouseEvents:true,showPageCorners:true,disableFlipByClick:false});pageFlip.on('init',function(event){book.classList.add('is-ready');update(event.data&&event.data.page)});pageFlip.on('flip',function(event){update(event.data)});pageFlip.loadFromHTML(Array.from(book.querySelectorAll('.publica-comic-page')))}prev.addEventListener('click',function(){if(pageFlip)pageFlip.flipPrev('top')});next.addEventListener('click',function(){if(pageFlip)pageFlip.flipNext('top')});demo.addEventListener('keydown',function(event){if(!pageFlip)return;if(event.key==='ArrowLeft')pageFlip.flipPrev('top');if(event.key==='ArrowRight')pageFlip.flipNext('top')});window.addEventListener('resize',function(){clearTimeout(resizeTimer);resizeTimer=setTimeout(function(){var nextPortrait=window.matchMedia('(max-width:640px)').matches;if(nextPortrait!==portrait)build()},180)});build()})})();</script>`;

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
  .lmsgen-pdf-course-section{background:#073f3b;color:#fff;font-family:"Open Sans",Arial,sans-serif!important}
  .lmsgen-pdf-course-section .lmsgen-seo-kicker{color:#7ce3d9}
  .lmsgen-pdf-course-section h2{max-width:78rem;color:#fff;font-family:"Montserrat",Arial,sans-serif!important;font-size:clamp(3.6rem,3vw,4.8rem)!important;font-weight:600!important;line-height:1.1!important;letter-spacing:-.035em!important;text-transform:none!important;text-wrap:balance}
  .lmsgen-pdf-course-header{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(30rem,.8fr);gap:6rem;align-items:end}
  .lmsgen-pdf-course-summary p{margin:0 0 2.4rem;font-size:1.85rem;line-height:1.6;color:#c8dedb}
  .lmsgen-pdf-course-summary a{display:inline-flex;align-items:center;gap:.8rem;padding:1.45rem 2rem;border-radius:999px;background:#65d4ca;color:#003f3a;text-decoration:none;font-family:"Montserrat",Arial,sans-serif!important;font-size:1.5rem;font-weight:700}
  .lmsgen-pdf-course-benefits{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1.2rem;margin:5rem 0 0;padding:0;list-style:none}
  .lmsgen-pdf-course-benefits li{min-height:19rem;padding:2.8rem;border:1px solid rgba(124,227,217,.24);border-radius:2rem;background:rgba(255,255,255,.055)}
  .lmsgen-pdf-course-benefits strong{display:block;font-family:"Montserrat",Arial,sans-serif!important;font-size:2.05rem;font-weight:600;line-height:1.24;letter-spacing:-.02em;color:#fff}
  .lmsgen-pdf-course-benefits p{margin:1.3rem 0 0;font-size:1.45rem;line-height:1.6;color:#bad2cf}
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
  .publica-demo-shell{display:block!important;width:min(100%,1120px);max-width:1120px;margin:3rem auto 0!important;padding:1.35rem!important;border-radius:2rem!important;background:#eaf8f6!important;overflow:hidden;box-sizing:border-box}
  .publica-demo-topbar{min-height:4.5rem;display:flex;align-items:center;justify-content:space-between;gap:1.5rem;padding:0 .6rem 1.1rem;color:#003f3a}
  .publica-demo-topbar>div{display:flex;align-items:center;gap:.9rem}.publica-demo-topbar strong{font-family:"Montserrat",Arial,sans-serif!important;font-size:1.3rem}.publica-demo-topbar small{font-size:.95rem;color:#52726e}
  .publica-demo-mark{width:3rem;height:3rem;display:grid;place-items:center;border-radius:.85rem;background:#0a5d56;color:#8af0e5;font-family:"Montserrat",Arial,sans-serif;font-size:1.25rem;font-weight:800}
  .publica-demo-live{display:inline-flex;align-items:center;gap:.7rem;padding:.8rem 1.1rem;border:1px solid rgba(0,63,58,.12);border-radius:999px;background:#fff;font-size:1.05rem;font-weight:700;color:#426560}.publica-demo-live i{width:.7rem;height:.7rem;border-radius:50%;background:#1bb7aa;box-shadow:0 0 0 .4rem rgba(27,183,170,.12)}
  .publica-reader-stage{position:relative;min-height:0;display:grid;grid-template-columns:4.5rem minmax(0,1fr) 4.5rem;grid-template-areas:"prev book next";align-items:center;gap:1rem;padding:1.7rem;border-radius:1.7rem;background:radial-gradient(circle at 50% 40%,#174e55 0,#082f33 58%,#041d21 100%);overflow:hidden;perspective:180rem}
  .publica-reader-stage:before{content:'';position:absolute;inset:0;background:linear-gradient(115deg,rgba(101,212,202,.08),transparent 36%,rgba(255,210,77,.07));pointer-events:none}
  .publica-book-viewport{grid-area:book;position:relative;z-index:1;display:flex;align-items:center;justify-content:center;max-width:100%;margin:auto;filter:drop-shadow(0 2.8rem 2.5rem rgba(0,0,0,.42));transition:width .2s ease,height .2s ease}
  .publica-comic-book{width:100%;height:100%;opacity:0;transition:opacity .2s ease}.publica-comic-book.is-ready,.publica-comic-book.is-fallback{opacity:1}
  .publica-comic-page{position:relative;width:100%;height:100%;min-width:0;overflow:hidden;background:#f8f1dd;color:#092f31;border:1px solid rgba(0,0,0,.12)}.publica-front-cover,.publica-back-cover-page{box-shadow:inset 0 0 2rem rgba(7,27,53,.18)}.publica-comic-book.is-fallback .publica-comic-page:not(:first-child){display:none}
  .publica-turn-control{position:relative;z-index:6;width:4.2rem;height:4.2rem;border:1px solid rgba(137,239,229,.35);border-radius:50%;background:rgba(4,29,33,.78);color:#8af0e5;display:inline-flex;align-items:center;justify-content:center;gap:.6rem;cursor:pointer;transition:transform .2s ease,background .2s ease,border-color .2s ease}.publica-turn-control span{font:400 2.8rem/1 Arial}.publica-turn-control b{display:none;font:750 1rem/1 "Montserrat",Arial,sans-serif}.publica-prev{grid-area:prev}.publica-next{grid-area:next}.publica-turn-control:hover:not(:disabled){transform:scale(1.08);background:#0b635b;border-color:#8af0e5}.publica-turn-control:disabled{opacity:.22;cursor:default}
  .publica-cover,.publica-back-cover{height:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:flex-end;padding:8%;color:#fff;background:linear-gradient(155deg,rgba(1,18,30,.08),rgba(1,18,30,.88)),radial-gradient(circle at 72% 25%,#ffcf42 0 5%,#ef5d43 6% 18%,transparent 19%),linear-gradient(145deg,#16a89a,#08647c 48%,#071b35);position:relative;overflow:hidden}.publica-cover:before{content:'';position:absolute;width:65%;aspect-ratio:1;right:-15%;top:-10%;border:2rem solid rgba(255,255,255,.12);transform:rotate(24deg)}
  .publica-cover span,.publica-back-cover span{position:relative;font-size:clamp(.75rem,1vw,1.2rem);font-weight:900;letter-spacing:.14em;color:#ffdf68}.publica-cover h4,.publica-back-cover h4{position:relative;margin:1rem 0;font-family:"Montserrat",Arial,sans-serif!important;font-size:clamp(2.5rem,4.2vw,6rem);font-weight:800;line-height:.88;letter-spacing:-.045em;text-transform:uppercase}.publica-cover p{position:relative;max-width:38rem;margin:.8rem 0 2rem;font-size:clamp(.9rem,1.2vw,1.4rem);line-height:1.45;color:#d8f5f1}.publica-cover>b,.publica-back-cover>b{position:relative;align-self:flex-start;padding:.8rem 1.1rem;border:1px solid rgba(255,255,255,.45);font-size:.9rem;letter-spacing:.1em}
  .publica-panel-grid{height:100%;box-sizing:border-box;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr auto;gap:1.1%;padding:2%;background:#fff8df}.publica-panel{position:relative;overflow:hidden;border:.3rem solid #0b2529;padding:7%;display:flex;flex-direction:column;justify-content:flex-end}.publica-panel:after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(125deg,transparent 0 1rem,rgba(255,255,255,.04) 1rem 1.2rem);pointer-events:none}.publica-panel em{font-size:clamp(.65rem,.8vw,.95rem);font-style:normal;font-weight:900;letter-spacing:.12em;color:#72e3d7}.publica-panel strong{margin-top:.5rem;font-family:"Montserrat",Arial,sans-serif!important;font-size:clamp(1.5rem,2.25vw,3rem);line-height:.95;color:#fff;text-shadow:0 .2rem 0 rgba(0,0,0,.2)}.publica-night{grid-row:span 2;background:linear-gradient(160deg,transparent 45%,rgba(2,10,27,.9)),radial-gradient(circle at 70% 22%,#ffd75e 0 4%,transparent 5%),linear-gradient(145deg,#174d69,#08182d)}.publica-hero{background:radial-gradient(circle at 55% 72%,#ffbd3f 0 9%,transparent 10%),linear-gradient(145deg,#db4b3c,#6d1433)}.publica-hero>b{font:900 clamp(5rem,8vw,10rem)/.7 "Montserrat",Arial;color:#ffdd55;transform:rotate(-9deg)}
  .publica-bubble{position:absolute;z-index:2;top:8%;left:8%;max-width:75%;padding:.8rem 1rem;border:.22rem solid #102b30;border-radius:50%;background:#fff;color:#102b30;font-size:clamp(.72rem,1vw,1.15rem);font-weight:800;line-height:1.2}.publica-caption{grid-column:1/-1;padding:1rem 1.2rem;background:#0c292e;color:#fff;font-size:clamp(.75rem,1vw,1.1rem);font-weight:700;line-height:1.35}.publica-caption-teal{background:#087d73}
  .publica-action-grid{grid-template-rows:1fr 1fr auto}.publica-signal{grid-column:1/-1;background:linear-gradient(25deg,rgba(0,0,0,.7),transparent),repeating-radial-gradient(circle at 78% 45%,#ffdb49 0 .4rem,#e64c35 .5rem 1.2rem,#172d43 1.3rem 2rem)}.publica-run{background:linear-gradient(135deg,#0f766e,#062f43)}.publica-run>b{font:900 clamp(3rem,6vw,8rem)/.8 "Montserrat",Arial;color:#fff;transform:skew(-10deg)}.publica-sfx{display:grid;place-items:center;padding:1rem;background:#e83f36;color:#fff;font:900 clamp(1.1rem,2vw,2.4rem)/1 "Montserrat",Arial;letter-spacing:.08em}.publica-sfx-yellow{background:#ffd34e;color:#102b30}.publica-lab{grid-row:span 2;background:linear-gradient(160deg,transparent,rgba(0,0,0,.85)),linear-gradient(135deg,#427d88,#102d43)}.publica-face{background:radial-gradient(circle at 50% 70%,#ffc252 0 16%,#db503e 17% 32%,#202040 33%)}.publica-portal{grid-column:1/-1;background:radial-gradient(circle at 70% 48%,#fff 0 3%,#6ff0e1 4% 14%,#146a72 15% 30%,#081b35 31%)}.publica-impact{background:linear-gradient(145deg,#f24b3e,#ffcb48)}.publica-impact>b{font:900 clamp(2.5rem,5vw,6rem)/.8 "Montserrat",Arial;color:#fff;transform:rotate(-12deg);text-shadow:.4rem .4rem 0 #122b36}.publica-back-cover{justify-content:center;background:linear-gradient(145deg,#062f2c,#0b6e65)}.publica-back-cover h4{font-size:clamp(2rem,3vw,4rem);line-height:1}.publica-back-cover ul{margin:1.5rem 0 2rem;padding-left:1.8rem;font-size:clamp(.85rem,1.1vw,1.25rem);line-height:1.7;color:#c9f4ef}
  .publica-reader-footer{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:1rem;padding:1.1rem .6rem .1rem;color:#426560;font-size:.95rem}.publica-reader-footer>strong{text-align:right;color:#087d73}.publica-reader-dots{display:flex;gap:.6rem}.publica-reader-dots i{width:.7rem;height:.7rem;border-radius:50%;background:#bad7d3}.publica-reader-dots i.is-active{width:2rem;border-radius:99px;background:#18aa9d}
  @media(max-width:991px){.lmsgen-pdf-course-header,.lmsgen-pdf-course-proof{grid-template-columns:1fr}.lmsgen-pdf-course-benefits{grid-template-columns:1fr}.lmsgen-pdf-course-benefits li{min-height:0}.lmsgen-pdf-proof-copy{padding:1rem 1rem 2rem}}
  @media(max-width:760px){.publica-reader-stage{grid-template-columns:4rem minmax(0,1fr) 4rem;gap:.7rem;padding:1.5rem}.publica-turn-control{width:3.8rem;height:3.8rem}.publica-turn-control span{font-size:2.5rem}.publica-demo-topbar small{display:none}}
  @media(max-width:640px){.lmsgen-pdf-course-header{gap:2.5rem}.lmsgen-pdf-course-benefits{margin-top:3.5rem}.lmsgen-pdf-course-benefits li{padding:2.2rem}.lmsgen-pdf-course-proof{padding:1rem;gap:1.5rem}.lmsgen-pdf-proof-screen{min-height:29rem;grid-template-columns:7.5rem 1fr}.lmsgen-pdf-proof-rail{padding:1.3rem .8rem}.lmsgen-pdf-proof-rail strong{font-size:.9rem}.lmsgen-pdf-proof-rail span{font-size:.75rem}.lmsgen-pdf-proof-slide{padding:.8rem}.lmsgen-pdf-proof-toolbar{font-size:.75rem}.lmsgen-pdf-proof-page{min-height:20rem;padding:1.8rem}.lmsgen-pdf-proof-page strong{font-size:2.7rem}.lmsgen-pdf-proof-page p{font-size:.9rem}.lmsgen-pdf-proof-copy{padding:1.5rem}.lmsgen-pdf-proof-copy h3{font-size:2.5rem}.publica-demo-shell{padding:1rem!important}.publica-demo-topbar{padding:.2rem .2rem 1rem;gap:.7rem}.publica-demo-topbar strong{font-size:1.1rem}.publica-demo-mark{width:3rem;height:3rem;border-radius:.8rem}.publica-demo-live{padding:.6rem .75rem;font-size:.75rem}.publica-reader-stage{grid-template-columns:1fr 1fr;grid-template-areas:"book book" "prev next";gap:1rem;padding:1.2rem}.publica-book-viewport{max-width:100%;filter:drop-shadow(0 1.5rem 1.6rem rgba(0,0,0,.38))}.publica-turn-control{position:static;width:100%;height:3.4rem;border-radius:.9rem;background:rgba(11,99,91,.85)}.publica-turn-control span{font-size:1.8rem}.publica-turn-control b{display:inline;font-size:.9rem}.publica-turn-control:hover:not(:disabled){transform:none}.publica-reader-footer{grid-template-columns:1fr auto;padding:1rem .3rem .2rem}.publica-reader-footer>strong{display:none}.publica-reader-dots{justify-self:end}.publica-panel-grid{gap:.8%;padding:1.5%}.publica-panel{border-width:.22rem}}
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
    html = insertAfterSection(html, 'lmsgen-seo-section lmsgen-pain-section', PDF_COURSE_SECTION);
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
