import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const landingRoot = path.resolve(scriptDir, '..', 'dist', 'landing');

const BLOG_SLUGS = new Set([
  'why-scorm-courses-go-unfinished',
  'live-quizzes-vs-static-assessments',
  'scorm-1-2-vs-scorm-2004',
  'ai-assisted-authoring-course-timeline',
  'signs-security-awareness-training-needs-refresh',
  'slide-deck-to-scorm-migration-guide',
  'quizmoto-as-a-full-learning-platform',
  'designing-knowledge-checks-that-dont-feel-like-a-test',
]);

async function htmlFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(full);
  }
  return files;
}

function injectTypographyAssets(html) {
  if (!html.includes('id="lmsgen-google-fonts"')) {
    const block = [
      '<link rel="preconnect" href="https://fonts.googleapis.com" />',
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
      '<link id="lmsgen-google-fonts" rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700&family=Open+Sans:wght@400;500;600;700&display=swap" />',
      '<link id="lmsgen-site-typography" rel="stylesheet" href="/landing/css/lmsgen-site-typography.css?v=20260903" />',
    ].join('\n    ');
    html = html.replace(/<\/head>/i, `    ${block}\n</head>`);
  }
  return html;
}

function humaniseFileName(src) {
  const file = String(src || '').split(/[?#]/)[0].split('/').pop() || '';
  return file
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/^\d+[-_]?/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function inferAlt(tag) {
  const src = (tag.match(/\bsrc=["']([^"']+)["']/i) || [])[1] || '';
  const classes = (tag.match(/\bclass=["']([^"']+)["']/i) || [])[1] || '';
  const signal = `${src} ${classes}`.toLowerCase();

  if (/logo|brand-mark|navbar-brand/.test(signal)) return 'LMSGEN logo';
  if (/hero-dashboard|hero-product|product-media/.test(signal)) return 'LMSGEN AI learning management platform dashboard';
  if (/ai-course|course-studio|ai-from-documents/.test(signal)) return 'LMSGEN AI course authoring interface';
  if (/quizmoto|live-quiz/.test(signal)) return 'Quizmoto live learning quiz experience';
  if (/learner-hub|learner-mgmt|learner.*dashboard/.test(signal)) return 'LMSGEN learner management and progress dashboard';
  if (/analytics|report|tracking-dashboard/.test(signal)) return 'LMSGEN learning analytics and reporting dashboard';
  if (/scorm/.test(signal)) return 'LMSGEN SCORM course delivery illustration';
  if (/access-control|admin-role/.test(signal)) return 'LMSGEN user roles and access controls';
  if (/content-library|library/.test(signal)) return 'LMSGEN course and content library';
  if (/learning-path/.test(signal)) return 'LMSGEN personalised learning path illustration';

  if (/\/images\/lmsgen\//i.test(src)) {
    const label = humaniseFileName(src);
    return label ? `LMSGEN ${label}` : 'LMSGEN learning platform illustration';
  }

  // Most remaining exported images are decorative Webflow artwork. An empty
  // alt attribute is the correct accessible treatment and still distinguishes
  // the image from an accidentally missing alt attribute.
  return '';
}

function ensureImageAltAttributes(html) {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (/\balt\s*=/i.test(tag)) return tag;
    const alt = inferAlt(tag).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return tag.replace(/^<img\b/i, `<img alt="${alt}"`);
  });
}

function splitHref(value) {
  const match = String(value).match(/^([^?#]*)([?#][\s\S]*)?$/);
  return { pathname: match?.[1] || '', suffix: match?.[2] || '' };
}

function canonicalInternalHref(value) {
  let href = String(value || '').trim();
  if (!href || /^(?:#|mailto:|tel:|javascript:)/i.test(href)) return href;
  if (/^https?:\/\//i.test(href) && !/^https?:\/\/(?:www\.)?lmsgen\.in(?:\/|$)/i.test(href)) return href;

  href = href.replace(/^https?:\/\/(?:www\.)?lmsgen\.in/i, '');
  const { pathname, suffix } = splitHref(href);
  let clean = pathname.replace(/\\/g, '/').trim();

  clean = clean.replace(/^\/+landing\//i, '/');
  clean = clean.replace(/^(?:\.\.\/)+/, '/');
  clean = clean.replace(/^\.\//, '');
  clean = clean.replace(/^landing\//i, '/');

  const withoutLeading = clean.replace(/^\/+/, '');
  const normalised = withoutLeading.replace(/\/+$/, '');

  if (!normalised || normalised === 'index.html') return `/${suffix}`;

  const topLevel = normalised
    .replace(/\/index\.html$/i, '')
    .replace(/\.html$/i, '');

  if (/^(solutions|about|blog|contact)$/i.test(topLevel)) {
    return `/${topLevel.toLowerCase()}${suffix}`;
  }

  const blogMatch = topLevel.match(/^(?:blog\/)?([a-z0-9-]+)$/i);
  if (blogMatch && BLOG_SLUGS.has(blogMatch[1].toLowerCase())) {
    return `/blog/${blogMatch[1].toLowerCase()}${suffix}`;
  }

  if (clean.startsWith('/')) return `${clean}${suffix}`;
  return value;
}

function normaliseInternalAnchorLinks(html) {
  return html.replace(/<a\b([^>]*?)\bhref=(["'])([^"']*)\2([^>]*)>/gi, (tag, before, quote, href, after) => {
    const cleaned = canonicalInternalHref(href);
    if (cleaned === href) return tag;
    return `<a${before}href=${quote}${cleaned}${quote}${after}>`;
  });
}

function removeOwnedInlineStyles(html) {
  // This style was injected by the LMSGEN marketing build itself. The width is
  // already defined in the external stylesheet, so keeping the style attribute
  // only adds to the audit's inline-style noise.
  return html.replace(
    /(<div\s+class=["']atelora-hero-product["'])\s+style=["'][^"']*["']/i,
    '$1',
  );
}

const files = await htmlFiles(landingRoot);
let missingBefore = 0;
let missingAfter = 0;
let linksCleaned = 0;

for (const file of files) {
  let html = await fs.readFile(file, 'utf8');
  missingBefore += (html.match(/<img\b(?![^>]*\balt\s*=)[^>]*>/gi) || []).length;

  const beforeLinks = html;
  html = injectTypographyAssets(html);
  html = ensureImageAltAttributes(html);
  html = normaliseInternalAnchorLinks(html);
  html = removeOwnedInlineStyles(html);

  if (html !== beforeLinks) linksCleaned += 1;
  missingAfter += (html.match(/<img\b(?![^>]*\balt\s*=)[^>]*>/gi) || []).length;
  await fs.writeFile(file, html, 'utf8');
}

if (missingAfter !== 0) {
  throw new Error(`Marketing accessibility pass left ${missingAfter} images without alt attributes.`);
}

console.log(`Marketing audit polish complete across ${files.length} pages. Missing image alt attributes: ${missingBefore} -> ${missingAfter}. Updated ${linksCleaned} page files.`);
