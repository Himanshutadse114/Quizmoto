const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { Op } = require('sequelize');
const User = require('../models/User');
const {
    ADMIN_CONTACT_EMAIL,
    normalizeEmail,
    getAccessRole,
    ensureSuperAdminGrant,
    captureAccessRequest,
    pendingApprovalPayload
} = require('../services/scorm/ScormAccessService');

const { OAuth2Client } = require('google-auth-library');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '1001652255296-695gf3vjul0fjh1oden4k2n6tvvdvncn.apps.googleusercontent.com';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const scormAuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    keyGenerator: (req) => {
        const identity = normalizeEmail(req.body?.email || req.body?.identifier);
        if (identity) return `account:${identity}`;
        const credential = String(req.body?.credential || '');
        return credential ? `google:${credential.slice(-48)}` : 'scorm-auth-anonymous';
    },
    message: {
        message: 'Too many SCORM AI authentication attempts. Please wait a few minutes and try again.',
        code: 'SCORM_AUTH_RATE_LIMITED'
    }
});

// Protect SCORM Google/password authentication without changing Quizmoto host auth.
// The limiter key is account-based so reverse-proxy deployments do not place
// every user behind the same IP-based authentication bucket.
router.use('/scorm', scormAuthLimiter);

function issueToken(user, scope = 'quizmoto', extraClaims = {}) {
    return jwt.sign({ userId: user.id, scope, ...extraClaims }, JWT_SECRET, { expiresIn: '30d' });
}

function publicUser(user, token, extras = {}) {
    return {
        token,
        username: user.username,
        avatar: user.avatar || null,
        email: user.email || null,
        ...extras
    };
}

async function scormAuthResponse(user, role) {
    if (role === 'super_admin') await ensureSuperAdminGrant();
    const token = issueToken(user, 'scorm', { scormRole: role });
    return publicUser(user, token, {
        role,
        isSuperAdmin: role === 'super_admin',
        adminContact: ADMIN_CONTACT_EMAIL,
        product: 'scorm-ai'
    });
}

function pendingResponse(user, captured = true) {
    return {
        ...pendingApprovalPayload({ captured }),
        email: user?.email || null,
        username: user?.username || null,
        product: 'scorm-ai'
    };
}

// Google Sign-In for Quizmoto host access.
router.post('/google', async (req, res) => {
    try {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({ message: 'Google credential missing' });
        }

        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;

        let user = await User.findOne({ where: { googleId } });

        if (!user) {
            user = await User.findOne({ where: { email } });

            if (user) {
                user.googleId = googleId;
                user.avatar = picture;
                await user.save();
            } else {
                user = await User.create({
                    username: name || email.split('@')[0],
                    email,
                    googleId,
                    avatar: picture
                });
            }
        } else if (user.avatar !== picture) {
            user.avatar = picture;
            await user.save();
        }

        res.json(publicUser(user, issueToken(user, 'quizmoto')));
    } catch (err) {
        console.error('Google Auth Error:', err);
        res.status(500).json({ message: 'Authentication failed' });
    }
});

// Google Sign-In for SCORM AI. Google proves ownership of the email. The user
// identity is captured even when access has not yet been approved so the Super
// Admin can see and approve that request from Access Control.
router.post('/scorm/google', async (req, res) => {
    try {
        const credential = String(req.body?.credential || '');
        if (!credential) {
            return res.status(400).json({ message: 'Google credential missing' });
        }

        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload() || {};
        const googleId = String(payload.sub || '');
        const email = normalizeEmail(payload.email);
        const name = String(payload.name || '').trim();
        const picture = payload.picture || null;

        if (!googleId || !email || payload.email_verified !== true) {
            return res.status(401).json({ message: 'A verified Google email address is required.' });
        }

        let user = await User.findOne({ where: { googleId } });
        if (user && normalizeEmail(user.email) !== email) {
            const emailOwner = await User.findOne({ where: { email } });
            if (emailOwner && emailOwner.id !== user.id) {
                return res.status(409).json({ message: 'This Google email is already linked to another account.' });
            }
            user.email = email;
        }

        if (!user) user = await User.findOne({ where: { email } });

        if (user) {
            user.googleId = googleId;
            if (picture) user.avatar = picture;
            if (!user.username) user.username = name || email.split('@')[0];
            await user.save();
        } else {
            const baseUsername = name || email.split('@')[0];
            const usernameTaken = await User.findOne({ where: { username: baseUsername } });
            const safeUsername = usernameTaken
                ? `${baseUsername}-${Math.floor(1000 + Math.random() * 9000)}`
                : baseUsername;
            user = await User.create({
                username: safeUsername,
                email,
                googleId,
                avatar: picture
            });
        }

        await captureAccessRequest({
            userId: user.id,
            email,
            username: user.username,
            authMethod: 'google'
        });

        const role = await getAccessRole(email);
        if (!role) return res.status(202).json(pendingResponse(user, true));

        res.json(await scormAuthResponse(user, role));
    } catch (err) {
        console.error('SCORM AI Google auth error:', err);
        res.status(500).json({ message: 'SCORM AI Google authentication failed.' });
    }
});

// SCORM AI account registration always captures the account first. Access is
// still controlled independently by the Super Admin. A pending user keeps the
// same credentials and can use them after approval without registering again.
router.post('/scorm/register', async (req, res) => {
    try {
        const username = String(req.body?.username || '').trim();
        const email = normalizeEmail(req.body?.email);
        const password = String(req.body?.password || '');

        if (username.length < 2 || username.length > 80) {
            return res.status(400).json({ message: 'Name must be between 2 and 80 characters.' });
        }
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({ message: 'Enter a valid email address.' });
        }
        if (password.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters.' });
        }

        const role = await getAccessRole(email);
        if (role === 'super_admin') {
            return res.status(403).json({
                message: 'The SCORM AI super administrator must sign in with Google.',
                code: 'SCORM_SUPER_ADMIN_GOOGLE_REQUIRED',
                adminContact: ADMIN_CONTACT_EMAIL
            });
        }

        let user = await User.findOne({ where: { email } });
        if (user?.password) {
            await captureAccessRequest({
                userId: user.id,
                email,
                username: user.username,
                authMethod: user.googleId ? 'mixed' : 'password'
            });

            if (!role) {
                return res.status(409).json({
                    ...pendingResponse(user, false),
                    message: `This SCORM AI account is already registered and is still waiting for administrator approval. Please contact ${ADMIN_CONTACT_EMAIL}. After approval, sign in with the same credentials you already registered.`,
                    code: 'SCORM_ACCOUNT_EXISTS_PENDING'
                });
            }

            return res.status(409).json({
                message: 'This SCORM AI account is already registered and approved. Please log in with the same credentials.',
                code: 'SCORM_ACCOUNT_EXISTS',
                pendingApproval: false,
                adminContact: ADMIN_CONTACT_EMAIL
            });
        }

        if (user) {
            user.password = password;
            if (!user.username) user.username = username;
            await user.save();
        } else {
            const usernameTaken = await User.findOne({ where: { username } });
            const safeUsername = usernameTaken ? `${username}-${Math.floor(1000 + Math.random() * 9000)}` : username;
            user = await User.create({ username: safeUsername, email, password });
        }

        await captureAccessRequest({
            userId: user.id,
            email,
            username: user.username,
            authMethod: user.googleId ? 'mixed' : 'password'
        });

        if (!role) return res.status(202).json(pendingResponse(user, true));

        res.status(201).json(await scormAuthResponse(user, role));
    } catch (err) {
        console.error('SCORM AI registration error:', err);
        res.status(500).json({ message: 'Could not create the SCORM AI account.' });
    }
});

router.post('/scorm/login', async (req, res) => {
    try {
        const identifier = String(req.body?.identifier || '').trim();
        const password = String(req.body?.password || '');
        if (!identifier || !password) {
            return res.status(400).json({ message: 'Email or username and password are required.' });
        }

        const user = await User.findOne({
            where: {
                [Op.or]: [
                    { email: identifier.toLowerCase() },
                    { username: identifier }
                ]
            }
        });

        if (!user || !user.password || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'Invalid email/username or password.' });
        }

        const role = await getAccessRole(user.email);
        if (role === 'super_admin') {
            return res.status(403).json({
                message: 'The SCORM AI super administrator must sign in with Google.',
                code: 'SCORM_SUPER_ADMIN_GOOGLE_REQUIRED',
                adminContact: ADMIN_CONTACT_EMAIL
            });
        }

        if (!role) {
            await captureAccessRequest({
                userId: user.id,
                email: user.email,
                username: user.username,
                authMethod: user.googleId ? 'mixed' : 'password'
            });
            return res.status(403).json(pendingResponse(user, false));
        }

        res.json(await scormAuthResponse(user, role));
    } catch (err) {
        console.error('SCORM AI login error:', err);
        res.status(500).json({ message: 'SCORM AI login failed.' });
    }
});

// Test Auth for E2E
router.post('/test-login', async (req, res, next) => {
    if (process.env.NODE_ENV !== 'test') {
        return res.status(404).json({ message: 'Not found' });
    }

    try {
        const testRunId = req.body?.testRunId ? `-${req.body.testRunId}` : (process.env.TEST_RUN_ID ? `-${process.env.TEST_RUN_ID}` : '');
        const username = `testhost${testRunId}`;
        const email = `test${testRunId}@example.com`;

        let user = await User.findOne({ where: { username } });
        if (!user) {
            user = await User.create({ username, email });
        }
        const token = jwt.sign({ userId: user.id, scope: 'quizmoto' }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, username: user.username, avatar: user.avatar });
    } catch (err) {
        console.error('Test Auth Error:', err);
        res.status(500).json({ message: 'Auth failed' });
    }
});

module.exports = router;
