import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const landingRoot = path.resolve(scriptDir, '..', 'dist', 'landing');

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
  { file: 'index.html', type: 'home', allowHomeCss: true, allowAdvantageCss: true },
  { file: 'solutions/index.html', type: 'solutions', allowAdvantageCss: true },
  { file: 'about/index.html', type: 'about' },
  { file: 'blog/index.html', type: 'blog' },
  { file: 'contact/index.html', type: 'contact' },
  ...BLOG_SLUGS.map((slug) => ({ file: `blog/${slug}.html`, type: 'article' })),
];

function ensureBodyClass(html, className) {
  return html.replace(/<body([^>]*)>/i, (match, attrs = '') => {
    const classMatch = attrs.match(/\sclass=(['"])(.*?)\1/i);
    if (!classMatch) return `<body${attrs} class="${className}">`;

    const classes = classMatch[2].split(/\s+/).filter(Boolean);
    if (!classes.includes(className)) classes.push(className);
    const updatedAttrs = attrs.replace(classMatch[0], ` class=${classMatch[1]}${classes.join(' ')}${classMatch[1]}`);
    return `<body${updatedAttrs}>`;
  });
}

function stripStylesheet(html, needle) {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<link\\b[^>]*href=["'][^"']*${escaped}[^"']*["'][^>]*>\\s*`, 'gi');
  return html.replace(pattern, '');
}

function stripScript(html, needle) {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<script\\b[^>]*src=["'][^"']*${escaped}[^"']*["'][^>]*>\\s*<\\/script>\\s*`, 'gi');
  return html.replace(pattern, '');
}

function stripAntiFouc(html) {
  return html.replace(/<style\s+id=["']lmsgen-anti-fouc["'][^>]*>[\s\S]*?<\/style>\s*/gi, '');
}

function ensureUnifiedCss(html) {
  html = stripStylesheet(html, 'lmsgen-unified-ui.css');
  const tag = '<link id="lmsgen-unified-ui" rel="stylesheet" href="/landing/css/lmsgen-unified-ui.css?v=20260903a" />';
  return html.replace(/<\/head>/i, `    ${tag}\n</head>`);
}

function ensureHomeTypographyCss(html, type) {
  html = stripStylesheet(html, 'lmsgen-home-lower-typography.css');
  if (type !== 'home') return html;

  const tag = '<link id="lmsgen-home-lower-typography" rel="stylesheet" href="/landing/css/lmsgen-home-lower-typography.css?v=20260904a" />';
  return html.replace(/<\/head>/i, `    ${tag}\n</head>`);
}

function ensureUnifiedNav(html) {
  html = stripScript(html, 'nav-menu.js');
  html = stripScript(html, 'lmsgen-nav.js');
  const tag = '<script src="/landing/js/lmsgen-nav.js?v=20260903a" defer></script>';
  return html.replace(/<\/body>/i, `    ${tag}\n  </body>`);
}

function normaliseLogo(html) {
  return html.replace(/<img\b[^>]*class=["'][^"']*\bnav-logo\b[^"']*["'][^>]*>/gi, (tag) => {
    let next = tag;
    if (/\bsrc=["'][^"']*["']/i.test(next)) {
      next = next.replace(/\bsrc=["'][^"']*["']/i, 'src="/branding/lmsgen-logo-light.png"');
    } else {
      next = next.replace(/^<img\b/i, '<img src="/branding/lmsgen-logo-light.png"');
    }
    if (/\balt=["'][^"']*["']/i.test(next)) {
      next = next.replace(/\balt=["'][^"']*["']/i, 'alt="LMSGEN"');
    } else {
      next = next.replace(/^<img\b/i, '<img alt="LMSGEN"');
    }
    return next;
  });
}

function tidyPageCopy(html, type) {
  if (type === 'blog') {
    html = html.replace(/Curated learning\s*<br\s*\/?>\s*contENt for you/i, 'Curated learning<br />content for you');
  }
  return html;
}

for (const page of pages) {
  const filePath = path.join(landingRoot, page.file);
  let html = await fs.readFile(filePath, 'utf8');

  html = ensureBodyClass(html, `lmsgen-page-${page.type}`);
  html = stripAntiFouc(html);

  if (!page.allowHomeCss) html = stripStylesheet(html, 'atelora-home-refresh.css');
  if (!page.allowAdvantageCss) html = stripStylesheet(html, 'lmsgen-advantage-assets.css');

  html = normaliseLogo(html);
  html = tidyPageCopy(html, page.type);
  html = ensureUnifiedCss(html);
  html = ensureHomeTypographyCss(html, page.type);
  html = ensureUnifiedNav(html);

  await fs.writeFile(filePath, html, 'utf8');
  console.log(`Stabilized marketing UI: ${page.file} (${page.type})`);
}
