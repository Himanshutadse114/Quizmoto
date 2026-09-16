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

function attribute(tag, name) {
  return (tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i')) || [])[1] || '';
}

function isConversionCta(tag) {
  const className = attribute(tag, 'class');
  const href = attribute(tag, 'href');
  const control = attribute(tag, 'cd');

  if (/\bfs-cc(?:-|\b)/i.test(className)) return false;
  if (/\bsubmit\b/i.test(className)) return false;
  if (/^\/category\//i.test(href)) return false;

  return /\bbtn-primary\b/i.test(className)
    || /(?:^|[\s_-])cta(?:[\s_-]|$)/i.test(className)
    || /book-a-demo/i.test(control);
}

function setDestination(tag, href, route) {
  let next = tag;
  if (/\bhref=["'][^"']*["']/i.test(next)) {
    next = next.replace(/\bhref=(["'])[^"']*\1/i, `href="${href}"`);
  } else {
    next = next.replace(/>$/, ` href="${href}">`);
  }

  if (/\bdata-lmsgen-cta-route=["'][^"']*["']/i.test(next)) {
    next = next.replace(/\bdata-lmsgen-cta-route=(["'])[^"']*\1/i, `data-lmsgen-cta-route="${route}"`);
  } else {
    next = next.replace(/>$/, ` data-lmsgen-cta-route="${route}">`);
  }
  return next;
}

function routeCtas(html) {
  let contactCount = 0;
  let output = html.replace(/<a\b[^>]*>/gi, (tag) => {
    if (!isConversionCta(tag)) return tag;
    const next = setDestination(tag, '/contact', 'contact');
    if (next !== tag) contactCount += 1;
    return next;
  });

  let platformCount = 0;
  output = output.replace(/<a\b[^>]*>\s*Explore LMSGEN\s*<\/a\s*>/gi, (anchor) => {
    const next = anchor.replace(/^<a\b[^>]*>/i, (tag) => setDestination(tag, '/login', 'platform'));
    if (next !== anchor) platformCount += 1;
    return next;
  });

  return { html: output, contactCount, platformCount };
}

const files = await htmlFiles(landingRoot);
let contactRouted = 0;
let platformRouted = 0;

for (const file of files) {
  const source = await fs.readFile(file, 'utf8');
  const result = routeCtas(source);
  contactRouted += result.contactCount;
  platformRouted += result.platformCount;
  await fs.writeFile(file, result.html, 'utf8');
}

console.log(`Routed ${contactRouted} sales CTAs to /contact and ${platformRouted} Explore LMSGEN CTAs to /login across ${files.length} pages.`);
