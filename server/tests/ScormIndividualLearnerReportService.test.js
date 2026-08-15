const { expect } = require('chai');
const { ScormRegistration } = require('../models/scorm');
const {
    loadLearnerRegistrations,
    searchLearners
} = require('../services/scorm/ScormIndividualLearnerReportService');

describe('ScormIndividualLearnerReportService', () => {
    const originalFindAll = ScormRegistration.findAll;

    afterEach(() => {
        ScormRegistration.findAll = originalFindAll;
    });

    it('scopes exact learner report lookup to the authenticated host and excludes previews', async () => {
        let query = null;
        ScormRegistration.findAll = async (options) => {
            query = options;
            return [];
        };

        let error = null;
        try {
            await loadLearnerRegistrations(42, 'Learner@Example.com');
        } catch (err) {
            error = err;
        }

        expect(error).to.exist;
        expect(error.code).to.equal('LEARNER_NOT_FOUND');
        expect(query.where.isPreview).to.equal(false);
        expect(query.include).to.have.length(1);
        expect(query.include[0].as).to.equal('course');
        expect(query.include[0].required).to.equal(true);
        expect(query.include[0].where.hostId).to.equal(42);
    });

    it('scopes learner search to the authenticated host', async () => {
        let query = null;
        ScormRegistration.findAll = async (options) => {
            query = options;
            return [];
        };

        const rows = await searchLearners(77, 'alice');
        expect(rows).to.deep.equal([]);
        expect(query.where.isPreview).to.equal(false);
        expect(query.include[0].where.hostId).to.equal(77);
        expect(query.limit).to.equal(250);
    });
});
