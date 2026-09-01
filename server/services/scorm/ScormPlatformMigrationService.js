const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const queryInterface = () => sequelize.getQueryInterface();
const tableDescriptionCache = new Map();
const tableIndexCache = new Map();

function resetSchemaCache() {
    tableDescriptionCache.clear();
    tableIndexCache.clear();
}

async function describeTableOrNull(tableName) {
    if (tableDescriptionCache.has(tableName)) return tableDescriptionCache.get(tableName);
    try {
        const description = await queryInterface().describeTable(tableName);
        tableDescriptionCache.set(tableName, description);
        return description;
    } catch (_) {
        tableDescriptionCache.set(tableName, null);
        return null;
    }
}

async function ensureTable(tableName, definition) {
    const existing = await describeTableOrNull(tableName);
    if (existing) return false;
    await queryInterface().createTable(tableName, definition);
    tableDescriptionCache.set(tableName, { ...definition });
    tableIndexCache.delete(tableName);
    return true;
}

async function ensureColumn(tableName, columnName, definition) {
    const description = await describeTableOrNull(tableName);
    if (!description || description[columnName]) return false;
    await queryInterface().addColumn(tableName, columnName, definition);
    description[columnName] = definition;
    return true;
}

async function ensureColumns(tableName, definitions) {
    const changes = [];
    for (const [columnName, definition] of Object.entries(definitions)) {
        if (await ensureColumn(tableName, columnName, definition)) changes.push(`${tableName}.${columnName}`);
    }
    return changes;
}

async function indexesForTable(tableName) {
    if (tableIndexCache.has(tableName)) return tableIndexCache.get(tableName);
    const indexes = await queryInterface().showIndex(tableName);
    tableIndexCache.set(tableName, indexes);
    return indexes;
}

async function ensureIndex(tableName, fields, options = {}) {
    const indexes = await indexesForTable(tableName);
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
    await queryInterface().addIndex(tableName, fields, options);
    indexes.push({
        name: options.name || null,
        unique: Boolean(options.unique),
        fields: fields.map((field) => ({ attribute: field, name: field }))
    });
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
        id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
        ownerUserId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
        name: { type: DataTypes.STRING(160), allowNull: false },
        status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'active' },
        ...timestampColumns()
    };
}

function workspaceMemberColumns() {
    return {
        id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
        workspaceId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'scorm_workspaces', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        userId: { type: DataTypes.INTEGER, allowNull: true },
        email: { type: DataTypes.STRING(320), allowNull: false, unique: true },
        displayName: { type: DataTypes.STRING(160), allowNull: true },
        role: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'co_admin' },
        status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'invited' },
        invitedByUserId: { type: DataTypes.INTEGER, allowNull: true },
        invitedByEmail: { type: DataTypes.STRING(320), allowNull: true },
        joinedAt: { type: DataTypes.DATE, allowNull: true },
        ...timestampColumns()
    };
}

function workspaceAuthConfigColumns() {
    return {
        id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
        workspaceId: {
            type: DataTypes.UUID,
            allowNull: false,
            unique: true,
            references: { model: 'scorm_workspaces', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        joiningMode: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'assigned_email' },
        googleEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        googleClientId: { type: DataTypes.STRING(255), allowNull: true },
        microsoftEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        microsoftClientId: { type: DataTypes.STRING(255), allowNull: true },
        microsoftTenantId: { type: DataTypes.STRING(128), allowNull: true },
        allowedDomainsJson: { type: DataTypes.TEXT, allowNull: true },
        staffJoiningMode: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'password_or_sso' },
        staffGoogleEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        staffGoogleClientId: { type: DataTypes.STRING(255), allowNull: true },
        staffMicrosoftEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        staffMicrosoftClientId: { type: DataTypes.STRING(255), allowNull: true },
        staffMicrosoftTenantId: { type: DataTypes.STRING(128), allowNull: true },
        staffAllowedDomainsJson: { type: DataTypes.TEXT, allowNull: true },
        updatedByUserId: { type: DataTypes.INTEGER, allowNull: true },
        ...timestampColumns()
    };
}

function entitlementColumns() {
    return {
        id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
        email: { type: DataTypes.STRING(320), allowNull: false, unique: true },
        maxCourses: { type: DataTypes.INTEGER, allowNull: true },
        maxLearners: { type: DataTypes.INTEGER, allowNull: true },
        maxStaff: { type: DataTypes.INTEGER, allowNull: true },
        maxCampaigns: { type: DataTypes.INTEGER, allowNull: true },
        maxAssignments: { type: DataTypes.INTEGER, allowNull: true },
        permissions: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
        updatedByUserId: { type: DataTypes.INTEGER, allowNull: true },
        updatedByEmail: { type: DataTypes.STRING(320), allowNull: true },
        ...timestampColumns()
    };
}

function campaignColumns() {
    return {
        id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
        workspaceId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'scorm_workspaces', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        hostId: { type: DataTypes.INTEGER, allowNull: false },
        name: { type: DataTypes.STRING(180), allowNull: false },
        status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'draft' },
        authMode: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'sso_any' },
        dueAt: { type: DataTypes.DATE, allowNull: true },
        required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        createdByUserId: { type: DataTypes.INTEGER, allowNull: true },
        startedAt: { type: DataTypes.DATE, allowNull: true },
        endedAt: { type: DataTypes.DATE, allowNull: true },
        ...timestampColumns()
    };
}

function campaignLearnerColumns() {
    return {
        id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
        campaignId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'scorm_campaigns', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        email: { type: DataTypes.STRING(320), allowNull: false },
        learnerName: { type: DataTypes.STRING(180), allowNull: true },
        ...timestampColumns()
    };
}

function campaignCourseColumns() {
    return {
        id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
        campaignId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'scorm_campaigns', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        courseId: { type: DataTypes.UUID, allowNull: false },
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
        if (await ensureTable(tableName, columns)) changes.push(tableName);
        else changes.push(...await ensureColumns(tableName, columns));
    }
    const indexes = [
        ['scorm_workspaces', ['status'], { name: 'scorm_workspaces_status_idx' }],
        ['scorm_workspace_members', ['workspaceId', 'email'], { name: 'scorm_workspace_members_workspace_email_uq', unique: true }],
        ['scorm_workspace_members', ['workspaceId', 'role'], { name: 'scorm_workspace_members_workspace_role_idx' }],
        ['scorm_workspace_members', ['userId'], { name: 'scorm_workspace_members_user_idx' }],
        ['scorm_workspace_members', ['status'], { name: 'scorm_workspace_members_status_idx' }]
    ];
    for (const [tableName, fields, options] of indexes) {
        if (await ensureIndex(tableName, fields, options)) changes.push(options.name);
    }
    return changes;
}

async function ensureEntitlementSchema() {
    const changes = [];
    const columns = entitlementColumns();
    if (await ensureTable('scorm_user_entitlements', columns)) changes.push('scorm_user_entitlements');
    else changes.push(...await ensureColumns('scorm_user_entitlements', columns));
    if (await ensureIndex('scorm_user_entitlements', ['email'], { name: 'scorm_user_entitlements_email_uq', unique: true })) {
        changes.push('scorm_user_entitlements_email_uq');
    }
    return changes;
}

async function ensureCampaignSchema() {
    const changes = [];
    const tables = [
        ['scorm_campaigns', campaignColumns()],
        ['scorm_campaign_learners', campaignLearnerColumns()],
        ['scorm_campaign_courses', campaignCourseColumns()]
    ];
    for (const [tableName, columns] of tables) {
        if (await ensureTable(tableName, columns)) changes.push(tableName);
        else changes.push(...await ensureColumns(tableName, columns));
    }
    const indexes = [
        ['scorm_campaigns', ['workspaceId'], { name: 'scorm_campaigns_workspace_idx' }],
        ['scorm_campaigns', ['status'], { name: 'scorm_campaigns_status_idx' }],
        ['scorm_campaign_learners', ['campaignId', 'email'], { name: 'scorm_campaign_learners_campaign_email_uq', unique: true }],
        ['scorm_campaign_learners', ['email'], { name: 'scorm_campaign_learners_email_idx' }],
        ['scorm_campaign_courses', ['campaignId', 'courseId'], { name: 'scorm_campaign_courses_campaign_course_uq', unique: true }]
    ];
    for (const [tableName, fields, options] of indexes) {
        if (await ensureIndex(tableName, fields, options)) changes.push(options.name);
    }
    return changes;
}

async function ensurePlatformSchema() {
    resetSchemaCache();
    const changes = [];
    changes.push(...await ensureWorkspaceSchema());
    changes.push(...await ensureEntitlementSchema());
    changes.push(...await ensureCampaignSchema());

    const registrationColumns = [
        ['assignedAt', { type: DataTypes.DATE, allowNull: true }],
        ['assignedByUserId', { type: DataTypes.INTEGER, allowNull: true }],
        ['dueAt', { type: DataTypes.DATE, allowNull: true }],
        ['assignmentSource', { type: DataTypes.STRING(32), allowNull: true }],
        ['required', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }],
        ['campaignId', { type: DataTypes.UUID, allowNull: true }]
    ];
    for (const [name, definition] of registrationColumns) {
        if (await ensureColumn('scorm_registrations', name, definition)) changes.push(`scorm_registrations.${name}`);
    }

    const registrationIndexes = [
        [['campaignId'], { name: 'scorm_registrations_campaign_idx' }],
        [['campaignId', 'isPreview', 'status'], { name: 'scorm_registrations_campaign_runtime_idx' }]
    ];
    for (const [fields, options] of registrationIndexes) {
        if (await ensureIndex('scorm_registrations', fields, options)) changes.push(options.name);
    }

    return { changed: changes.length > 0, changes };
}

module.exports = { ensurePlatformSchema };
