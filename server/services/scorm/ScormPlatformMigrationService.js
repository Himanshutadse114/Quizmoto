const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const queryInterface = () => sequelize.getQueryInterface();

async function describeTableOrNull(tableName) {
    try {
        return await queryInterface().describeTable(tableName);
    } catch (_) {
        return null;
    }
}

async function ensureTable(tableName, definition) {
    const existing = await describeTableOrNull(tableName);
    if (existing) return false;
    await queryInterface().createTable(tableName, definition);
    return true;
}

async function ensureColumn(tableName, columnName, definition) {
    const description = await describeTableOrNull(tableName);
    if (!description || description[columnName]) return false;
    await queryInterface().addColumn(tableName, columnName, definition);
    return true;
}

async function ensureColumns(tableName, definitions) {
    const changes = [];
    for (const [columnName, definition] of Object.entries(definitions)) {
        if (await ensureColumn(tableName, columnName, definition)) {
            changes.push(`${tableName}.${columnName}`);
        }
    }
    return changes;
}

async function ensureIndex(tableName, fields, options = {}) {
    const qi = queryInterface();
    const indexes = await qi.showIndex(tableName);
    const name = options.name;
    const exists = name
        ? indexes.some((index) => index.name === name)
        : indexes.some((index) => {
            const currentFields = (index.fields || []).map((field) => field.attribute || field.name);
            return currentFields.length === fields.length
                && currentFields.every((field, indexPosition) => field === fields[indexPosition])
                && Boolean(index.unique) === Boolean(options.unique);
        });

    if (exists) return false;
    await qi.addIndex(tableName, fields, options);
    return true;
}

function timestampColumns() {
    return {
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false }
    };
}

function workspaceColumns() {
    return {
        id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true
        },
        ownerUserId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true
        },
        name: {
            type: DataTypes.STRING(160),
            allowNull: false
        },
        status: {
            type: DataTypes.STRING(32),
            allowNull: false,
            defaultValue: 'active'
        },
        ...timestampColumns()
    };
}

function workspaceMemberColumns() {
    return {
        id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true
        },
        workspaceId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'scorm_workspaces', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        email: {
            type: DataTypes.STRING(320),
            allowNull: false,
            unique: true
        },
        displayName: {
            type: DataTypes.STRING(160),
            allowNull: true
        },
        role: {
            type: DataTypes.STRING(32),
            allowNull: false,
            defaultValue: 'co_admin'
        },
        status: {
            type: DataTypes.STRING(32),
            allowNull: false,
            defaultValue: 'invited'
        },
        invitedByUserId: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        invitedByEmail: {
            type: DataTypes.STRING(320),
            allowNull: true
        },
        joinedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        ...timestampColumns()
    };
}

function workspaceAuthConfigColumns() {
    return {
        id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true
        },
        workspaceId: {
            type: DataTypes.UUID,
            allowNull: false,
            unique: true,
            references: { model: 'scorm_workspaces', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        joiningMode: {
            type: DataTypes.STRING(32),
            allowNull: false,
            defaultValue: 'assigned_email'
        },
        googleEnabled: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        googleClientId: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        microsoftEnabled: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        microsoftClientId: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        microsoftTenantId: {
            type: DataTypes.STRING(128),
            allowNull: true
        },
        allowedDomainsJson: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        updatedByUserId: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        ...timestampColumns()
    };
}

async function ensureWorkspaceSchema() {
    const changes = [];
    const tables = [
        ['scorm_workspaces', workspaceColumns()],
        ['scorm_workspace_members', workspaceMemberColumns()],
        ['scorm_workspace_auth_configs', workspaceAuthConfigColumns()]
    ];

    for (const [tableName, columns] of tables) {
        if (await ensureTable(tableName, columns)) {
            changes.push(tableName);
        } else {
            changes.push(...await ensureColumns(tableName, columns));
        }
    }

    const indexes = [
        ['scorm_workspaces', ['status'], { name: 'scorm_workspaces_status_idx' }],
        ['scorm_workspace_members', ['workspaceId', 'email'], {
            name: 'scorm_workspace_members_workspace_email_uq',
            unique: true
        }],
        ['scorm_workspace_members', ['workspaceId', 'role'], {
            name: 'scorm_workspace_members_workspace_role_idx'
        }],
        ['scorm_workspace_members', ['userId'], {
            name: 'scorm_workspace_members_user_idx'
        }],
        ['scorm_workspace_members', ['status'], {
            name: 'scorm_workspace_members_status_idx'
        }]
    ];

    for (const [tableName, fields, options] of indexes) {
        if (await ensureIndex(tableName, fields, options)) {
            changes.push(options.name);
        }
    }

    return changes;
}

async function ensurePlatformSchema() {
    const changes = [];

    // Workspace/role/SSO tables were introduced after the original SCORM schema.
    // Long-lived production databases intentionally do not use destructive
    // sequelize.sync({ alter: true }), so create/repair these tables explicitly.
    changes.push(...await ensureWorkspaceSchema());

    const registrationColumns = [
        ['assignedAt', { type: DataTypes.DATE, allowNull: true }],
        ['assignedByUserId', { type: DataTypes.INTEGER, allowNull: true }],
        ['dueAt', { type: DataTypes.DATE, allowNull: true }],
        ['assignmentSource', { type: DataTypes.STRING(32), allowNull: true }],
        ['required', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }]
    ];

    for (const [name, definition] of registrationColumns) {
        if (await ensureColumn('scorm_registrations', name, definition)) {
            changes.push(`scorm_registrations.${name}`);
        }
    }

    return { changed: changes.length > 0, changes };
}

module.exports = { ensurePlatformSchema };
