import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(scriptDir, '..');
const landingRoot = path.join(clientRoot, 'dist', 'landing');

const pages = [
  { file: 'index.html', base: '/landing/', home: true },
  { file: 'solutions/index.html', base: '/landing/solutions/' },
  { file: 'about/index.html', base: '/landing/about/' },
  { file: 'blog/index.html', base: '/landing/blog/' },
  { file: 'contact/index.html', base: '/landing/contact/' },
];

const HOME_REPLACEMENTS = [
  ['For modern L&amp;D and security awareness teams', 'One workspace for modern learning teams'],
  ['Save 95% of time and budget on every custom SCORM course.', 'Create, deliver and measure learning in one place.'],
  [
    'Send your brief today, get your next-level SCORM course in your LMS Next minute. AI-powered production',
    'Build SCORM-ready courses with AI, run live Quizmoto sessions, manage learners and track progress',
  ],
  ['at a fraction of the cost and resources.', 'from one connected LMSGEN workspace.'],
  ['<div>How It Works</div>', '<div>See solutions</div>'],
];

const HERO_PRODUCT = `<div class="atelora-hero-product">
              <div class="atelora-product-shell">
                <div class="atelora-product-media">
                  <img src="/atelora-marketing/hero-dashboard.png" alt="LMSGEN learning platform dashboard" loading="eager" decoding="async" />
                </div>
              </div>
            </div>`;

function brandMarketingHtml(html) {
  return html
    .replace(/\bAtelora\b/g, 'LMSGEN')
    .replace(/\bATELORA\b/g, 'LMSGEN');
}

function ensureHeadAssets(html, baseHref) {
  const inserts = [];

  if (!/<base\s+href=/i.test(html)) {
    inserts.push(`<base href="${baseHref}" />`);
  }

  if (!html.includes('/landing/css/atelora-home-refresh.css')) {
    inserts.push('<link rel="stylesheet" href="/landing/css/atelora-home-refresh.css" />');
  }

  if (!inserts.length) return html;
  return html.replace(/<head>/i, `<head>\n    ${inserts.join('\n    ')}`);
}

function ensureBodyClasses(html, classes) {
  return html.replace(/<body([^>]*)>/i, (match, attrs = '') => {
    const classMatch = attrs.match(/\sclass=(['"])(.*?)\1/i);

    if (classMatch) {
      const existing = classMatch[2].split(/\s+/).filter(Boolean);
      const merged = [...new Set([...existing, ...classes])].join(' ');
      const updatedAttrs = attrs.replace(
        classMatch[0],
        ` class=${classMatch[1]}${merged}${classMatch[1]}`,
      );
      return `<body${updatedAttrs}>`;
    }

    return `<body${attrs} class="${classes.join(' ')}">`;
  });
}

function prepareHome(html) {
  for (const [from, to] of HOME_REPLACEMENTS) {
    html = html.split(from).join(to);
  }

  if (!html.includes('class="atelora-hero-product"')) {
    html = html.replace(
      '<div class="hp-hero-img-c new">',
      `<div class="hp-hero-img-c new">\n            ${HERO_PRODUCT}`,
    );
  }

  return html;
}

async function preparePage(page) {
  const filePath = path.join(landingRoot, page.file);
  let html = await fs.readFile(filePath, 'utf8');

  // Remove the exported-site publication marker and make the built documents
  // self-consistent when served at their friendly public route.
  html = html.replace(/<!--\s*Last Published:[\s\S]*?-->\s*/i, '');
  html = ensureHeadAssets(html, page.base);
  html = ensureBodyClasses(html, [
    'atelora-site-refresh',
    ...(page.home ? ['atelora-home-refresh'] : []),
  ]);

  if (page.home) html = prepareHome(html);

  if (page.file === 'contact/index.html') {
    html = html.replace(
      '<title>Contact</title>',
      '<title>Contact LMSGEN | Learning Platform</title>',
    );
  }

  html = brandMarketingHtml(html);

  await fs.writeFile(filePath, html, 'utf8');
  console.log(`Prepared LMSGEN marketing page: ${page.file}`);
}

try {
  await Promise.all(pages.map(preparePage));
} catch (error) {
  console.error('Failed to prepare LMSGEN marketing pages:', error);
  process.exitCode = 1;
}
