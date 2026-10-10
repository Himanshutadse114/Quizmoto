const { expect } = require('chai');
const express = require('express');
const request = require('supertest');
const proxyquire = require('proxyquire').noCallThru();

function buildApp(scope) {
    const router = proxyquire('../routes/scorm/avatarStudioPayments', {
        '../middleware': (req, res, next) => {
            req.authScope = scope;
            req.authenticatedUserId = 41;
            next();
        }
    });
    const app = express();
    app.use(express.json());
    app.use('/api/avatar-studio/payments', router);
    return app;
}

describe('Avatar Studio payment authentication', () => {
    for (const scope of ['scorm', 'trial']) {
        it(`accepts an authenticated ${scope} LMSGEN session`, async () => {
            const response = await request(buildApp(scope))
                .get('/api/avatar-studio/payments/entitlement');

            expect(response.status).to.equal(400);
            expect(response.body.message).to.equal('A valid avatar fingerprint is required.');
        });
    }

    it('rejects a Quizmoto-only session', async () => {
        const response = await request(buildApp('quizmoto'))
            .get('/api/avatar-studio/payments/entitlement');

        expect(response.status).to.equal(401);
        expect(response.body.message).to.equal('LMSGEN platform login required.');
    });
});
