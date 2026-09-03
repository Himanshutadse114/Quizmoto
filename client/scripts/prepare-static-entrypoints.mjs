import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(scriptDir, '..');
const distRoot = path.join(clientRoot, 'dist');
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

async function copyFile(source, destination) {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
}

function injectAfterHeadOpen(html, markup) {
  return html.replace(/<head>/i, `<head>\n  ${markup}`);
}

function canonicalisePhysicalEntry(html, canonicalPath) {
  if (html.includes('id="lmsgen-physical-route-canonical"')) return html;
  const encodedCanonical = JSON.stringify(canonicalPath);
  const script = `<script id="lmsgen-physical-route-canonical">(function(){try{if(!location.pathname.startsWith('/landing/'))return;var target=${encodedCanonical}+location.search+location.hash;history.replaceState(null,'',target);}catch(e){}})();</script>`;
  return injectAfterHeadOpen(html, script);
}

// Preserve Vite's authenticated React shell before replacing dist/index.html
// with the real marketing homepage. Static hosts can then route application
// paths to /app.html without making search crawlers parse the private LMS shell.
await copyFile(path.join(distRoot, 'index.html'), path.join(distRoot, 'app.html'));

// If an older host-level catch-all sends an LMS deep link to app.html, restore
// the requested URL before React starts.
const restoreScript = `<script id="lmsgen-app-route-restore">(function(){try{if(location.pathname!='/app.html')return;var p=new URLSearchParams(location.search).get('__lmsgen_route');if(p){history.replaceState(null,'',p);}}catch(e){}})();</script>`;
let appHtml = await fs.readFile(path.join(distRoot, 'app.html'), 'utf8');
if (!appHtml.includes('id="lmsgen-app-route-restore"')) {
  appHtml = injectAfterHeadOpen(appHtml, restoreScript);
  await fs.writeFile(path.join(distRoot, 'app.html'), appHtml, 'utf8');
}

const marketingCopies = [
  { source: path.join(landingRoot, 'index.html'), destination: path.join(distRoot, 'index.html'), canonical: '/' },
  { source: path.join(landingRoot, 'solutions', 'index.html'), destination: path.join(distRoot, 'solutions', 'index.html'), canonical: '/solutions' },
  { source: path.join(landingRoot, 'about', 'index.html'), destination: path.join(distRoot, 'about', 'index.html'), canonical: '/about' },
  { source: path.join(landingRoot, 'blog', 'index.html'), destination: path.join(distRoot, 'blog', 'index.html'), canonical: '/blog' },
  { source: path.join(landingRoot, 'contact', 'index.html'), destination: path.join(distRoot, 'contact', 'index.html'), canonical: '/contact' },
  ...BLOG_SLUGS.map((slug) => ({
    source: path.join(landingRoot, 'blog', `${slug}.html`),
    destination: path.join(distRoot, 'blog', slug, 'index.html'),
    canonical: `/blog/${slug}`,
  })),
];

// Give every physical /landing page a clean canonical URL after it loads. This
// lets us use the physical files as a reliable fallback on hosts that rewrite
// every unknown path to /index.html, without leaving /landing/... in the address bar.
for (const entry of marketingCopies) {
  let sourceHtml = await fs.readFile(entry.source, 'utf8');
  sourceHtml = canonicalisePhysicalEntry(sourceHtml, entry.canonical);
  await fs.writeFile(entry.source, sourceHtml, 'utf8');
  await copyFile(entry.source, entry.destination);
}

// Host-independent recovery for public routes. Some static hosting setups apply
// an unconditional SPA catch-all and serve the homepage for /about, /blog, etc.
// If that happens, jump to the real physical marketing file; the script injected
// above immediately restores the clean canonical URL with history.replaceState.
const publicRecoveryScript = `<script id="lmsgen-public-route-recovery">(function(){try{var p=location.pathname.replace(/\\/+$/,'')||'/';var routes={'/solutions':'/landing/solutions/index.html','/about':'/landing/about/index.html','/blog':'/landing/blog/index.html','/contact':'/landing/contact/index.html'};var target=routes[p];if(!target){var m=p.match(/^\\/blog\\/([a-z0-9-]+)$/);if(m)target='/landing/blog/'+m[1]+'.html';}if(target){location.replace(target+location.search+location.hash);}}catch(e){}})();</script>`;

// If a host-level catch-all sends an authenticated/app route to the marketing
// homepage, move it to app.html and preserve the original path for React.
const appHandoffScript = `<script id="lmsgen-static-app-handoff">(function(){try{var p=location.pathname;var app=/^\\/(?:signin(?:\\/|$)|login(?:\\/|$)|auth(?:\\/|$)|scorm(?:\\/|$)|player(?:\\/|$)|join(?:\\/|$)|host(?:\\/|$)|dashboard(?:\\/|$)|create-quiz(?:\\/|$)|edit-quiz(?:\\/|$)|reports(?:\\/|$)|learn(?:\\/|$)|campaign(?:\\/|$))/.test(p);if(!app)return;var route=p+location.search+location.hash;if(/^\\/signin(?:\\/|$)/.test(p))route='/login'+location.search+location.hash;location.replace('/app.html?__lmsgen_route='+encodeURIComponent(route));}catch(e){}})();</script>`;

let rootMarketing = await fs.readFile(path.join(distRoot, 'index.html'), 'utf8');
if (!rootMarketing.includes('id="lmsgen-public-route-recovery"')) {
  rootMarketing = injectAfterHeadOpen(rootMarketing, publicRecoveryScript);
}
if (!rootMarketing.includes('id="lmsgen-static-app-handoff"')) {
  rootMarketing = injectAfterHeadOpen(rootMarketing, appHandoffScript);
}
await fs.writeFile(path.join(distRoot, 'index.html'), rootMarketing, 'utf8');

console.log(`Prepared ${marketingCopies.length} crawlable marketing entry points, physical-route recovery and app.html.`);
