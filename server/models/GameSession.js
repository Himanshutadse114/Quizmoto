const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

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
    }
});


module.exports = { GameSession, Player, PlayerAnswer };
