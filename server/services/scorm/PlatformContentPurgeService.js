const { sequelize } = require('../../config/database');
const {
    ScormPackage,
    ScormCourse,
    ScormRegistration,
    ScormAttempt,
    ScormCmiState,
    ScormRuntimeSnapshot,
    ScormXapiStatement,
    ScormCampaignCourse,
    ScormGenerationJob,
    ScormAiUsageEvent,
    ScormCourseCatalogGrant,
    ScormCourseProvision
} = require('../../models/scorm');
const Flipbook = require('../../models/Flipbook');
const FlipbookTenantLink = require('../../models/FlipbookTenantLink');
const FlipbookReaderContext = require('../../models/FlipbookReaderContext');
const FlipbookReaderEvent = require('../../models/FlipbookReaderEvent');
const FlipbookReaderSession = require('../../models/FlipbookReaderSession');
const ScormCampaignFlipbook = require('../../models/scorm/ScormCampaignFlipbook');
const ScormFlipbookAssignment = require('../../models/scorm/ScormFlipbookAssignment');
const { getObjectStorage } = require('../../storage/ObjectStorage');
const ScormAiGenerationManager = require('../../jobs/ScormAiGenerationManager');
const logger = require('../../utils/logger');

const PURGE_CONFIRMATION = 'DELETE ALL COURSES AND PUBLICA';
const COURSE_STORAGE_PREFIXES = Object.freeze([
    'scorm/packages/',
    'scorm/sources/',
    'ai-author/source/',
    'direct-uploads/video-courses/'
]);
const PUBLICA_STORAGE_PREFIXES = Object.freeze(['flipbooks/']);

let purgePromise = null;

function defaultDependencies() {
    return {
        sequelize,
        storage: getObjectStorage(),
        generationManager: ScormAiGenerationManager,
        ensureSchema: () => Promise.all([
            Flipbook.sync(),
            FlipbookTenantLink.sync(),
            FlipbookReaderContext.sync(),
            FlipbookReaderEvent.sync(),
            FlipbookReaderSession.sync(),
            ScormCampaignFlipbook.sync(),
            ScormFlipbookAssignment.sync()
        ]),
        models: {
            ScormPackage,
            ScormCourse,
            ScormRegistration,
            ScormAttempt,
            ScormCmiState,
            ScormRuntimeSnapshot,
            ScormXapiStatement,
            ScormCampaignCourse,
            ScormGenerationJob,
            ScormAiUsageEvent,
            ScormCourseCatalogGrant,
            ScormCourseProvision,
            Flipbook,
            FlipbookTenantLink,
            FlipbookReaderContext,
            FlipbookReaderEvent,
            FlipbookReaderSession,
            ScormCampaignFlipbook,
            ScormFlipbookAssignment
        }
    };
}

async function destroyAll(model, transaction) {
    return model.destroy({ where: {}, transaction });
}

async function deleteEntirePrefix(storage, prefix) {
    let deleted = 0;
    let passes = 0;
    if (typeof storage.deletePrefix === 'function') {
        // S3/R2 listings are capped per request. Repeat until the prefix is empty.
        while (passes < 10000) {
            passes += 1;
            const result = await storage.deletePrefix(prefix);
            const removed = Math.max(0, Number(result?.deleted || 0));
            const listed = Number(result?.keys);
            deleted += removed;
            if (removed === 0) {
                if (Number.isFinite(listed) && listed > 0) {
                    throw new Error(`Object storage could not delete ${listed} object(s) under ${prefix}`);
                }
                return { prefix, deleted, passes };
            }
        }
        throw new Error(`Object cleanup did not converge for ${prefix}`);
    }

    if (typeof storage.listKeys !== 'function' || typeof storage.deleteObject !== 'function') {
        throw new Error('Object storage does not support prefix deletion.');
    }
    while (passes < 10000) {
        passes += 1;
        const keys = await storage.listKeys(prefix);
        if (!keys.length) return { prefix, deleted, passes };
        await Promise.all(keys.map((key) => storage.deleteObject(key)));
        deleted += keys.length;
    }
    throw new Error(`Object cleanup did not converge for ${prefix}`);
}

async function purgeDatabase(dependencies) {
    const m = dependencies.models;
    const counts = {
        courses: await m.ScormCourse.count(),
        packages: await m.ScormPackage.count(),
        publications: await m.Flipbook.count(),
        courseRegistrations: await m.ScormRegistration.count(),
        publicaAssignments: await m.ScormFlipbookAssignment.count()
    };

    await dependencies.sequelize.transaction(async (transaction) => {
        // Reader and SCORM runtime evidence must be removed before their parents.
        await destroyAll(m.FlipbookReaderContext, transaction);
        await destroyAll(m.FlipbookReaderEvent, transaction);
        await destroyAll(m.FlipbookReaderSession, transaction);
        await destroyAll(m.ScormFlipbookAssignment, transaction);
        await destroyAll(m.ScormCampaignFlipbook, transaction);
        await destroyAll(m.FlipbookTenantLink, transaction);
        await destroyAll(m.Flipbook, transaction);

        await destroyAll(m.ScormXapiStatement, transaction);
        await destroyAll(m.ScormRuntimeSnapshot, transaction);
        await destroyAll(m.ScormCmiState, transaction);
        await destroyAll(m.ScormAttempt, transaction);
        await destroyAll(m.ScormRegistration, transaction);
        await destroyAll(m.ScormCampaignCourse, transaction);
        await destroyAll(m.ScormCourseCatalogGrant, transaction);
        await destroyAll(m.ScormCourseProvision, transaction);

        // Usage is an audit/credit ledger and intentionally survives course deletion.
        await m.ScormAiUsageEvent.update(
            { packageId: null, courseId: null },
            { where: {}, transaction }
        );
        await destroyAll(m.ScormCourse, transaction);
        await destroyAll(m.ScormPackage, transaction);
        await destroyAll(m.ScormGenerationJob, transaction);
    });
    return counts;
}

async function runPurge({ actorEmail = null, dependencies = defaultDependencies() } = {}) {
    if (typeof dependencies.ensureSchema === 'function') await dependencies.ensureSchema();
    const cancellation = await dependencies.generationManager.cancelAll();
    const idle = await dependencies.generationManager.waitForIdle(6000);
    if (!idle.idle) {
        const error = new Error('Course generation is still stopping. Wait a few seconds and run the purge again.');
        error.status = 409;
        error.code = 'PLATFORM_PURGE_GENERATION_ACTIVE';
        throw error;
    }

    const counts = await purgeDatabase(dependencies);
    const storageResults = [];
    const storageFailures = [];
    for (const prefix of [...COURSE_STORAGE_PREFIXES, ...PUBLICA_STORAGE_PREFIXES]) {
        try {
            storageResults.push(await deleteEntirePrefix(dependencies.storage, prefix));
        } catch (error) {
            storageFailures.push({ prefix, message: error.message });
        }
    }

    const result = {
        ok: storageFailures.length === 0,
        counts,
        cancelledGenerationJobs: cancellation.cancelled,
        storageObjectsDeleted: storageResults.reduce((sum, item) => sum + item.deleted, 0),
        storagePrefixes: storageResults.map((item) => ({ prefix: item.prefix, deleted: item.deleted })),
        storageFailures
    };
    logger.warn('platform_learning_content_purged', {
        module: 'scorm',
        actorEmail,
        ...result
    });

    if (storageFailures.length) {
        const error = new Error('Courses and Publica were removed from the platform database, but some R2 objects could not be deleted. Run the purge again to finish storage cleanup.');
        error.status = 502;
        error.code = 'PLATFORM_PURGE_STORAGE_INCOMPLETE';
        error.result = result;
        throw error;
    }
    return result;
}

async function purgeAllLearningContent(options = {}) {
    if (purgePromise) {
        const error = new Error('A platform content purge is already running.');
        error.status = 409;
        error.code = 'PLATFORM_PURGE_IN_PROGRESS';
        throw error;
    }
    purgePromise = runPurge(options);
    try {
        return await purgePromise;
    } finally {
        purgePromise = null;
    }
}

function isPlatformContentPurgeActive() {
    return Boolean(purgePromise);
}

module.exports = {
    PURGE_CONFIRMATION,
    COURSE_STORAGE_PREFIXES,
    PUBLICA_STORAGE_PREFIXES,
    deleteEntirePrefix,
    isPlatformContentPurgeActive,
    purgeAllLearningContent
};
