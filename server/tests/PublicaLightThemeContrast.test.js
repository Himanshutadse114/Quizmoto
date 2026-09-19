const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

function source(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('Publica light-theme contrast', () => {
    it('uses the shared theme ink token for Publica controls and page text', () => {
        const flipbooks = source('../client/src/pages/Scorm/flipbooks.css');
        const analytics = source('../client/src/pages/Scorm/flipbookAnalytics.css');

        expect(flipbooks).to.include('color:var(--scorm-ink,#eef7ff)');
        expect(analytics).to.include('color:var(--scorm-ink,#eef7ff)');
        expect(`${flipbooks}\n${analytics}`).not.to.include('var(--scorm-text');
    });
});
