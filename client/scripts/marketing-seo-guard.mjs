import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.resolve(scriptDir, '..', 'dist');
const landingRoot = path.join(distRoot, 'landing');
const PREVIEW_IMAGE = 'https://www.lmsgen.in/atelora-marketing/hero-dashboard.png';

function upsertMeta(html, attribute, key, content) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<meta\\s+[^>]*${attribute}=["']${escaped}["'][^>]*>`, 'i');
  const tag = `<meta ${attribute}="${key}" content="${content}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace(/<\/head>/i, `  ${tag}\n</head>`);
}

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

const files = await htmlFiles(landingRoot);
for (const file of files) {
  let html = await fs.readFile(file, 'utf8');
  html = html
    .replace(/quizmoto-frontend\.onrender\.com/gi, 'www.lmsgen.in')
    .replace(/\bAtelora\b/g, 'LMSGEN')
    .replace(/\bATELORA\b/g, 'LMSGEN');
  html = upsertMeta(html, 'property', 'og:image', PREVIEW_IMAGE);
  html = upsertMeta(html, 'name', 'twitter:image', PREVIEW_IMAGE);
  await fs.writeFile(file, html, 'utf8');
}

// Marketing HTML is served at clean routes such as /solutions and /about, but
// its CSS, JS and images still live under /landing/. Keep those assets crawlable
// so search engines can render the page correctly. Duplicate HTML URLs are
// canonicalised/redirected by Nginx instead of blocking the whole asset tree.
const robots = `User-agent: *\nAllow: /\nDisallow: /login\nDisallow: /scorm/\nDisallow: /campaign/\nDisallow: /learn/\nDisallow: /player/\nDisallow: /host/\nDisallow: /join\n\nSitemap: https://www.lmsgen.in/sitemap.xml\n`;
await fs.writeFile(path.join(distRoot, 'robots.txt'), robots, 'utf8');

const home = await fs.readFile(path.join(landingRoot, 'index.html'), 'utf8');
const solutions = await fs.readFile(path.join(landingRoot, 'solutions', 'index.html'), 'utf8');
const finalRobots = await fs.readFile(path.join(distRoot, 'robots.txt'), 'utf8');

const checks = [
  [home.includes('<link rel="canonical" href="https://www.lmsgen.in/"'), 'Homepage canonical is missing or incorrect.'],
  [home.includes('id="lmsgen-pain-title"'), 'Homepage pain-point section was not generated.'],
  [home.includes('id="lmsgen-faq-title"'), 'Homepage FAQ section was not generated.'],
  [home.includes('AI-powered LMS for SCORM course creation, delivery and learner tracking.'), 'Homepage SEO hero was not generated.'],
  [home.includes(`property="og:image" content="${PREVIEW_IMAGE}"`), 'Homepage Open Graph image is not canonical.'],
  [home.includes(`name="twitter:image" content="${PREVIEW_IMAGE}"`), 'Homepage Twitter image is not canonical.'],
  [solutions.includes('<link rel="canonical" href="https://www.lmsgen.in/solutions"'), 'Solutions canonical is missing or incorrect.'],
  [solutions.includes('id="lmsgen-audience-title"'), 'Solutions audience section was not generated.'],
  [!home.includes('quizmoto-frontend.onrender.com'), 'Old Render frontend domain remains in homepage HTML.'],
  [!home.includes('Atelora'), 'Old Atelora brand remains in homepage HTML.'],
  [!finalRobots.includes('Disallow: /landing/'), 'robots.txt blocks marketing CSS/JS/image assets under /landing/.'],
  [finalRobots.includes('Sitemap: https://www.lmsgen.in/sitemap.xml'), 'robots.txt does not expose the canonical sitemap.'],
];

const failures = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failures.length) {
  throw new Error(`Marketing SEO guard failed:\n- ${failures.join('\n- ')}`);
}

console.log(`Marketing SEO guard passed for ${files.length} HTML files.`);
