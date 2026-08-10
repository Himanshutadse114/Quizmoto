const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const {
    ScormCourse,
    ScormRegistration,
    ScormAttempt,
    ScormPackage
} = require('../../models/scorm');

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

    // A duplicate submit/refresh before the learner has actually started should
    // keep the same first attempt instead of inflating the attempt counter.
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

async function acceptInvite({ inviteCode, learnerName, learnerEmail }) {
    const normalizedEmail = normalizeLearnerEmail(learnerEmail);

    return sequelize.transaction(async (transaction) => {
        // Lock the course row so concurrent joins for the same course cannot both
        // create a registration for the same learner email.
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

        const pkg = await ScormPackage.findByPk(course.packageId, { transaction });
        if (!pkg || pkg.status !== 'ready') {
            const err = new Error('Course package is not ready');
            err.code = 'PACKAGE_NOT_READY';
            throw err;
        }
        course.setDataValue('package', pkg);

        let reg = null;
        if (normalizedEmail) {
            reg = await ScormRegistration.findOne({
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
        }

        if (!reg) {
            reg = await ScormRegistration.create({
                courseId: course.id,
                learnerName: learnerName || 'Learner',
                learnerEmail: normalizedEmail,
                status: 'invited'
            }, { transaction });
        } else {
            // Keep one canonical registration per course/email and refresh the
            // learner's display details instead of creating another tracking row.
            reg.learnerName = learnerName || reg.learnerName || 'Learner';
            reg.learnerEmail = normalizedEmail;
            if (reg.status === 'revoked') reg.status = 'invited';
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
    signRegistrationToken,
    verifyRegistrationToken,
    createInviteCode,
    acceptInvite
};
