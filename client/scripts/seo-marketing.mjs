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
    description: 'Create SCORM-ready training with AI, launch learner campaigns, run live quizzes and track completion, scores and learning activity in one LMS built for L&D teams.',
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
const HOME_HERO_DESCRIPTION = 'Turn policies, documents and ideas into structured learning, publish or upload SCORM, launch learner campaigns, run live Quizmoto sessions and measure learning from one connected workspace.';

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

const FAQ_ITEMS = [
  ['What is LMSGEN?', 'LMSGEN is an AI-powered learning management platform for creating, delivering and tracking workplace learning. It combines AI-assisted course authoring, SCORM delivery, learner campaigns, live Quizmoto sessions and reporting in one workspace.'],
  ['Who is LMSGEN built for?', 'LMSGEN is designed for L&D teams, compliance and training managers, security awareness teams and organisations that need to create custom learning quickly and track learner outcomes without stitching together multiple tools.'],
  ['Does LMSGEN support SCORM 1.2 and SCORM 2004?', 'Yes. LMSGEN can upload and deliver SCORM 1.2 and SCORM 2004 packages. Externally authored Articulate courses can be uploaded as SCORM ZIP packages, while LMSGEN-generated courses can also be delivered and tracked inside the platform.'],
  ['Can LMSGEN track learner answers and scores?', 'LMSGEN tracks the SCORM data a course sends. Depending on the package, this can include completion, score, learning time, attempts, learner response, correct response, result and compatible question-level interaction data.'],
  ['How do learner campaigns work in LMSGEN?', 'Admins can create a campaign, assign published courses and learners, start or stop the campaign, add or remove learners while it is running and send reminder emails. Campaign analytics are kept separate from direct course-link tracking.'],
  ['Is Quizmoto part of the SCORM course player?', 'Quizmoto is a separate live-quiz feature inside the LMSGEN workspace. Hosts run a real-time session, participants join with a code and the group plays together live.'],
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
  const text = `# LMSGEN\n\nLMSGEN is an AI-powered learning management platform for L&D, compliance and security awareness teams.\n\n## Core capabilities\n- AI-assisted course authoring from briefs and source material\n- SCORM 1.2 and SCORM 2004 package upload and delivery\n- Direct course-link learner tracking\n- Learner campaigns with add/remove learner management and reminders\n- Campaign analytics kept separate from direct learner tracking\n- Completion, score, time, attempts and compatible SCORM interaction evidence\n- Live Quizmoto sessions for real-time quiz engagement\n- Learner roster, reports and role-based administration\n\n## Important pages\n- Home: ${SITE_URL}/\n- Solutions: ${SITE_URL}/solutions\n- About: ${SITE_URL}/about\n- Blog: ${SITE_URL}/blog\n- Contact: ${SITE_URL}/contact\n\n## Product notes\nLMSGEN stores the SCORM data a course sends. Question-level reporting depends on the interaction data exposed by the SCORM package. Quizmoto is a separate live-quiz feature inside the LMSGEN workspace.\n`;
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
