const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const {
    ScormCourse,
    ScormPackage,
    ScormRegistration,
    ScormCmiState
} = require('../../models/scorm');
const { serializeRegistration } = require('../../services/scorm/ScormProgressService');

function registrationRows(course) {
    const regs = Array.isArray(course.registrations) ? course.registrations : [];
    return regs.map((reg) => serializeRegistration(reg, course));
}

function learnerRows(course) {
    return registrationRows(course).filter((row) => !row.isPreview);
}

function previewRows(course) {
    return registrationRows(course).filter((row) => row.isPreview);
}

function summarizeRows(rows) {
    const completed = rows.filter((row) => row.progressAvailable && row.progressPercent >= 100).length;
    const inProgress = rows.filter((row) => (
        (row.progressAvailable && row.progressPercent > 0 && row.progressPercent < 100) ||
        (!row.progressAvailable && row.status === 'active')
    )).length;
    const notStarted = rows.filter((row) => row.progressAvailable && row.progressPercent <= 0 && row.status !== 'active').length;
    const unavailable = rows.filter((row) => !row.progressAvailable).length;
    const measurable = rows.filter((row) => row.progressAvailable);
    const averageProgress = measurable.length
        ? Math.round((measurable.reduce((sum, row) => sum + Number(row.progressPercent || 0), 0) / measurable.length) * 10) / 10
        : 0;
    return { completed, inProgress, notStarted, unavailable, averageProgress };
}

function courseSummary(course) {
    // Preview sessions are visible to hosts for QA, but never count as learners.
    const rows = learnerRows(course);
    const previews = previewRows(course);
    const stats = summarizeRows(rows);
    return {
        id: course.id,
        title: course.title,
        status: course.status,
        inviteCode: course.inviteCode,
        packageId: course.packageId,
        learners: rows.length,
        previewSessions: previews.length,
        active: stats.inProgress,
        ...stats,
        updatedAt: course.updatedAt
    };
}

async function loadHostCourses(hostId, courseId = null) {
    const where = { hostId };
    if (courseId) where.id = courseId;
    return ScormCourse.findAll({
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
                include: [{ model: ScormCmiState, as: 'cmiState' }]
            }
        ],
        order: [['updatedAt', 'DESC']]
    });
}

function newestFirst(rows) {
    return rows.sort((a, b) => {
        const at = new Date(a.lastCommitAt || a.updatedAt || 0).getTime();
        const bt = new Date(b.lastCommitAt || b.updatedAt || 0).getTime();
        return bt - at;
    });
}

router.get('/summary', auth, async (req, res) => {
    try {
        const courses = await loadHostCourses(req.userId);
        const visible = courses.filter((course) => course.status !== 'archived' && course.package && course.package.status !== 'deleted');
        const courseSummaries = visible.map(courseSummary);
        const rows = visible.flatMap(learnerRows);
        const previews = visible.flatMap(previewRows);
        const stats = summarizeRows(rows);

        res.json({
            overview: {
                courses: visible.length,
                learners: rows.length,
                previewSessions: previews.length,
                ...stats
            },
            courses: courseSummaries,
            learners: newestFirst(rows),
            previews: newestFirst(previews)
        });
    } catch (err) {
        res.status(500).json({ message: err.message || 'Failed to load SCORM tracking' });
    }
});

router.get('/course/:courseId', auth, async (req, res) => {
    try {
        const courses = await loadHostCourses(req.userId, req.params.courseId);
        const course = courses[0];
        if (!course || course.status === 'archived') return res.status(404).json({ message: 'Course not found' });
        const learners = learnerRows(course);
        const previews = previewRows(course);
        res.json({
            course: courseSummary(course),
            registrations: newestFirst([...learners, ...previews]),
            learners,
            previews
        });
    } catch (err) {
        res.status(500).json({ message: err.message || 'Failed to load course tracking' });
    }
});

module.exports = router;