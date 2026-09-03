import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const contactPath = path.resolve(scriptDir, '..', 'dist', 'landing', 'contact', 'index.html');
const SCRIPT_SRC = '/landing/js/contact-form.js?v=20260903-contact1';

let html = await fs.readFile(contactPath, 'utf8');
if (!html.includes('/landing/js/contact-form.js')) {
  html = html.replace(/<\/body>/i, `    <script src="${SCRIPT_SRC}"></script>\n  </body>`);
  await fs.writeFile(contactPath, html, 'utf8');
}

console.log('Wired LMSGEN Contact page form to the SMTP enquiry API.');
