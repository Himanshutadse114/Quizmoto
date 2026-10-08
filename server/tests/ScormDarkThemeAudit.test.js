const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

function clientSource(relativePath) {
    return fs.readFileSync(path.join(__dirname, '../../client/src', relativePath), 'utf8');
}

describe('SCORM platform dark-theme contrast', () => {
    it('loads the final contrast guard for every platform route', () => {
        const app = clientSource('App.jsx');
        expect(app).to.include("import './pages/Scorm/scormDarkContrastGuard.css'");
    });

    it('strengthens text, borders, surfaces, and authentication controls', () => {
        const css = clientSource('pages/Scorm/scormDarkContrastGuard.css');
        expect(css).to.include('--scorm-dark-ink-soft: #CDDAD6');
        expect(css).to.include('--scorm-dark-ink-muted: #9DB0AB');
        expect(css).to.include('--scorm-dark-line: rgba(225, 244, 239, .20)');
        expect(css).to.include('.scorm-editorial.scorm-theme-dark');
        expect(css).to.include('.scorm-auth-workbench.scorm-theme-dark');
        expect(css).to.include('.sa-input::placeholder');
    });
});
