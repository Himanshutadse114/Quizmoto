const { Op } = require('sequelize');
const {
    ScormCampaign,
    ScormCampaignLearner,
    ScormCampaignCourse,
    ScormCourse,
    ScormPackage,
    ScormRegistration,
    ScormAttempt
} = require('../../models/scorm');
const LearningState = require('./ScormLearningStateService');
const {
    enrichedRegistration,
    learnerResult
} = require('../ScormReportService');

const ACTIVE_REGISTRATION_STATUSES = { [Op.notIn]: ['revoked', 'superseded'] };

function fail(message, code, status = 400) {
    const err = new Error(message);
    err.code = code;
    err.status = status;
    return err;
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function numericScore(value) {
    if (value == null || String(value).trim() === '') return null;
    const score = Number(value);
    return Number.isFinite(score) ? score : null;
}

function statusBucket(entry) {
    const result = String(entry.result || '').toLowerCase();
    if (['passed', 'failed', 'completed'].includes(result)) return 'completed';
    if (result === 'in progress') return 'in_progress';
    return 'not_started';
}

function roundedPercent(value) {
    return Math.round(Number(value || 0) * 10) / 10;
}

function entryProgressPercent(entry) {
    if (statusBucket(entry) === 'completed') return 100;
    const value = Number(entry?.progressPercent);
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, value));
}

function summarizeEntries(entries) {
    const rows = Array.isArray(entries) ? entries : [];
    const completedCount = rows.filter((entry) => statusBucket(entry) === 'completed').length;
    const inProgressCount = rows.filter((entry) => statusBucket(entry) === 'in_progress').length;
    const notStartedCount = Math.max(0, rows.length - completedCount - inProgressCount);
    const passedCount = rows.filter((entry) => String(entry.result || '').toLowerCase() === 'passed').length;
    const failedCount = rows.filter((entry) => String(entry.result || '').toLowerCase() === 'failed').length;
    const scores = rows.map((entry) => numericScore(entry.lastScoreRaw ?? entry.score)).filter((value) => value != null);
    const progressValues = rows.map(entryProgressPercent);
    const questionsCaptured = rows.reduce((sum, entry) => sum + Number(entry.answerSummary?.captured || 0), 0);
    const gradedQuestions = rows.reduce((sum, entry) => sum + Number(entry.answerSummary?.graded || 0), 0);
    const correctAnswers = rows.reduce((sum, entry) => sum + Number(entry.answerSummary?.correct || 0), 0);
    const latestActivity = rows.reduce((latest, entry) => {
        const value = entry.lastCommitAt || entry.updatedAt || null;
        if (!value) return latest;
        if (!latest) return value;
        return new Date(value).getTime() > new Date(latest).getTime() ? value : latest;
    }, null);

    return {
        assignmentCount: rows.length,
        completedCount,
        inProgressCount,
        notStartedCount,
        passedCount,
        failedCount,
        completionRate: progressValues.length
            ? roundedPercent(progressValues.reduce((sum, progress) => sum + progress, 0) / progressValues.length)
            : 0,
        averageScore: scores.length ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100 : null,
        questionsCaptured,
        gradedQuestions,
        correctAnswers,
        answerAccuracy: gradedQuestions ? roundedPercent((correctAnswers / gradedQuestions) * 100) : null,
        latestActivity
    };
}

function serializeAnalyticsEntry(registration) {
    const enriched = enrichedRegistration(registration, registration.course || null);
    const result = learnerResult(enriched);
    const attempts = Array.isArray(enriched.attempts)
        ? enriched.attempts.map((attempt) => ({
            id: attempt.id,
            attemptNo: attempt.attemptNo,
            startedAt: attempt.startedAt,
            finishedAt: attempt.finishedAt,
            createdAt: attempt.createdAt,
            updatedAt: attempt.updatedAt
        }))
        : [];

    return {
        registrationId: enriched.id,
        courseId: enriched.courseId,
        courseTitle: enriched.courseTitle || registration.course?.title || 'Course',
        scormStandard: registration.course?.package?.standard || null,
        learnerEmail: enriched.learnerEmail,
        learnerName: enriched.learnerName || null,
        status: enriched.status,
        result,
        progressPercent: enriched.progressPercent,
        progressAvailable: enriched.progressAvailable,
        lastScoreRaw: enriched.lastScoreRaw,
        lastTotalTime: enriched.lastTotalTime,
        lastLessonStatus: enriched.lastLessonStatus,
        lastLocation: enriched.lastLocation,
        lastCommitAt: enriched.lastCommitAt || enriched.updatedAt || null,
        assignedAt: enriched.assignedAt || enriched.createdAt || null,
        dueAt: enriched.dueAt || null,
        required: enriched.required !== false,
        interactions: enriched.interactions || [],
        answerSummary: enriched.answerSummary || { captured: 0, graded: 0, correct: 0, accuracy: null },
        attempts,
        attemptCount: attempts.length
    };
}

async function getCampaignAnalytics({ campaignId, hostId, workspaceId }) {
    const campaign = await ScormCampaign.findOne({
        where: { id: campaignId, hostId, workspaceId }
    });
    if (!campaign) throw fail('Campaign not found.', 'SCORM_CAMPAIGN_NOT_FOUND', 404);

    const [campaignLearners, courseLinks, registrations] = await Promise.all([
        ScormCampaignLearner.findAll({
            where: { campaignId },
            order: [['learnerName', 'ASC'], ['email', 'ASC']]
        }),
        ScormCampaignCourse.findAll({
            where: { campaignId },
            include: [{ model: ScormCourse, as: 'course' }]
        }),
        ScormRegistration.findAll({
            where: {
                campaignId,
                isPreview: false,
                status: ACTIVE_REGISTRATION_STATUSES
            },
            include: [
                {
                    model: ScormCourse,
                    as: 'course',
                    required: true,
                    where: { hostId },
                    include: [{
                        model: ScormPackage,
                        as: 'package',
                        required: false,
                        attributes: ['id', 'title', 'standard', 'analysisJson']
                    }]
                },
                {
                    model: ScormAttempt,
                    as: 'attempts',
                    required: false,
                    separate: true,
                    order: [['attemptNo', 'ASC']]
                }
            ],
            order: [['learnerEmail', 'ASC'], ['assignedAt', 'ASC']]
        })
    ]);

    if (registrations.length) {
        const states = await LearningState.listByRegistrationIds(registrations.map((registration) => registration.id));
        for (const registration of registrations) {
            const state = states.get(String(registration.id)) || null;
            if (typeof registration.setDataValue === 'function') registration.setDataValue('learningStateV2', state);
            else registration.learningStateV2 = state;
        }
    }

    const entries = registrations.map(serializeAnalyticsEntry);

    const learnerMap = new Map();
    for (const learner of campaignLearners) {
        learnerMap.set(normalizeEmail(learner.email), {
            id: learner.id,
            email: learner.email,
            learnerName: learner.learnerName || 'Learner',
            entries: []
        });
    }
    for (const entry of entries) {
        const key = normalizeEmail(entry.learnerEmail);
        if (!learnerMap.has(key)) {
            learnerMap.set(key, {
                id: null,
                email: entry.learnerEmail,
                learnerName: entry.learnerName || 'Learner',
                entries: []
            });
        }
        learnerMap.get(key).entries.push(entry);
    }

    const learners = Array.from(learnerMap.values()).map((learner) => ({
        id: learner.id,
        email: learner.email,
        learnerName: learner.learnerName,
        ...summarizeEntries(learner.entries),
        courseCount: learner.entries.length,
        entries: learner.entries
    }));

    const courseMap = new Map();
    for (const link of courseLinks) {
        courseMap.set(String(link.courseId), {
            id: link.courseId,
            title: link.course?.title || 'Course',
            status: link.course?.status || null,
            entries: []
        });
    }
    for (const entry of entries) {
        const key = String(entry.courseId);
        if (!courseMap.has(key)) {
            courseMap.set(key, {
                id: entry.courseId,
                title: entry.courseTitle || 'Course',
                status: null,
                entries: []
            });
        }
        courseMap.get(key).entries.push(entry);
    }

    const courses = Array.from(courseMap.values()).map((course) => ({
        id: course.id,
        title: course.title,
        status: course.status,
        ...summarizeEntries(course.entries),
        learnerCount: new Set(course.entries.map((entry) => normalizeEmail(entry.learnerEmail)).filter(Boolean)).size
    }));

    const overall = summarizeEntries(entries);
    const learnerStartedCount = learners.filter((learner) => learner.inProgressCount > 0 || learner.completedCount > 0).length;
    const learnerCompletedCount = learners.filter((learner) => learner.assignmentCount > 0 && learner.completedCount === learner.assignmentCount).length;

    return {
        campaign: {
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            dueAt: campaign.dueAt || null,
            required: campaign.required !== false,
            createdAt: campaign.createdAt,
            startedAt: campaign.startedAt || null,
            portalPath: campaign.status === 'active' ? `/campaign/${campaign.id}` : null,
            learnerCount: campaignLearners.length,
            courseCount: courseLinks.length,
            learnerStartedCount,
            learnerCompletedCount,
            ...overall
        },
        learners,
        courses
    };
}

module.exports = {
    getCampaignAnalytics,
    summarizeEntries,
    statusBucket,
    entryProgressPercent
};
