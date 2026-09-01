const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const MailOtp = require('../../models/MailOtp');
const MailService = require('./MailService');

const ALLOWED_PURPOSES = new Set(['login', 'password_reset', 'email_verification']);
const OTP_TTL_MINUTES = Math.max(3, Math.min(30, Number(process.env.MAIL_OTP_TTL_MINUTES || 10)));
const MAX_ATTEMPTS = Math.max(3, Math.min(10, Number(process.env.MAIL_OTP_MAX_ATTEMPTS || 5)));
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

function fail(message, code, status = 400) {
    const error = new Error(message);
    error.code = code;
    error.status = status;
    return error;
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizePurpose(value) {
    const purpose = String(value || 'email_verification').trim().toLowerCase();
    if (!ALLOWED_PURPOSES.has(purpose)) {
        throw fail('Unsupported verification purpose.', 'MAIL_OTP_PURPOSE_INVALID', 400);
    }
    return purpose;
}

function otpSecret() {
    return String(process.env.MAIL_OTP_SECRET || JWT_SECRET);
}

function hashCode({ email, purpose, code }) {
    return crypto
        .createHmac('sha256', otpSecret())
        .update(`${normalizeEmail(email)}:${normalizePurpose(purpose)}:${String(code || '')}`)
        .digest('hex');
}

function newCode() {
    return String(crypto.randomInt(100000, 1000000));
}

async function pruneExpired() {
    await MailOtp.destroy({
        where: {
            [Op.or]: [
                { expiresAt: { [Op.lt]: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
                { consumedAt: { [Op.lt]: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
            ]
        }
    });
}

async function requestOtp({ email, purpose = 'email_verification', requestedIp = null, name = null }) {
    const normalizedEmail = normalizeEmail(email);
    const normalizedPurpose = normalizePurpose(purpose);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        throw fail('Enter a valid email address.', 'MAIL_OTP_EMAIL_INVALID', 400);
    }
    if (!MailService.isConfigured()) {
        throw fail('Email delivery is not configured yet.', 'MAIL_NOT_CONFIGURED', 503);
    }

    await MailOtp.update(
        { consumedAt: new Date() },
        {
            where: {
                email: normalizedEmail,
                purpose: normalizedPurpose,
                consumedAt: null,
                expiresAt: { [Op.gt]: new Date() }
            }
        }
    );

    const code = newCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    const row = await MailOtp.create({
        email: normalizedEmail,
        purpose: normalizedPurpose,
        codeHash: hashCode({ email: normalizedEmail, purpose: normalizedPurpose, code }),
        expiresAt,
        requestedIp: String(requestedIp || '').slice(0, 80) || null
    });

    try {
        await MailService.send({
            to: normalizedEmail,
            template: 'otp',
            required: true,
            data: {
                code,
                purpose: normalizedPurpose,
                expiresMinutes: OTP_TTL_MINUTES,
                name
            }
        });
    } catch (error) {
        try { await row.destroy(); } catch (_) {}
        throw fail('We could not send the verification code. Please try again.', error.code || 'MAIL_OTP_SEND_FAILED', error.status || 503);
    }

    pruneExpired().catch(() => {});
    return {
        ok: true,
        expiresAt,
        expiresInSeconds: OTP_TTL_MINUTES * 60
    };
}

async function verifyOtp({ email, purpose = 'email_verification', code }) {
    const normalizedEmail = normalizeEmail(email);
    const normalizedPurpose = normalizePurpose(purpose);
    const cleanCode = String(code || '').trim();
    if (!/^\d{6}$/.test(cleanCode)) {
        throw fail('Enter the 6-digit verification code.', 'MAIL_OTP_CODE_INVALID', 400);
    }

    const row = await MailOtp.findOne({
        where: {
            email: normalizedEmail,
            purpose: normalizedPurpose,
            consumedAt: null
        },
        order: [['createdAt', 'DESC']]
    });

    if (!row || new Date(row.expiresAt).getTime() <= Date.now()) {
        if (row && !row.consumedAt) {
            row.consumedAt = new Date();
            await row.save();
        }
        throw fail('This verification code has expired. Request a new code.', 'MAIL_OTP_EXPIRED', 410);
    }
    if (Number(row.attempts || 0) >= MAX_ATTEMPTS) {
        row.consumedAt = new Date();
        await row.save();
        throw fail('Too many incorrect attempts. Request a new verification code.', 'MAIL_OTP_ATTEMPTS_EXCEEDED', 429);
    }

    const expected = Buffer.from(row.codeHash, 'hex');
    const actual = Buffer.from(hashCode({ email: normalizedEmail, purpose: normalizedPurpose, code: cleanCode }), 'hex');
    const matches = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    if (!matches) {
        row.attempts = Number(row.attempts || 0) + 1;
        if (row.attempts >= MAX_ATTEMPTS) row.consumedAt = new Date();
        await row.save();
        throw fail(
            row.attempts >= MAX_ATTEMPTS
                ? 'Too many incorrect attempts. Request a new verification code.'
                : 'The verification code is incorrect.',
            row.attempts >= MAX_ATTEMPTS ? 'MAIL_OTP_ATTEMPTS_EXCEEDED' : 'MAIL_OTP_MISMATCH',
            row.attempts >= MAX_ATTEMPTS ? 429 : 400
        );
    }

    row.consumedAt = new Date();
    await row.save();
    const token = jwt.sign({
        typ: 'mail_otp',
        email: normalizedEmail,
        purpose: normalizedPurpose,
        otpId: row.id
    }, JWT_SECRET, { expiresIn: '15m' });

    return {
        ok: true,
        verified: true,
        verificationToken: token,
        expiresInSeconds: 15 * 60
    };
}

function verifyOtpToken(token, purpose = null) {
    try {
        const decoded = jwt.verify(String(token || ''), JWT_SECRET);
        if (decoded.typ !== 'mail_otp' || !decoded.email || !decoded.purpose) throw new Error('Invalid verification token');
        if (purpose && decoded.purpose !== normalizePurpose(purpose)) throw new Error('Verification purpose mismatch');
        return decoded;
    } catch (_) {
        throw fail('Verification has expired. Request a new code.', 'MAIL_OTP_TOKEN_INVALID', 401);
    }
}

module.exports = {
    ALLOWED_PURPOSES,
    OTP_TTL_MINUTES,
    MAX_ATTEMPTS,
    normalizeEmail,
    normalizePurpose,
    requestOtp,
    verifyOtp,
    verifyOtpToken
};
