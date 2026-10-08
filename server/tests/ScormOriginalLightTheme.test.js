const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

const source = relativePath => fs.readFileSync(path.join(__dirname, '../../client/src', relativePath), 'utf8');

describe('LMSGEN original light theme', () => {
    it('restores the pre-high-contrast teal colours and subtle surfaces', () => {
        const css = source('lmsgenLightFinal.css');
        expect(css).to.include('--scorm-canvas: #f5f9f8');
        expect(css).to.include('--scorm-ink: #13211e');
        expect(css).to.include('--scorm-accent: #4fc9bf');
        expect(css).to.include('--scorm-line: #d8e5e2');
        expect(css).not.to.include('--scorm-canvas: #e7efed');
        expect(css).not.to.include('--scorm-canvas: #f2f5f1');
        expect(css).not.to.include('--sa-border-strong: #78928c');
    });

    it('uses the original light-mode text bridge rather than the later sage palette', () => {
        const css = source('pages/Scorm/scormLightContrastGuard.css');
        expect(css).to.include('--scorm-light-contrast-text: #14201E');
        expect(css).to.include('--scorm-light-contrast-body: #35514C');
        expect(css).to.include('--scorm-light-contrast-teal: #0B6259');
        expect(css).not.to.include('#2B3B36');
    });

    it('keeps current typography and shared spacing independent of theme restoration', () => {
        const main = source('main.jsx');
        expect(main).to.include("import('./platformUsability.css')");
        expect(main).to.include("import('./platformSections.css')");
        expect(source('pages/Scorm/ScormPlatformShell.jsx')).to.include('PlatformPageLayout');
    });
});
