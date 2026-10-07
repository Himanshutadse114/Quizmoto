const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const auth = require('../middleware');
const {
    ScormCourse,
    ScormPackage,
    ScormRegistration,
    ScormAttempt
} = require('../../models/scorm');
const { attachCanonicalState } = require('../../services/scorm/ScormCanonicalProgressService');
const { serializeRegistration } = require('../../services/scorm/ScormProgressService');
const { extractInteractions, answerSummary } = require('../../services/scorm/ScormInteractionReportService');
const { resolveCourseOrPackageId } = require('../../services/scorm/ScormCourseWorkspaceService');

const FINISHED = new Set(['completed', 'passed', 'failed']);
const INACTIVE = ['revoked', 'superseded'];

function activityTime(row) {
    return new Date(row.lastCommitAt || row.lastActivityAt || row.updatedAt || row.createdAt || 0).getTime();
}

function attemptRows(attempts) {
    return (Array.isArray(attempts) ? attempts : []).map((attempt) => ({
        id: attempt.id,
        attemptNo: attempt.attemptNo,
        startedAt: attempt.startedAt,
        finishedAt: attempt.finishedAt,
        exitType: attempt.exitType || null
    }));
}

function registrationRow(reg, course) {
    const row = serializeRegistration(reg, course);
    const attempts = Array.isArray(reg.attempts)
        ? reg.attempts
        : Array.isArray(reg.dataValues?.attempts) ? reg.dataValues.attempts : [];
    const state = typeof reg.getDataValue === 'function'
        ? reg.getDataValue('learningStateV2')
        : reg.learningStateV2;
    const interactions = extractInteractions({ state, packageRow: course?.package || null });
    const lessonStatus = String(state?.lessonStatus || row.lastLessonStatus || '').trim().toLowerCase();
    const hasCanonicalActivity = Boolean(
        state && (
            Number(state.sequence || 0) > 0 ||
            state.updatedAt ||
            state.lessonLocation ||
            state.suspendData ||
            state.scoreRaw != null ||
            (state.totalTime && state.totalTime !== '00:00:00.00') ||
            (lessonStatus && lessonStatus !== 'not attempted' && lessonStatus !== 'unknown')
        )
    );
    const completed = row.status === 'completed' || FINISHED.has(lessonStatus);

    return {
        ...row,
        status: row.status === 'revoked' ? 'revoked' : completed ? 'completed' : hasCanonicalActivity ? 'active' : row.status,
        lastCommitAt: state?.updatedAt || row.lastCommitAt || null,
        lastActivityAt: state?.updatedAt || row.lastActivityAt || row.lastCommitAt || null,
        courseTitle: course?.title || row.courseTitle || 'Course',
        scormStandard: course?.package?.standard || null,
        attempts: attemptRows(attempts),
        // A registration is an assignment, not an attempt. Do not display one
        // attempt until the learner actually launches the course. Historical
        // activity without an attempt row still counts as one legacy attempt.
        attemptCount: attempts.length || (hasCanonicalActivity ? 1 : 0),
        interactions,
        answerSummary: answerSummary(interactions)
    };
}

function isDirectTrackingRegistration(reg) {
    return Boolean(reg && !reg.isPreview && !reg.campaignId && !INACTIVE.includes(String(reg.status || '').toLowerCase()));
}

function learnerRows(course) {
    const regs = Array.isArray(course.registrations) ? course.registrations : [];
    const rows = regs
        .filter(isDirectTrackingRegistration)
        .map((reg) => registrationRow(reg, course));

    const grouped = new Map();
    for (const row of rows) {
        const email = String(row.learnerEmail || '').trim().toLowerCase();
        const key = email ? `${row.courseId}:${email}` : `${row.courseId}:registration:${row.id}`;
        const current = grouped.get(key);
        if (!current) {
            grouped.set(key, { ...row });
            continue;
        }

        const mergedAttempts = [...(current.attempts || []), ...(row.attempts || [])]
            .sort((a, b) => Number(a.attemptNo || 0) - Number(b.attemptNo || 0));
        const combinedAttempts = Math.max(0, Number(current.attemptCount || 0) + Number(row.attemptCount || 0));
        const newest = activityTime(row) > activityTime(current) ? row : current;
        grouped.set(key, {
            ...newest,
            attempts: mergedAttempts,
            attemptCount: combinedAttempts
        });
    }
    return Array.from(grouped.values());
}

function isCompletedRow(row) {
    return (row.progressAvailable && Number(row.progressPercent) >= 100)
        || row.status === 'completed'
        || ['completed', 'passed', 'failed'].includes(String(row.lastLessonStatus || '').toLowerCase());
}

function isStartedRow(row) {
    if (isCompletedRow(row)) return true;
    return (row.progressAvailable && Number(row.progressPercent) > 0)
        || ['active', 'in_progress', 'launched', 'started'].includes(String(row.status || ''))
        || Boolean(row.lastCommitAt || row.lastActivityAt)
        || Number(row.stateVersion || 0) > 0
        || ['incomplete', 'browsed'].includes(String(row.lastLessonStatus || '').toLowerCase());
}

function summarizeRows(rows) {
    const completed = rows.filter(isCompletedRow).length;
    const inProgress = rows.filter((row) => !isCompletedRow(row) && isStartedRow(row)).length;
    const unavailable = rows.filter((row) => row.progressAvailable === false && !isStartedRow(row)).length;
    // Keep metric buckets mutually exclusive. Previously every unavailable row
    // was also counted as Not started, which made the overview totals misleading.
    const notStarted = rows.filter((row) => row.progressAvailable !== false && !isStartedRow(row)).length;
    const measurable = rows.filter((row) => row.progressAvailable);
    const averageProgress = measurable.length
        ? Math.round((measurable.reduce((sum, row) => sum + Number(row.progressPercent || 0), 0) / measurable.length) * 10) / 10
        : 0;
    return { completed, inProgress, notStarted, unavailable, averageProgress };
}

function courseSummary(course) {
    const rows = learnerRows(course);
    const stats = summarizeRows(rows);
    return {
        id: course.id,
        title: course.title,
        status: course.status,
        inviteCode: course.inviteCode,
        packageId: course.packageId,
        learners: rows.length,
        active: stats.inProgress,
        ...stats,
        updatedAt: course.updatedAt
    };
}

async function attachLearningState(courses) {
    const registrations = courses.flatMap((course) => (
        Array.isArray(course.registrations) ? course.registrations : []
    ));
    await attachCanonicalState(registrations);
    return courses;
}

async function loadHostCourses(hostId, courseId = null) {
    const where = { hostId };
    if (courseId) where.id = courseId;
    const courses = await ScormCourse.findAll({
        where,
        include: [
            {
                model: ScormPackage,
                as: 'package',
                attributes: ['id', 'title', 'status', 'analysisJson', 'standard', 'source']
            },
            {
                model: ScormRegistration,
                as: 'registrations',
                required: false,
                // Learner Tracking is intentionally the direct-learning view.
                // Campaign registrations have their own lifecycle, management and
                // analytics surface and must not be duplicated here.
                where: {
                    isPreview: false,
                    campaignId: null,
                    status: { [Op.notIn]: INACTIVE }
                },
                include: [{
                    model: ScormAttempt,
                    as: 'attempts',
                    required: false,
                    attributes: ['id', 'attemptNo', 'startedAt', 'finishedAt', 'exitType']
                }]
            }
        ],
        order: [['updatedAt', 'DESC']]
    });
    return attachLearningState(courses);
}

function newestFirst(rows) {
    return rows.sort((a, b) => activityTime(b) - activityTime(a));
}

router.get('/summary', auth, async (req, res) => {
    try {
        const courses = await loadHostCourses(req.userId);
        const visible = courses.filter((course) => course.status !== 'archived' && course.package && course.package.status !== 'deleted');
        const courseSummaries = visible.map(courseSummary);
        const rows = visible.flatMap(learnerRows);
        const stats = summarizeRows(rows);

        res.json({
            scope: 'direct_learning',
            overview: {
                courses: visible.length,
                learners: rows.length,
                ...stats
            },
            courses: courseSummaries,
            learners: newestFirst(rows)
        });
    } catch (err) {
        console.error('[scorm-tracking-v4] summary failed', {
            hostId: req.userId,
            error: err?.message || String(err),
            dbCode: err?.original?.code || err?.parent?.code || null
        });
        res.status(500).json({ message: err.message || 'Failed to load SCORM tracking' });
    }
});

router.get('/course/:courseId', auth, async (req, res) => {
    try {
        const resolved = await resolveCourseOrPackageId({ id: req.params.courseId, hostId: req.userId });
        const resolvedId = resolved?.id || resolved?.courseId || req.params.courseId;
        const courses = await loadHostCourses(req.userId, resolvedId);
        const course = courses[0];
        if (!course || course.status === 'archived') return res.status(404).json({ message: 'Course not found' });
        const learners = newestFirst(learnerRows(course));
        res.json({
            scope: 'direct_learning',
            course: courseSummary(course),
            registrations: learners,
            learners
        });
    } catch (err) {
        console.error('[scorm-tracking-v4] course failed', {
            hostId: req.userId,
            courseId: req.params.courseId,
            error: err?.message || String(err),
            dbCode: err?.original?.code || err?.parent?.code || null
        });
        res.status(500).json({ message: err.message || 'Failed to load course tracking' });
    }
});

module.exports = router;
