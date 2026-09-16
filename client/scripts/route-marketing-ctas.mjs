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

function routeCtas(html) {
  let count = 0;
  const output = html.replace(/<a\b[^>]*>/gi, (tag) => {
    if (!isConversionCta(tag)) return tag;

    let next = tag;
    if (/\bhref=["'][^"']*["']/i.test(next)) {
      next = next.replace(/\bhref=(["'])[^"']*\1/i, 'href="/contact"');
    } else {
      next = next.replace(/>$/, ' href="/contact">');
    }

    if (!/\bdata-lmsgen-cta-route=/i.test(next)) {
      next = next.replace(/>$/, ' data-lmsgen-cta-route="contact">');
    }
    if (next !== tag) count += 1;
    return next;
  });
  return { html: output, count };
}

const files = await htmlFiles(landingRoot);
let routed = 0;

for (const file of files) {
  const source = await fs.readFile(file, 'utf8');
  const result = routeCtas(source);
  routed += result.count;
  await fs.writeFile(file, result.html, 'utf8');
}

console.log(`Routed ${routed} marketing CTAs to /contact across ${files.length} pages.`);
