const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

describe('SCORM campaign route contract', () => {
    it('uses a dedicated non-ID endpoint for campaign creation data', () => {
        const indexSource = fs.readFileSync(path.join(__dirname, '..', 'routes', 'scorm', 'index.js'), 'utf8');
        const clientSource = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'src', 'pages', 'Scorm', 'CampaignCreate.jsx'), 'utf8');
        expect(indexSource).to.include("router.use('/campaign-create-options'");
        expect(clientSource).to.include("apiUrl('/api/scorm/campaign-create-options')");
        expect(clientSource).not.to.include("apiUrl('/api/scorm/campaigns/create-options')");
    });

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

    it('routes new videos through course authoring instead of the retired standalone library', () => {
        const appSource = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'src', 'App.jsx'), 'utf8');
        const shellSource = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'src', 'pages', 'Scorm', 'ScormPlatformShell.jsx'), 'utf8');
        const campaignSource = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'src', 'pages', 'Scorm', 'CampaignCreate.jsx'), 'utf8');
        const optionsSource = fs.readFileSync(path.join(__dirname, '..', 'routes', 'scorm', 'campaignCreateOptions.js'), 'utf8');

        expect(appSource).to.include('to="/scorm/author?mode=video"');
        expect(shellSource).not.to.include("to: '/scorm/videos'");
        expect(campaignSource).not.to.include('videoSelections');
        expect(optionsSource).not.to.include('listVideos');
    });
});
