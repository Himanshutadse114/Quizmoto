const { expect } = require('chai');
const express = require('express');
const request = require('supertest');
const proxyquire = require('proxyquire').noCallThru();

const ADMIN = 'tadsehimanshu@gmail.com';

function makeUser(overrides = {}) {
    return {
        id: 50,
        username: 'Pending User',
        email: 'pending@example.com',
        password: 'hashed-password',
        googleId: null,
        avatar: null,
        async save() { return this; },
        async comparePassword(candidate) { return candidate === 'Password123!'; },
        ...overrides
    };
}

function buildApp({ role = null, existingUser = null, googlePayload = null } = {}) {
    const captured = [];
    const created = [];

    const User = {
        async findOne({ where }) {
            if (where?.email) return existingUser && existingUser.email === where.email ? existingUser : null;
            if (where?.username) return existingUser && existingUser.username === where.username ? existingUser : null;
            if (where?.googleId) return existingUser && existingUser.googleId === where.googleId ? existingUser : null;
            if (existingUser) return existingUser;
            return null;
        },
        async create(values) {
            created.push(values);
            return makeUser({
                id: 60,
                username: values.username,
                email: values.email,
                password: values.password,
                googleId: values.googleId || null,
                avatar: values.avatar || null
            });
        }
    };

    const access = {
        ADMIN_CONTACT_EMAIL: ADMIN,
        normalizeEmail(value) {
            return String(value || '').trim().toLowerCase();
        },
        async getAccessRole() {
            return role;
        },
        async ensureSuperAdminGrant() {
            return null;
        },
        async captureAccessRequest(values) {
            captured.push(values);
            return { id: 1, status: role ? 'approved' : 'pending', ...values };
        },
        pendingApprovalPayload({ captured: wasCaptured = true } = {}) {
            return {
                message: wasCaptured
                    ? `Your registration has been captured, but your SCORM AI account is not authorised yet. Please contact the administrator at ${ADMIN} to unlock access. After approval, you can sign in using the same credentials you just registered.`
                    : `Your SCORM AI account is registered but not authorised yet. Please contact the administrator at ${ADMIN} to unlock access. After approval, use the same registered credentials to sign in.`,
                code: 'SCORM_APPROVAL_PENDING',
                pendingApproval: true,
                registrationCaptured: wasCaptured,
                adminContact: ADMIN
            };
        }
    };

    class OAuth2Client {
        async verifyIdToken() {
            return {
                getPayload() {
                    return googlePayload;
                }
            };
        }
    }

    const authRouter = proxyquire('../routes/auth', {
        '../models/User': User,
        '../services/scorm/ScormAccessService': access,
        'express-rate-limit': () => (req, res, next) => next(),
        jsonwebtoken: { sign: () => 'signed-scorm-token' },
        'google-auth-library': { OAuth2Client }
    });

    const app = express();
    app.use(express.json());
    app.use('/', authRouter);
    return { app, captured, created };
}

describe('SCORM pending approval authentication', () => {
    it('stores a normal registration and returns pending approval without a SCORM token', async () => {
        const { app, captured, created } = buildApp({ role: null });

        const res = await request(app)
            .post('/scorm/register')
            .send({
                username: 'Pending User',
                email: 'PENDING@example.com',
                password: 'Password123!'
            });

        expect(res.status).to.equal(202);
        expect(res.body.pendingApproval).to.equal(true);
        expect(res.body.registrationCaptured).to.equal(true);
        expect(res.body.code).to.equal('SCORM_APPROVAL_PENDING');
        expect(res.body.token).to.equal(undefined);
        expect(res.body.message).to.include('registration has been captured');
        expect(res.body.message).to.include('same credentials');
        expect(res.body.message).to.include(ADMIN);
        expect(created).to.have.length(1);
        expect(created[0].email).to.equal('pending@example.com');
        expect(captured).to.have.length(1);
        expect(captured[0].email).to.equal('pending@example.com');
        expect(captured[0].authMethod).to.equal('password');
    });

    it('captures an unapproved Google identity as pending instead of granting SCORM access', async () => {
        const googlePayload = {
            sub: 'google-user-1',
            email: 'google.pending@example.com',
            email_verified: true,
            name: 'Google Pending',
            picture: 'https://example.com/avatar.png'
        };
        const { app, captured, created } = buildApp({ role: null, googlePayload });

        const res = await request(app)
            .post('/scorm/google')
            .send({ credential: 'google-credential' });

        expect(res.status).to.equal(202);
        expect(res.body.pendingApproval).to.equal(true);
        expect(res.body.registrationCaptured).to.equal(true);
        expect(res.body.token).to.equal(undefined);
        expect(created).to.have.length(1);
        expect(created[0].email).to.equal('google.pending@example.com');
        expect(created[0].googleId).to.equal('google-user-1');
        expect(captured).to.have.length(1);
        expect(captured[0].authMethod).to.equal('google');
        expect(captured[0].email).to.equal('google.pending@example.com');
    });

    it('allows registration immediately when the Super Admin pre-approved that email', async () => {
        const { app, captured } = buildApp({ role: 'user' });

        const res = await request(app)
            .post('/scorm/register')
            .send({
                username: 'Approved User',
                email: 'approved@example.com',
                password: 'Password123!'
            });

        expect(res.status).to.equal(201);
        expect(res.body.token).to.equal('signed-scorm-token');
        expect(res.body.role).to.equal('user');
        expect(res.body.isSuperAdmin).to.equal(false);
        expect(captured).to.have.length(1);
    });

    it('keeps a registered user blocked at login until approval', async () => {
        const existingUser = makeUser();
        const { app, captured } = buildApp({ role: null, existingUser });

        const res = await request(app)
            .post('/scorm/login')
            .send({ identifier: existingUser.email, password: 'Password123!' });

        expect(res.status).to.equal(403);
        expect(res.body.pendingApproval).to.equal(true);
        expect(res.body.registrationCaptured).to.equal(false);
        expect(res.body.message).to.include('same registered credentials');
        expect(captured).to.have.length(1);
        expect(captured[0].userId).to.equal(existingUser.id);
    });

    it('accepts the exact same registered password after approval', async () => {
        const existingUser = makeUser();
        const { app, captured } = buildApp({ role: 'user', existingUser });

        const res = await request(app)
            .post('/scorm/login')
            .send({ identifier: existingUser.email, password: 'Password123!' });

        expect(res.status).to.equal(200);
        expect(res.body.token).to.equal('signed-scorm-token');
        expect(res.body.email).to.equal(existingUser.email);
        expect(res.body.username).to.equal(existingUser.username);
        expect(captured).to.have.length(0);
    });
});
