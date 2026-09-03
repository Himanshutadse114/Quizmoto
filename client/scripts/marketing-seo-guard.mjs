import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const landingRoot = path.resolve(scriptDir, '..', 'dist', 'landing');

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
  await fs.writeFile(file, html, 'utf8');
}

const home = await fs.readFile(path.join(landingRoot, 'index.html'), 'utf8');
const solutions = await fs.readFile(path.join(landingRoot, 'solutions', 'index.html'), 'utf8');

const checks = [
  [home.includes('<link rel="canonical" href="https://www.lmsgen.in/"'), 'Homepage canonical is missing or incorrect.'],
  [home.includes('id="lmsgen-pain-title"'), 'Homepage pain-point section was not generated.'],
  [home.includes('id="lmsgen-faq-title"'), 'Homepage FAQ section was not generated.'],
  [home.includes('AI-powered LMS for SCORM course creation, delivery and learner tracking.'), 'Homepage SEO hero was not generated.'],
  [solutions.includes('<link rel="canonical" href="https://www.lmsgen.in/solutions"'), 'Solutions canonical is missing or incorrect.'],
  [solutions.includes('id="lmsgen-audience-title"'), 'Solutions audience section was not generated.'],
  [!home.includes('quizmoto-frontend.onrender.com'), 'Old Render frontend domain remains in homepage HTML.'],
  [!home.includes('Atelora'), 'Old Atelora brand remains in homepage HTML.'],
];

const failures = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failures.length) {
  throw new Error(`Marketing SEO guard failed:\n- ${failures.join('\n- ')}`);
}

console.log(`Marketing SEO guard passed for ${files.length} HTML files.`);
