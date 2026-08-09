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
        Quiz.hasMany(Question, { as: 'questions', foreignKey: 'quizId', onDelete: 'CASCADE' });
        Question.belongsTo(Quiz, { foreignKey: 'quizId' });

        GameSession.belongsTo(Quiz, { foreignKey: 'quizId' });
        Quiz.hasMany(GameSession, { foreignKey: 'quizId', as: 'sessions' });

        GameSession.hasMany(Player, { as: 'players', foreignKey: 'sessionId', onDelete: 'CASCADE' });
        Player.belongsTo(GameSession, { foreignKey: 'sessionId' });

        GameSession.hasMany(PlayerAnswer, { as: 'answers', foreignKey: 'sessionId', onDelete: 'CASCADE' });
        PlayerAnswer.belongsTo(GameSession, { foreignKey: 'sessionId' });

        Player.hasMany(PlayerAnswer, { as: 'answers', foreignKey: 'playerId', onDelete: 'CASCADE' });
        PlayerAnswer.belongsTo(Player, { foreignKey: 'playerId' });

        PlayerProfile.hasMany(Player, { as: 'sessionPlayers', foreignKey: 'playerProfileId' });
        Player.belongsTo(PlayerProfile, { foreignKey: 'playerProfileId', as: 'profile' });

        GameSession.hasMany(Round, { as: 'rounds', foreignKey: 'sessionId', onDelete: 'CASCADE' });
        Round.belongsTo(GameSession, { foreignKey: 'sessionId' });

        GameSession.hasMany(SessionEvent, { as: 'events', foreignKey: 'sessionId', onDelete: 'CASCADE' });
        SessionEvent.belongsTo(GameSession, { foreignKey: 'sessionId' });

        GameSession.hasMany(IdempotencyRecord, { as: 'idempotencyRecords', foreignKey: 'sessionId', onDelete: 'CASCADE' });
        IdempotencyRecord.belongsTo(GameSession, { foreignKey: 'sessionId' });

        // Add columns individually - handle duplicate column errors for MySQL & PostgreSQL.
        // sequelize.sync() does not alter existing production tables, so every additive
        // runtime field must be explicitly migrated here for long-lived Render databases.
        const addColumnIfMissing = async (sql) => {
            try {
                await sequelize.query(sql);
            } catch (e) {
                const isDuplicateCol =
                    (e.original && e.original.errno === 1060) ||
                    (e.original && e.original.code === '42701') ||
                    (e.message && e.message.includes('already exists'));
                if (!isDuplicateCol) {
                    console.warn('Database migration note:', e.message);
                }
            }
        };

        if (isPostgres) {
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
            await addColumnIfMissing('ALTER TABLE `GameSessions` ADD COLUMN `gameMode` VARCHAR(255) DEFAULT \'classic\' AFTER `status`');
            await addColumnIfMissing('ALTER TABLE `GameSessions` ADD COLUMN `analytics` JSON NULL AFTER `questionStartTime`');
            await addColumnIfMissing('ALTER TABLE `Players` ADD COLUMN `teamName` VARCHAR(255) NULL AFTER `nickname`');
            await addColumnIfMissing('ALTER TABLE `Players` ADD COLUMN `playerProfileId` INTEGER NULL AFTER `teamName`');
            await addColumnIfMissing('ALTER TABLE `Questions` ADD COLUMN `explanation` TEXT NULL');
            await addColumnIfMissing('ALTER TABLE `Questions` MODIFY `image` LONGTEXT NULL');
            await addColumnIfMissing('ALTER TABLE `Users` ADD COLUMN `googleId` VARCHAR(255) NULL');
            await addColumnIfMissing('ALTER TABLE `Users` ADD COLUMN `email` VARCHAR(255) NULL');
            await addColumnIfMissing('ALTER TABLE `Users` ADD COLUMN `avatar` VARCHAR(255) NULL');
            await addColumnIfMissing('ALTER TABLE `Users` MODIFY `password` VARCHAR(255) NULL');
            await addColumnIfMissing('ALTER TABLE `PlayerProfiles` ADD COLUMN `googleId` VARCHAR(255) NULL');
            await addColumnIfMissing('ALTER TABLE `PlayerProfiles` MODIFY `password` VARCHAR(255) NULL');

            await addColumnIfMissing('ALTER TABLE `GameSessions` ADD COLUMN `state` VARCHAR(32) DEFAULT \'LOBBY\'');
            await addColumnIfMissing('ALTER TABLE `GameSessions` ADD COLUMN `stateVersion` BIGINT NOT NULL DEFAULT 0');
            await addColumnIfMissing('ALTER TABLE `GameSessions` ADD COLUMN `activeRoundId` VARCHAR(36) NULL');
            await addColumnIfMissing('ALTER TABLE `GameSessions` ADD COLUMN `stateEnteredAt` DATETIME NULL');
            await addColumnIfMissing('ALTER TABLE `GameSessions` ADD COLUMN `questionOpensAt` DATETIME NULL');
            await addColumnIfMissing('ALTER TABLE `GameSessions` ADD COLUMN `questionClosesAt` DATETIME NULL');
            await addColumnIfMissing('ALTER TABLE `GameSessions` ADD COLUMN `hostLeaseOwner` VARCHAR(128) NULL');
            await addColumnIfMissing('ALTER TABLE `GameSessions` ADD COLUMN `hostLeaseExpiresAt` DATETIME NULL');
            await addColumnIfMissing('ALTER TABLE `GameSessions` ADD COLUMN `lastEventSequence` BIGINT NOT NULL DEFAULT 0');
            await addColumnIfMissing('ALTER TABLE `GameSessions` ADD COLUMN `recoverySchemaVersion` INTEGER NOT NULL DEFAULT 1');
            await addColumnIfMissing('ALTER TABLE `GameSessions` ADD COLUMN `lastErrorCode` VARCHAR(64) NULL');
            await addColumnIfMissing('ALTER TABLE `PlayerAnswers` ADD COLUMN `roundId` VARCHAR(36) NULL');
        }

        // Standard sync (without alter) to ensure basic table existence including Phase 2 + SCORM models.
        try {
            await sequelize.sync();
            console.log('Database models synced ✅');
        } catch (syncErr) {
            console.error('Sequelize sync error:', syncErr.message);
        }

        const defaultQuizTitleCleanup = [
            ['🛡️ Phishing Awareness Challenge', 'Phishing Awareness Challenge'],
            ['🔑 Password & Account Security', 'Password & Account Security'],
            ['🌐 Remote Work & Public Wi-Fi', 'Remote Work & Public Wi-Fi'],
            ['🏢 Office & Social Engineering', 'Office & Social Engineering']
        ];
        for (const [oldTitle, newTitle] of defaultQuizTitleCleanup) {
            try {
                await Quiz.update({ title: newTitle }, { where: { title: oldTitle } });
            } catch (cleanupErr) {
                console.warn('Default quiz title cleanup note:', cleanupErr.message);
            }
        }

        // SCORM additive migrations. These deliberately run after sync so the
        // tables exist on a fresh installation and older installations are upgraded.
        if (isPostgres) {
            await addColumnIfMissing(`ALTER TABLE "scorm_packages" ADD COLUMN "analysisJson" TEXT NULL`);
            await addColumnIfMissing(`ALTER TABLE "scorm_packages" ADD COLUMN "templateId" INTEGER NULL`);
            await addColumnIfMissing(`ALTER TABLE "scorm_packages" ADD COLUMN "source" VARCHAR(255) DEFAULT 'upload'`);

            await addColumnIfMissing(`ALTER TABLE "scorm_registrations" ADD COLUMN "isPreview" BOOLEAN NOT NULL DEFAULT FALSE`);
            await addColumnIfMissing(`ALTER TABLE "scorm_registrations" ADD COLUMN "lastLessonStatus" VARCHAR(255) NULL`);
            await addColumnIfMissing(`ALTER TABLE "scorm_registrations" ADD COLUMN "lastScoreRaw" DOUBLE PRECISION NULL`);
            await addColumnIfMissing(`ALTER TABLE "scorm_registrations" ADD COLUMN "lastTotalTime" VARCHAR(255) NULL`);
            await addColumnIfMissing(`ALTER TABLE "scorm_registrations" ADD COLUMN "lastCommitAt" TIMESTAMP WITH TIME ZONE NULL`);

            await addColumnIfMissing(`ALTER TABLE "scorm_cmi_states" ADD COLUMN "attemptId" UUID NULL`);
            await addColumnIfMissing(`ALTER TABLE "scorm_cmi_states" ADD COLUMN "lessonStatus" VARCHAR(255) DEFAULT 'not attempted'`);
            await addColumnIfMissing(`ALTER TABLE "scorm_cmi_states" ADD COLUMN "scoreRaw" DOUBLE PRECISION NULL`);
            await addColumnIfMissing(`ALTER TABLE "scorm_cmi_states" ADD COLUMN "scoreMin" DOUBLE PRECISION NULL`);
            await addColumnIfMissing(`ALTER TABLE "scorm_cmi_states" ADD COLUMN "scoreMax" DOUBLE PRECISION NULL`);
            await addColumnIfMissing(`ALTER TABLE "scorm_cmi_states" ADD COLUMN "lessonLocation" TEXT NULL`);
            await addColumnIfMissing(`ALTER TABLE "scorm_cmi_states" ADD COLUMN "suspendData" TEXT NULL`);
            await addColumnIfMissing(`ALTER TABLE "scorm_cmi_states" ADD COLUMN "entry" VARCHAR(255) NULL`);
            await addColumnIfMissing(`ALTER TABLE "scorm_cmi_states" ADD COLUMN "exit" VARCHAR(255) NULL`);
            await addColumnIfMissing(`ALTER TABLE "scorm_cmi_states" ADD COLUMN "totalTime" VARCHAR(255) DEFAULT '00:00:00.00'`);
            await addColumnIfMissing(`ALTER TABLE "scorm_cmi_states" ADD COLUMN "sessionTime" VARCHAR(255) DEFAULT '00:00:00.00'`);
            await addColumnIfMissing(`ALTER TABLE "scorm_cmi_states" ADD COLUMN "interactionsJson" TEXT NULL`);
            await addColumnIfMissing(`ALTER TABLE "scorm_cmi_states" ADD COLUMN "rawMapJson" TEXT NULL`);
            await addColumnIfMissing(`ALTER TABLE "scorm_cmi_states" ADD COLUMN "stateVersion" INTEGER NOT NULL DEFAULT 0`);
            await addColumnIfMissing(`ALTER TABLE "scorm_cmi_states" ADD COLUMN "initialized" BOOLEAN NOT NULL DEFAULT FALSE`);

            await addColumnIfMissing(`ALTER TABLE "scorm_attempts" ADD COLUMN "exitType" VARCHAR(255) NULL`);
        } else if (isMysql) {
            await addColumnIfMissing('ALTER TABLE `scorm_packages` ADD COLUMN `analysisJson` LONGTEXT NULL');
            await addColumnIfMissing('ALTER TABLE `scorm_packages` ADD COLUMN `templateId` INTEGER NULL');
            await addColumnIfMissing("ALTER TABLE `scorm_packages` ADD COLUMN `source` VARCHAR(255) DEFAULT 'upload'");

            await addColumnIfMissing('ALTER TABLE `scorm_registrations` ADD COLUMN `isPreview` BOOLEAN NOT NULL DEFAULT FALSE');
            await addColumnIfMissing('ALTER TABLE `scorm_registrations` ADD COLUMN `lastLessonStatus` VARCHAR(255) NULL');
            await addColumnIfMissing('ALTER TABLE `scorm_registrations` ADD COLUMN `lastScoreRaw` DOUBLE NULL');
            await addColumnIfMissing('ALTER TABLE `scorm_registrations` ADD COLUMN `lastTotalTime` VARCHAR(255) NULL');
            await addColumnIfMissing('ALTER TABLE `scorm_registrations` ADD COLUMN `lastCommitAt` DATETIME NULL');

            await addColumnIfMissing('ALTER TABLE `scorm_cmi_states` ADD COLUMN `attemptId` CHAR(36) NULL');
            await addColumnIfMissing("ALTER TABLE `scorm_cmi_states` ADD COLUMN `lessonStatus` VARCHAR(255) DEFAULT 'not attempted'");
            await addColumnIfMissing('ALTER TABLE `scorm_cmi_states` ADD COLUMN `scoreRaw` DOUBLE NULL');
            await addColumnIfMissing('ALTER TABLE `scorm_cmi_states` ADD COLUMN `scoreMin` DOUBLE NULL');
            await addColumnIfMissing('ALTER TABLE `scorm_cmi_states` ADD COLUMN `scoreMax` DOUBLE NULL');
            await addColumnIfMissing('ALTER TABLE `scorm_cmi_states` ADD COLUMN `lessonLocation` LONGTEXT NULL');
            await addColumnIfMissing('ALTER TABLE `scorm_cmi_states` ADD COLUMN `suspendData` LONGTEXT NULL');
            await addColumnIfMissing('ALTER TABLE `scorm_cmi_states` ADD COLUMN `entry` VARCHAR(255) NULL');
            await addColumnIfMissing('ALTER TABLE `scorm_cmi_states` ADD COLUMN `exit` VARCHAR(255) NULL');
            await addColumnIfMissing("ALTER TABLE `scorm_cmi_states` ADD COLUMN `totalTime` VARCHAR(255) DEFAULT '00:00:00.00'");
            await addColumnIfMissing("ALTER TABLE `scorm_cmi_states` ADD COLUMN `sessionTime` VARCHAR(255) DEFAULT '00:00:00.00'");
            await addColumnIfMissing('ALTER TABLE `scorm_cmi_states` ADD COLUMN `interactionsJson` LONGTEXT NULL');
            await addColumnIfMissing('ALTER TABLE `scorm_cmi_states` ADD COLUMN `rawMapJson` LONGTEXT NULL');
            await addColumnIfMissing('ALTER TABLE `scorm_cmi_states` ADD COLUMN `stateVersion` INTEGER NOT NULL DEFAULT 0');
            await addColumnIfMissing('ALTER TABLE `scorm_cmi_states` ADD COLUMN `initialized` BOOLEAN NOT NULL DEFAULT FALSE');

            await addColumnIfMissing('ALTER TABLE `scorm_attempts` ADD COLUMN `exitType` VARCHAR(255) NULL');
        }

        isConnected = true;
    } catch (err) {
        console.error('Sequelize connection error:', err);
        process.exit(1);
    }
};

module.exports.connectDB = connectDB;
