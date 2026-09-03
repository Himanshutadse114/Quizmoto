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

// Preserve Vite's authenticated React shell before replacing dist/index.html
// with the real marketing homepage. Static hosts can then route application
// paths to /app.html without making search crawlers parse the private LMS shell.
await copyFile(path.join(distRoot, 'index.html'), path.join(distRoot, 'app.html'));

// If an older host-level catch-all still sends an LMS deep link to index.html,
// move it to app.html and restore the requested URL before React starts. This
// makes the SEO entry-point change safe even before hosting route rules refresh.
const restoreScript = `<script id="lmsgen-app-route-restore">(function(){try{if(location.pathname!='/app.html')return;var p=new URLSearchParams(location.search).get('__lmsgen_route');if(p){history.replaceState(null,'',p);}}catch(e){}})();</script>`;
let appHtml = await fs.readFile(path.join(distRoot, 'app.html'), 'utf8');
if (!appHtml.includes('id="lmsgen-app-route-restore"')) {
  appHtml = injectAfterHeadOpen(appHtml, restoreScript);
  await fs.writeFile(path.join(distRoot, 'app.html'), appHtml, 'utf8');
}

const marketingCopies = [
  [path.join(landingRoot, 'index.html'), path.join(distRoot, 'index.html')],
  [path.join(landingRoot, 'solutions', 'index.html'), path.join(distRoot, 'solutions', 'index.html')],
  [path.join(landingRoot, 'about', 'index.html'), path.join(distRoot, 'about', 'index.html')],
  [path.join(landingRoot, 'blog', 'index.html'), path.join(distRoot, 'blog', 'index.html')],
  [path.join(landingRoot, 'contact', 'index.html'), path.join(distRoot, 'contact', 'index.html')],
  ...BLOG_SLUGS.map((slug) => [
    path.join(landingRoot, 'blog', `${slug}.html`),
    path.join(distRoot, 'blog', slug, 'index.html'),
  ]),
];

for (const [source, destination] of marketingCopies) {
  await copyFile(source, destination);
}

const appHandoffScript = `<script id="lmsgen-static-app-handoff">(function(){try{var p=location.pathname;var app=/^\\/(?:login(?:\\/|$)|auth(?:\\/|$)|scorm(?:\\/|$)|player(?:\\/|$)|join(?:\\/|$)|host(?:\\/|$)|dashboard(?:\\/|$)|create-quiz(?:\\/|$)|edit-quiz(?:\\/|$)|reports(?:\\/|$)|learn(?:\\/|$)|campaign(?:\\/|$))/.test(p);if(!app)return;var route=p+location.search+location.hash;location.replace('/app.html?__lmsgen_route='+encodeURIComponent(route));}catch(e){}})();</script>`;
let rootMarketing = await fs.readFile(path.join(distRoot, 'index.html'), 'utf8');
if (!rootMarketing.includes('id="lmsgen-static-app-handoff"')) {
  rootMarketing = injectAfterHeadOpen(rootMarketing, appHandoffScript);
  await fs.writeFile(path.join(distRoot, 'index.html'), rootMarketing, 'utf8');
}

console.log(`Prepared ${marketingCopies.length} crawlable static marketing entry points plus app.html.`);
