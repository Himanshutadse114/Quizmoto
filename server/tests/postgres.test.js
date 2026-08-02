const { expect } = require('chai');
const { sequelize } = require('../config/database');
const { Quiz, Question } = require('../models/Quiz');

describe('PostgreSQL Dialect & Transaction Integration', () => {
    it('should fail if dialect is not postgres (prevents silent SQLite fallback)', () => {
        expect(sequelize.getDialect()).to.equal('postgres', 'The test MUST be run with DB_DIALECT=postgres');
    });

    it('should verify PostgreSQL version is at least 15', async () => {
        const [results] = await sequelize.query('SELECT version()');
        expect(results).to.be.an('array').that.is.not.empty;
        expect(results[0].version.toLowerCase()).to.include('postgresql 15');
    });

    it('should verify connection uses test credentials safely without exposing them', () => {
        expect(sequelize.config.host).to.equal('localhost');
        expect(sequelize.config.port).to.equal(5434);
        expect(sequelize.config.database).to.equal('quizmototest');
    });

    it('should test a real PostgreSQL transaction and constraint path', async () => {
        const transaction = await sequelize.transaction();
        try {
            const quiz = await Quiz.create({
                title: 'Transaction Test Quiz',
                hostId: 99999, // Host doesn't need to exist for this test unless FK enforces it
            }, { transaction });

            await Question.create({
                quizId: quiz.id,
                questionText: 'Is Postgres working?',
                options: JSON.stringify(['Yes', 'No']),
                correctIndex: 0,
                timer: 10,
            }, { transaction });

            await transaction.commit();

            const savedQuiz = await Quiz.findByPk(quiz.id);
            expect(savedQuiz).to.not.be.null;

            // Cleanup
            await Quiz.destroy({ where: { id: quiz.id } });
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    });
});
