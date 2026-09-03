import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(scriptDir, '..');
const homePath = path.join(clientRoot, 'dist', 'landing', 'index.html');

let html = await fs.readFile(homePath, 'utf8');

const style = `
<style id="lmsgen-hide-home-metrics">
  body.atelora-home-refresh .hp-trust-metrics-c {
    display: none !important;
  }
</style>`;

if (!html.includes('id="lmsgen-hide-home-metrics"')) {
  html = html.replace(/<\/head>/i, `${style}\n</head>`);
}

await fs.writeFile(homePath, html, 'utf8');
console.log('Removed homepage AI / AI / 360° metrics strip.');

// Apply every content/SEO transformation to the physical marketing pages first.
// Static canonical entry points are published only after the final UI pass so
// /about and /landing/about can never contain different CSS revisions.
await import('./seo-marketing.mjs');
await import('./refine-home-pain-section.mjs');
await import('./apply-seoptimer-fixes.mjs');
await import('./normalize-marketing-analytics.mjs');
await import('./contact-transparency.mjs');
await import('./finalize-public-seo-files.mjs');
