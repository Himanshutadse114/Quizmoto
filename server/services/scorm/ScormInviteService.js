const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const {
    ScormCourse,
    ScormRegistration,
    ScormAttempt,
    ScormPackage,
    ScormLearnerRoster,
    ScormWorkspace,
    ScormWorkspaceAuthConfig
} = require('../../models/scorm');
const { ensurePackageLaunchMetadata } = require('./ScormLaunchMetadataService');
const { assertEnrollmentAllowed } = require('./ScormEntitlementService');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

function randomCode(len = 10) {
    return crypto.randomBytes(16).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, len);
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function normalizeLearnerEmail(value) {
    const email = String(value || '').trim().toLowerCase();
    return email || null;
}

function isValidLearnerEmail(value) {
    const email = normalizeLearnerEmail(value);
    return Boolean(email && email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

function signRegistrationToken(registrationId, courseId) {
    return jwt.sign(
        { scormRegId: registrationId, courseId, typ: 'scorm_reg' },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

function verifyRegistrationToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.typ !== 'scorm_reg' || !decoded.scormRegId) {
            const err = new Error('Invalid registration token');
            err.code = 'FORBIDDEN';
            throw err;
        }
        return decoded;
    } catch (error) {
        if (error?.code === 'FORBIDDEN') throw error;
        const err = new Error('Invalid or expired registration token');
        err.code = 'FORBIDDEN';
        err.cause = error;
        throw err;
    }
}

async function createInviteCode() {
    for (let i = 0; i < 8; i++) {
        const code = randomCode(10);
        const exists = await ScormCourse.findOne({ where: { inviteCode: code } });
        if (!exists) return code;
    }
    return randomCode(12);
}

async function nextAttempt(reg, transaction) {
    const latest = await ScormAttempt.findOne({
        where: { registrationId: reg.id },
        order: [['attemptNo', 'DESC']],
        transaction,
        lock: transaction.LOCK.UPDATE
    });

    const hasStartedBefore =
        reg.status === 'active' ||
        reg.status === 'completed' ||
        Boolean(reg.lastCommitAt) ||
        Boolean(latest?.finishedAt);

    if (latest && !hasStartedBefore && !latest.finishedAt) {
        return latest;
    }

    if (latest && !latest.finishedAt) {
        latest.finishedAt = new Date();
        latest.exitType = 'relaunch';
        await latest.save({ transaction });
    }

    return ScormAttempt.create({
        registrationId: reg.id,
        attemptNo: latest ? Number(latest.attemptNo || 0) + 1 : 1,
        startedAt: new Date()
    }, { transaction });
}

async function assertLegacyInviteAllowed(course, transaction) {
    const workspace = await ScormWorkspace.findOne({
        where: { ownerUserId: course.hostId, status: 'active' },
        transaction
    });
    if (!workspace) return;
    const config = await ScormWorkspaceAuthConfig.findOne({
        where: { workspaceId: workspace.id },
        transaction
    });
    if (String(config?.joiningMode || '').toLowerCase() !== 'sso_only') return;

    const err = new Error('This organisation requires SSO. Open the organisation learner portal and sign in with Google or Microsoft.');
    err.code = 'SCORM_SSO_REQUIRED';
    err.status = 403;
    err.workspaceId = workspace.id;
    throw err;
}

async function acceptInvite({ inviteCode, learnerName, learnerEmail }) {
    const normalizedEmail = normalizeLearnerEmail(learnerEmail);
    if (!normalizedEmail) {
        const err = new Error('Learner email is required');
        err.code = 'EMAIL_REQUIRED';
        throw err;
    }
    if (!isValidLearnerEmail(normalizedEmail)) {
        const err = new Error('Enter a valid learner email address');
        err.code = 'EMAIL_INVALID';
        throw err;
    }

    return sequelize.transaction(async (transaction) => {
        const course = await ScormCourse.findOne({
            where: { inviteCode, status: 'published' },
            transaction,
            lock: transaction.LOCK.UPDATE
        });
        if (!course) {
            const err = new Error('Course not found or not published');
            err.code = 'NOT_FOUND';
            throw err;
        }

        // A workspace-wide SSO-only policy must also protect historical public
        // invite links; otherwise a learner could bypass the configured identity
        // provider simply by opening an older course URL and typing an email.
        await assertLegacyInviteAllowed(course, transaction);

        const approvedLearner = await ScormLearnerRoster.findOne({
            where: { hostId: course.hostId, email: normalizedEmail },
            transaction
        });

        if (!approvedLearner) {
            const rosterCount = await ScormLearnerRoster.count({
                where: { hostId: course.hostId },
                transaction
            });
            const err = new Error(
                rosterCount === 0
                    ? 'This course is not accepting learners yet. Ask the course administrator to add the approved learner roster.'
                    : 'This email is not authorised for this course. Use your organisation email or contact the course administrator.'
            );
            err.code = rosterCount === 0 ? 'LEARNER_ROSTER_EMPTY' : 'LEARNER_NOT_APPROVED';
            err.status = 403;
            throw err;
        }

        await assertEnrollmentAllowed(course.hostId, normalizedEmail);
        const resolvedLearnerName = approvedLearner.learnerName || String(learnerName || '').trim() || 'Learner';

        const pkg = await ScormPackage.findByPk(course.packageId, { transaction });
        if (!pkg || pkg.status !== 'ready') {
            const err = new Error('Course package is not ready');
            err.code = 'PACKAGE_NOT_READY';
            throw err;
        }

        await ensurePackageLaunchMetadata(pkg, { transaction });
        course.setDataValue('package', pkg);

        let reg = await ScormRegistration.findOne({
            where: {
                courseId: course.id,
                isPreview: false,
                [Op.and]: [
                    sequelize.where(
                        sequelize.fn('LOWER', sequelize.col('learnerEmail')),
                        normalizedEmail
                    )
                ]
            },
            order: [['createdAt', 'ASC']],
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!reg) {
            reg = await ScormRegistration.create({
                courseId: course.id,
                learnerName: resolvedLearnerName,
                learnerEmail: normalizedEmail,
                status: 'invited',
                assignedAt: new Date(),
                assignmentSource: 'invite',
                required: true
            }, { transaction });
        } else {
            reg.learnerName = resolvedLearnerName;
            reg.learnerEmail = normalizedEmail;
            if (reg.status === 'revoked') reg.status = 'invited';
            if (!reg.assignedAt) reg.assignedAt = reg.createdAt || new Date();
            if (!reg.assignmentSource) reg.assignmentSource = 'invite';
        }

        const attempt = await nextAttempt(reg, transaction);
        const token = signRegistrationToken(reg.id, course.id);
        reg.inviteTokenHash = hashToken(token);
        await reg.save({ transaction });

        return {
            registration: reg,
            course,
            token,
            attemptNo: Number(attempt.attemptNo || 1)
        };
    });
}

module.exports = {
    randomCode,
    hashToken,
    normalizeLearnerEmail,
    isValidLearnerEmail,
    signRegistrationToken,
    verifyRegistrationToken,
    createInviteCode,
    acceptInvite
};
