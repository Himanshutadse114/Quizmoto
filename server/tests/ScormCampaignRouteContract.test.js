const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

describe('SCORM campaign route contract', () => {
    it('matches create-options before every campaign UUID route', () => {
        for (const file of ['campaignFlipbooks.js', 'campaigns.js']) {
            const source = fs.readFileSync(path.join(__dirname, '../routes/scorm', file), 'utf8');
            const staticRoute = source.indexOf("router.get('/create-options'");
            const firstDynamicRoute = source.indexOf("router.get('/:campaignId");
            expect(staticRoute, `${file} must define create-options`).to.be.greaterThan(-1);
            expect(firstDynamicRoute, `${file} must define campaign routes`).to.be.greaterThan(-1);
            expect(staticRoute, `${file} must keep create-options ahead of /:campaignId`).to.be.lessThan(firstDynamicRoute);
            expect(source).to.include("router.param('campaignId'");
            expect(source).to.include('SCORM_CAMPAIGN_NOT_FOUND');
        }
    });
});
