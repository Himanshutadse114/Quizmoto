const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

function makeResponse() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        }
    };
}

describe('SCORM access middleware', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
    });

    function buildMiddleware({ decoded, user, role, staffPolicy = null }) {
        const jwt = {
            verify() {
                return decoded;
            }
        };
        const User = {
            async findByPk(id) {
                if (Number(id) === 901) return { id: 901, email: 'tenant-host@lmsgen.internal' };
                expect(id).to.equal(decoded.userId);
                return user;
            }
        };
        const access = {
            async getAccessRole(email) {
                expect(email).to.equal(user.email);
                return role;
            },
            accessDeniedPayload() {
                return {
                    message: 'Your SCORM AI account is registered but not authorised yet. Please contact the administrator at tadsehimanshu@gmail.com to unlock access.',
                    code: 'SCORM_APPROVAL_PENDING',
                    pendingApproval: true,
                    adminContact: 'tadsehimanshu@gmail.com'
                };
            }
        };

        return proxyquire('../routes/middleware', {
            jsonwebtoken: jwt,
            '../models/User': User,
            '../services/scorm/ScormAccessService': access,
            '../services/scorm/ScormWorkspaceService': {
                async resolveWorkspaceContext() {
                    return {
                        workspace: { id: 'workspace-1', ownerUserId: 901, status: 'active' },
                        member: { id: 'member-1', role: role === 'user' ? 'admin' : role, status: 'active' },
                        hostId: 901,
                        role: role === 'user' ? 'admin' : role
                    };
                }
            },
            '../services/scorm/ScormStaffAuthService': {
                async getStaffPolicyForEmail() { return staffPolicy; }
            },
            '../services/scorm/ScormEntitlementService': {
                async enforceRequestEntitlement() { return null; }
            },
            '../services/scorm/ScormRbacService': {
                assertScormRouteAllowed() { return true; }
            }
        });
    }

    it('allows an active allowlisted SCORM user and attaches the current role', async () => {
        process.env.NODE_ENV = 'production';
        const middleware = buildMiddleware({
            decoded: { userId: 11, scope: 'scorm' },
            user: { id: 11, email: 'allowed@example.com' },
            role: 'user'
        });
        const req = {
            header: () => 'Bearer token',
            originalUrl: '/api/scorm/courses'
        };
        const res = makeResponse();
        let nextCalled = false;

        await middleware(req, res, () => { nextCalled = true; });

        expect(nextCalled).to.equal(true);
        expect(req.authenticatedUserId).to.equal(11);
        expect(req.userId).to.equal(901);
        expect(req.authScope).to.equal('scorm');
        expect(req.scormRole).to.equal('admin');
        expect(req.scormEmail).to.equal('allowed@example.com');
    });

    it('rejects a generic Google token when the tenant requires its Staff SSO flow', async () => {
        process.env.NODE_ENV = 'production';
        const middleware = buildMiddleware({
            decoded: { userId: 16, scope: 'scorm', authMethod: 'google', workspaceId: 'workspace-1' },
            user: { id: 16, email: 'staff@example.com' },
            role: 'co_admin',
            staffPolicy: {
                publicConfig: { staffSsoRequired: true, staffGoogleEnabled: true, staffMicrosoftEnabled: false }
            }
        });
        const req = { header: () => 'Bearer generic-google-token', originalUrl: '/api/scorm/courses' };
        const res = makeResponse();
        let nextCalled = false;

        await middleware(req, res, () => { nextCalled = true; });

        expect(nextCalled).to.equal(false);
        expect(res.statusCode).to.equal(403);
        expect(res.body.code).to.equal('SCORM_STAFF_SSO_REQUIRED');
    });

    it('accepts a tenant-issued Staff SSO token for the enabled provider', async () => {
        process.env.NODE_ENV = 'production';
        const middleware = buildMiddleware({
            decoded: { userId: 17, scope: 'scorm', authMethod: 'google', staffSso: true, workspaceId: 'workspace-1' },
            user: { id: 17, email: 'staff@example.com' },
            role: 'co_admin',
            staffPolicy: {
                publicConfig: { staffSsoRequired: true, staffGoogleEnabled: true, staffMicrosoftEnabled: false }
            }
        });
        const req = { header: () => 'Bearer tenant-staff-token', originalUrl: '/api/scorm/courses' };
        const res = makeResponse();
        let nextCalled = false;

        await middleware(req, res, () => { nextCalled = true; });

        expect(nextCalled).to.equal(true);
        expect(req.staffSso).to.equal(true);
    });

    it('enforces tenant Staff SSO on protected APIs outside the SCORM URL namespace', async () => {
        process.env.NODE_ENV = 'production';
        const middleware = buildMiddleware({
            decoded: { userId: 18, scope: 'scorm', authMethod: 'google', workspaceId: 'workspace-1' },
            user: { id: 18, email: 'staff@example.com' },
            role: 'admin',
            staffPolicy: {
                publicConfig: { staffSsoRequired: true, staffGoogleEnabled: true, staffMicrosoftEnabled: false }
            }
        });
        const req = { header: () => 'Bearer generic-google-token', originalUrl: '/api/quizzes' };
        const res = makeResponse();
        let nextCalled = false;

        await middleware(req, res, () => { nextCalled = true; });

        expect(nextCalled).to.equal(false);
        expect(res.statusCode).to.equal(403);
        expect(res.body.code).to.equal('SCORM_STAFF_SSO_REQUIRED');
    });

    it('rejects the same valid SCORM token after its live access grant is removed', async () => {
        process.env.NODE_ENV = 'production';
        const middleware = buildMiddleware({
            decoded: { userId: 12, scope: 'scorm' },
            user: { id: 12, email: 'revoked@example.com' },
            role: null
        });
        const req = {
            header: () => 'Bearer still-valid-jwt',
            originalUrl: '/api/scorm/tracking'
        };
        const res = makeResponse();
        let nextCalled = false;

        await middleware(req, res, () => { nextCalled = true; });

        expect(nextCalled).to.equal(false);
        expect(res.statusCode).to.equal(403);
        expect(res.body.code).to.equal('SCORM_APPROVAL_PENDING');
        expect(res.body.pendingApproval).to.equal(true);
        expect(res.body.adminContact).to.equal('tadsehimanshu@gmail.com');
    });

    it('rejects a Quizmoto token from protected SCORM admin APIs', async () => {
        process.env.NODE_ENV = 'production';
        const middleware = buildMiddleware({
            decoded: { userId: 13, scope: 'quizmoto' },
            user: { id: 13, email: 'host@example.com' },
            role: 'user'
        });
        const req = {
            header: () => 'Bearer quizmoto-token',
            originalUrl: '/api/scorm/courses'
        };
        const res = makeResponse();
        let nextCalled = false;

        await middleware(req, res, () => { nextCalled = true; });

        expect(nextCalled).to.equal(false);
        expect(res.statusCode).to.equal(401);
        expect(res.body.code).to.equal('SCORM_AUTH_REQUIRED');
    });

    it('rejects a pending platform token from every protected SCORM AI API', async () => {
        process.env.NODE_ENV = 'production';
        const middleware = buildMiddleware({
            decoded: { userId: 14, scope: 'platform', scormRole: 'pending' },
            user: { id: 14, email: 'pending@example.com' },
            role: null
        });
        const req = {
            header: () => 'Bearer pending-platform-token',
            originalUrl: '/api/scorm/author/generate'
        };
        const res = makeResponse();
        let nextCalled = false;

        await middleware(req, res, () => { nextCalled = true; });

        expect(nextCalled).to.equal(false);
        expect(res.statusCode).to.equal(401);
        expect(res.body.code).to.equal('SCORM_AUTH_REQUIRED');
    });

    it('allows the same pending platform token to use non-SCORM APIs such as Quizmoto', async () => {
        process.env.NODE_ENV = 'production';
        const middleware = buildMiddleware({
            decoded: { userId: 15, scope: 'platform', scormRole: 'pending' },
            user: { id: 15, email: 'pending.quiz@example.com' },
            role: null
        });
        const req = {
            header: () => 'Bearer pending-platform-token',
            originalUrl: '/api/quizzes'
        };
        const res = makeResponse();
        let nextCalled = false;

        await middleware(req, res, () => { nextCalled = true; });

        expect(nextCalled).to.equal(true);
        expect(req.userId).to.equal(15);
        expect(req.authScope).to.equal('platform');
    });
});
