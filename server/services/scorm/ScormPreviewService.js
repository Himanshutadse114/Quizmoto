const { sequelize } = require('../../config/database');
const {
    ScormCourse,
    ScormRegistration,
    ScormAttempt,
    ScormCmiState,
    ScormRuntimeSnapshot,
    ScormXapiStatement
} = require('../../models/scorm');

async function clearPreviewRuntime(registrationId, transaction = null) {
    const options = { where: { registrationId } };
    if (transaction) options.transaction = transaction;

    // The canonical snapshot is authoritative. Legacy CMI cleanup must never
    // stop an admin from starting a clean QA run if that historical table has
    // schema drift or corrupt rows.
    await ScormRuntimeSnapshot.destroy(options);
    try {
        await ScormCmiState.destroy(options);
    } catch (err) {
        console.warn('[scorm-preview] legacy CMI cleanup skipped', {
            registrationId,
            error: err?.message || String(err)
        });
    }
    await ScormAttempt.destroy(options);
    await ScormXapiStatement.destroy(options);
}

async function compactCoursePreviewRegistrations(courseId, transaction = null) {
    const query = {
        where: { courseId, isPreview: true },
        order: [['updatedAt', 'DESC']]
    };
    if (transaction) {
        query.transaction = transaction;
        query.lock = transaction.LOCK.UPDATE;
    }

    const previews = await ScormRegistration.findAll(query);
    const keep = previews[0] || null;
    const duplicates = previews.slice(1);

    for (const duplicate of duplicates) {
        await clearPreviewRuntime(duplicate.id, transaction);
        await duplicate.destroy(transaction ? { transaction } : undefined);
    }

    return {
        registration: keep,
        removedDuplicates: duplicates.length
    };
}

async function prepareCoursePreview(courseId) {
    return sequelize.transaction(async (transaction) => {
        const course = await ScormCourse.findByPk(courseId, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });
        if (!course) {
            const err = new Error('Course not found');
            err.code = 'COURSE_NOT_FOUND';
            throw err;
        }

        const compacted = await compactCoursePreviewRegistrations(courseId, transaction);
        let registration = compacted.registration;
        const reused = !!registration;

        if (!registration) {
            registration = await ScormRegistration.create({
                courseId,
                learnerName: 'Host Preview',
                learnerEmail: null,
                status: 'active',
                isPreview: true
            }, { transaction });
        } else {
            // Every admin preview starts clean while retaining one stable QA row.
            await clearPreviewRuntime(registration.id, transaction);
            registration.learnerName = 'Host Preview';
            registration.learnerEmail = null;
            registration.status = 'active';
            registration.isPreview = true;
            registration.lastLessonStatus = null;
            registration.lastScoreRaw = null;
            registration.lastTotalTime = null;
            registration.lastCommitAt = null;
            await registration.save({ transaction });
        }

        return {
            registration,
            reused,
            removedDuplicates: compacted.removedDuplicates
        };
    });
}

async function cleanupPreviewRegistrations() {
    const rows = await ScormRegistration.findAll({
        where: { isPreview: true },
        attributes: ['courseId']
    });
    const courseIds = [...new Set(rows.map((row) => String(row.courseId)).filter(Boolean))];
    let removedDuplicates = 0;

    for (const courseId of courseIds) {
        const result = await sequelize.transaction((transaction) =>
            compactCoursePreviewRegistrations(courseId, transaction)
        );
        removedDuplicates += result.removedDuplicates;
    }

    return { removedDuplicates, coursesChecked: courseIds.length };
}

module.exports = {
    prepareCoursePreview,
    cleanupPreviewRegistrations,
    compactCoursePreviewRegistrations,
    clearPreviewRuntime
};
