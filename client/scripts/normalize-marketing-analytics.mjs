import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const landingRoot = path.resolve(scriptDir, '..', 'dist', 'landing');
const GTM_ID = process.env.VITE_GTM_CONTAINER_ID || process.env.GTM_CONTAINER_ID || 'GTM-M6VGFPM';

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

if (!/^GTM-[A-Z0-9]+$/i.test(GTM_ID)) {
  throw new Error(`Invalid LMSGEN GTM container ID: ${GTM_ID}`);
}

const consentDefaults = `<script id="lmsgen-consent-default">window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',personalization_storage:'denied',functionality_storage:'granted',security_storage:'granted',wait_for_update:500});</script>`;
const gtmHead = `<script id="lmsgen-gtm">(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');</script>`;

for (const file of await htmlFiles(landingRoot)) {
  let html = await fs.readFile(file, 'utf8');

  // Remove the old body-level GTM loader from the Webflow export. Cookie
  // consent update code remains in place and continues to update dataLayer.
  html = html.replace(/\s*<!-- Google Tag Manager -->[\s\S]*?<!-- End Google Tag Manager -->\s*/gi, '\n');
  html = html.replace(/<script id="lmsgen-consent-default">[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<script id="lmsgen-gtm">[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<\/head>/i, `  ${consentDefaults}\n  ${gtmHead}\n</head>`);

  await fs.writeFile(file, html, 'utf8');
}

console.log(`Normalized Google Tag Manager ${GTM_ID} across marketing pages.`);
