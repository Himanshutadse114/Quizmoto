const { Sequelize } = require('sequelize');
const path = require('path');

const dialect = process.env.DB_DIALECT || 'sqlite';
const dbName = process.env.DB_NAME || 'kahoot_awareness';
const isPostgres = dialect === 'postgres';
const isMysql = dialect === 'mysql';

let sequelize;

const sslOptions = process.env.DB_SSL === 'true'
    ? (isPostgres
        ? { ssl: { require: true, rejectUnauthorized: false } }
        : { ssl: { require: true, rejectUnauthorized: true } })
    : {};

if (isMysql || isPostgres) {
    sequelize = new Sequelize(
        dbName,
        process.env.DB_USER || 'root',
        process.env.DB_PASS || '',
        {
            host: process.env.DB_HOST || 'localhost',
            dialect: dialect,
            logging: false,
            port: parseInt(process.env.DB_PORT || (isPostgres ? '5432' : '3306')),
            dialectOptions: sslOptions
        }
    );
} else {
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: process.env.NODE_ENV === 'test' ? ':memory:' : path.join(__dirname, '../database.sqlite'),
        logging: false
    });
}

// FIX: Export sequelize IMMEDIATELY to prevent circular dependency issues
// when models are required inside connectDB.
module.exports.sequelize = sequelize;

let isConnected = false;
const connectDB = async () => {
    if (isConnected) return;
    try {
        await sequelize.authenticate();
        console.log(`${dialect.charAt(0).toUpperCase() + dialect.slice(1)} Connected (Sequelize)...`);

        // IMPORTANT: Import ALL models and register associations BEFORE sync()
        const { Quiz, Question } = require('../models/Quiz');
        const {
            GameSession,
            Player,
            PlayerAnswer,
            Round,
            SessionEvent,
            IdempotencyRecord
        } = require('../models/GameSession');
        const { User } = require('../models/User');
        const { PlayerProfile } = require('../models/PlayerProfile');

        // SCORM World models (additive — no coupling to GameSession)
        require('../models/scorm');

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

        // Phase 2: Round / SessionEvent / IdempotencyRecord
        GameSession.hasMany(Round, { as: 'rounds', foreignKey: 'sessionId', onDelete: 'CASCADE' });
        Round.belongsTo(GameSession, { foreignKey: 'sessionId' });

        GameSession.hasMany(SessionEvent, { as: 'events', foreignKey: 'sessionId', onDelete: 'CASCADE' });
        SessionEvent.belongsTo(GameSession, { foreignKey: 'sessionId' });

        GameSession.hasMany(IdempotencyRecord, { as: 'idempotencyRecords', foreignKey: 'sessionId', onDelete: 'CASCADE' });
        IdempotencyRecord.belongsTo(GameSession, { foreignKey: 'sessionId' });

        // Add columns individually - handle duplicate column errors for MySQL & PostgreSQL
        const addColumnIfMissing = async (sql) => {
            try {
                await sequelize.query(sql);
            } catch (e) {
                const isDuplicateCol =
                    (e.original && e.original.errno === 1060) ||           // MySQL
                    (e.original && e.original.code === '42701') ||          // PostgreSQL
                    (e.message && e.message.includes('already exists'));     // fallback
                if (!isDuplicateCol) {
                    console.warn('Database migration note:', e.message);
                }
            }
        };

        if (isPostgres) {
            // PostgreSQL syntax: double quotes, no AFTER clause
            await addColumnIfMissing(`ALTER TABLE "GameSessions" ADD COLUMN "gameMode" VARCHAR(255) DEFAULT 'classic'`);
            await addColumnIfMissing(`ALTER TABLE "GameSessions" ADD COLUMN "analytics" JSON NULL`);
            await addColumnIfMissing(`ALTER TABLE "Players" ADD COLUMN "teamName" VARCHAR(255) NULL`);
            await addColumnIfMissing(`ALTER TABLE "Players" ADD COLUMN "playerProfileId" INTEGER NULL`);
            await addColumnIfMissing(`ALTER TABLE "Questions" ADD COLUMN "explanation" TEXT NULL`);
            await addColumnIfMissing(`ALTER TABLE "Questions" ALTER COLUMN "image" TYPE TEXT`);
            await addColumnIfMissing(`ALTER TABLE "Users" ADD COLUMN "googleId" VARCHAR(255) NULL`);
            await addColumnIfMissing(`ALTER TABLE "Users" ADD COLUMN "email" VARCHAR(255) NULL`);
            await addColumnIfMissing(`ALTER TABLE "Users" ADD COLUMN "avatar" VARCHAR(255) NULL`);
            await addColumnIfMissing(`ALTER TABLE "Users" ALTER COLUMN "password" DROP NOT NULL`);
            await addColumnIfMissing(`ALTER TABLE "PlayerProfiles" ADD COLUMN "googleId" VARCHAR(255) NULL`);
            await addColumnIfMissing(`ALTER TABLE "PlayerProfiles" ALTER COLUMN "password" DROP NOT NULL`);

            // Phase 2 additive columns on GameSessions
            await addColumnIfMissing(`ALTER TABLE "GameSessions" ADD COLUMN "state" VARCHAR(32) DEFAULT 'LOBBY'`);
            await addColumnIfMissing(`ALTER TABLE "GameSessions" ADD COLUMN "stateVersion" BIGINT NOT NULL DEFAULT 0`);
            await addColumnIfMissing(`ALTER TABLE "GameSessions" ADD COLUMN "activeRoundId" VARCHAR(36) NULL`);
            await addColumnIfMissing(`ALTER TABLE "GameSessions" ADD COLUMN "stateEnteredAt" TIMESTAMP NULL`);
            await addColumnIfMissing(`ALTER TABLE "GameSessions" ADD COLUMN "questionOpensAt" TIMESTAMP NULL`);
            await addColumnIfMissing(`ALTER TABLE "GameSessions" ADD COLUMN "questionClosesAt" TIMESTAMP NULL`);
            await addColumnIfMissing(`ALTER TABLE "GameSessions" ADD COLUMN "hostLeaseOwner" VARCHAR(128) NULL`);
            await addColumnIfMissing(`ALTER TABLE "GameSessions" ADD COLUMN "hostLeaseExpiresAt" TIMESTAMP NULL`);
            await addColumnIfMissing(`ALTER TABLE "GameSessions" ADD COLUMN "lastEventSequence" BIGINT NOT NULL DEFAULT 0`);
            await addColumnIfMissing(`ALTER TABLE "GameSessions" ADD COLUMN "recoverySchemaVersion" INTEGER NOT NULL DEFAULT 1`);
            await addColumnIfMissing(`ALTER TABLE "GameSessions" ADD COLUMN "lastErrorCode" VARCHAR(64) NULL`);
            await addColumnIfMissing(`ALTER TABLE "PlayerAnswers" ADD COLUMN "roundId" VARCHAR(36) NULL`);
        } else if (isMysql) {
            // MySQL syntax: backticks, supports AFTER clause
            await addColumnIfMissing(`ALTER TABLE \`GameSessions\` ADD COLUMN \`gameMode\` VARCHAR(255) DEFAULT 'classic' AFTER \`status\``);
            await addColumnIfMissing(`ALTER TABLE \`GameSessions\` ADD COLUMN \`analytics\` JSON NULL AFTER \`questionStartTime\``);
            await addColumnIfMissing(`ALTER TABLE \`Players\` ADD COLUMN \`teamName\` VARCHAR(255) NULL AFTER \`nickname\``);
            await addColumnIfMissing(`ALTER TABLE \`Players\` ADD COLUMN \`playerProfileId\` INTEGER NULL AFTER \`teamName\``);
            await addColumnIfMissing(`ALTER TABLE \`Questions\` ADD COLUMN \`explanation\` TEXT NULL`);
            await addColumnIfMissing(`ALTER TABLE \`Questions\` MODIFY \`image\` LONGTEXT NULL`);
            await addColumnIfMissing(`ALTER TABLE \`Users\` ADD COLUMN \`googleId\` VARCHAR(255) NULL`);
            await addColumnIfMissing(`ALTER TABLE \`Users\` ADD COLUMN \`email\` VARCHAR(255) NULL`);
            await addColumnIfMissing(`ALTER TABLE \`Users\` ADD COLUMN \`avatar\` VARCHAR(255) NULL`);
            await addColumnIfMissing(`ALTER TABLE \`Users\` MODIFY \`password\` VARCHAR(255) NULL`);
            await addColumnIfMissing(`ALTER TABLE \`PlayerProfiles\` ADD COLUMN \`googleId\` VARCHAR(255) NULL`);
            await addColumnIfMissing(`ALTER TABLE \`PlayerProfiles\` MODIFY \`password\` VARCHAR(255) NULL`);

            // Phase 2 additive columns on GameSessions
            await addColumnIfMissing(`ALTER TABLE \`GameSessions\` ADD COLUMN \`state\` VARCHAR(32) DEFAULT 'LOBBY'`);
            await addColumnIfMissing(`ALTER TABLE \`GameSessions\` ADD COLUMN \`stateVersion\` BIGINT NOT NULL DEFAULT 0`);
            await addColumnIfMissing(`ALTER TABLE \`GameSessions\` ADD COLUMN \`activeRoundId\` VARCHAR(36) NULL`);
            await addColumnIfMissing(`ALTER TABLE \`GameSessions\` ADD COLUMN \`stateEnteredAt\` DATETIME NULL`);
            await addColumnIfMissing(`ALTER TABLE \`GameSessions\` ADD COLUMN \`questionOpensAt\` DATETIME NULL`);
            await addColumnIfMissing(`ALTER TABLE \`GameSessions\` ADD COLUMN \`questionClosesAt\` DATETIME NULL`);
            await addColumnIfMissing(`ALTER TABLE \`GameSessions\` ADD COLUMN \`hostLeaseOwner\` VARCHAR(128) NULL`);
            await addColumnIfMissing(`ALTER TABLE \`GameSessions\` ADD COLUMN \`hostLeaseExpiresAt\` DATETIME NULL`);
            await addColumnIfMissing(`ALTER TABLE \`GameSessions\` ADD COLUMN \`lastEventSequence\` BIGINT NOT NULL DEFAULT 0`);
            await addColumnIfMissing(`ALTER TABLE \`GameSessions\` ADD COLUMN \`recoverySchemaVersion\` INTEGER NOT NULL DEFAULT 1`);
            await addColumnIfMissing(`ALTER TABLE \`GameSessions\` ADD COLUMN \`lastErrorCode\` VARCHAR(64) NULL`);
            await addColumnIfMissing(`ALTER TABLE \`PlayerAnswers\` ADD COLUMN \`roundId\` VARCHAR(36) NULL`);
        }

        // Standard sync (without alter) to ensure basic table existence including Phase 2 + SCORM models
        try {
            await sequelize.sync();
            console.log('Database models synced ✅');
        } catch (syncErr) {
            console.error('Sequelize sync error:', syncErr.message);
        }

        isConnected = true;
    } catch (err) {
        console.error('Sequelize connection error:', err);
        process.exit(1);
    }
};

module.exports.connectDB = connectDB;
