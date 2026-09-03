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

// Preserve Vite's authenticated React shell before replacing dist/index.html
// with the real marketing homepage. Static hosts can then route application
// paths to /app.html without making search crawlers parse the private LMS shell.
await copyFile(path.join(distRoot, 'index.html'), path.join(distRoot, 'app.html'));

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

console.log(`Prepared ${marketingCopies.length} crawlable static marketing entry points plus app.html.`);
