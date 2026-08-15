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

    function buildMiddleware({ decoded, user, role }) {
        const jwt = {
            verify() {
                return decoded;
            }
        };
        const User = {
            async findByPk(id) {
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
                    message: 'Your account does not have access to SCORM AI. Please contact the administrator at tadsehimanshu@gmail.com.',
                    code: 'SCORM_ACCESS_DENIED',
                    adminContact: 'tadsehimanshu@gmail.com'
                };
            }
        };

        return proxyquire('../routes/middleware', {
            jsonwebtoken: jwt,
            '../models/User': User,
            '../services/scorm/ScormAccessService': access
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
        expect(req.userId).to.equal(11);
        expect(req.authScope).to.equal('scorm');
        expect(req.scormRole).to.equal('user');
        expect(req.scormEmail).to.equal('allowed@example.com');
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
        expect(res.body.code).to.equal('SCORM_ACCESS_DENIED');
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
});
