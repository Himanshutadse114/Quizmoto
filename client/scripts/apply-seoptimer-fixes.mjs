import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(scriptDir, '..');
const landingRoot = path.join(clientRoot, 'dist', 'landing');
const SITE_URL = 'https://www.lmsgen.in';
const PREVIEW_IMAGE = `${SITE_URL}/atelora-marketing/hero-dashboard.png`;
const BUILD_DATE = new Date().toISOString();
const BUILD_DAY = BUILD_DATE.slice(0, 10);
const BUILD_MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date());

const BLOG_SLUGS = [
  'why-scorm-courses-go-unfinished',
  'live-quizzes-vs-static-assessments',
  'scorm-1-2-vs-scorm-2004',
  'ai-assisted-authoring-course-timeline',
  'signs-security-awareness-training-needs-refresh',
  'slide-deck-to-scorm-migration-guide',
  'quizmoto-as-a-full-learning-platform',
  'designing-knowledge-checks-that-dont-feel-like-a-test',
];

const PAGES = [
  {
    file: 'index.html',
    route: '/',
    title: 'AI LMS for SCORM Course Creation & Learner Tracking | LMSGEN',
    description: 'Create SCORM training with AI, launch learner campaigns, run live quizzes and track completion, scores, time and learning activity in one LMS for L&D teams.',
    type: 'website',
  },
  {
    file: 'solutions/index.html',
    route: '/solutions',
    title: 'AI Course Authoring, SCORM LMS & Learner Tracking | LMSGEN',
    description: 'Replace disconnected learning tools with LMSGEN: AI course authoring, SCORM 1.2/2004 delivery, learner campaigns, live quizzes, tracking and reporting.',
    type: 'website',
  },
  {
    file: 'about/index.html',
    route: '/about',
    title: 'About LMSGEN | AI-Powered Learning Management Platform',
    description: 'LMSGEN helps L&D, compliance and security awareness teams create training faster, deliver SCORM learning and measure learner progress from one platform.',
    type: 'website',
  },
  {
    file: 'blog/index.html',
    route: '/blog',
    title: 'LMSGEN Blog | SCORM, AI Authoring & Learning Analytics',
    description: 'Practical guides for L&D and security awareness teams on SCORM, AI course creation, learner engagement, training delivery and learning analytics.',
    type: 'website',
  },
  {
    file: 'contact/index.html',
    route: '/contact',
    title: 'Contact LMSGEN | AI LMS for SCORM & Corporate Training',
    description: 'Talk to LMSGEN about AI course authoring, SCORM delivery, learner campaigns, live quizzes and training analytics for your organisation.',
    type: 'website',
  },
  ...BLOG_SLUGS.map((slug) => ({
    file: `blog/${slug}.html`,
    route: `/blog/${slug}`,
    title: null,
    description: null,
    type: 'article',
  })),
];

const SOCIAL_ENV = [
  process.env.VITE_LINKEDIN_URL,
  process.env.VITE_YOUTUBE_URL,
  process.env.VITE_X_URL,
  process.env.VITE_FACEBOOK_URL,
  process.env.VITE_INSTAGRAM_URL,
].filter((value) => /^https:\/\//i.test(String(value || '').trim()));

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

function upsertMeta(html, attribute, key, content) {
  if (!content) return html;
  const pattern = new RegExp(`<meta\\s+[^>]*${attribute}=["']${escapeRegExp(key)}["'][^>]*>`, 'i');
  const tag = `<meta ${attribute}="${key}" content="${attr(content)}" />`;
  return pattern.test(html)
    ? html.replace(pattern, tag)
    : html.replace(/<\/head>/i, `  ${tag}\n</head>`);
}

function upsertTitle(html, title) {
  if (!title) return html;
  return /<title>[\s\S]*?<\/title>/i.test(html)
    ? html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
    : html.replace(/<\/head>/i, `  <title>${title}</title>\n</head>`);
}

function addHeadBlock(html, id, block) {
  const pattern = new RegExp(`<script[^>]*id=["']${escapeRegExp(id)}["'][^>]*>[\\s\\S]*?<\\/script>`, 'i');
  if (pattern.test(html)) return html.replace(pattern, block);
  return html.replace(/<\/head>/i, `  ${block}\n</head>`);
}

function buildEntitySchema(page, title, description) {
  const graph = [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'LMSGEN',
      url: SITE_URL,
      logo: `${SITE_URL}/branding/lmsgen-logo-dark.png`,
      description: 'AI-powered learning management platform for course authoring, SCORM delivery, learner campaigns, live quizzes and learning analytics.',
      areaServed: 'Worldwide',
      contactPoint: [
        {
          '@type': 'ContactPoint',
          contactType: 'sales and product enquiries',
          url: `${SITE_URL}/contact`,
          availableLanguage: ['English'],
        },
      ],
      ...(SOCIAL_ENV.length ? { sameAs: SOCIAL_ENV } : {}),
    },
    {
      '@type': page.type === 'article' ? 'Article' : 'WebPage',
      '@id': `${SITE_URL}${page.route}#page`,
      url: `${SITE_URL}${page.route}`,
      name: title,
      headline: page.type === 'article' ? title : undefined,
      description: description || undefined,
      inLanguage: 'en',
      dateModified: BUILD_DATE,
      publisher: { '@id': `${SITE_URL}/#organization` },
      about: { '@id': `${SITE_URL}/#software` },
    },
  ];

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

function analyticsMarkup() {
  const gtm = String(process.env.VITE_GTM_CONTAINER_ID || process.env.GTM_CONTAINER_ID || '').trim();
  const ga = String(process.env.VITE_GA_MEASUREMENT_ID || process.env.GA_MEASUREMENT_ID || '').trim();

  if (/^GTM-[A-Z0-9]+$/i.test(gtm)) {
    return {
      head: `<script id="lmsgen-analytics">(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');</script>`,
      body: `<noscript id="lmsgen-analytics-noscript"><iframe src="https://www.googletagmanager.com/ns.html?id=${gtm}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`,
    };
  }

  if (/^G-[A-Z0-9]+$/i.test(ga)) {
    return {
      head: `<script id="lmsgen-analytics" async src="https://www.googletagmanager.com/gtag/js?id=${ga}"></script><script id="lmsgen-analytics-config">window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga}',{anonymize_ip:true});</script>`,
      body: '',
    };
  }

  return { head: '', body: '' };
}

function injectAnalytics(html) {
  const markup = analyticsMarkup();
  if (!markup.head) return html;

  if (!html.includes('id="lmsgen-analytics"')) {
    html = html.replace(/<\/head>/i, `  ${markup.head}\n</head>`);
  }
  if (markup.body && !html.includes('id="lmsgen-analytics-noscript"')) {
    html = html.replace(/<body([^>]*)>/i, (match) => `${match}\n  ${markup.body}`);
  }
  return html;
}

const TRUST_SECTION = `
<section class="lmsgen-audit-trust" aria-labelledby="lmsgen-trust-title">
  <div class="lmsgen-audit-trust-inner">
    <div class="lmsgen-audit-trust-copy">
      <div class="lmsgen-audit-kicker">TRANSPARENT BY DESIGN</div>
      <h2 id="lmsgen-trust-title">Know what LMSGEN tracks - and what the course must provide.</h2>
      <p>LMSGEN supports SCORM learning workflows, campaign delivery and learner reporting. We report the learning data a course actually sends rather than inventing missing assessment evidence.</p>
      <div class="lmsgen-audit-updated">Product and website information <time datetime="${BUILD_DAY}">updated ${BUILD_MONTH}</time>.</div>
    </div>
    <div class="lmsgen-audit-trust-links">
      <a href="/blog/scorm-1-2-vs-scorm-2004"><strong>SCORM standards</strong><span>Understand SCORM 1.2 and SCORM 2004 tracking.</span></a>
      <a href="/solutions"><strong>Platform capabilities</strong><span>Review authoring, campaigns, tracking and Quizmoto.</span></a>
      <a href="/about"><strong>About LMSGEN</strong><span>Learn who the platform is built for and why.</span></a>
      <a href="/contact"><strong>Contact LMSGEN</strong><span>Talk to the team about your learning workflow.</span></a>
    </div>
  </div>
</section>`;

const TRUST_STYLE = `<style id="lmsgen-audit-trust-style">
.lmsgen-audit-trust{padding:8rem 2.4rem;background:#edf7f5;color:#073f3a}.lmsgen-audit-trust-inner{width:min(128rem,100%);margin:0 auto;display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);gap:5rem;align-items:start}.lmsgen-audit-kicker{margin-bottom:1.6rem;color:#14796f;font-size:1.25rem;font-weight:800;letter-spacing:.14em}.lmsgen-audit-trust h2{margin:0;max-width:60rem;color:#073f3a;font-size:clamp(3rem,4vw,5.2rem);line-height:1.05;letter-spacing:-.03em}.lmsgen-audit-trust-copy>p{max-width:62rem;margin:2rem 0 0;color:#476762;font-size:1.7rem;line-height:1.6}.lmsgen-audit-updated{margin-top:2.2rem;color:#0b6259;font-size:1.4rem;font-weight:700}.lmsgen-audit-trust-links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.3rem}.lmsgen-audit-trust-links a{display:flex;min-height:15rem;flex-direction:column;justify-content:space-between;padding:2.2rem;border:1px solid rgba(7,63,58,.14);border-radius:1.8rem;background:#fff;color:#073f3a;text-decoration:none}.lmsgen-audit-trust-links strong{font-size:1.8rem;line-height:1.25}.lmsgen-audit-trust-links span{margin-top:1.2rem;color:#58736f;font-size:1.4rem;line-height:1.5}.lmsgen-audit-trust-links a:hover{border-color:#17a99b;transform:translateY(-2px)}@media(max-width:900px){.lmsgen-audit-trust-inner{grid-template-columns:1fr}.lmsgen-audit-trust-links{grid-template-columns:1fr 1fr}}@media(max-width:600px){.lmsgen-audit-trust{padding:6rem 1.8rem}.lmsgen-audit-trust-links{grid-template-columns:1fr}.lmsgen-audit-trust-links a{min-height:0}}
</style>`;

function injectHomeTrust(html) {
  if (!html.includes('id="lmsgen-audit-trust-style"')) {
    html = html.replace(/<\/head>/i, `  ${TRUST_STYLE}\n</head>`);
  }
  if (!html.includes('class="lmsgen-audit-trust"')) {
    const faqIndex = html.indexOf('<section class="lmsgen-seo-section lmsgen-faq-section"');
    if (faqIndex !== -1) {
      html = `${html.slice(0, faqIndex)}${TRUST_SECTION}\n${html.slice(faqIndex)}`;
    } else {
      html = html.replace(/<\/main>/i, `${TRUST_SECTION}\n</main>`);
    }
  }
  return html;
}

function addSocialLinksFromEnvironment(html) {
  if (!SOCIAL_ENV.length || html.includes('class="lmsgen-social-trust-links"')) return html;
  const labels = SOCIAL_ENV.map((url) => {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('linkedin')) return ['LinkedIn', url];
    if (host.includes('youtube') || host.includes('youtu.be')) return ['YouTube', url];
    if (host.includes('instagram')) return ['Instagram', url];
    if (host.includes('facebook')) return ['Facebook', url];
    if (host === 'x.com' || host.includes('twitter')) return ['X', url];
    return ['Social profile', url];
  });
  const block = `<nav class="lmsgen-social-trust-links" aria-label="LMSGEN social profiles">${labels.map(([label, url]) => `<a href="${attr(url)}" rel="me noopener" target="_blank">${label}</a>`).join('')}</nav>`;
  return html.replace(/<\/body>/i, `${block}\n</body>`);
}

function normalizePage(html, page) {
  const existingTitle = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]?.trim();
  const title = page.title || existingTitle || 'LMSGEN';
  const existingDescription = (html.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) || [])[1];
  const description = page.description || existingDescription || '';

  html = upsertTitle(html, title);
  if (description) html = upsertMeta(html, 'name', 'description', description);
  html = upsertMeta(html, 'name', 'robots', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
  html = upsertMeta(html, 'property', 'og:type', page.type === 'article' ? 'article' : 'website');
  html = upsertMeta(html, 'property', 'og:title', title);
  if (description) html = upsertMeta(html, 'property', 'og:description', description);
  html = upsertMeta(html, 'property', 'og:url', `${SITE_URL}${page.route}`);
  html = upsertMeta(html, 'property', 'og:site_name', 'LMSGEN');
  html = upsertMeta(html, 'property', 'og:locale', 'en_US');
  html = upsertMeta(html, 'property', 'og:image', PREVIEW_IMAGE);
  html = upsertMeta(html, 'property', 'og:image:secure_url', PREVIEW_IMAGE);
  html = upsertMeta(html, 'property', 'og:image:alt', 'LMSGEN AI learning management platform dashboard');
  html = upsertMeta(html, 'name', 'twitter:card', 'summary_large_image');
  html = upsertMeta(html, 'name', 'twitter:title', title);
  if (description) html = upsertMeta(html, 'name', 'twitter:description', description);
  html = upsertMeta(html, 'name', 'twitter:image', PREVIEW_IMAGE);
  html = upsertMeta(html, 'name', 'twitter:image:alt', 'LMSGEN AI learning management platform dashboard');
  html = upsertMeta(html, 'name', 'application-name', 'LMSGEN');
  if (page.type === 'article') html = upsertMeta(html, 'property', 'article:modified_time', BUILD_DATE);

  const entitySchema = `<script id="lmsgen-seoptimer-entity-schema" type="application/ld+json">${buildEntitySchema(page, title, description)}</script>`;
  html = addHeadBlock(html, 'lmsgen-seoptimer-entity-schema', entitySchema);
  html = injectAnalytics(html);
  html = addSocialLinksFromEnvironment(html);
  if (page.route === '/') html = injectHomeTrust(html);
  return html;
}

for (const page of PAGES) {
  const filePath = path.join(landingRoot, page.file);
  let html = await fs.readFile(filePath, 'utf8');
  html = normalizePage(html, page);
  await fs.writeFile(filePath, html, 'utf8');
  console.log(`Applied SEOptimer fixes: ${page.route}`);
}

console.log('SEOptimer code-level fixes complete.');
