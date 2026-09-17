const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

function loadCapacity({ max = 2, connected = 0 } = {}) {
    const User = { findByPk: sinon.stub().resolves({ id: 7, email: 'host@example.com' }) };
    const GameSession = { findAll: sinon.stub().resolves([{ id: 91 }]) };
    const Player = { count: sinon.stub().resolves(connected) };
    const ScormWorkspace = { findByPk: sinon.stub().resolves(null), findOne: sinon.stub().resolves(null) };
    const ScormWorkspaceMember = { findOne: sinon.stub().resolves(null), findAll: sinon.stub().resolves([]) };
    const service = proxyquire('../services/QuizmotoCapacityService', {
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
        expect(await service.withQuizPlayerCapacity(7, create)).to.deep.equal({ id: 42 });
        expect(create.calledOnce).to.equal(true);
    });

    it('rejects a new player once the user or tenant limit is reached', async () => {
        const { service } = loadCapacity({ max: 2, connected: 2 });
        const create = sinon.stub().resolves({ id: 43 });
        let caught;
        try { await service.withQuizPlayerCapacity(7, create); } catch (err) { caught = err; }
        expect(caught?.code).to.equal('QUIZMOTO_PLAYER_CAPACITY_REACHED');
        expect(caught?.capacity).to.deep.equal({ current: 2, max: 2 });
        expect(create.called).to.equal(false);
    });

    it('keeps blank limits unlimited', async () => {
        const { service } = loadCapacity({ max: null, connected: 250 });
        const create = sinon.stub().resolves({ id: 44 });
        expect(await service.withQuizPlayerCapacity(7, create)).to.deep.equal({ id: 44 });
    });
});
