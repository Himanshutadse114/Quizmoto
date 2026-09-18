const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

function loadCapacity({ max = 2, connected = 0 } = {}) {
    const User = { findByPk: sinon.stub().resolves({ id: 7, email: 'host@example.com' }) };
    const GameSession = {
        findAll: sinon.stub().resolves([{ id: 91 }]),
        findOne: sinon.stub().resolves({ id: 91 })
    };
    const Player = { count: sinon.stub().resolves(connected) };
    const ScormWorkspace = { findByPk: sinon.stub().resolves(null), findOne: sinon.stub().resolves(null) };
    const ScormWorkspaceMember = { findOne: sinon.stub().resolves(null), findAll: sinon.stub().resolves([]) };
    const sequelize = {
        transaction: sinon.stub().callsFake(async (callback) => callback({ id: 'tx-1' })),
        getDialect: sinon.stub().returns('sqlite'),
        query: sinon.stub().resolves()
    };
    const service = proxyquire('../services/QuizmotoCapacityService', {
        '../config/database': { sequelize },
        '../models/User': User,
        '../models/GameSession': { GameSession, Player },
        '../models/scorm': { ScormWorkspace, ScormWorkspaceMember },
        './scorm/ScormEntitlementService': {
            getEntitlement: sinon.stub().resolves({ maxQuizPlayers: max }),
            normalizeLimit: (value) => value == null || value === '' ? null : Math.max(0, Math.floor(Number(value)))
        },
        './scorm/ScormAccessService': { isSuperAdminEmail: () => false }
    });
    return { service, Player };
}

describe('Quizmoto concurrent player capacity', () => {
    it('allows a join while capacity is available', async () => {
        const { service } = loadCapacity({ max: 2, connected: 1 });
        const create = sinon.stub().resolves({ id: 42 });
        expect(await service.withQuizPlayerCapacity(7, 91, create)).to.deep.equal({ id: 42 });
        expect(create.calledOnce).to.equal(true);
    });

    it('rejects a new player once the user or tenant limit is reached', async () => {
        const { service } = loadCapacity({ max: 10, connected: 10 });
        const create = sinon.stub().resolves({ id: 43 });
        let caught;
        try { await service.withQuizPlayerCapacity(7, 91, create); } catch (err) { caught = err; }
        expect(caught?.code).to.equal('QUIZMOTO_PLAYER_CAPACITY_REACHED');
        expect(caught?.capacity).to.deep.equal({ current: 10, max: 10 });
        expect(create.called).to.equal(false);
    });

    it('gives blank starter accounts a 10-player per-session cap', async () => {
        const { service } = loadCapacity({ max: null, connected: 9 });
        const create = sinon.stub().resolves({ id: 44 });
        expect(await service.withQuizPlayerCapacity(7, 91, create)).to.deep.equal({ id: 44 });
    });

    it('applies capacity independently to each live session', async () => {
        const { service, Player } = loadCapacity({ max: 10, connected: 9 });
        const create = sinon.stub().resolves({ id: 45 });
        expect(await service.withQuizPlayerCapacity(7, 92, create)).to.deep.equal({ id: 45 });
        expect(Player.count.firstCall.args[0].where.sessionId).to.equal(92);
    });
});
