const { expect } = require('chai');
const crypto = require('crypto');
const { sequelize } = require('../config/database');
const LearningState = require('../services/scorm/ScormLearningStateService');

const describePostgres = sequelize.getDialect() === 'postgres' ? describe : describe.skip;

describePostgres('SCORM v2 learning state PostgreSQL persistence', function () {
    this.timeout(15000);
    const registrationId = crypto.randomUUID();

    before(async () => {
        await sequelize.authenticate();
        LearningState.resetReadyForTests();
        await LearningState.ensureReady();
    });

    after(async () => {
        try {
            await LearningState.destroyState(registrationId);
        } finally {
            await sequelize.close();
        }
    });

    it('round-trips a full SCORM state document and rejects stale revisions', async () => {
        await LearningState.persistDocument(registrationId, {
            clientRevision: 5,
            values: {
                'cmi.core.lesson_status': 'incomplete',
                'cmi.core.lesson_location': '4',
                'cmi.core.score.raw': '80',
                'cmi.suspend_data': '{"screen":4}',
                'cmi.progress_measure': '0.4'
            }
        });

        const firstMap = await LearningState.listByRegistrationIds([registrationId]);
        const first = firstMap.get(registrationId);
        expect(first.lessonStatus).to.equal('incomplete');
        expect(first.lessonLocation).to.equal('4');
        expect(first.scoreRaw).to.equal(80);
        expect(first.progressPercent).to.equal(40);
        expect(first.clientRevision).to.equal(5);
        expect(first.values['cmi.suspend_data']).to.equal('{"screen":4}');

        await LearningState.persistDocument(registrationId, {
            clientRevision: 8,
            values: {
                'cmi.core.lesson_status': 'completed',
                'cmi.core.lesson_location': '9',
                'cmi.core.score.raw': '92',
                'cmi.suspend_data': '{"screen":9}',
                'cmi.progress_measure': '1'
            }
        });

        // Simulate a delayed pagehide/beacon request arriving after revision 8.
        await LearningState.persistDocument(registrationId, {
            clientRevision: 6,
            values: {
                'cmi.core.lesson_status': 'incomplete',
                'cmi.core.lesson_location': '5',
                'cmi.core.score.raw': '81',
                'cmi.progress_measure': '0.5'
            }
        });

        const finalMap = await LearningState.listByRegistrationIds([registrationId]);
        const finalState = finalMap.get(registrationId);
        expect(finalState.lessonStatus).to.equal('completed');
        expect(finalState.lessonLocation).to.equal('9');
        expect(finalState.scoreRaw).to.equal(92);
        expect(finalState.progressPercent).to.equal(100);
        expect(finalState.clientRevision).to.equal(8);

        const [rows] = await sequelize.query(
            'SELECT COUNT(*)::int AS count FROM scorm_learning_state_v2 WHERE registration_id = :registrationId',
            { replacements: { registrationId } }
        );
        expect(rows[0].count).to.equal(1);
    });
});
