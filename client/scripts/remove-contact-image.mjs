import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const contactPath = path.resolve(scriptDir, '..', 'dist', 'landing', 'contact', 'index.html');

let html = await fs.readFile(contactPath, 'utf8');

const imageBlock = /\s*<div class="ct-main-info-c">\s*<div class="ct-main-img-w">\s*<img[\s\S]*?\/?>\s*<\/div>\s*<\/div>/i;

if (imageBlock.test(html)) {
  html = html.replace(imageBlock, '');
}

const layoutFix = `
<style id="lmsgen-contact-without-image">
  .ct-main-form-c {
    width: 100% !important;
    max-width: 100% !important;
  }
  .ct-main-form-w {
    width: 100% !important;
  }
</style>`;

if (!html.includes('id="lmsgen-contact-without-image"')) {
  html = html.replace(/<\/head>/i, `${layoutFix}\n</head>`);
}

await fs.writeFile(contactPath, html, 'utf8');
console.log('Removed Contact page image and expanded the form area.');
