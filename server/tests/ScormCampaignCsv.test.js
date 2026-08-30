const assert = require('assert');
const { parseCampaignCsv } = require('../services/scorm/ScormCampaignService');

describe('SCORM campaign CSV parser', () => {
    it('parses and deduplicates learner emails', () => {
        const result = parseCampaignCsv([
            'Email,Name',
            'User@One.com,User One',
            'user@one.com,Duplicate',
            'two@company.com,User Two'
        ].join('\n'));

        assert.strictEqual(result.learners.length, 2);
        assert.deepStrictEqual(result.learners[0], { email: 'user@one.com', learnerName: 'User One' });
        assert.deepStrictEqual(result.learners[1], { email: 'two@company.com', learnerName: 'User Two' });
    });

    it('supports quoted CSV values and first/last name columns', () => {
        const result = parseCampaignCsv([
            'Email,First Name,Last Name',
            'learner@company.com,"Jane, QA",Doe'
        ].join('\n'));

        assert.strictEqual(result.learners[0].email, 'learner@company.com');
        assert.strictEqual(result.learners[0].learnerName, 'Jane, QA Doe');
    });

    it('reports invalid rows while keeping valid learners', () => {
        const result = parseCampaignCsv([
            'Email,Name',
            'not-an-email,Bad',
            'valid@company.com,Good'
        ].join('\n'));

        assert.strictEqual(result.learners.length, 1);
        assert.strictEqual(result.invalidRows.length, 1);
        assert.strictEqual(result.invalidRows[0].row, 2);
        assert.strictEqual(result.invalidRows[0].reason, 'Invalid email address');
    });

    it('requires an email header', () => {
        assert.throws(
            () => parseCampaignCsv('Name,Department\nLearner,IT'),
            /Email column/i
        );
    });
});
