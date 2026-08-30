const { parseCampaignCsv } = require('../services/scorm/ScormCampaignService');

describe('SCORM campaign CSV parser', () => {
    test('parses and deduplicates learner emails', () => {
        const result = parseCampaignCsv([
            'Email,Name',
            'User@One.com,User One',
            'user@one.com,Duplicate',
            'two@company.com,User Two'
        ].join('\n'));

        expect(result.learners).toHaveLength(2);
        expect(result.learners[0]).toEqual({ email: 'user@one.com', learnerName: 'User One' });
        expect(result.learners[1]).toEqual({ email: 'two@company.com', learnerName: 'User Two' });
    });

    test('supports quoted CSV values and first/last name columns', () => {
        const result = parseCampaignCsv([
            'Email,First Name,Last Name',
            'learner@company.com,"Jane, QA",Doe'
        ].join('\n'));

        expect(result.learners[0].email).toBe('learner@company.com');
        expect(result.learners[0].learnerName).toBe('Jane, QA Doe');
    });

    test('reports invalid rows while keeping valid learners', () => {
        const result = parseCampaignCsv([
            'Email,Name',
            'not-an-email,Bad',
            'valid@company.com,Good'
        ].join('\n'));

        expect(result.learners).toHaveLength(1);
        expect(result.invalidRows).toEqual([
            expect.objectContaining({ row: 2, reason: 'Invalid email address' })
        ]);
    });

    test('requires an email header', () => {
        expect(() => parseCampaignCsv('Name,Department\nLearner,IT')).toThrow(/Email column/i);
    });
});
