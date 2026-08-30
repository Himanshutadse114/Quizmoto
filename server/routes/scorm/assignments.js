const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const auth = require('../middleware');
const User = require('../../models/User');
const { sequelize } = require('../../config/database');
const {
    ScormLearnerRoster,
    ScormCourse,
    ScormRegistration
} = require('../../models/scorm');
const { getAccessRole } = require('../../services/scorm/ScormAccessService');
const { getEntitlement } = require('../../services/scorm/ScormEntitlementService');

const MAX_ASSIGNMENT_COMBINATIONS = 5000;
const INACTIVE_ASSIGNMENT_STATUSES = ['revoked', 'superseded'];

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function assignmentStatus(reg) {
    const lesson = String(reg.lastLessonStatus || '').toLowerCase();
    if (reg.status === 'completed' || ['completed', 'passed', 'failed'].includes(lesson)) return 'completed';
    if (reg.status === 'active' || reg.lastCommitAt) return 'in_progress';
    return 'not_started';
}

function serializeAssignment(reg) {
    return {
        id: reg.id,
        instanceId: reg.id,
        registrationId: reg.id,
        courseId: reg.courseId,
        learnerEmail: reg.learnerEmail,
        learnerName: reg.learnerName || null,
        status: assignmentStatus(reg),
        registrationStatus: reg.status,
        assignedAt: reg.assignedAt || reg.createdAt,
        dueAt: reg.dueAt || null,
        required: reg.required !== false,
        score: reg.lastScoreRaw == null ? null : Number(reg.lastScoreRaw),
        lessonStatus: reg.lastLessonStatus || null,
        lastActivityAt: reg.lastCommitAt || null,
        course: reg.course ? {
            id: reg.course.id,
            title: reg.course.title,
            status: reg.course.status
        } : null
    };
}

async function assertBulkLearnerLimit(hostId, learnerEmails) {
    const host = await User.findByPk(hostId);
    if (!host?.email) return;
    const role = await getAccessRole(host.email);
    const entitlement = await getEntitlement(host.email, role || 'admin');
    const maxLearners = entitlement?.maxLearners;
    if (maxLearners === null || maxLearners === undefined) return;

    const courses = await ScormCourse.findAll({
        where: { hostId },
        attributes: ['id'],
        raw: true
    });
    const courseIds = courses.map((course) => course.id);
    const existingRows = courseIds.length
        ? await ScormRegistration.findAll({
            where: {
                courseId: { [Op.in]: courseIds },
                isPreview: false,
                status: { [Op.notIn]: INACTIVE_ASSIGNMENT_STATUSES },
                learnerEmail: { [Op.ne]: null }
            },
            attributes: ['learnerEmail'],
            raw: true
        })
        : [];

    const enrolled = new Set(existingRows.map((row) => normalizeEmail(row.learnerEmail)).filter(Boolean));
    const requested = [...new Set((learnerEmails || []).map(normalizeEmail).filter(Boolean))];
    const additional = requested.filter((email) => !enrolled.has(email)).length;
    const projected = enrolled.size + additional;
    if (projected > Number(maxLearners)) {
        const err = new Error(`Assigning these learners would exceed the workspace learner limit (${projected}/${maxLearners}).`);
        err.status = 403;
        err.code = 'SCORM_LEARNER_LIMIT_REACHED';
        throw err;
    }
}

router.get('/', auth, async (req, res) => {
    try {
        const [learners, courses, registrations] = await Promise.all([
            ScormLearnerRoster.findAll({
                where: { hostId: req.userId },
                order: [['learnerName', 'ASC'], ['email', 'ASC']]
            }),
            ScormCourse.findAll({
                where: { hostId: req.userId, status: { [Op.ne]: 'archived' } },
                order: [['createdAt', 'DESC']]
            }),
            ScormRegistration.findAll({
                where: { isPreview: false, status: { [Op.notIn]: INACTIVE_ASSIGNMENT_STATUSES } },
                include: [{
                    model: ScormCourse,
                    as: 'course',
                    required: true,
                    where: { hostId: req.userId }
                }],
                order: [['assignedAt', 'DESC'], ['createdAt', 'DESC']]
            })
        ]);

        res.json({
            ok: true,
            workspaceId: req.scormWorkspaceId || null,
            learnerPortalPath: req.scormWorkspaceId ? `/learn/${req.scormWorkspaceId}` : null,
            learners: learners.map((row) => ({
                id: row.id,
                email: row.email,
                learnerName: row.learnerName || null
            })),
            courses: courses.map((row) => ({
                id: row.id,
                title: row.title,
                description: row.description || null,
                status: row.status,
                publishedAt: row.publishedAt || null
            })),
            assignments: registrations.map(serializeAssignment)
        });
    } catch (err) {
        console.error('[scorm-assignments] load failed', err);
        res.status(500).json({ message: 'Unable to load learner assignments.' });
    }
});

router.post('/bulk', auth, async (req, res) => {
    try {
        const learnerIds = [...new Set((Array.isArray(req.body?.learnerIds) ? req.body.learnerIds : []).map(String).filter(Boolean))];
        const courseIds = [...new Set((Array.isArray(req.body?.courseIds) ? req.body.courseIds : []).map(String).filter(Boolean))];
        const dueAt = parseDate(req.body?.dueAt);
        const required = req.body?.required !== false;

        if (!learnerIds.length) return res.status(400).json({ message: 'Select at least one learner.' });
        if (!courseIds.length) return res.status(400).json({ message: 'Select at least one course.' });
        if (req.body?.dueAt && !dueAt) return res.status(400).json({ message: 'Enter a valid due date.' });
        if (learnerIds.length * courseIds.length > MAX_ASSIGNMENT_COMBINATIONS) {
            return res.status(413).json({ message: `A maximum of ${MAX_ASSIGNMENT_COMBINATIONS} learner-course assignments can be created at once.` });
        }

        const [learners, courses] = await Promise.all([
            ScormLearnerRoster.findAll({ where: { id: { [Op.in]: learnerIds }, hostId: req.userId } }),
            ScormCourse.findAll({ where: { id: { [Op.in]: courseIds }, hostId: req.userId } })
        ]);

        if (learners.length !== learnerIds.length) return res.status(400).json({ message: 'One or more selected learners are not in this workspace roster.' });
        if (courses.length !== courseIds.length) return res.status(400).json({ message: 'One or more selected courses do not belong to this workspace.' });
        const unpublished = courses.filter((course) => course.status !== 'published');
        if (unpublished.length) {
            return res.status(409).json({
                message: `Publish ${unpublished.length === 1 ? 'the selected course' : 'all selected courses'} before assigning to learners.`,
                code: 'SCORM_ASSIGNMENT_REQUIRES_PUBLISHED_COURSE'
            });
        }

        await assertBulkLearnerLimit(req.userId, learners.map((learner) => learner.email));

        let created = 0;
        let updated = 0;
        let superseded = 0;
        await sequelize.transaction(async (transaction) => {
            for (const learner of learners) {
                const email = normalizeEmail(learner.email);
                for (const course of courses) {
                    // Repeated edits to the same live Admin assignment should update
                    // metadata, but a legacy invite or completed assignment must never
                    // be recycled because its assessment/runtime state belongs to the
                    // old learning instance.
                    let registration = await ScormRegistration.findOne({
                        where: {
                            courseId: course.id,
                            isPreview: false,
                            assignmentSource: 'admin',
                            status: { [Op.notIn]: ['completed', ...INACTIVE_ASSIGNMENT_STATUSES] },
                            [Op.and]: [sequelize.where(sequelize.fn('LOWER', sequelize.col('learnerEmail')), email)]
                        },
                        order: [['createdAt', 'DESC']],
                        transaction,
                        lock: transaction.LOCK.UPDATE
                    });

                    if (!registration) {
                        // Keep previous registrations for reporting, but remove them
                        // from the learner's active dashboard. Their SCORM state remains
                        // keyed to the old registration UUID and is never copied.
                        const [count] = await ScormRegistration.update(
                            { status: 'superseded' },
                            {
                                where: {
                                    courseId: course.id,
                                    isPreview: false,
                                    status: { [Op.notIn]: INACTIVE_ASSIGNMENT_STATUSES },
                                    [Op.and]: [sequelize.where(sequelize.fn('LOWER', sequelize.col('learnerEmail')), email)]
                                },
                                transaction
                            }
                        );
                        superseded += Number(count || 0);

                        registration = await ScormRegistration.create({
                            courseId: course.id,
                            learnerEmail: email,
                            learnerName: learner.learnerName || 'Learner',
                            status: 'invited',
                            assignedAt: new Date(),
                            assignedByUserId: req.authenticatedUserId || req.userId,
                            dueAt,
                            assignmentSource: 'admin',
                            required
                        }, { transaction });
                        created += 1;
                    } else {
                        registration.learnerEmail = email;
                        registration.learnerName = learner.learnerName || registration.learnerName || 'Learner';
                        registration.assignedByUserId = req.authenticatedUserId || req.userId;
                        registration.dueAt = dueAt;
                        registration.assignmentSource = 'admin';
                        registration.required = required;
                        await registration.save({ transaction });
                        updated += 1;
                    }
                }
            }
        });

        res.status(created ? 201 : 200).json({
            ok: true,
            created,
            updated,
            superseded,
            learners: learners.length,
            courses: courses.length,
            combinations: learners.length * courses.length,
            learnerPortalPath: req.scormWorkspaceId ? `/learn/${req.scormWorkspaceId}` : null
        });
    } catch (err) {
        console.error('[scorm-assignments] bulk assign failed', err);
        res.status(err.status || 500).json({ message: err.message || 'Unable to assign courses.', code: err.code });
    }
});

router.patch('/:id', auth, async (req, res) => {
    try {
        const registration = await ScormRegistration.findByPk(req.params.id, {
            include: [{ model: ScormCourse, as: 'course' }]
        });
        if (!registration || !registration.course || registration.course.hostId !== req.userId || registration.isPreview || INACTIVE_ASSIGNMENT_STATUSES.includes(registration.status)) {
            return res.status(404).json({ message: 'Assignment not found.' });
        }
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'dueAt')) {
            const dueAt = parseDate(req.body.dueAt);
            if (req.body.dueAt && !dueAt) return res.status(400).json({ message: 'Enter a valid due date.' });
            registration.dueAt = dueAt;
        }
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'required')) registration.required = Boolean(req.body.required);
        await registration.save();
        res.json({ ok: true, assignment: serializeAssignment(registration) });
    } catch (err) {
        res.status(500).json({ message: 'Unable to update assignment.' });
    }
});

router.delete('/:id', auth, async (req, res) => {
    try {
        const registration = await ScormRegistration.findByPk(req.params.id, {
            include: [{ model: ScormCourse, as: 'course' }]
        });
        if (!registration || !registration.course || registration.course.hostId !== req.userId || registration.isPreview || registration.status === 'superseded') {
            return res.status(404).json({ message: 'Assignment not found.' });
        }
        registration.status = 'revoked';
        await registration.save();
        res.json({ ok: true, revoked: registration.id });
    } catch (err) {
        res.status(500).json({ message: 'Unable to remove assignment.' });
    }
});

module.exports = router;
