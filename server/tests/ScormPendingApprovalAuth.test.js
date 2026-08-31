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

function buildApp({ role = null, existingUser = null, googlePayload = null, tenantAssigned = true } = {}) {
    const captured = [];
    const created = [];
    const workspace = { id: 'tenant-1', ownerUserId: 900, name: 'Acme Tenant', status: 'active' };
    const member = {
        id: 'member-1',
        workspaceId: workspace.id,
        userId: existingUser?.id || 50,
        email: existingUser?.email || googlePayload?.email || 'approved@example.com',
        role: role || 'admin',
        status: 'active'
    };

    const User = {
        async findOne({ where }) {
            if (where?.email) return existingUser && existingUser.email === where.email ? existingUser : null;
            if (where?.username) return existingUser && existingUser.username === where.username ? existingUser : null;
            if (where?.googleId) return existingUser && existingUser.googleId === where.googleId ? existingUser : null;
            if (existingUser) return existingUser;
            return null;
        },
        async findByPk(id) {
            return existingUser && Number(existingUser.id) === Number(id) ? existingUser : null;
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
                    ? `Your registration has been captured, but your LMSGEN account is not authorised yet. Please contact ${ADMIN}.`
                    : `Your LMSGEN account is registered but not authorised yet. Please contact ${ADMIN}.`,
                code: 'SCORM_APPROVAL_PENDING',
                pendingApproval: true,
                registrationCaptured: wasCaptured,
                adminContact: ADMIN
            };
        }
    };

    class OAuth2Client {
        async verifyIdToken() {
            return { getPayload() { return googlePayload; } };
        }
    }

    const authRouter = proxyquire('../routes/auth', {
        '../models/User': User,
        '../models/scorm': {
            ScormWorkspace: {
                async findByPk(id) { return tenantAssigned && id === workspace.id ? workspace : null; }
            },
            ScormWorkspaceMember: {
                async findOne({ where }) {
                    if (!tenantAssigned || !role || role === 'super_admin') return null;
                    return { ...member, email: where?.email || member.email, role };
                }
            }
        },
        '../services/scorm/ScormAccessService': access,
        './middleware': (req, _res, next) => {
            req.userId = existingUser?.id || 50;
            req.authScope = 'platform';
            next();
        },
        'express-rate-limit': () => (req, res, next) => next(),
        jsonwebtoken: { sign: () => 'signed-scorm-token' },
        'google-auth-library': { OAuth2Client }
    });

    const app = express();
    app.use(express.json());
    app.use('/', authRouter);
    return { app, captured, created };
}

describe('LMSGEN authentication and tenant assignment', () => {
    it('stores a normal registration and returns a limited platform session while access is pending', async () => {
        const { app, captured, created } = buildApp({ role: null });
        const res = await request(app).post('/scorm/register').send({
            username: 'Pending User', email: 'PENDING@example.com', password: 'Password123!'
        });
        expect(res.status).to.equal(202);
        expect(res.body.pendingApproval).to.equal(true);
        expect(res.body.scormAccess).to.equal(false);
        expect(created).to.have.length(1);
        expect(captured).to.have.length(1);
    });

    it('keeps an unassigned Google identity in Quizmoto instead of creating LMSGEN tenant access', async () => {
        const googlePayload = {
            sub: 'google-user-1',
            email: 'google.pending@example.com',
            email_verified: true,
            name: 'Google Pending',
            picture: 'https://example.com/avatar.png'
        };
        const { app, captured, created } = buildApp({ role: null, googlePayload });
        const res = await request(app).post('/scorm/google').send({ credential: 'google-credential' });
        expect(res.status).to.equal(200);
        expect(res.body.quizmotoOnly).to.equal(true);
        expect(res.body.scormAccess).to.equal(false);
        expect(res.body.role).to.equal('quizmoto');
        expect(created).to.have.length(1);
        expect(captured).to.have.length(0);
    });

    it('allows a tenant Admin to register when the email is pre-assigned to a tenant', async () => {
        const { app, captured } = buildApp({ role: 'admin', tenantAssigned: true });
        const res = await request(app).post('/scorm/register').send({
            username: 'Approved User', email: 'approved@example.com', password: 'Password123!'
        });
        expect(res.status).to.equal(201);
        expect(res.body.scormAccess).to.equal(true);
        expect(res.body.role).to.equal('admin');
        expect(res.body.tenantId).to.equal('tenant-1');
        expect(captured).to.have.length(1);
    });

    it('rejects an authorised account that has not actually been assigned to a tenant', async () => {
        const existingUser = makeUser({ email: 'orphan@example.com' });
        const { app } = buildApp({ role: 'admin', existingUser, tenantAssigned: false });
        const res = await request(app).post('/scorm/login').send({
            identifier: existingUser.email, password: 'Password123!'
        });
        expect(res.status).to.equal(403);
        expect(res.body.code).to.equal('SCORM_TENANT_MEMBERSHIP_REQUIRED');
    });

    it('lets a registered pending user enter the limited platform while tenant access remains locked', async () => {
        const existingUser = makeUser();
        const { app, captured } = buildApp({ role: null, existingUser });
        const res = await request(app).post('/scorm/login').send({ identifier: existingUser.email, password: 'Password123!' });
        expect(res.status).to.equal(200);
        expect(res.body.pendingApproval).to.equal(true);
        expect(res.body.scormAccess).to.equal(false);
        expect(captured).to.have.length(1);
    });

    it('returns the assigned tenant when an authorised session refreshes', async () => {
        const existingUser = makeUser({ email: 'approved@example.com' });
        const { app } = buildApp({ role: 'admin', existingUser, tenantAssigned: true });
        const res = await request(app).get('/scorm/status').set('Authorization', 'Bearer platform-token');
        expect(res.status).to.equal(200);
        expect(res.body.scormAccess).to.equal(true);
        expect(res.body.role).to.equal('admin');
        expect(res.body.tenantId).to.equal('tenant-1');
    });

    it('keeps a signed-in pending account limited when no tenant grant exists', async () => {
        const existingUser = makeUser();
        const { app } = buildApp({ role: null, existingUser });
        const res = await request(app).get('/scorm/status').set('Authorization', 'Bearer platform-token');
        expect(res.status).to.equal(200);
        expect(res.body.pendingApproval).to.equal(true);
        expect(res.body.scormAccess).to.equal(false);
    });

    it('accepts the same password after the account is assigned to a tenant', async () => {
        const existingUser = makeUser({ email: 'approved@example.com' });
        const { app, captured } = buildApp({ role: 'admin', existingUser, tenantAssigned: true });
        const res = await request(app).post('/scorm/login').send({ identifier: existingUser.email, password: 'Password123!' });
        expect(res.status).to.equal(200);
        expect(res.body.email).to.equal(existingUser.email);
        expect(res.body.scormAccess).to.equal(true);
        expect(res.body.tenantName).to.equal('Acme Tenant');
        expect(captured).to.have.length(0);
    });
});
