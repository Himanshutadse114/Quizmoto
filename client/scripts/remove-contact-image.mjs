import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const contactPath = path.resolve(scriptDir, '..', 'dist', 'landing', 'contact', 'index.html');

let html = await fs.readFile(contactPath, 'utf8');

const imageBlock = /\s*<div class="ct-main-info-c">\s*<div class="ct-main-img-w">\s*<img[\s\S]*?\/?>\s*<\/div>\s*<\/div>/i;

const contextPanel = `
            <aside class="ct-main-info-c lmsgen-contact-context" aria-label="How LMSGEN can help">
              <div class="lmsgen-contact-context-head">
                <span class="lmsgen-contact-kicker">HOW WE CAN HELP</span>
                <h2>From first draft to measurable learning.</h2>
                <p>Tell us what you are planning and we will point you to the right LMSGEN workflow.</p>
              </div>
              <div class="lmsgen-contact-capability-list">
                <div class="lmsgen-contact-capability">
                  <span class="lmsgen-contact-capability-number">01</span>
                  <div>
                    <h3>AI course creation</h3>
                    <p>Turn source material into structured, editable training.</p>
                  </div>
                </div>
                <div class="lmsgen-contact-capability">
                  <span class="lmsgen-contact-capability-number">02</span>
                  <div>
                    <h3>SCORM delivery</h3>
                    <p>Prepare standards-ready learning for your LMS and teams.</p>
                  </div>
                </div>
                <div class="lmsgen-contact-capability">
                  <span class="lmsgen-contact-capability-number">03</span>
                  <div>
                    <h3>Engagement and analytics</h3>
                    <p>Use Quizmoto, learner management and reporting in one workspace.</p>
                  </div>
                </div>
              </div>
              <div class="lmsgen-contact-response">
                <span class="lmsgen-contact-response-dot" aria-hidden="true"></span>
                <p><strong>What happens next</strong><br />We review your request and respond with the most relevant next step.</p>
              </div>
            </aside>`;

if (!html.includes('lmsgen-contact-context')) {
  if (imageBlock.test(html)) {
    html = html.replace(imageBlock, `\n${contextPanel}`);
  } else {
    const titleBlock = /(<div class="ct-main-form-title-w">[\s\S]*?<\/div>)/i;
    html = html.replace(titleBlock, `$1\n${contextPanel}`);
  }
}

if (!html.includes('lmsgen-contact-form-head')) {
  html = html.replace(
    /(<form\b[^>]*id="wf-form-Contact-Form"[^>]*>)/i,
    `$1\n                  <header class="lmsgen-contact-form-head">\n                    <h2>Send us a message</h2>\n                    <p>Share a few details and we will help you find the right way to use LMSGEN.</p>\n                  </header>`,
  );
}

html = html.replace(
  /By checking this you agree to our privacy policy and to marketing communication \(we promise not\s*send any spam\) you can unsubscribe at any time/i,
  'By selecting this box, you agree to our privacy policy and marketing communications. You can unsubscribe at any time.',
);

// Remove the old single-column patch if a previous generated build contains it.
html = html.replace(/\s*<style\s+id="lmsgen-contact-without-image">[\s\S]*?<\/style>\s*/i, '\n');

await fs.writeFile(contactPath, html, 'utf8');
console.log('Refined Contact page with product context and form hierarchy.');
