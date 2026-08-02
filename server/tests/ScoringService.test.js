const { expect } = require('chai');
const ScoringService = require('../services/ScoringService');

describe('ScoringService', () => {
    describe('calculateReward()', () => {
        it('should return 0 points and 0 streak for an incorrect answer', () => {
            const result = ScoringService.calculateReward(10, 5, false);
            expect(result.points).to.equal(0);
            expect(result.multiplier).to.equal(1.0);
            expect(result.streak).to.equal(0);
        });

        it('should handle streak < 3 with 1.0 multiplier', () => {
            const result = ScoringService.calculateReward(20, 1, true); // new streak = 2
            // Base: 1000 + 200 = 1200
            // Multiplier: 1.0
            expect(result.points).to.equal(1200);
            expect(result.multiplier).to.equal(1.0);
            expect(result.streak).to.equal(2);
        });

        it('should handle streak >= 3 and < 5 with 1.2 multiplier', () => {
            const result = ScoringService.calculateReward(20, 2, true); // new streak = 3
            // Base: 1200 * 1.2 = 1440
            expect(result.points).to.equal(1440);
            expect(result.multiplier).to.equal(1.2);
            expect(result.streak).to.equal(3);
        });

        it('should handle streak >= 5 and < 7 with 1.5 multiplier', () => {
            const result = ScoringService.calculateReward(10, 4, true); // new streak = 5
            // Base: 1000 + 100 = 1100
            // 1100 * 1.5 = 1650
            expect(result.points).to.equal(1650);
            expect(result.multiplier).to.equal(1.5);
            expect(result.streak).to.equal(5);
        });

        it('should handle streak >= 7 with 2.0 multiplier', () => {
            const result = ScoringService.calculateReward(5, 7, true); // new streak = 8
            // Base: 1000 + 50 = 1050
            // 1050 * 2.0 = 2100
            expect(result.points).to.equal(2100);
            expect(result.multiplier).to.equal(2.0);
            expect(result.streak).to.equal(8);
        });

        it('should default to 0 streak and timeRemaining if undefined', () => {
            const result = ScoringService.calculateReward(undefined, undefined, true);
            // new streak = 1 (multiplier 1.0)
            // base = 1000 + 0 = 1000
            expect(result.points).to.equal(1000);
            expect(result.multiplier).to.equal(1.0);
            expect(result.streak).to.equal(1);
        });
    });
});
