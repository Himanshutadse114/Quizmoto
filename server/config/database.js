const { Sequelize } = require('sequelize');
const path = require('path');

const dialect = process.env.DB_DIALECT || 'sqlite';

let sequelize;

if (dialect === 'mysql') {
    sequelize = new Sequelize(
        process.env.DB_NAME || 'kahoot_awareness',
        process.env.DB_USER || 'root',
        process.env.DB_PASS || '',
        {
            host: process.env.DB_HOST || 'localhost',
            dialect: 'mysql',
            logging: false,
            port: process.env.DB_PORT || 3306,
            dialectOptions: process.env.DB_SSL === 'true' ? {
                ssl: {
                    require: true,
                    rejectUnauthorized: true
                }
            } : {}
        }
    );
} else {
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: path.join(__dirname, '../database.sqlite'),
        logging: false
    });
}

// FIX: Export sequelize IMMEDIATELY to prevent circular dependency issues
// when models are required inside connectDB.
module.exports.sequelize = sequelize;

const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log(`${dialect.charAt(0).toUpperCase() + dialect.slice(1)} Connected (Sequelize)...`);

        // IMPORTANT: Import ALL models and register associations BEFORE sync()
        const { Quiz, Question } = require('../models/Quiz');
        const { GameSession, Player, PlayerAnswer } = require('../models/GameSession');
        const { User } = require('../models/User');
        const { PlayerProfile } = require('../models/PlayerProfile');

        // Centralized Associations
        // Quiz <-> Question
        Quiz.hasMany(Question, { as: 'questions', foreignKey: 'quizId', onDelete: 'CASCADE' });
        Question.belongsTo(Quiz, { foreignKey: 'quizId' });

        // GameSession <-> Quiz
        GameSession.belongsTo(Quiz, { foreignKey: 'quizId' });
        Quiz.hasMany(GameSession, { foreignKey: 'quizId', as: 'sessions' });

        // GameSession <-> Player
        GameSession.hasMany(Player, { as: 'players', foreignKey: 'sessionId', onDelete: 'CASCADE' });
        Player.belongsTo(GameSession, { foreignKey: 'sessionId' });

        // GameSession <-> PlayerAnswer
        GameSession.hasMany(PlayerAnswer, { as: 'answers', foreignKey: 'sessionId', onDelete: 'CASCADE' });
        PlayerAnswer.belongsTo(GameSession, { foreignKey: 'sessionId' });

        // Player <-> PlayerAnswer
        Player.hasMany(PlayerAnswer, { as: 'answers', foreignKey: 'playerId', onDelete: 'CASCADE' });
        PlayerAnswer.belongsTo(Player, { foreignKey: 'playerId' });

        // Player <-> PlayerProfile
        PlayerProfile.hasMany(Player, { as: 'sessionPlayers', foreignKey: 'playerProfileId' });
        Player.belongsTo(PlayerProfile, { foreignKey: 'playerProfileId', as: 'profile' });

        // Add columns individually - catch error 1060 (duplicate column) to support MySQL & MariaDB
        const addColumnIfMissing = async (sql) => {
            try {
                await sequelize.query(sql);
            } catch (e) {
                if (e.original && e.original.errno === 1060) {
                    // Column already exists - safe to ignore
                } else {
                    console.warn('Database migration note:', e.message);
                }
            }
        };

        await addColumnIfMissing(`ALTER TABLE \`GameSessions\` ADD COLUMN \`gameMode\` VARCHAR(255) DEFAULT 'classic' AFTER \`status\``);
        await addColumnIfMissing(`ALTER TABLE \`GameSessions\` ADD COLUMN \`analytics\` JSON NULL AFTER \`questionStartTime\``);
        await addColumnIfMissing(`ALTER TABLE \`Players\` ADD COLUMN \`teamName\` VARCHAR(255) NULL AFTER \`nickname\``);
        await addColumnIfMissing(`ALTER TABLE \`Players\` ADD COLUMN \`playerProfileId\` INTEGER NULL AFTER \`teamName\``);

        // Standard sync (without alter) to ensure basic table existence
        try {
            await sequelize.sync();
            console.log('Database models synced ✅');
        } catch (syncErr) {
            console.error('Sequelize sync error:', syncErr.message);
        }
    } catch (err) {
        console.error('Sequelize connection error:', err);
        process.exit(1);
    }
};

module.exports.connectDB = connectDB;
