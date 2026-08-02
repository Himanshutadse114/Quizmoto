const { sequelize } = require('../config/database');
const User = require('../models/User');
const { Quiz, Question } = require('../models/Quiz');
const { GameSession, Player, PlayerAnswer } = require('../models/GameSession');
const { PlayerProfile } = require('../models/PlayerProfile');
const bcrypt = require('bcryptjs');

const clearDatabase = async () => {
  // Sync in case tables don't exist, use force: true to drop old schemas
  await sequelize.sync({ force: true });
  
  await PlayerAnswer.destroy({ where: {} });
  await Player.destroy({ where: {} });
  await GameSession.destroy({ where: {} });
  await Question.destroy({ where: {} });
  await Quiz.destroy({ where: {} });
  await User.destroy({ where: {} });
  await PlayerProfile.destroy({ where: {} });
};

const seedTestFixtures = async () => {
  await clearDatabase();
  
  const testRunId = process.env.TEST_RUN_ID ? `-${process.env.TEST_RUN_ID}` : '';
  const username = `testhost${testRunId}`;
  
  // 1. Create a Test Host
  const hashedPassword = await bcrypt.hash('password123', 10);
  const host = await User.create({
    username,
    email: `test${testRunId}@example.com`,
    password: hashedPassword,
  });

  // 2. Create a Deterministic Quiz
  const quiz = await Quiz.create({
    title: 'Deterministic Test Quiz',
    hostId: host.id,
  });

  // 3. Create at least three questions
  await Question.bulkCreate([
    {
      quizId: quiz.id,
      questionText: 'What is 2 + 2?',
      options: JSON.stringify(['3', '4', '5', '22']),
      correctIndex: 1, // '4'
      timer: 5,
      explanation: 'Basic math',
    },
    {
      quizId: quiz.id,
      questionText: 'Which planet is known as the Red Planet?',
      options: JSON.stringify(['Earth', 'Mars', 'Jupiter', 'Saturn']),
      correctIndex: 1, // 'Mars'
      timer: 5,
      explanation: 'Mars is red due to iron oxide.',
    },
    {
      quizId: quiz.id,
      questionText: 'Is the sky blue?',
      options: JSON.stringify(['Yes', 'No']),
      correctIndex: 0, // 'Yes'
      timer: 5,
      explanation: 'Rayleigh scattering.',
    }
  ]);

  return { host, quiz };
};

module.exports = {
  clearDatabase,
  seedTestFixtures,
};
