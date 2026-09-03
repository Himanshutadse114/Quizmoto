import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.resolve(scriptDir, '..', 'dist');
const landingRoot = path.join(distRoot, 'landing');
const PREVIEW_IMAGE = 'https://www.lmsgen.in/atelora-marketing/hero-dashboard.png';

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

function metaContent(html, attribute, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const first = new RegExp(`<meta\\s+[^>]*${attribute}=["']${escaped}["'][^>]*content=["']([^"']*)["'][^>]*>`, 'i');
  const second = new RegExp(`<meta\\s+[^>]*content=["']([^"']*)["'][^>]*${attribute}=["']${escaped}["'][^>]*>`, 'i');
  return (html.match(first) || html.match(second) || [])[1] || '';
}

function visibleWordCount(html) {
  const withoutCode = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return withoutCode ? withoutCode.split(' ').filter(Boolean).length : 0;
}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function seoAuditSurface(html) {
  // Only inspect content that can affect visible branding or search/social
  // metadata. Webflow implementation hooks such as data-wf-domain, legacy CSS
  // class names, JavaScript identifiers and asset folder names are deliberately
  // excluded because they are not rendered brand copy or canonical SEO signals.
  const title = (html.match(/<title>[\s\S]*?<\/title>/i) || [''])[0];
  const metaTags = (html.match(/<meta\b[^>]*>/gi) || []).join('\n');
  const canonicalAndAlternates = (html.match(/<link\b[^>]*(?:rel=["'](?:canonical|alternate)["']|hreflang=)[^>]*>/gi) || []).join('\n');
  const structuredData = (html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || []).join('\n');

  return [
    visibleText(html),
    title,
    metaTags,
    canonicalAndAlternates,
    structuredData,
  ].join('\n');
}

function hasLegacySeoBranding(html) {
  // The existing Webflow export still stores the product screenshot under
  // /atelora-marketing/. That folder name is an internal asset locator, not
  // rendered brand copy. Mask only that exact path before checking for stale
  // Atelora text so real visible/meta/schema regressions are still rejected.
  const surface = seoAuditSurface(html)
    .replace(/\/atelora-marketing\//gi, '/lmsgen-marketing-asset/');

  return /\bAtelora\b/i.test(surface) || /quizmoto-frontend\.onrender\.com/i.test(surface);
}

const landingFiles = await htmlFiles(landingRoot);
const home = await fs.readFile(path.join(distRoot, 'index.html'), 'utf8');
const app = await fs.readFile(path.join(distRoot, 'app.html'), 'utf8');
const solutions = await fs.readFile(path.join(distRoot, 'solutions', 'index.html'), 'utf8');
const finalRobots = await fs.readFile(path.join(distRoot, 'robots.txt'), 'utf8');
const sitemap = await fs.readFile(path.join(distRoot, 'sitemap.xml'), 'utf8');

const title = (home.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]?.trim() || '';
const description = metaContent(home, 'name', 'description');
const robotsMeta = metaContent(home, 'name', 'robots');
const h1Count = (home.match(/<h1\b/gi) || []).length;
const h2Count = (home.match(/<h2\b/gi) || []).length;
const h3Count = (home.match(/<h3\b/gi) || []).length;
const wordCount = visibleWordCount(home);

const requiredEntrypoints = [
  'solutions/index.html',
  'about/index.html',
  'blog/index.html',
  'contact/index.html',
  'blog/why-scorm-courses-go-unfinished/index.html',
  'blog/live-quizzes-vs-static-assessments/index.html',
  'blog/scorm-1-2-vs-scorm-2004/index.html',
];
const entrypointChecks = await Promise.all(requiredEntrypoints.map(async (file) => {
  try {
    await fs.access(path.join(distRoot, file));
    return [true, `Missing static entry point: ${file}`];
  } catch {
    return [false, `Missing static entry point: ${file}`];
  }
}));

const staleMarketing = [];
for (const file of landingFiles) {
  const html = await fs.readFile(file, 'utf8');
  if (hasLegacySeoBranding(html)) staleMarketing.push(file);
}

const checks = [
  [home.includes('<link rel="canonical" href="https://www.lmsgen.in/"'), 'Homepage canonical is missing or incorrect.'],
  [!robotsMeta.toLowerCase().includes('noindex'), 'Public homepage is still marked noindex.'],
  [h1Count === 1, `Homepage must have exactly one H1; found ${h1Count}.`],
  [h2Count >= 3, `Homepage should use multiple H2 headings; found ${h2Count}.`],
  [h3Count >= 4, `Homepage should use supporting H3 headings; found ${h3Count}.`],
  [wordCount >= 500, `Homepage is still too thin for the audit; visible word count is ${wordCount}.`],
  [title.length >= 50 && title.length <= 60, `Homepage title length should be 50-60 characters; found ${title.length}.`],
  [description.length >= 120 && description.length <= 160, `Homepage meta description should be 120-160 characters; found ${description.length}.`],
  [home.includes('id="lmsgen-pain-title"'), 'Homepage pain-point section was not generated.'],
  [home.includes('id="lmsgen-faq-title"'), 'Homepage FAQ/Q&A section was not generated.'],
  [home.includes('class="lmsgen-audit-trust"'), 'Homepage trust/freshness section was not generated.'],
  [home.includes('class="lmsgen-business-identity"'), 'Visible business/contact identity block was not generated.'],
  [home.includes('id="lmsgen-seoptimer-entity-schema"'), 'Identity/contact structured data was not generated.'],
  [home.includes('FAQPage'), 'FAQ structured data is missing.'],
  [home.includes('Organization'), 'Organization identity schema is missing.'],
  [home.includes(`property="og:image" content="${PREVIEW_IMAGE}"`), 'Homepage Open Graph image is missing or non-canonical.'],
  [home.includes(`name="twitter:image" content="${PREVIEW_IMAGE}"`), 'Homepage X/Twitter card image is missing or non-canonical.'],
  [home.includes('GTM-M6VGFPM'), 'Google Tag Manager is missing from the final marketing homepage.'],
  [home.includes('updated ') && home.includes('<time datetime='), 'Visible freshness signal is missing.'],
  [solutions.includes('<link rel="canonical" href="https://www.lmsgen.in/solutions"'), 'Solutions canonical is missing or incorrect.'],
  [solutions.includes('id="lmsgen-audience-title"'), 'Solutions audience section was not generated.'],
  [staleMarketing.length === 0, `Stale visible or SEO Atelora/Render branding remains in ${staleMarketing.length} marketing files.`],
  [metaContent(app, 'name', 'robots').toLowerCase().includes('noindex'), 'Private React LMS shell must remain noindex.'],
  [!finalRobots.includes('Disallow: /landing/'), 'robots.txt blocks marketing CSS/JS/image assets under /landing/.'],
  [finalRobots.includes('Sitemap: https://www.lmsgen.in/sitemap.xml'), 'robots.txt does not expose the canonical sitemap.'],
  [sitemap.includes('<loc>https://www.lmsgen.in/</loc>'), 'Sitemap is missing the canonical homepage.'],
  [sitemap.includes('<lastmod>'), 'Sitemap does not include freshness lastmod values.'],
  ...entrypointChecks,
];

const failures = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failures.length) {
  throw new Error(`Marketing SEO guard failed:\n- ${failures.join('\n- ')}`);
}

console.log(`Marketing SEO guard passed. Homepage: ${wordCount} words, ${h1Count} H1, ${h2Count} H2, ${h3Count} H3.`);
