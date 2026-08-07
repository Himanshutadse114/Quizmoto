const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {
    ScormCourse,
    ScormRegistration,
    ScormPackage
} = require('../../models/scorm');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

function randomCode(len = 10) {
    return crypto.randomBytes(16).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, len);
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function signRegistrationToken(registrationId, courseId) {
    return jwt.sign(
        { scormRegId: registrationId, courseId, typ: 'scorm_reg' },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

function verifyRegistrationToken(token) {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.typ !== 'scorm_reg' || !decoded.scormRegId) {
        throw new Error('Invalid registration token');
    }
    return decoded;
}

async function createInviteCode() {
    for (let i = 0; i < 8; i++) {
        const code = randomCode(10);
        const exists = await ScormCourse.findOne({ where: { inviteCode: code } });
        if (!exists) return code;
    }
    return randomCode(12);
}

async function acceptInvite({ inviteCode, learnerName, learnerEmail }) {
    const course = await ScormCourse.findOne({
        where: { inviteCode, status: 'published' },
        include: [{ model: ScormPackage, as: 'package' }]
    });
    if (!course) {
        const err = new Error('Course not found or not published');
        err.code = 'NOT_FOUND';
        throw err;
    }
    if (!course.package || course.package.status !== 'ready') {
        const err = new Error('Course package is not ready');
        err.code = 'PACKAGE_NOT_READY';
        throw err;
    }

    const reg = await ScormRegistration.create({
        courseId: course.id,
        learnerName: learnerName || 'Learner',
        learnerEmail: learnerEmail || null,
        status: 'invited'
    });

    const token = signRegistrationToken(reg.id, course.id);
    reg.inviteTokenHash = hashToken(token);
    await reg.save();

    return { registration: reg, course, token };
}

module.exports = {
    randomCode,
    hashToken,
    signRegistrationToken,
    verifyRegistrationToken,
    createInviteCode,
    acceptInvite
};
