// Injects the Genny mascot loader into every static marketing entry point.
//
// The public site is served as static HTML (the React shell never loads
// there), so the vanilla bundle built by build-mascot-bundle.mjs
// (public/landing/js/genny-mascot.js -> dist/landing/js/genny-mascot.js) has
// to be referenced from the HTML itself. Runs after prepare-static-entrypoints
// so both the /landing/** physical copies and the clean-URL entry points get it.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.resolve(scriptDir, '..', 'dist');

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

const PHYSICAL_PAGES = [
  'landing/index.html',
  'landing/solutions/index.html',
  'landing/about/index.html',
  'landing/blog/index.html',
  'landing/contact/index.html',
  ...BLOG_SLUGS.map((slug) => `landing/blog/${slug}.html`),
];

const ENTRY_POINTS = [
  'index.html',
  'solutions/index.html',
  'about/index.html',
  'blog/index.html',
  'contact/index.html',
  ...BLOG_SLUGS.map((slug) => `blog/${slug}/index.html`),
];

const MASCOT_TAG = '<script type="module" src="/landing/js/genny-mascot.js"></script>';

let injected = 0;
let skipped = 0;

for (const rel of [...PHYSICAL_PAGES, ...ENTRY_POINTS]) {
  const filePath = path.join(distRoot, rel);
  let html;
  try {
    html = await fs.readFile(filePath, 'utf8');
  } catch {
    console.warn(`[inject-mascot] missing file, skipping: ${rel}`);
    skipped += 1;
    continue;
  }
  if (html.includes('genny-mascot.js')) continue; // idempotent
  if (!html.includes('</body>')) {
    console.warn(`[inject-mascot] no </body> in ${rel}, skipping`);
    skipped += 1;
    continue;
  }
  html = html.replace('</body>', `  ${MASCOT_TAG}\n</body>`);
  await fs.writeFile(filePath, html, 'utf8');
  injected += 1;
}

console.log(`[inject-mascot] injected Genny loader into ${injected} pages (${skipped} skipped)`);
