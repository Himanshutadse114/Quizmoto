const { expect } = require('chai');
const crypto = require('crypto');
const { sequelize } = require('../config/database');
const RuntimeStore = require('../services/scorm/ScormRuntimeSnapshotStore');

describe('SCORM runtime PostgreSQL snapshot persistence', function () {
    this.timeout(15000);

    const registrationId = crypto.randomUUID();

    before(async () => {
        expect(sequelize.getDialect()).to.equal('postgres');
        await sequelize.authenticate();
        RuntimeStore.resetReadyForTests();
        await RuntimeStore.ensureReady();
    });

    after(async () => {
        try {
            await RuntimeStore.destroy(registrationId);
        } finally {
            await sequelize.close();
        }
    });

    it('persists and updates the same registration atomically', async () => {
        const initial = RuntimeStore.defaultState();
        initial.initialized = true;
        initial.lessonStatus = 'incomplete';
        initial.lessonLocation = '4';
        initial.rawMapJson = JSON.stringify({
            'cmi.progress_measure': '0.4',
            'cmi.core.lesson_location': '4'
        });

        await RuntimeStore.save(registrationId, initial, { projectLegacy: false });
        const first = await RuntimeStore.load(registrationId);

        expect(first.initialized).to.equal(true);
        expect(first.lessonStatus).to.equal('incomplete');
        expect(first.lessonLocation).to.equal('4');
        expect(JSON.parse(first.rawMapJson)['cmi.progress_measure']).to.equal('0.4');

        first.lessonStatus = 'completed';
        first.lessonLocation = '9';
        first.stateVersion = 1;
        first.totalTime = '00:03:12.00';

        await RuntimeStore.save(registrationId, first, { projectLegacy: false });
        const second = await RuntimeStore.load(registrationId);

        expect(second.lessonStatus).to.equal('completed');
        expect(second.lessonLocation).to.equal('9');
        expect(second.stateVersion).to.equal(1);
        expect(second.totalTime).to.equal('00:03:12.00');

        const [rows] = await sequelize.query(
            'SELECT COUNT(*)::int AS count FROM "scorm_runtime_snapshots" WHERE "registrationId" = :registrationId',
            { replacements: { registrationId } }
        );
        expect(rows[0].count).to.equal(1);
    });
});
