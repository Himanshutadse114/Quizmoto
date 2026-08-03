const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Canonical V2 session states (Phase 2). Legacy `status` remains the runtime path
 * until `new_session_engine` is enabled for a session.
 */
const SESSION_STATES = [
    'CREATED',
    'LOBBY',
    'STARTING',
    'QUESTION_COUNTDOWN',
    'QUESTION_OPEN',
    'QUESTION_LOCKED',
    'ANSWER_REVEAL',
    'LEADERBOARD',
    'NEXT_ROUND_READY',
    'PAUSED',
    'FINISHING',
    'FINISHED',
    'CANCELLED'
];

const GameSession = sequelize.define('GameSession', {
    pin: {
        type: DataTypes.STRING(6),
        allowNull: false,
        unique: true
    },
    quizId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    hostId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    // Legacy status — keep as source of truth while feature flag is OFF
    status: {
        type: DataTypes.ENUM('lobby', 'question', 'result', 'finished'),
        defaultValue: 'lobby'
    },
    gameMode: {
        type: DataTypes.STRING,
        defaultValue: 'classic' // 'classic' or 'team'
    },
    currentQuestionIndex: {
        type: DataTypes.INTEGER,
        defaultValue: -1
    },
    questionStartTime: {
        type: DataTypes.DATE,
        allowNull: true
    },
    analytics: {
        type: DataTypes.JSON,
        allowNull: true
    },
    // --- Phase 2 additive fields (unused until new_session_engine is ON) ---
    state: {
        type: DataTypes.STRING(32),
        allowNull: true,
        defaultValue: 'LOBBY'
    },
    stateVersion: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0
    },
    activeRoundId: {
        type: DataTypes.STRING(36),
        allowNull: true
    },
    stateEnteredAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    questionOpensAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    questionClosesAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    hostLeaseOwner: {
        type: DataTypes.STRING(128),
        allowNull: true
    },
    hostLeaseExpiresAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    lastEventSequence: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0
    },
    recoverySchemaVersion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    lastErrorCode: {
        type: DataTypes.STRING(64),
        allowNull: true
    }
});

const Player = sequelize.define('Player', {
    sessionId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    nickname: {
        type: DataTypes.STRING,
        allowNull: false
    },
    teamName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    playerProfileId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    socketId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    score: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    lastAnswerCorrect: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    lastAnswerTime: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    lastAnswerIndex: {
        type: DataTypes.INTEGER,
        defaultValue: -1
    },
    streak: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    avatar: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    indexes: [
        {
            unique: true,
            fields: ['sessionId', 'nickname']
        },
        {
            fields: ['score']
        },
        {
            fields: ['teamName']
        }
    ]
});

const PlayerAnswer = sequelize.define('PlayerAnswer', {
    sessionId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    playerId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    questionIndex: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    answerIndex: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    isCorrect: {
        type: DataTypes.BOOLEAN,
        allowNull: false
    },
    timeTaken: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    // Phase 2: optional link to Round when V2 path is used
    roundId: {
        type: DataTypes.STRING(36),
        allowNull: true
    }
}, {
    indexes: [
        {
            unique: true,
            fields: ['sessionId', 'playerId', 'questionIndex'],
            name: 'player_answers_session_player_question_unique'
        }
    ]
});

/** One logical question attempt within a session (Phase 2). */
const Round = sequelize.define('Round', {
    sessionId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    roundId: {
        type: DataTypes.STRING(36),
        allowNull: false,
        unique: true
    },
    questionIndex: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'PENDING'
    },
    opensAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    closesAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    indexes: [
        {
            fields: ['sessionId', 'questionIndex']
        }
    ]
});

/** Append-only session event ledger (Phase 2). */
const SessionEvent = sequelize.define('SessionEvent', {
    sessionId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    sequence: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    eventType: {
        type: DataTypes.STRING(64),
        allowNull: false
    },
    stateVersion: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    roundId: {
        type: DataTypes.STRING(36),
        allowNull: true
    },
    actorType: {
        type: DataTypes.STRING(16),
        allowNull: true
    },
    actorId: {
        type: DataTypes.STRING(64),
        allowNull: true
    },
    payloadJson: {
        type: DataTypes.JSON,
        allowNull: true
    },
    correlationId: {
        type: DataTypes.STRING(36),
        allowNull: true
    }
}, {
    indexes: [
        {
            unique: true,
            fields: ['sessionId', 'sequence'],
            name: 'session_events_session_sequence_unique'
        },
        {
            fields: ['sessionId', 'stateVersion']
        }
    ]
});

/** Command idempotency store (Phase 2). */
const IdempotencyRecord = sequelize.define('IdempotencyRecord', {
    commandId: {
        type: DataTypes.STRING(36),
        allowNull: false,
        unique: true
    },
    actorId: {
        type: DataTypes.STRING(64),
        allowNull: false
    },
    sessionId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    commandType: {
        type: DataTypes.STRING(64),
        allowNull: false
    },
    requestHash: {
        type: DataTypes.STRING(64),
        allowNull: true
    },
    resultCode: {
        type: DataTypes.STRING(32),
        allowNull: false
    },
    resultPayload: {
        type: DataTypes.JSON,
        allowNull: true
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    indexes: [
        {
            fields: ['sessionId', 'commandType']
        },
        {
            fields: ['expiresAt']
        }
    ]
});

module.exports = {
    GameSession,
    Player,
    PlayerAnswer,
    Round,
    SessionEvent,
    IdempotencyRecord,
    SESSION_STATES
};
