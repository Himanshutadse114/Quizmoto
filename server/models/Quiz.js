const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Quiz = sequelize.define('Quiz', {
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    hostId: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
});

const Question = sequelize.define('Question', {
    quizId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    questionText: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    options: {
        type: DataTypes.JSON,
        allowNull: false,
        get() {
            const rawValue = this.getDataValue('options');
            if (typeof rawValue === 'string') {
                try { return JSON.parse(rawValue); } catch (e) { return []; }
            }
            return rawValue || [];
        }
    },
    correctIndex: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    timer: {
        type: DataTypes.INTEGER,
        defaultValue: 20
    },
    image: {
        type: DataTypes.STRING
    }
});

module.exports = { Quiz, Question };
