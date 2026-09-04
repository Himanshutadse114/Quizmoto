import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.resolve(scriptDir, '..', 'dist');
const landingRoot = path.join(distRoot, 'landing');

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

const pages = [
  { landing: 'index.html', canonical: 'index.html', type: 'home', homeCss: true, advantageCss: true },
  { landing: 'solutions/index.html', canonical: 'solutions/index.html', type: 'solutions', advantageCss: true },
  { landing: 'about/index.html', canonical: 'about/index.html', type: 'about' },
  { landing: 'blog/index.html', canonical: 'blog/index.html', type: 'blog' },
  { landing: 'contact/index.html', canonical: 'contact/index.html', type: 'contact' },
  ...BLOG_SLUGS.map((slug) => ({
    landing: `blog/${slug}.html`,
    canonical: `blog/${slug}/index.html`,
    type: 'article',
  })),
];

const failures = [];

function check(ok, message) {
  if (!ok) failures.push(message);
}

async function read(filePath) {
  return fs.readFile(filePath, 'utf8');
}

for (const page of pages) {
  const physicalPath = path.join(landingRoot, page.landing);
  const canonicalPath = path.join(distRoot, page.canonical);
  const physical = await read(physicalPath);
  const canonical = await read(canonicalPath);
  const label = page.landing;

  for (const [kind, html] of [['physical', physical], ['canonical', canonical]]) {
    check(html.includes(`lmsgen-page-${page.type}`), `${label} ${kind} copy is missing lmsgen-page-${page.type}.`);
    check(html.includes('lmsgen-unified-ui.css'), `${label} ${kind} copy is missing the unified UI stylesheet.`);
    check(html.includes('lmsgen-nav.js'), `${label} ${kind} copy is missing the stable nav script.`);
    check(!html.includes('/landing/js/nav-menu.js'), `${label} ${kind} copy still loads legacy nav-menu.js.`);
    check(!html.includes('id="lmsgen-anti-fouc"'), `${label} ${kind} copy still contains the global anti-FOUC style.`);
    check(html.includes('/branding/lmsgen-logo-light.png'), `${label} ${kind} copy does not use the shared light-background LMSGEN logo.`);
  }

  if (page.homeCss) {
    check(physical.includes('atelora-home-refresh.css'), `${label} should keep the homepage refresh stylesheet.`);
  } else {
    check(!physical.includes('atelora-home-refresh.css'), `${label} incorrectly loads homepage refresh CSS.`);
  }

  if (page.advantageCss) {
    check(physical.includes('lmsgen-advantage-assets.css'), `${label} should keep the LMSGEN visual asset stylesheet.`);
  } else {
    check(!physical.includes('lmsgen-advantage-assets.css'), `${label} incorrectly loads Home/Solutions visual asset CSS.`);
  }
}

const about = await read(path.join(landingRoot, 'about', 'index.html'));
check(about.includes('ab-hero-carousel-w'), 'About page lost its hero carousel markup.');
check(!about.includes('.ab-hero-carousel-w,.ab-hero-img,.ab-hero-carousel-slide{display:none'), 'About page contains a forced carousel hide rule.');

const contact = await read(path.join(landingRoot, 'contact', 'index.html'));
const canonicalContact = await read(path.join(distRoot, 'contact', 'index.html'));
check(contact.includes('id="wf-form-Contact-Form"'), 'Contact form is missing from the final page.');
check(contact.includes('/landing/js/contact-form.js'), 'Contact form SMTP/API client script is missing.');
check(contact.includes('lmsgen-contact-context'), 'Contact product context panel is missing from the physical page.');
check(contact.includes('lmsgen-contact-form-head'), 'Contact form hierarchy header is missing from the physical page.');
check(contact.includes('lmsgen-contact-refresh.css'), 'Contact refresh stylesheet is missing from the physical page.');
check(canonicalContact.includes('lmsgen-contact-context'), 'Contact product context panel is missing from the canonical page.');
check(canonicalContact.includes('lmsgen-contact-refresh.css'), 'Contact refresh stylesheet is missing from the canonical page.');

const contactRefreshCss = await read(path.join(landingRoot, 'css', 'lmsgen-contact-refresh.css'));
check(contactRefreshCss.includes('grid-template-areas'), 'Contact refresh CSS is missing the responsive page grid.');
check(contactRefreshCss.includes('lmsgen-contact-context'), 'Contact refresh CSS is missing the product context panel styles.');

const blog = await read(path.join(landingRoot, 'blog', 'index.html'));
check(!/contENt for you/.test(blog), 'Blog hero still contains broken mixed-case copy.');
check(/Curated learning\s*<br\s*\/?>\s*content for you/.test(blog), 'Blog hero corrected copy is missing.');

const unifiedCss = await read(path.join(landingRoot, 'css', 'lmsgen-unified-ui.css'));
check(unifiedCss.includes('body.lmsgen-page-about'), 'Unified UI CSS is missing About scoping.');
check(unifiedCss.includes('body.lmsgen-page-solutions'), 'Unified UI CSS is missing Solutions scoping.');
check(unifiedCss.includes('body.lmsgen-page-contact'), 'Unified UI CSS is missing Contact scoping.');
check(unifiedCss.includes('.global-header-c'), 'Unified UI CSS is missing shared navigation rules.');

const stableNav = await read(path.join(landingRoot, 'js', 'lmsgen-nav.js'));
check(!stableNav.includes('lmsgen-advantage-assets.css'), 'Stable nav script must never load page CSS dynamically.');
check(!stableNav.includes('aboutCarousel.remove'), 'Stable nav script must never delete About content.');

if (failures.length) {
  throw new Error(`Marketing UI audit failed:\n- ${failures.join('\n- ')}`);
}

console.log(`Marketing UI audit passed across ${pages.length} public pages and their canonical copies.`);