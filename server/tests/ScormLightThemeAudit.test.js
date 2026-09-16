const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

function clientSource(relativePath) {
    return fs.readFileSync(path.join(__dirname, '../../client/src', relativePath), 'utf8');
}

describe('SCORM platform light-theme audit', () => {
    it('does not force a nested dark theme in the presentation editor', () => {
        const source = clientSource('pages/Scorm/PresentationEditor.jsx');
        expect(source).to.include('scorm-presentation-editor');
        expect(source).to.not.include('scorm-theme-dark');
    });

    it('opts legacy admin surfaces into the scoped light-mode adapter', () => {
        for (const file of [
            'pages/Scorm/AuthorVisual.jsx',
            'pages/Scorm/FeatureLocked.jsx',
            'pages/Scorm/LearnerAuditDetail.jsx',
            'pages/Scorm/PendingHome.jsx'
        ]) {
            expect(clientSource(file), file).to.include('scorm-light-adapted');
        }

        const shell = clientSource('pages/Scorm/ScormPlatformShell.jsx');
        const detail = clientSource('pages/Scorm/CourseDetail.jsx');
        expect(shell).to.include('scorm-sidebar-profile');
        expect(detail).to.include('scorm-invite-panel');
        expect(detail).to.include('scorm-learner-expanded-row');
    });

    it('keeps compatibility overrides scoped to light mode', () => {
        const css = clientSource('lmsgenLightFinal.css');
        expect(css).to.include('.scorm-editorial.scorm-theme-light .scorm-light-adapted');
        expect(css).to.include('.scorm-editorial.scorm-theme-light .scorm-sidebar-profile');
        expect(css).to.include('.scorm-editorial.scorm-theme-light .scorm-invite-panel');
    });
});
