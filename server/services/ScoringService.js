/**
 * Pure deterministic service for calculating scores, multipliers, and streaks.
 * It does not interact with the database, Socket.IO, or current wall-clock time.
 */

class ScoringService {
    /**
     * Calculates the reward for a given answer.
     * @param {number} timeRemaining - The time remaining for the question in seconds.
     * @param {number} currentStreak - The player's current correct-answer streak.
     * @param {boolean} isCorrect - Whether the player's answer was correct.
     * @returns {Object} An object containing points, multiplier, and new streak.
     */
    static calculateReward(timeRemaining, currentStreak, isCorrect) {
        if (!isCorrect) {
            return { points: 0, multiplier: 1.0, streak: 0 };
        }

        const newStreak = (currentStreak || 0) + 1;
        let multiplier = 1.0;
        
        if (newStreak >= 7) {
            multiplier = 2.0;
        } else if (newStreak >= 5) {
            multiplier = 1.5;
        } else if (newStreak >= 3) {
            multiplier = 1.2;
        }

        const basePoints = 1000 + (Number(timeRemaining || 0) * 10);
        
        return {
            points: Math.round(basePoints * multiplier),
            multiplier,
            streak: newStreak
        };
    }
}

module.exports = ScoringService;
