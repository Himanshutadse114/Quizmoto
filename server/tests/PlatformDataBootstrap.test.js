const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

const bootstrapPath = path.join(__dirname, '..', '..', 'client', 'src', 'components', 'PlatformDataBootstrap.jsx');

describe('Platform data bootstrap', () => {
    const source = fs.readFileSync(bootstrapPath, 'utf8');

    it('never renders a blocking preparation screen', () => {
        expect(source).to.include('return null;');
        expect(source).not.to.include('Preparing your platform');
        expect(source).not.to.include('role="progressbar"');
        expect(source).not.to.include('fixed inset-0');
    });

    it('continues to warm platform data in the background', () => {
        expect(source).to.include('warmScormPlatformData(token');
        expect(source).to.include('BACKGROUND_REFRESH_MS');
        expect(source).to.include('includeHeavy: false');
        expect(source).to.include('window.setInterval(refreshVisibleData, BACKGROUND_REFRESH_MS)');
    });

    it('deduplicates overlapping cache warm-up requests', () => {
        expect(source).to.include('if (warmPromise) return warmPromise;');
        expect(source).to.include('if (warmPromise === request) warmPromise = null;');
    });
});
