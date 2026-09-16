const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const ScormUserEntitlement = require('../../models/scorm/ScormUserEntitlement');
const {
    ScormAiUsageEvent,
    ScormCourse
} = require('../../models/scorm');

const COUNTED_AI_STATUSES = ['reserved', 'completed', 'failed', 'cancelled'];

function normalizeLimit(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : null;
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase() || null;
}

function deny(message, code) {
    const error = new Error(message);
    error.code = code;
    error.status = 403;
    return error;
}

function isBillableAiGenerationPayload(payload = {}) {
    const isReplacement = Boolean(payload.replacePackageId || payload.packageId);
    if (!isReplacement) return true;
    return payload.fullAiRegeneration === true
        || payload.regenerateAi === true
        || payload.regenerateVisuals === true;
}

function generationSource(payload = {}) {
    if (String(payload.courseMode || '').toLowerCase() === 'presentation') return 'presentation';
    if (payload.fullAiRegeneration === true || payload.regenerateAi === true || payload.regenerateVisuals === true) {
        return 'ai_regeneration';
    }
    return 'ai_author';
}

async function countAiGenerations(hostId, transaction = null) {
    if (!hostId) return 0;
    return ScormAiUsageEvent.count({
        where: {
            hostId,
            kind: 'course_generation',
            status: { [Op.in]: COUNTED_AI_STATUSES }
        },
        transaction
    });
}

async function countPendingActiveReservations(hostId, transaction = null) {
    if (!hostId) return 0;
    return ScormAiUsageEvent.count({
        where: { hostId, kind: 'course_generation', status: 'reserved', reservesActiveSlot: true },
        transaction
    });
}

async function activeCourseUsage(hostId, transaction = null) {
    const [courses, reservations] = await Promise.all([
        ScormCourse.count({
            where: { hostId, status: { [Op.ne]: 'archived' } },
            transaction
        }),
        countPendingActiveReservations(hostId, transaction)
    ]);
    return { courses, reservations, total: courses + reservations };
}

async function assertAiGenerationAvailable(hostId, entitlement, transaction = null) {
    const max = normalizeLimit(entitlement?.maxCourses);
    if (max === null) return;
    const consumed = await countAiGenerations(hostId, transaction);
    if (consumed >= max) {
        throw deny(
            `AI course-generation credits used (${consumed}/${max}). Deleting or archiving a course does not restore an AI credit.`,
            'SCORM_AI_GENERATION_LIMIT_REACHED'
        );
    }
}

async function assertActiveCourseCapacity(hostId, entitlement, transaction = null) {
    const max = normalizeLimit(entitlement?.maxActiveCourses);
    if (max === null) return;
    const usage = await activeCourseUsage(hostId, transaction);
    if (usage.total >= max) {
        throw deny(
            `Active course capacity reached (${usage.total}/${max}). Archive or delete a course to free a slot.`,
            'SCORM_ACTIVE_COURSE_LIMIT_REACHED'
        );
    }
}

async function reserveAiCourseGeneration({
    hostId,
    entitlementEmail,
    entitlement,
    operationKey,
    source = 'ai_author',
    reserveActiveSlot = true,
    metadata = {}
}) {
    if (!hostId || !operationKey) throw new Error('AI usage reservation requires a host and operation key.');

    const existing = await ScormAiUsageEvent.findOne({ where: { operationKey } });
    if (existing && existing.status !== 'released') return { event: existing, duplicate: true };

    try {
        return await sequelize.transaction(async (transaction) => {
            const email = normalizeEmail(entitlementEmail);
            if (email) {
                await ScormUserEntitlement.findOne({
                    where: { email },
                    transaction,
                    lock: transaction.LOCK.UPDATE
                });
            }

            const duplicate = await ScormAiUsageEvent.findOne({ where: { operationKey }, transaction });
            if (duplicate && duplicate.status !== 'released') return { event: duplicate, duplicate: true };

            await assertAiGenerationAvailable(hostId, entitlement, transaction);
            if (reserveActiveSlot) await assertActiveCourseCapacity(hostId, entitlement, transaction);

            const values = {
                hostId,
                entitlementEmail: email,
                operationKey,
                kind: 'course_generation',
                source,
                status: 'reserved',
                reservesActiveSlot: Boolean(reserveActiveSlot),
                metadata: metadata && typeof metadata === 'object' ? metadata : {}
            };
            if (duplicate) {
                Object.assign(duplicate, values);
                await duplicate.save({ transaction });
                return { event: duplicate, duplicate: false, reused: true };
            }
            const event = await ScormAiUsageEvent.create(values, { transaction });
            return { event, duplicate: false };
        });
    } catch (error) {
        if (error?.name === 'SequelizeUniqueConstraintError') {
            const duplicate = await ScormAiUsageEvent.findOne({ where: { operationKey } });
            if (duplicate) return { event: duplicate, duplicate: true };
        }
        throw error;
    }
}

async function finalizeAiCourseGeneration(operationKey, {
    status,
    packageId = null,
    courseId = null,
    metadata = null
} = {}) {
    if (!operationKey) return 0;
    const allowed = ['completed', 'failed', 'cancelled', 'released'];
    const nextStatus = allowed.includes(status) ? status : 'failed';
    const values = { status: nextStatus };
    if (packageId) values.packageId = packageId;
    if (courseId) values.courseId = courseId;
    if (metadata && typeof metadata === 'object') values.metadata = metadata;
    const [updated] = await ScormAiUsageEvent.update(values, { where: { operationKey } });
    return updated;
}

function usageOperationKey(progressId) {
    return `course-generation:${String(progressId || '').trim()}`;
}

module.exports = {
    COUNTED_AI_STATUSES,
    isBillableAiGenerationPayload,
    generationSource,
    countAiGenerations,
    countPendingActiveReservations,
    activeCourseUsage,
    assertAiGenerationAvailable,
    assertActiveCourseCapacity,
    reserveAiCourseGeneration,
    finalizeAiCourseGeneration,
    usageOperationKey
};
