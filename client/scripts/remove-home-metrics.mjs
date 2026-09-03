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

// The SEO pass deliberately runs after the existing marketing preparation so
// canonical URLs, structured data and audience-focused copy are applied to the
// exact HTML that will be shipped in dist/.
await import('./seo-marketing.mjs');

// Refine the generated pain-point block after SEO inserts it. This keeps the
// content crawlable while ensuring the homepage layout uses the product site's
// visual system rather than a generic long card grid.
await import('./refine-home-pain-section.mjs');

// Fail the production build if stale branding/domains or the critical SEO
// sections reappear in a future marketing export.
await import('./marketing-seo-guard.mjs');
