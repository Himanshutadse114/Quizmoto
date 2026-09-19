const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

function clientSource(relative) {
    return fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'src', relative), 'utf8');
}

describe('one-time platform startup preparation', () => {
    const app = clientSource('App.jsx');
    const auth = clientSource('context/AuthContext.jsx');
    const gate = clientSource('components/PlatformStartupGate.jsx');
    const session = clientSource('services/platformPreparationSession.js');
    const bootstrap = clientSource('components/PlatformDataBootstrap.jsx');
    const apiCache = clientSource('services/scormApiCache.js');
    const publica = clientSource('pages/Scorm/Flipbooks.jsx');
    const publicaLibrary = clientSource('pages/Scorm/FlipbookLibraryShare.jsx');
    const courseLibrary = clientSource('pages/Scorm/Library.jsx');
    const packagesRoute = fs.readFileSync(path.join(__dirname, '..', 'routes', 'scorm', 'packages.js'), 'utf8');

    it('runs the preparation gate inside authenticated platform routes', () => {
        expect(app).to.include('<PlatformStartupGate><ScormPlatformShell /></PlatformStartupGate>');
        expect(gate).to.include('warmScormPlatformData');
        expect(gate).to.include('includeHeavy: false');
        expect(gate).to.include('preloadInitialWorkspace');
    });

    it('marks only a fresh login for preparation and clears it after completion', () => {
        expect(auth).to.include('resolveFreshPlatformLogin');
        expect(auth).to.include('markPlatformPreparationPending');
        expect(session).to.include('window.sessionStorage.setItem');
        expect(session).to.include('window.sessionStorage.removeItem');
        expect(gate).to.include('markPlatformPreparationComplete');
    });

    it('prevents the normal background warmer from duplicating startup reads', () => {
        expect(bootstrap).to.include('isPlatformPreparationPending()');
        expect(bootstrap).to.include("'lmsgen-platform-prepared'");
    });

    it('hydrates Publica from the data prepared behind the login loader', () => {
        expect(apiCache).to.include("dataKey: 'flipbooks'");
        expect(apiCache).to.include("dataKey: 'flipbook-library'");
        expect(publica).to.include("peekScormData('flipbooks', token)");
        expect(publicaLibrary).to.include("peekScormData('flipbook-library', token)");
    });

    it('does not expose editable shared-library URLs', () => {
        expect(publicaLibrary).not.to.include('Custom library link');
        expect(publicaLibrary).not.to.include('shareSlug');
    });

    it('keeps full authored course JSON out of package inventory reads', () => {
        const inventoryRoute = packagesRoute.slice(
            packagesRoute.indexOf("router.get('/', auth"),
            packagesRoute.indexOf("router.get('/:id/download-link'")
        );
        expect(inventoryRoute).to.include("attributes: [");
        expect(inventoryRoute).not.to.include("'analysisJson'");
        expect(courseLibrary).not.to.include("p?.analysisJson");
        expect(courseLibrary).to.include("p?.source === 'ai_author'");
    });

    it('does not re-query administrative tracking on every route change', () => {
        expect(apiCache).to.include("if (clean.includes('/active-sessions')) return 15_000");
        expect(apiCache).to.include("if (clean.includes('/tracking') || clean.includes('/analytics')) return 60_000");
    });
});
