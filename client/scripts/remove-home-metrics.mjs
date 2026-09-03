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

// Apply canonical URLs, structured data, audience-focused copy and crawlable
// FAQ content to the generated marketing HTML.
await import('./seo-marketing.mjs');

// Keep the buyer pain-point content but use the site's actual visual language.
await import('./refine-home-pain-section.mjs');

// Apply the remaining code-level findings from the SEOptimer audit: social
// preview tags, identity/contact schema, freshness/trust signals and optional
// analytics/social profile integration when real IDs/URLs are configured.
await import('./apply-seoptimer-fixes.mjs');

// Make robots.txt, sitemap.xml and llms.txt reflect the final public/private
// routing model and publish explicit freshness signals.
await import('./finalize-public-seo-files.mjs');

// Preserve the private React application as app.html and make the public
// marketing pages the real static entry points used by Render/CDN hosting.
await import('./prepare-static-entrypoints.mjs');

// Fail the production build if stale branding/domains or critical SEO signals
// disappear from the final files that will actually be deployed.
await import('./marketing-seo-guard.mjs');
