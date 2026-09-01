const crypto = require('crypto');
const { Op } = require('sequelize');
const ScormLearnerEmailOtp = require('../../models/scorm/ScormLearnerEmailOtp');
const MailService = require('../mail/MailService');
const { learnerOtpTemplate } = require('../mail/templates');

const PURPOSE = 'learner_signin';

function numericEnv(name, fallback, min, max) {
    const value = Number(process.env[name]);
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(value)));
}

function settings() {
    return {
        ttlSeconds: numericEnv('LEARNER_OTP_TTL_SECONDS', 600, 300, 1800),
        resendSeconds: numericEnv('LEARNER_OTP_RESEND_SECONDS', 60, 30, 300),
        maxAttempts: numericEnv('LEARNER_OTP_MAX_ATTEMPTS', 5, 3, 10)
    };
}

function fail(message, code, status = 400, extras = {}) {
    const err = new Error(message);
    err.code = code;
    err.status = status;
    Object.assign(err, extras);
    return err;
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function hashSecret() {
    const secret = String(
        process.env.OTP_HASH_SECRET ||
        process.env.SCORM_LEARNER_SESSION_SECRET ||
        process.env.JWT_SECRET ||
        ''
    );
    if (!secret && process.env.NODE_ENV === 'production') {
        throw fail('OTP security secret is not configured.', 'OTP_SECRET_NOT_CONFIGURED', 503);
    }
    return secret || 'quizmoto-test-otp-secret';
}

function codeHash({ workspaceId, email, code }) {
    return crypto
        .createHmac('sha256', hashSecret())
        .update(`${workspaceId}:${normalizeEmail(email)}:${PURPOSE}:${String(code || '').trim()}`)
        .digest('hex');
}

function compareHash(left, right) {
    const a = Buffer.from(String(left || ''), 'hex');
    const b = Buffer.from(String(right || ''), 'hex');
    return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

async function purgeOldRows() {
    const cutoff = new Date(Date.now() - (24 * 60 * 60 * 1000));
    try {
        await ScormLearnerEmailOtp.destroy({
            where: {
                [Op.or]: [
                    { expiresAt: { [Op.lt]: cutoff } },
                    { consumedAt: { [Op.lt]: cutoff } }
                ]
            }
        });
    } catch (_) {
        // Cleanup is best effort and must never block sign-in.
    }
}

async function issueOtp({ workspaceId, email, learnerName, workspaceName }) {
    MailService.assertConfigured();
    const config = settings();
    const normalized = normalizeEmail(email);
    const now = new Date();
    const recent = await ScormLearnerEmailOtp.findOne({
        where: {
            workspaceId,
            email: normalized,
            purpose: PURPOSE,
            consumedAt: null
        },
        order: [['sentAt', 'DESC']]
    });

    if (recent?.sentAt) {
        const ageSeconds = Math.floor((Date.now() - new Date(recent.sentAt).getTime()) / 1000);
        if (ageSeconds < config.resendSeconds) {
            const retryAfter = config.resendSeconds - Math.max(0, ageSeconds);
            throw fail(
                `Please wait ${retryAfter} seconds before requesting another code.`,
                'SCORM_LEARNER_OTP_RESEND_TOO_SOON',
                429,
                { retryAfter }
            );
        }
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const expiresAt = new Date(now.getTime() + config.ttlSeconds * 1000);

    await ScormLearnerEmailOtp.update(
        { consumedAt: now },
        {
            where: {
                workspaceId,
                email: normalized,
                purpose: PURPOSE,
                consumedAt: null
            }
        }
    );

    const row = await ScormLearnerEmailOtp.create({
        workspaceId,
        email: normalized,
        purpose: PURPOSE,
        codeHash: codeHash({ workspaceId, email: normalized, code }),
        expiresAt,
        consumedAt: null,
        attempts: 0,
        sentAt: now
    });

    const template = learnerOtpTemplate({
        learnerName,
        workspaceName,
        code,
        expiresInMinutes: Math.ceil(config.ttlSeconds / 60)
    });

    try {
        await MailService.sendMail({
            to: normalized,
            ...template,
            tag: 'learner_otp'
        });
    } catch (err) {
        try { await row.destroy(); } catch (_) {}
        throw fail(
            'We could not send the verification code. Please try again shortly.',
            'SCORM_LEARNER_OTP_SEND_FAILED',
            503
        );
    }

    purgeOldRows();
    return {
        sent: true,
        expiresInSeconds: config.ttlSeconds,
        resendAfterSeconds: config.resendSeconds
    };
}

async function verifyOtp({ workspaceId, email, code }) {
    const config = settings();
    const normalized = normalizeEmail(email);
    const submitted = String(code || '').trim();
    if (!/^\d{6}$/.test(submitted)) {
        throw fail('Enter the 6-digit verification code.', 'SCORM_LEARNER_OTP_INVALID', 400);
    }

    const row = await ScormLearnerEmailOtp.findOne({
        where: {
            workspaceId,
            email: normalized,
            purpose: PURPOSE,
            consumedAt: null
        },
        order: [['sentAt', 'DESC']]
    });

    if (!row) {
        throw fail('This verification code is no longer valid. Request a new code.', 'SCORM_LEARNER_OTP_EXPIRED', 401);
    }
    if (new Date(row.expiresAt).getTime() <= Date.now()) {
        row.consumedAt = new Date();
        await row.save();
        throw fail('This verification code has expired. Request a new code.', 'SCORM_LEARNER_OTP_EXPIRED', 401);
    }
    if (Number(row.attempts || 0) >= config.maxAttempts) {
        row.consumedAt = new Date();
        await row.save();
        throw fail('Too many incorrect attempts. Request a new verification code.', 'SCORM_LEARNER_OTP_ATTEMPTS_EXCEEDED', 429);
    }

    const expected = codeHash({ workspaceId, email: normalized, code: submitted });
    if (!compareHash(row.codeHash, expected)) {
        row.attempts = Number(row.attempts || 0) + 1;
        const attemptsRemaining = Math.max(0, config.maxAttempts - row.attempts);
        if (attemptsRemaining === 0) row.consumedAt = new Date();
        await row.save();
        throw fail(
            attemptsRemaining
                ? `The verification code is incorrect. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining.`
                : 'Too many incorrect attempts. Request a new verification code.',
            attemptsRemaining ? 'SCORM_LEARNER_OTP_INVALID' : 'SCORM_LEARNER_OTP_ATTEMPTS_EXCEEDED',
            attemptsRemaining ? 401 : 429,
            { attemptsRemaining }
        );
    }

    row.consumedAt = new Date();
    await row.save();
    return { verified: true };
}

module.exports = {
    PURPOSE,
    settings,
    issueOtp,
    verifyOtp,
    codeHash
};
