const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BlogPost = sequelize.define('BlogPost', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    slug: {
        type: DataTypes.STRING(180),
        allowNull: false,
        unique: true
    },
    title: {
        type: DataTypes.STRING(220),
        allowNull: false
    },
    excerpt: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    body: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    category: {
        type: DataTypes.STRING(80),
        allowNull: false,
        defaultValue: 'Learning Design'
    },
    authorName: {
        type: DataTypes.STRING(120),
        allowNull: false,
        defaultValue: 'LMSGEN Team'
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'draft'
    },
    publishedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    createdByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    updatedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'blog_posts',
    indexes: [
        { fields: ['status', 'publishedAt'] },
        { fields: ['category'] }
    ]
});

module.exports = BlogPost;
