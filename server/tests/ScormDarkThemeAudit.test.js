const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

function clientSource(relativePath) {
    return fs.readFileSync(path.join(__dirname, '../../client/src', relativePath), 'utf8');
}

describe('SCORM original dark theme', () => {
    it('no longer loads the high-contrast override', () => {
        const app = clientSource('App.jsx');
        expect(app).not.to.include("import './pages/Scorm/scormDarkContrastGuard.css'");
        expect(app).to.include("import './pages/Scorm/scormReferenceTheme.css'");
    });

    it('retains the original teal canvas, subtle borders and authentication palette', () => {
        const css = clientSource('pages/Scorm/scormReferenceTheme.css');
        expect(css).to.include('--sai-paper: #0A0F0E');
        expect(css).to.include('--sai-ink-soft: #A9BAB6');
        expect(css).to.include('--sai-line: rgba(255,255,255,.10)');
        const auth = clientSource('pages/Scorm/scormAuthTealRestore.css');
        expect(auth).to.include('--sa-bg: #0A0F0E');
        expect(auth).to.include('--sa-orange: #4FC9BF');
    });
});
