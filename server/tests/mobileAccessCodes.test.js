const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const { connectDB, sequelize } = require('../config/database');
const User = require('../models/User');
const MobileAccessCode = require('../models/MobileAccessCode');
const mobileAccessRouter = require('../routes/mobileAccessCodes');

const GENERIC_MESSAGE = 'Invalid or expired access code.';

describe('Mobile Access Codes', () => {
    let app;
    let user;
    let authToken;

    function signLmsgenToken(targetUser) {
        return jwt.sign(
            {
                userId: targetUser.id,
                scope: 'lmsgen',
                authVersion: Number(targetUser.authVersion || 0)
            },
            JWT_SECRET,
            { algorithm: 'HS256' }
        );
    }

    async function generateCode(targetUser, label) {
        // Always sign against the current authVersion: earlier tests bump it
        // via the revoke kill-switch, so a token minted in before() goes stale.
        const fresh = await User.findByPk(targetUser.id);
        const token = signLmsgenToken(fresh);
        const res = await request(app)
            .post('/api/mobile-access/codes')
            .set('Authorization', `Bearer ${token}`)
            .send({ label });
        expect(res.status).to.equal(201);
        return res.body.code;
    }

    async function freshAuthToken(targetUser) {
        return signLmsgenToken(await User.findByPk(targetUser.id));
    }

    before(async () => {
        await connectDB();
        await sequelize.sync({ force: true });

        app = express();
        app.use(express.json());
        app.use('/api/mobile-access', mobileAccessRouter);

        user = await User.create({
            username: 'mobile-user',
            email: 'mobile-user@example.com',
            password: 'password123',
            displayName: 'Mobile User'
        });
        authToken = signLmsgenToken(user);
    });

    it('generates a code in XXXX-XXXX-XXXX format and stores only the hash', async () => {
        const res = await request(app)
            .post('/api/mobile-access/codes')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ label: 'My phone' });

        expect(res.status).to.equal(201);
        expect(res.body.code).to.match(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
        expect(res.body.label).to.equal('My phone');

        const stored = await MobileAccessCode.findOne({ where: { id: res.body.id } });
        expect(stored).to.not.equal(null);
        expect(stored.codeHash).to.match(/^[0-9a-f]{64}$/);
        // The plaintext code (formatted or raw) must not be persisted anywhere.
        expect(stored.codeHash).to.not.include(res.body.code);
        expect(stored.codeHash).to.not.include(res.body.code.replace(/-/g, ''));
        expect(stored.get({ plain: true })).to.not.have.property('code');
    });

    it('exchanges a valid code for a scorm-scoped JWT and touches lastUsedAt', async () => {
        const code = await generateCode(user, 'exchange test');

        const res = await request(app)
            .post('/api/mobile-access/exchange')
            .send({ code });

        expect(res.status).to.equal(200);
        expect(res.body.token).to.be.a('string');

        const decoded = jwt.verify(res.body.token, JWT_SECRET, { algorithms: ['HS256'] });
        expect(decoded.scope).to.equal('scorm');
        expect(String(decoded.userId)).to.equal(String(user.id));
        expect(Number(decoded.authVersion)).to.equal(Number(user.authVersion || 0));

        expect(res.body.user).to.include({
            id: user.id,
            name: 'Mobile User',
            email: 'mobile-user@example.com'
        });

        // lastUsedAt should now be set on the code.
        const list = await request(app)
            .get('/api/mobile-access/codes')
            .set('Authorization', `Bearer ${await freshAuthToken(user)}`);
        expect(list.status).to.equal(200);
        const entry = list.body.codes.find((c) => c.label === 'exchange test');
        expect(entry).to.not.equal(undefined);
        expect(entry.lastUsedAt).to.be.a('string');
        // Never returns the raw code or its hash.
        expect(JSON.stringify(list.body)).to.not.include(code.replace(/-/g, ''));
        expect(entry).to.not.have.property('codeHash');
    });

    it('accepts codes typed without dashes and in lowercase', async () => {
        const code = await generateCode(user, 'normalization test');
        const res = await request(app)
            .post('/api/mobile-access/exchange')
            .send({ code: code.replace(/-/g, ' ').toLowerCase() });
        expect(res.status).to.equal(200);
    });

    it('rejects a wrong code with a generic 401', async () => {
        const res = await request(app)
            .post('/api/mobile-access/exchange')
            .send({ code: 'AAAA-AAAA-AAAA' });
        expect(res.status).to.equal(401);
        expect(res.body.message).to.equal(GENERIC_MESSAGE);
        expect(res.body).to.not.have.property('token');
    });

    it('rejects a missing code with a generic 401', async () => {
        const res = await request(app)
            .post('/api/mobile-access/exchange')
            .send({});
        expect(res.status).to.equal(401);
        expect(res.body.message).to.equal(GENERIC_MESSAGE);
    });

    it('rejects a revoked code with the same generic 401', async () => {
        const code = await generateCode(user, 'revoke exchange test');

        const token = await freshAuthToken(user);
        const list = await request(app)
            .get('/api/mobile-access/codes')
            .set('Authorization', `Bearer ${token}`);
        const entry = list.body.codes.find((c) => c.label === 'revoke exchange test');

        const del = await request(app)
            .delete(`/api/mobile-access/codes/${entry.id}`)
            .set('Authorization', `Bearer ${token}`);
        expect(del.status).to.equal(200);
        expect(del.body.revoked).to.equal(true);

        const res = await request(app)
            .post('/api/mobile-access/exchange')
            .send({ code });
        expect(res.status).to.equal(401);
        expect(res.body.message).to.equal(GENERIC_MESSAGE);
    });

    it('regenerating a code invalidates the old one', async () => {
        const oldCode = await generateCode(user, 'regenerate test');

        const token = await freshAuthToken(user);
        const list = await request(app)
            .get('/api/mobile-access/codes')
            .set('Authorization', `Bearer ${token}`);
        const entry = list.body.codes.find((c) => c.label === 'regenerate test');

        const regen = await request(app)
            .post(`/api/mobile-access/codes/${entry.id}/regenerate`)
            .set('Authorization', `Bearer ${token}`)
            .send({});
        expect(regen.status).to.equal(200);
        expect(regen.body.code).to.match(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
        expect(regen.body.code).to.not.equal(oldCode);

        const oldAttempt = await request(app)
            .post('/api/mobile-access/exchange')
            .send({ code: oldCode });
        expect(oldAttempt.status).to.equal(401);

        const newAttempt = await request(app)
            .post('/api/mobile-access/exchange')
            .send({ code: regen.body.code });
        expect(newAttempt.status).to.equal(200);
    });

    it('revoking a code bumps authVersion and kills existing mobile sessions', async () => {
        const code = await generateCode(user, 'kill switch test');

        // Exchange a code to obtain a live mobile token.
        const exchanged = await request(app)
            .post('/api/mobile-access/exchange')
            .send({ code });
        expect(exchanged.status).to.equal(200);
        const mobileToken = exchanged.body.token;

        // The live token works before revocation.
        const before = await request(app)
            .get('/api/mobile-access/codes')
            .set('Authorization', `Bearer ${mobileToken}`);
        expect(before.status).to.equal(200);

        const beforeVersion = Number((await User.findByPk(user.id)).authVersion || 0);

        const token = signLmsgenToken(await User.findByPk(user.id));
        const list = await request(app)
            .get('/api/mobile-access/codes')
            .set('Authorization', `Bearer ${token}`);
        const entry = list.body.codes.find((c) => c.label === 'kill switch test');

        await request(app)
            .delete(`/api/mobile-access/codes/${entry.id}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        const afterVersion = Number((await User.findByPk(user.id)).authVersion || 0);
        expect(afterVersion).to.equal(beforeVersion + 1);

        // The previously issued mobile JWT is now rejected by the middleware.
        const after = await request(app)
            .get('/api/mobile-access/codes')
            .set('Authorization', `Bearer ${mobileToken}`);
        expect(after.status).to.equal(401);

        // A fresh exchange issues a token with the new authVersion.
        const fresh = await request(app)
            .post('/api/mobile-access/exchange')
            .send({ code: await generateCode(user, 'kill switch fresh') });
        expect(fresh.status).to.equal(200);
        const decoded = jwt.verify(fresh.body.token, JWT_SECRET, { algorithms: ['HS256'] });
        expect(Number(decoded.authVersion)).to.equal(afterVersion);
    });

    it('caps active codes at 5 per user', async () => {
        const capped = await User.create({
            username: 'mobile-capped',
            email: 'mobile-capped@example.com',
            password: 'password123'
        });
        const token = signLmsgenToken(capped);

        for (let i = 0; i < 5; i += 1) {
            const res = await request(app)
                .post('/api/mobile-access/codes')
                .set('Authorization', `Bearer ${token}`)
                .send({ label: `device ${i}` });
            expect(res.status).to.equal(201);
        }

        const sixth = await request(app)
            .post('/api/mobile-access/codes')
            .set('Authorization', `Bearer ${token}`)
            .send({ label: 'device 6' });
        expect(sixth.status).to.equal(409);
        expect(sixth.body.code).to.equal('MOBILE_CODE_LIMIT_REACHED');
    });

    it('omits learnerToken when the account has no workspace with assigned learning', async () => {
        const learnerless = await User.create({
            username: 'mobile-learnerless',
            email: 'mobile-learnerless@example.com',
            password: 'password123'
        });
        const code = await generateCode(learnerless, 'learner omission test');

        const res = await request(app)
            .post('/api/mobile-access/exchange')
            .send({ code });

        expect(res.status).to.equal(200);
        // Silent omission: the host token still works, no learner keys present.
        expect(res.body).to.not.have.property('learnerToken');
        expect(res.body).to.not.have.property('learnerWorkspaceId');
        expect(res.body.token).to.be.a('string');
    });

    it('returns 404 for codes belonging to another user', async () => {
        const other = await User.create({
            username: 'mobile-other',
            email: 'mobile-other@example.com',
            password: 'password123'
        });
        const otherToken = signLmsgenToken(other);

        const list = await request(app)
            .get('/api/mobile-access/codes')
            .set('Authorization', `Bearer ${await freshAuthToken(user)}`);
        const someoneElses = list.body.codes[0];

        const del = await request(app)
            .delete(`/api/mobile-access/codes/${someoneElses.id}`)
            .set('Authorization', `Bearer ${otherToken}`);
        expect(del.status).to.equal(404);
    });
});
