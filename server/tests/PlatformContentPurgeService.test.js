const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const {
    PURGE_CONFIRMATION,
    COURSE_STORAGE_PREFIXES,
    PUBLICA_STORAGE_PREFIXES,
    deleteEntirePrefix,
    purgeAllLearningContent
} = require('../services/scorm/PlatformContentPurgeService');

const MODEL_NAMES = [
    'ScormPackage',
    'ScormCourse',
    'ScormRegistration',
    'ScormAttempt',
    'ScormCmiState',
    'ScormRuntimeSnapshot',
    'ScormXapiStatement',
    'ScormCampaignCourse',
    'ScormGenerationJob',
    'ScormAiUsageEvent',
    'ScormCourseCatalogGrant',
    'ScormCourseProvision',
    'Flipbook',
    'FlipbookTenantLink',
    'FlipbookReaderContext',
    'FlipbookReaderEvent',
    'FlipbookReaderSession',
    'ScormCampaignFlipbook',
    'ScormFlipbookAssignment'
];

function fakeDependencies({ storage } = {}) {
    const calls = [];
    const counts = {
        ScormCourse: 7,
        ScormPackage: 6,
        Flipbook: 5,
        ScormRegistration: 4,
        ScormFlipbookAssignment: 3
    };
    const models = Object.fromEntries(MODEL_NAMES.map((name) => [name, {
        count: async () => counts[name] || 0,
        destroy: async () => { calls.push(`destroy:${name}`); return 1; },
        update: async (values) => { calls.push(`update:${name}:${JSON.stringify(values)}`); return [1]; }
    }]));
    return {
        calls,
        ensureSchema: async () => { calls.push('schema'); },
        sequelize: {
            transaction: async (callback) => callback({ id: 'transaction' })
        },
        generationManager: {
            cancelAll: async () => ({ cancelled: 2 }),
            waitForIdle: async () => ({ idle: true, active: 0, queued: 0 })
        },
        storage: storage || {
            deletePrefix: async (prefix) => {
                calls.push(`storage:${prefix}`);
                return { deleted: calls.filter((item) => item === `storage:${prefix}`).length === 1 ? 2 : 0 };
            }
        },
        models
    };
}

describe('PlatformContentPurgeService', () => {
    it('uses a deliberate confirmation phrase and a Super Admin-only endpoint', () => {
        expect(PURGE_CONFIRMATION).to.equal('DELETE ALL COURSES AND PUBLICA');
        const route = fs.readFileSync(path.join(__dirname, '../routes/scorm/access.js'), 'utf8');
        expect(route).to.include("router.post('/purge-learning-content', auth, requireSuperAdmin");
        expect(route).to.include('acknowledgeIrreversible !== true');
        const middleware = fs.readFileSync(path.join(__dirname, '../routes/middleware.js'), 'utf8');
        expect(middleware).to.include('isPlatformContentPurgeActive()');
        expect(middleware).to.include("url !== '/api/scorm/access/purge-learning-content'");
    });

    it('deletes all course and Publica records, preserves the AI credit ledger, and clears storage prefixes', async () => {
        const dependencies = fakeDependencies();
        const result = await purgeAllLearningContent({ actorEmail: 'super@example.com', dependencies });

        expect(result.ok).to.equal(true);
        expect(result.counts).to.deep.equal({
            courses: 7,
            packages: 6,
            publications: 5,
            courseRegistrations: 4,
            publicaAssignments: 3
        });
        expect(result.cancelledGenerationJobs).to.equal(2);
        expect(result.storageObjectsDeleted).to.equal(10);
        expect(dependencies.calls).to.include('update:ScormAiUsageEvent:{"packageId":null,"courseId":null}');
        expect(dependencies.calls).not.to.include('destroy:ScormAiUsageEvent');
        expect(dependencies.calls).to.include('destroy:ScormCourse');
        expect(dependencies.calls).to.include('destroy:Flipbook');
        for (const prefix of [...COURSE_STORAGE_PREFIXES, ...PUBLICA_STORAGE_PREFIXES]) {
            expect(dependencies.calls.filter((item) => item === `storage:${prefix}`)).to.have.length(2);
        }
    });

    it('keeps deleting a prefix until a paginated R2 listing is empty', async () => {
        const batches = [10000, 10000, 25, 0];
        const result = await deleteEntirePrefix({
            deletePrefix: async () => ({ deleted: batches.shift() })
        }, 'scorm/packages/');
        expect(result.deleted).to.equal(20025);
        expect(result.passes).to.equal(4);
    });

    it('does not report success when R2 lists objects but deletes none', async () => {
        let error;
        try {
            await deleteEntirePrefix({
                deletePrefix: async () => ({ deleted: 0, keys: 3 })
            }, 'flipbooks/');
        } catch (caught) {
            error = caught;
        }
        expect(error).to.exist;
        expect(error.message).to.include('could not delete 3 object(s)');
    });

    it('reports partial R2 cleanup so an idempotent retry can finish it', async () => {
        const dependencies = fakeDependencies({
            storage: {
                deletePrefix: async (prefix) => {
                    if (prefix === 'flipbooks/') throw new Error('R2 unavailable');
                    return { deleted: 0 };
                }
            }
        });

        let error;
        try {
            await purgeAllLearningContent({ dependencies });
        } catch (caught) {
            error = caught;
        }
        expect(error).to.exist;
        expect(error.code).to.equal('PLATFORM_PURGE_STORAGE_INCOMPLETE');
        expect(error.status).to.equal(502);
        expect(error.result.storageFailures).to.deep.equal([{ prefix: 'flipbooks/', message: 'R2 unavailable' }]);
    });
});
