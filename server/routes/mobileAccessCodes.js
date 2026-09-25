const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const auth = require('./middleware');
const User = require('../models/User');
const MobileAccessCode = require('../models/MobileAccessCode');

const router = express.Router();

// Signing secret: identical expression to server/routes/auth.js and
// server/routes/middleware.js at this revision, so mobile tokens verify
// with the same secret everywhere. On Render JWT_SECRET is always set.
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

function issueMobileToken(user) {
    // Mirrors issueToken(user, scope, extraClaims) from server/routes/auth.js.
    // Scope 'scorm' (not a custom scope): server/routes/middleware.js only
    // privileges scope 'scorm' — any /api/scorm/* request with another scope
    // is rejected 401 (SCORM_AUTH_REQUIRED) outside NODE_ENV=test.
    const expiresIn = process.env.LMSGEN_AUTH_TOKEN_TTL || '30d';
    return jwt.sign({
        userId: user.id,
        scope: 'scorm',
        authVersion: Number(user.authVersion || 0),
        authMethod: 'mobile-code'
    }, JWT_SECRET, { expiresIn, algorithm: 'HS256' });
}

// Codes are typed by hand on a phone keypad: unambiguous alphabet (no I, L,
// O, 0, 1 to avoid lookalike confusion). Stored as SHA-256 of the normalized
// (unformatted, uppercased) value.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 12;
const MAX_ACTIVE_CODES = 5;

function normalizeCode(input) {
    return String(input || '').replace(/[\s-]/g, '').toUpperCase();
}

function hashCode(normalized) {
    return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

function generateCode() {
    let raw = '';
    for (let i = 0; i < CODE_LENGTH; i += 1) {
        raw += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
    }
    return raw;
}

function formatCode(raw) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

function hashMatches(storedHash, candidateHash) {
    const a = Buffer.from(String(storedHash || ''), 'utf8');
    const b = Buffer.from(String(candidateHash || ''), 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function invalidCode(res) {
    // Generic on purpose: no user enumeration, no hint about whether the
    // code exists, is revoked or is expired. Never log the submitted code.
    return res.status(401).json({
        message: 'Invalid or expired access code.',
        code: 'MOBILE_CODE_INVALID'
    });
}

// Strict brute-force protection on the public exchange endpoint:
// 10 attempts per 15 minutes per client IP AND per normalized code.
const exchangeIpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    message: {
        message: 'Too many access-code attempts from this network. Please wait and try again.',
        code: 'MOBILE_CODE_IP_RATE_LIMITED'
    }
});

const exchangeCodeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `mobile-code:${normalizeCode(req.body?.code) || 'blank'}`,
    skip: () => process.env.NODE_ENV === 'test',
    message: {
        message: 'Too many attempts for this access code. Please wait and try again.',
        code: 'MOBILE_CODE_ATTEMPT_RATE_LIMITED'
    }
});

function ownedCodeWhere(req) {
    return { id: req.params.id, userId: req.userId };
}

// ---------------------------------------------------------------------------
// Public: exchange a one-time access code for a mobile JWT.
// ---------------------------------------------------------------------------
router.post('/exchange', exchangeIpLimiter, exchangeCodeLimiter, async (req, res) => {
    try {
        const normalized = normalizeCode(req.body?.code);
        if (!normalized) return invalidCode(res);

        const candidateHash = hashCode(normalized);
        const record = await MobileAccessCode.findOne({ where: { codeHash: candidateHash } });
        if (!record || !hashMatches(record.codeHash, candidateHash)) return invalidCode(res);
        if (record.revokedAt) return invalidCode(res);
        if (record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now()) return invalidCode(res);

        const user = await User.findByPk(record.userId);
        if (!user) return invalidCode(res);

        record.lastUsedAt = new Date();
        await record.save();

        // Best-effort: also mint a scorm_learner token for the user's own
        // workspace so the mobile app's Courses tab works when the account has
        // assigned learning. Any failure (no workspace, no email on the user
        // row, SCORM_LEARNER_NOT_ASSIGNED, config/DB error) silently omits the
        // token — the host token above still unlocks everything else.
        let learnerToken = null;
        let learnerWorkspaceId = null;
        try {
            const ScormWorkspace = require('../models/scorm/ScormWorkspace');
            const { createLearnerSessionFromIdentity } =
                require('../services/scorm/ScormLearnerAuthService');
            const workspace = await ScormWorkspace.findOne({
                where: { ownerUserId: user.id, status: 'active' }
            });
            if (workspace && user.email) {
                const session = await createLearnerSessionFromIdentity({
                    workspaceId: workspace.id,
                    identity: {
                        email: user.email,
                        name: user.displayName || user.username || user.email,
                        provider: 'mobile-code'
                    }
                });
                learnerToken = session.token;
                learnerWorkspaceId = workspace.id;
            }
        } catch (err) {
            // Log the event only — never the code, email, or user id.
            console.warn('[mobile-access] learner token mint skipped', {
                code: (err && err.code) || 'UNKNOWN'
            });
        }

        return res.json({
            token: issueMobileToken(user),
            // Present only when the account owns an active workspace AND has
            // assigned learning in it. Absent otherwise (silent omission).
            ...(learnerToken ? { learnerToken, learnerWorkspaceId } : {}),
            user: {
                id: user.id,
                name: user.displayName || user.username,
                email: user.email || null,
                avatar: user.avatar || null
            }
        });
    } catch (err) {
        return res.status(500).json({ message: 'Could not verify the access code. Please try again.' });
    }
});

// ---------------------------------------------------------------------------
// Authenticated: manage the user's access codes.
// ---------------------------------------------------------------------------
router.get('/codes', auth, async (req, res) => {
    try {
        const codes = await MobileAccessCode.findAll({
            where: { userId: req.userId },
            order: [['createdAt', 'DESC']]
        });
        return res.json({
            codes: codes.map((record) => ({
                id: record.id,
                label: record.label || null,
                createdAt: record.createdAt,
                lastUsedAt: record.lastUsedAt || null,
                revoked: Boolean(record.revokedAt)
            }))
        });
    } catch (err) {
        return res.status(500).json({ message: 'Could not load access codes. Please try again.' });
    }
});

router.post('/codes', auth, async (req, res) => {
    try {
        const activeCount = await MobileAccessCode.count({
            where: { userId: req.userId, revokedAt: null }
        });
        if (activeCount >= MAX_ACTIVE_CODES) {
            return res.status(409).json({
                message: `You can have at most ${MAX_ACTIVE_CODES} active access codes. Revoke one before generating a new code.`,
                code: 'MOBILE_CODE_LIMIT_REACHED'
            });
        }

        const raw = generateCode();
        const record = await MobileAccessCode.create({
            userId: req.userId,
            codeHash: hashCode(raw),
            label: String(req.body?.label || '').slice(0, 120) || null
        });

        // The plaintext code is returned exactly once. It is never stored and
        // cannot be recovered afterwards.
        return res.status(201).json({
            id: record.id,
            label: record.label || null,
            code: formatCode(raw),
            createdAt: record.createdAt
        });
    } catch (err) {
        return res.status(500).json({ message: 'Could not generate an access code. Please try again.' });
    }
});

router.post('/codes/:id/regenerate', auth, async (req, res) => {
    try {
        const record = await MobileAccessCode.findOne({ where: ownedCodeWhere(req) });
        if (!record) return res.status(404).json({ message: 'Access code not found.' });

        const raw = generateCode();
        record.codeHash = hashCode(raw);
        record.lastUsedAt = null;
        record.revokedAt = null;
        await record.save();

        return res.json({
            id: record.id,
            label: record.label || null,
            code: formatCode(raw),
            createdAt: record.createdAt
        });
    } catch (err) {
        return res.status(500).json({ message: 'Could not regenerate the access code. Please try again.' });
    }
});

router.delete('/codes/:id', auth, async (req, res) => {
    try {
        const record = await MobileAccessCode.findOne({ where: ownedCodeWhere(req) });
        if (!record) return res.status(404).json({ message: 'Access code not found.' });

        if (!record.revokedAt) {
            record.revokedAt = new Date();
            await record.save();
        }

        // Kill-switch: the auth middleware (server/routes/middleware.js) rejects
        // any token whose authVersion does not match the user's current
        // authVersion, so bumping it here immediately invalidates every mobile
        // JWT previously issued from this account's codes (and all other
        // sessions, which is the intended "revoke everything" behaviour).
        const user = await User.findByPk(req.userId);
        if (user) await user.increment('authVersion', { by: 1 });

        return res.json({ revoked: true });
    } catch (err) {
        return res.status(500).json({ message: 'Could not revoke the access code. Please try again.' });
    }
});

module.exports = router;
