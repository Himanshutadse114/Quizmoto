const { expect } = require('chai');
const { buildAwarenessCampaignReport } = require('../services/awareness/AwarenessEmailCampaignReportService');

describe('AwarenessEmailCampaignReportService', () => {
    it('builds a Python-report payload with campaign and recipient evidence', () => {
        const report = buildAwarenessCampaignReport({
            name: 'October Awareness',
            templateTitle: 'Social Media Threats',
            recipientCount: 2,
            sentCount: 2,
            deliveredCount: 1,
            failedCount: 1,
            recipients: [
                {
                    learnerName: 'Asha',
                    email: 'asha@example.com',
                    status: 'delivered',
                    sentAt: '2026-10-01T10:00:00.000Z'
                },
                { learnerName: 'Ravi', email: 'ravi@example.com', status: 'failed', errorCode: 'BOUNCED' }
            ]
        });

        expect(report.schemaVersion).to.equal('lmsgen-report-v2');
        expect(report.reportType).to.equal('awareness-email-campaign');
        expect(report.summary.some((item) => item.label === 'Tracked opens')).to.equal(false);
        expect(report.columns.some((item) => /open/i.test(item.label))).to.equal(false);
        expect(report.rows).to.have.length(2);
        expect(report.rows[0]).to.include({ recipient: 'Asha', status: 'Delivered' });
        expect(report.rows[0]).not.to.have.any.keys('opens', 'firstOpen', 'lastOpen');
        expect(report.rows[1]).to.include({ recipient: 'Ravi', status: 'Failed', error: 'BOUNCED' });
    });
});
