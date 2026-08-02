const { expect } = require('chai');
const jwt = require('jsonwebtoken');
const SessionTokenService = require('../services/SessionTokenService');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

describe('SessionTokenService', () => {
    it('should verify a valid host token and return hostId', () => {
        const token = jwt.sign({ userId: 42, role: 'host' }, JWT_SECRET);
        const hostId = SessionTokenService.verifyHostToken(token);
        expect(hostId).to.equal(42);
    });

    it('should return null for invalid host token', () => {
        const token = jwt.sign({ userId: 42, role: 'host' }, 'wrong_secret');
        const hostId = SessionTokenService.verifyHostToken(token);
        expect(hostId).to.be.null;
    });

    it('should return null if no host token is provided', () => {
        const hostId = SessionTokenService.verifyHostToken(null);
        expect(hostId).to.be.null;
    });

    it('should generate a valid player token', () => {
        const token = SessionTokenService.generatePlayerToken(10, 5, 'PlayerOne');
        expect(token).to.be.a('string');
        const decoded = jwt.verify(token, JWT_SECRET);
        expect(decoded.sessionId).to.equal(10);
        expect(decoded.playerId).to.equal(5);
        expect(decoded.nickname).to.equal('PlayerOne');
    });

    it('should verify a valid player token', () => {
        const token = SessionTokenService.generatePlayerToken(10, 5, 'PlayerOne');
        const decoded = SessionTokenService.verifyPlayerToken(token);
        expect(decoded).to.not.be.null;
        expect(decoded.sessionId).to.equal(10);
        expect(decoded.playerId).to.equal(5);
        expect(decoded.nickname).to.equal('PlayerOne');
    });

    it('should return null for invalid player token', () => {
        const token = jwt.sign({ sessionId: 10 }, 'wrong_secret');
        const decoded = SessionTokenService.verifyPlayerToken(token);
        expect(decoded).to.be.null;
    });

    it('should return null if no player token is provided', () => {
        const decoded = SessionTokenService.verifyPlayerToken(undefined);
        expect(decoded).to.be.null;
    });

    it('should gracefully reject expired tokens without throwing', () => {
        const token = jwt.sign({ userId: 42, role: 'host' }, JWT_SECRET, { expiresIn: '-1h' });
        
        let hostId;
        expect(() => {
            hostId = SessionTokenService.verifyHostToken(token);
        }).to.not.throw();
        
        expect(hostId).to.be.null;
    });
});
