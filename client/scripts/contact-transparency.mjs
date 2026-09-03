import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const landingRoot = path.resolve(scriptDir, '..', 'dist', 'landing');

const businessBlock = `<address class="lmsgen-business-identity">
  <strong>LMSGEN</strong>
  <span>AI-powered web learning management platform</span>
  <span>Website: <a href="https://www.lmsgen.in/">www.lmsgen.in</a></span>
  <span>Service scope: organisations and learning teams worldwide</span>
  <a class="lmsgen-business-contact" href="/contact">Contact the LMSGEN team</a>
</address>`;

const style = `<style id="lmsgen-business-identity-style">
.lmsgen-business-identity{display:flex;flex-direction:column;gap:.55rem;margin:2.4rem 0 0;padding:1.8rem;border:1px solid rgba(7,63,58,.14);border-radius:1.4rem;background:rgba(255,255,255,.72);color:#395e59;font-style:normal;font-size:1.35rem;line-height:1.5}.lmsgen-business-identity strong{color:#073f3a;font-size:1.55rem}.lmsgen-business-identity a{color:#0b6259;font-weight:700;text-decoration:underline;text-underline-offset:.2em}.lmsgen-contact-transparency{padding:7rem 2.4rem;background:#edf7f5;color:#073f3a}.lmsgen-contact-transparency-inner{width:min(102rem,100%);margin:0 auto}.lmsgen-contact-transparency h2{margin:0;color:#073f3a;font-size:clamp(3rem,4vw,5.2rem);line-height:1.05;letter-spacing:-.03em}.lmsgen-contact-transparency p{max-width:72rem;margin:1.8rem 0 0;color:#4d6c67;font-size:1.65rem;line-height:1.6}@media(max-width:640px){.lmsgen-contact-transparency{padding:5.5rem 1.8rem}}
</style>`;

async function ensureStyle(filePath, html) {
  if (!html.includes('id="lmsgen-business-identity-style"')) {
    html = html.replace(/<\/head>/i, `  ${style}\n</head>`);
  }
  await fs.writeFile(filePath, html, 'utf8');
  return html;
}

const homePath = path.join(landingRoot, 'index.html');
let home = await fs.readFile(homePath, 'utf8');
home = await ensureStyle(homePath, home);
if (!home.includes('class="lmsgen-business-identity"')) {
  home = home.replace(
    /(<div class="lmsgen-audit-updated">[\s\S]*?<\/div>)/i,
    `$1\n${businessBlock}`,
  );
  await fs.writeFile(homePath, home, 'utf8');
}

const contactPath = path.join(landingRoot, 'contact', 'index.html');
let contact = await fs.readFile(contactPath, 'utf8');
contact = await ensureStyle(contactPath, contact);
if (!contact.includes('class="lmsgen-contact-transparency"')) {
  const section = `<section class="lmsgen-contact-transparency" aria-labelledby="lmsgen-contact-business-title"><div class="lmsgen-contact-transparency-inner"><h2 id="lmsgen-contact-business-title">LMSGEN business and contact information</h2><p>LMSGEN is a web-based learning management platform for L&D, compliance, training and security awareness teams. Use this page to contact the LMSGEN team about product access, SCORM delivery, learner campaigns or learning analytics.</p>${businessBlock}</div></section>`;
  contact = contact.replace(/<\/main>/i, `${section}\n</main>`);
  await fs.writeFile(contactPath, contact, 'utf8');
}

console.log('Added visible LMSGEN contact and business transparency signals.');
