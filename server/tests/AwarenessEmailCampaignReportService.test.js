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
            openedCount: 1,
            recipients: [
                {
                    learnerName: 'Asha',
                    email: 'asha@example.com',
                    status: 'delivered',
                    sentAt: '2026-10-01T10:00:00.000Z',
                    openedAt: '2026-10-01T10:05:00.000Z',
                    lastOpenedAt: '2026-10-01T10:06:00.000Z',
                    openCount: 2
                },
                { learnerName: 'Ravi', email: 'ravi@example.com', status: 'failed', errorCode: 'BOUNCED' }
            ]
        });

        expect(report.schemaVersion).to.equal('lmsgen-report-v2');
        expect(report.reportType).to.equal('awareness-email-campaign');
        expect(report.summary.find((item) => item.label === 'Tracked opens').value).to.equal(1);
        expect(report.rows).to.have.length(2);
        expect(report.rows[0]).to.include({ recipient: 'Asha', status: 'Tracked open', opens: 2 });
        expect(report.rows[1]).to.include({ recipient: 'Ravi', status: 'Failed', error: 'BOUNCED' });
    });

    it('uses the same authoritative tracked-open total shown by the campaign dashboard', () => {
        const report = buildAwarenessCampaignReport({
            name: 'Dashboard parity',
            recipientCount: 3,
            openedCount: 2,
            recipients: []
        });

        expect(report.summary.find((item) => item.label === 'Tracked opens').value).to.equal(2);
    });
});
