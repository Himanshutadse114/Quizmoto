const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { Op } = require('sequelize');
const User = require('../models/User');
const { ScormWorkspace, ScormWorkspaceMember } = require('../models/scorm');
const auth = require('./middleware');
const {
    ADMIN_CONTACT_EMAIL,
    normalizeEmail,
    getAccessRole,
    ensureSuperAdminGrant,
    captureAccessRequest,
    pendingApprovalPayload
} = require('../services/scorm/ScormAccessService');
const { verifyOtpToken } = require('../services/mail/MailOtpService');

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
        message: 'Too many LMSGEN authentication attempts. Please wait a few minutes and try again.',
        code: 'SCORM_AUTH_RATE_LIMITED'
    }
});

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

function requireVerifiedOtpForEmail(token, purpose, expectedEmail) {
    if (process.env.NODE_ENV === 'test' && !token) return { email: expectedEmail, purpose };
    const verification = verifyOtpToken(token, purpose);
    if (normalizeEmail(verification.email) !== normalizeEmail(expectedEmail)) {
        const err = new Error('Email verification does not match this account. Request a new code.');
        err.status = 401;
        err.code = 'MAIL_OTP_EMAIL_MISMATCH';
        throw err;
    }
    return verification;
}

async function tenantForUser(user, role) {
    if (role === 'super_admin') return { member: null, workspace: null };
    const email = normalizeEmail(user?.email);
    const member = email ? await ScormWorkspaceMember.findOne({ where: { email } }) : null;
    if (!member || member.status === 'disabled') {
        const err = new Error('Your LMSGEN account is authorised but has not been assigned to a tenant. Contact the Super Admin.');
        err.status = 403;
        err.code = 'SCORM_TENANT_MEMBERSHIP_REQUIRED';
        throw err;
    }
    const workspace = await ScormWorkspace.findByPk(member.workspaceId);
    if (!workspace || workspace.status !== 'active') {
        const err = new Error('Your LMSGEN tenant is not active.');
        err.status = 403;
        err.code = 'SCORM_TENANT_INACTIVE';
        throw err;
    }
    return { member, workspace };
}

async function scormAuthResponse(user, role, { authMethod = 'password' } = {}) {
    if (role === 'super_admin') await ensureSuperAdminGrant();
    const { workspace } = await tenantForUser(user, role);
    const workspaceId = workspace?.id || null;
    const token = issueToken(user, 'scorm', {
        scormRole: role,
        workspaceId,
        authMethod
    });
    return publicUser(user, token, {
        role,
        isSuperAdmin: role === 'super_admin',
        adminContact: ADMIN_CONTACT_EMAIL,
        product: 'scorm-ai',
        platformAccess: true,
        scormAccess: true,
        pendingApproval: false,
        workspaceId,
        workspaceName: workspace?.name || null,
        tenantId: workspaceId,
        tenantName: workspace?.name || null,
        authMethod
    });
}

function pendingResponse(user, captured = true) {
    const token = user ? issueToken(user, 'platform', { scormRole: 'pending' }) : null;
    return {
        ...pendingApprovalPayload({ captured }),
        token,
        email: user?.email || null,
        username: user?.username || null,
        role: 'pending',
        isSuperAdmin: false,
        product: 'scorm-ai',
        platformAccess: Boolean(token),
        scormAccess: false
    };
}

function quizmotoOnlyResponse(user) {
    return publicUser(user, issueToken(user, 'quizmoto', { authMethod: 'google' }), {
        role: 'quizmoto',
        isSuperAdmin: false,
        product: 'quizmoto',
        platformAccess: true,
        scormAccess: false,
        pendingApproval: false,
        quizmotoOnly: true,
        authMethod: 'google'
    });
}

async function platformGoogleResponse(user) {
    const role = await getAccessRole(user.email);
    if (!role) return quizmotoOnlyResponse(user);
    return scormAuthResponse(user, role, { authMethod: 'google' });
}

router.get('/scorm/status', auth, async (req, res) => {
    try {
        const user = await User.findByPk(req.userId);
        if (!user) {
            return res.status(401).json({ message: 'Platform account no longer exists.', code: 'PLATFORM_AUTH_REQUIRED' });
        }

        const role = await getAccessRole(user.email);
        if (!role) return res.json(pendingResponse(user, false));
        return res.json(await scormAuthResponse(user, role, { authMethod: req.authMethod || 'password' }));
    } catch (err) {
        console.error('LMSGEN access status error:', err);
        return res.status(err.status || 500).json({
            message: err.message || 'Could not refresh LMSGEN access status.',
            code: err.code
        });
    }
});

router.use('/scorm', scormAuthLimiter);

async function ensureGoogleUser(payload) {
    const googleId = String(payload?.sub || '');
    const email = normalizeEmail(payload?.email);
    const name = String(payload?.name || '').trim();
    const picture = payload?.picture || null;
    if (!googleId || !email || payload?.email_verified !== true) {
        const err = new Error('A verified Google email address is required.');
        err.status = 401;
        throw err;
    }

    let user = await User.findOne({ where: { googleId } });
    if (user && normalizeEmail(user.email) !== email) {
        const emailOwner = await User.findOne({ where: { email } });
        if (emailOwner && emailOwner.id !== user.id) {
            const err = new Error('This Google email is already linked to another account.');
            err.status = 409;
            throw err;
        }
        user.email = email;
    }
    if (!user) user = await User.findOne({ where: { email } });

    if (user) {
        user.googleId = googleId;
        if (picture) user.avatar = picture;
        if (!user.username) user.username = name || email.split('@')[0];
        await user.save();
        return user;
    }

    const baseUsername = name || email.split('@')[0];
    const usernameTaken = await User.findOne({ where: { username: baseUsername } });
    return User.create({
        username: usernameTaken ? `${baseUsername}-${Math.floor(1000 + Math.random() * 9000)}` : baseUsername,
        email,
        googleId,
        avatar: picture
    });
}

async function googleLogin(req, res) {
    try {
        const credential = String(req.body?.credential || '');
        if (!credential) return res.status(400).json({ message: 'Google credential missing' });
        const ticket = await client.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
        const user = await ensureGoogleUser(ticket.getPayload() || {});
        res.json(await platformGoogleResponse(user));
    } catch (err) {
        console.error('Google Auth Error:', err);
        res.status(err.status || 500).json({
            message: err.message || 'Google authentication failed.',
            code: err.code
        });
    }
}

// Common Google sign-in: authorised tenant staff and the protected Super Admin
// receive full LMSGEN access. Unassigned Google identities remain Quizmoto-only.
router.post('/google', googleLogin);
router.post('/scorm/google', googleLogin);

router.post('/scorm/register', async (req, res) => {
    try {
        const username = String(req.body?.username || '').trim();
        const email = normalizeEmail(req.body?.email);
        const password = String(req.body?.password || '');
        const verificationToken = String(req.body?.verificationToken || '');

        if (username.length < 2 || username.length > 80) {
            return res.status(400).json({ message: 'Name must be between 2 and 80 characters.' });
        }
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({ message: 'Enter a valid email address.' });
        }
        if (password.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters.' });
        }

        requireVerifiedOtpForEmail(verificationToken, 'email_verification', email);

        const role = await getAccessRole(email);
        if (role === 'super_admin') {
            return res.status(403).json({
                message: 'The Super Admin account already exists. Sign in with its existing password or Google account.',
                code: 'SCORM_SUPER_ADMIN_ACCOUNT_MANAGED',
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
                    message: `This account is already registered but has not been assigned to an LMSGEN tenant. Please contact ${ADMIN_CONTACT_EMAIL}.`,
                    code: 'SCORM_ACCOUNT_EXISTS_PENDING'
                });
            }

            return res.status(409).json({
                message: 'This LMSGEN account is already registered. Please sign in with the same credentials.',
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
        res.status(201).json(await scormAuthResponse(user, role, { authMethod: 'password' }));
    } catch (err) {
        console.error('LMSGEN registration error:', err);
        res.status(err.status || 500).json({ message: err.message || 'Could not create the LMSGEN account.', code: err.code });
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
        if (!role) {
            await captureAccessRequest({
                userId: user.id,
                email: user.email,
                username: user.username,
                authMethod: user.googleId ? 'mixed' : 'password'
            });
            return res.json(pendingResponse(user, false));
        }

        res.json(await scormAuthResponse(user, role, { authMethod: 'password' }));
    } catch (err) {
        console.error('LMSGEN login error:', err);
        res.status(err.status || 500).json({ message: err.message || 'LMSGEN login failed.', code: err.code });
    }
});

router.post('/scorm/reset-password', async (req, res) => {
    try {
        const email = normalizeEmail(req.body?.email);
        const newPassword = String(req.body?.newPassword || '');
        const verificationToken = String(req.body?.verificationToken || '');

        if (!/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({ message: 'Enter a valid email address.' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters.' });
        }

        requireVerifiedOtpForEmail(verificationToken, 'password_reset', email);

        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({
                message: 'No LMSGEN account exists for this email address.',
                code: 'SCORM_ACCOUNT_NOT_FOUND'
            });
        }

        user.password = newPassword;
        await user.save();

        res.json({
            ok: true,
            message: 'Your password has been reset. You can now sign in with the new password.'
        });
    } catch (err) {
        console.error('LMSGEN password reset error:', err);
        res.status(err.status || 500).json({
            message: err.message || 'Could not reset the password.',
            code: err.code
        });
    }
});

router.post('/test-login', async (req, res) => {
    if (process.env.NODE_ENV !== 'test') {
        return res.status(404).json({ message: 'Not found' });
    }

    try {
        const testRunId = req.body?.testRunId ? `-${req.body.testRunId}` : (process.env.TEST_RUN_ID ? `-${process.env.TEST_RUN_ID}` : '');
        const username = `testhost${testRunId}`;
        const email = `test${testRunId}@example.com`;

        let user = await User.findOne({ where: { username } });
        if (!user) user = await User.create({ username, email });
        const token = jwt.sign({ userId: user.id, scope: 'quizmoto' }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, username: user.username, avatar: user.avatar });
    } catch (err) {
        console.error('Test Auth Error:', err);
        res.status(500).json({ message: 'Auth failed' });
    }
});

module.exports = router;
