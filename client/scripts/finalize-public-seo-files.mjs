import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.resolve(scriptDir, '..', 'dist');
const SITE_URL = 'https://www.lmsgen.in';
const today = new Date().toISOString().slice(0, 10);

// /landing/ contains the CSS, JS and image assets used by the crawlable public
// pages, so it must remain available to search and AI crawlers. Private LMS and
// learner/player application routes stay excluded from organic indexing.
const robots = `User-agent: *\nAllow: /\nDisallow: /login\nDisallow: /auth/\nDisallow: /scorm/\nDisallow: /campaign/\nDisallow: /learn\nDisallow: /learn/\nDisallow: /player/\nDisallow: /host/\nDisallow: /join\nDisallow: /app.html\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
await fs.writeFile(path.join(distRoot, 'robots.txt'), robots, 'utf8');

const sitemapPath = path.join(distRoot, 'sitemap.xml');
let sitemap = await fs.readFile(sitemapPath, 'utf8');
sitemap = sitemap.replace(/(<url><loc>[^<]+<\/loc>)(?!<lastmod>)/g, `$1<lastmod>${today}</lastmod>`);
await fs.writeFile(sitemapPath, sitemap, 'utf8');

const llmsPath = path.join(distRoot, 'llms.txt');
let llms = await fs.readFile(llmsPath, 'utf8');
if (!/^Last updated:/m.test(llms)) {
  llms = llms.replace(/^# LMSGEN\s*/m, `# LMSGEN\n\nLast updated: ${today}\n\n`);
}
await fs.writeFile(llmsPath, llms, 'utf8');

console.log(`Finalized crawler files with ${today} freshness signals.`);
