const { expect } = require('chai');
const { connectDB } = require('../config/database');
const { seedTestFixtures, clearDatabase } = require('./fixtures');
const { GameSession } = require('../models/GameSession');
const HostLeaseService = require('../services/HostLeaseService');

describe('HostLeaseService (Phase 2)', function () {
    this.timeout(15000);

    let host;
    let quiz;
    let session;

    before(async () => {
        await connectDB();
    });

    beforeEach(async () => {
        const fixtures = await seedTestFixtures();
        host = fixtures.host;
        quiz = fixtures.quiz;
        session = await GameSession.create({
            pin: String(Math.floor(100000 + Math.random() * 900000)),
            quizId: quiz.id,
            hostId: host.id,
            status: 'lobby',
            state: 'LOBBY',
            stateVersion: 0
        });
    });

    after(async () => {
        await clearDatabase();
    });

    it('acquires and renews lease for same owner', async () => {
        const first = await HostLeaseService.acquireOrRenew({
            sessionId: session.id,
            ownerId: host.id,
            ttlMs: 5000,
            force: true
        });
        expect(first.ok).to.equal(true);
        expect(first.code).to.equal('ACQUIRED');

        const second = await HostLeaseService.acquireOrRenew({
            sessionId: session.id,
            ownerId: host.id,
            ttlMs: 5000,
            force: true
        });
        expect(second.ok).to.equal(true);
        expect(second.code).to.equal('RENEWED');

        await session.reload();
        expect(String(session.hostLeaseOwner)).to.equal(String(host.id));
        expect(session.hostLeaseExpiresAt).to.not.equal(null);
    });

    it('serializes concurrent same-owner renewals without sqlite transaction collisions', async () => {
        const results = await Promise.all([
            HostLeaseService.acquireOrRenew({
                sessionId: session.id,
                ownerId: 'same-socket',
                ttlMs: 5000,
                force: true
            }),
            HostLeaseService.acquireOrRenew({
                sessionId: session.id,
                ownerId: 'same-socket',
                ttlMs: 5000,
                force: true
            })
        ]);

        expect(results.every((result) => result.ok)).to.equal(true);
        expect(results.map((result) => result.code)).to.include('ACQUIRED');
        expect(results.map((result) => result.code)).to.include('RENEWED');

        await session.reload();
        expect(String(session.hostLeaseOwner)).to.equal('same-socket');
    });

    it('rejects second owner while lease is active', async () => {
        await HostLeaseService.acquireOrRenew({
            sessionId: session.id,
            ownerId: 'host-A',
            ttlMs: 60000,
            force: true
        });

        const blocked = await HostLeaseService.acquireOrRenew({
            sessionId: session.id,
            ownerId: 'host-B',
            ttlMs: 60000,
            force: true
        });

        expect(blocked.ok).to.equal(false);
        expect(blocked.code).to.equal('LEASE_HELD');
    });

    it('serializes concurrent competing owners and permits only the first active lease', async () => {
        const [first, second] = await Promise.all([
            HostLeaseService.acquireOrRenew({
                sessionId: session.id,
                ownerId: 'host-A',
                ttlMs: 60000,
                force: true
            }),
            HostLeaseService.acquireOrRenew({
                sessionId: session.id,
                ownerId: 'host-B',
                ttlMs: 60000,
                force: true
            })
        ]);

        const successes = [first, second].filter((result) => result.ok);
        const blocked = [first, second].filter((result) => !result.ok);
        expect(successes).to.have.length(1);
        expect(blocked).to.have.length(1);
        expect(blocked[0].code).to.equal('LEASE_HELD');
    });

    it('allows takeover after lease expiry', async () => {
        await HostLeaseService.acquireOrRenew({
            sessionId: session.id,
            ownerId: 'host-A',
            ttlMs: 1,
            force: true
        });

        await new Promise((r) => setTimeout(r, 5));

        const takeover = await HostLeaseService.acquireOrRenew({
            sessionId: session.id,
            ownerId: 'host-B',
            ttlMs: 5000,
            force: true
        });

        expect(takeover.ok).to.equal(true);
        expect(takeover.hostLeaseOwner).to.equal('host-B');
    });

    it('releases lease for owner', async () => {
        await HostLeaseService.acquireOrRenew({
            sessionId: session.id,
            ownerId: host.id,
            force: true
        });

        const released = await HostLeaseService.release({
            sessionId: session.id,
            ownerId: host.id,
            force: true
        });
        expect(released.ok).to.equal(true);

        await session.reload();
        expect(session.hostLeaseOwner).to.equal(null);
    });
});
