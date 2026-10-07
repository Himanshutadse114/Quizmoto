const { Op, UniqueConstraintError } = require('sequelize');
const { sequelize } = require('../../config/database');
const {
    ScormCourse,
    ScormPackage,
    ScormWorkspace,
    ScormCourseCatalogGrant,
    ScormCourseProvision
} = require('../../models/scorm');
const { createInviteCode } = require('./ScormInviteService');
const { packageContentPrefix } = require('./storageKeys');

function fail(message, code, status = 400) {
    const err = new Error(message);
    err.code = code;
    err.status = status;
    return err;
}

function defaultGrantKey(courseId) {
    return `default:${courseId}`;
}

function tenantGrantKey(workspaceId, courseId) {
    return `tenant:${workspaceId}:${courseId}`;
}

async function sourceCourse(courseId, sourceHostId, transaction = null) {
    const course = await ScormCourse.findOne({
        where: { id: courseId, hostId: sourceHostId },
        include: [{ model: ScormPackage, as: 'package' }],
        transaction
    });
    if (!course || course.status === 'archived' || !course.package || course.package.status !== 'ready') {
        throw fail('Choose a ready course from the Super Admin course library.', 'SCORM_CATALOG_SOURCE_INVALID', 404);
    }
    return course;
}

async function ensureProvision({ source, targetHostId, targetWorkspaceId = null, transaction = null }) {
    if (String(source.hostId) === String(targetHostId)) return null;

    let provision = await ScormCourseProvision.findOne({
        where: { sourceCourseId: source.id, targetHostId },
        transaction
    });
    let course = provision ? await ScormCourse.findByPk(provision.courseId, { transaction }) : null;
    let pkg = provision ? await ScormPackage.findByPk(provision.packageId, { transaction }) : null;

    if (!pkg) {
        pkg = await ScormPackage.create({
            hostId: targetHostId,
            title: source.package.title,
            description: source.package.description,
            standard: source.package.standard,
            storageKeyZip: source.package.storageKeyZip,
            storagePrefixContent: source.package.storagePrefixContent || packageContentPrefix(source.package.id),
            entryHref: source.package.entryHref,
            manifestHash: source.package.manifestHash,
            byteSize: source.package.byteSize,
            fileCount: source.package.fileCount,
            status: 'ready',
            source: 'catalog',
            templateId: source.package.templateId,
            analysisJson: null
        }, { transaction });
    } else {
        Object.assign(pkg, {
            title: source.package.title,
            description: source.package.description,
            standard: source.package.standard,
            storageKeyZip: source.package.storageKeyZip,
            storagePrefixContent: source.package.storagePrefixContent || packageContentPrefix(source.package.id),
            entryHref: source.package.entryHref,
            manifestHash: source.package.manifestHash,
            byteSize: source.package.byteSize,
            fileCount: source.package.fileCount,
            status: 'ready',
            source: 'catalog',
            templateId: source.package.templateId,
            analysisJson: null
        });
        await pkg.save({ transaction });
    }

    if (!course) {
        course = await ScormCourse.create({
            hostId: targetHostId,
            packageId: pkg.id,
            title: source.title,
            description: source.description,
            inviteCode: await createInviteCode(),
            status: 'published',
            settings: {
                ...(source.settings || {}),
                catalogManaged: true,
                catalogSourceCourseId: source.id
            },
            publishedAt: source.publishedAt || new Date()
        }, { transaction });
    } else {
        course.title = source.title;
        course.description = source.description;
        course.status = 'published';
        course.publishedAt = source.publishedAt || course.publishedAt || new Date();
        course.settings = {
            ...(source.settings || {}),
            catalogManaged: true,
            catalogSourceCourseId: source.id
        };
        await course.save({ transaction });
    }

    if (!provision) {
        provision = await ScormCourseProvision.create({
            sourceCourseId: source.id,
            targetHostId,
            targetWorkspaceId,
            packageId: pkg.id,
            courseId: course.id,
            active: true
        }, { transaction });
    } else {
        provision.targetWorkspaceId = targetWorkspaceId || provision.targetWorkspaceId || null;
        provision.packageId = pkg.id;
        provision.courseId = course.id;
        provision.active = true;
        await provision.save({ transaction });
    }
    return provision;
}

async function ensureProvisionSafely({ source, targetHostId, targetWorkspaceId = null }) {
    try {
        return await sequelize.transaction((transaction) => ensureProvision({
            source,
            targetHostId,
            targetWorkspaceId,
            transaction
        }));
    } catch (err) {
        if (!(err instanceof UniqueConstraintError)) throw err;

        // Two initial page loads can request catalogue synchronisation together.
        // The unique source/host constraint is the authority; reuse the winner.
        const existing = await ScormCourseProvision.findOne({
            where: { sourceCourseId: source.id, targetHostId }
        });
        if (existing) return existing;
        throw err;
    }
}

async function grantsForTarget(workspaceId = null) {
    const where = workspaceId
        ? { [Op.or]: [{ scope: 'default' }, { scope: 'tenant', workspaceId }] }
        : { scope: 'default' };
    return ScormCourseCatalogGrant.findAll({ where, attributes: ['sourceCourseId'] });
}

async function syncAvailableCourses({ targetHostId, targetWorkspaceId = null }) {
    if (!targetHostId) return [];
    const grants = await grantsForTarget(targetWorkspaceId);
    const ids = [...new Set(grants.map((row) => String(row.sourceCourseId)))];
    if (!ids.length) return [];
    const sources = await ScormCourse.findAll({
        where: { id: { [Op.in]: ids }, status: { [Op.ne]: 'archived' } },
        include: [{ model: ScormPackage, as: 'package', required: true, where: { status: 'ready' } }]
    });
    const provisions = [];
    for (const source of sources) {
        const provision = await ensureProvisionSafely({
            source,
            targetHostId,
            targetWorkspaceId
        });
        if (provision) provisions.push(provision);
    }
    return provisions;
}

async function provisionToAllWorkspaces(source) {
    const workspaces = await ScormWorkspace.findAll({ where: { status: 'active' } });
    for (const workspace of workspaces) {
        await ensureProvisionSafely({
            source,
            targetHostId: workspace.ownerUserId,
            targetWorkspaceId: workspace.id
        });
    }
}

async function setDefaultCourse({ courseId, sourceHostId, actorUserId }) {
    const source = await sourceCourse(courseId, sourceHostId);
    await ScormCourseCatalogGrant.findOrCreate({
        where: { grantKey: defaultGrantKey(courseId) },
        defaults: {
            grantKey: defaultGrantKey(courseId),
            sourceCourseId: courseId,
            workspaceId: null,
            scope: 'default',
            createdByUserId: actorUserId || null
        }
    });
    await provisionToAllWorkspaces(source);
    return true;
}

async function grantCourseToTenant({ courseId, workspaceId, sourceHostId, actorUserId }) {
    const [source, workspace] = await Promise.all([
        sourceCourse(courseId, sourceHostId),
        ScormWorkspace.findByPk(workspaceId)
    ]);
    if (!workspace || workspace.status !== 'active') {
        throw fail('Choose an active tenant.', 'SCORM_CATALOG_TENANT_INVALID', 404);
    }
    const includedByDefault = await ScormCourseCatalogGrant.count({
        where: { grantKey: defaultGrantKey(courseId) }
    });
    if (includedByDefault) return true;

    await ScormCourseCatalogGrant.findOrCreate({
        where: { grantKey: tenantGrantKey(workspaceId, courseId) },
        defaults: {
            grantKey: tenantGrantKey(workspaceId, courseId),
            sourceCourseId: courseId,
            workspaceId,
            scope: 'tenant',
            createdByUserId: actorUserId || null
        }
    });
    await ensureProvisionSafely({
        source,
        targetHostId: workspace.ownerUserId,
        targetWorkspaceId: workspace.id
    });
    return true;
}

async function catalogAdminData(sourceHostId) {
    const [courses, grants, workspaces] = await Promise.all([
        ScormCourse.findAll({
            where: { hostId: sourceHostId, status: { [Op.ne]: 'archived' } },
            include: [{ model: ScormPackage, as: 'package', required: true, where: { status: 'ready' } }],
            order: [['updatedAt', 'DESC']]
        }),
        ScormCourseCatalogGrant.findAll(),
        ScormWorkspace.findAll({ where: { status: 'active' }, order: [['name', 'ASC']] })
    ]);
    const defaults = new Set(grants.filter((row) => row.scope === 'default').map((row) => String(row.sourceCourseId)));
    const tenantCourseIds = new Map();
    grants.filter((row) => row.scope === 'tenant').forEach((row) => {
        const key = String(row.workspaceId);
        if (!tenantCourseIds.has(key)) tenantCourseIds.set(key, []);
        tenantCourseIds.get(key).push(String(row.sourceCourseId));
    });
    return {
        courses: courses.map((course) => ({
            id: course.id,
            title: course.title,
            description: course.description || null,
            status: course.status,
            source: course.package?.source || null,
            isDefault: defaults.has(String(course.id))
        })),
        tenants: workspaces
            .filter((workspace) => String(workspace.ownerUserId) !== String(sourceHostId))
            .map((workspace) => ({
                id: workspace.id,
                name: workspace.name,
                hostId: workspace.ownerUserId,
                courseIds: tenantCourseIds.get(String(workspace.id)) || []
            }))
    };
}

async function removeGrant({ courseId, workspaceId = null }) {
    const grantKey = workspaceId ? tenantGrantKey(workspaceId, courseId) : defaultGrantKey(courseId);
    await ScormCourseCatalogGrant.destroy({ where: { grantKey } });

    const provisions = await ScormCourseProvision.findAll({
        where: workspaceId ? { sourceCourseId: courseId, targetWorkspaceId: workspaceId } : { sourceCourseId: courseId }
    });
    for (const provision of provisions) {
        const stillAvailable = await ScormCourseCatalogGrant.count({
            where: {
                sourceCourseId: courseId,
                [Op.or]: [
                    { scope: 'default' },
                    ...(provision.targetWorkspaceId ? [{ scope: 'tenant', workspaceId: provision.targetWorkspaceId }] : [])
                ]
            }
        });
        if (stillAvailable) continue;
        provision.active = false;
        await provision.save();
        await ScormCourse.update({ status: 'archived' }, { where: { id: provision.courseId } });
    }
    return true;
}

async function provisionMapForHost(hostId) {
    const rows = await ScormCourseProvision.findAll({ where: { targetHostId: hostId, active: true } });
    return new Map(rows.map((row) => [String(row.courseId), row]));
}

async function assertProvisionedCourse(hostId, courseId) {
    const provision = await ScormCourseProvision.findOne({
        where: { targetHostId: hostId, courseId, active: true }
    });
    if (!provision) {
        throw fail('This course is not included in your free catalogue.', 'SCORM_TRIAL_COURSE_NOT_AVAILABLE', 403);
    }
    return provision;
}

async function retireCatalogSourcesForPackage({ packageId, sourceHostId }) {
    const sources = await ScormCourse.findAll({
        where: { packageId, hostId: sourceHostId },
        attributes: ['id']
    });
    const sourceCourseIds = sources.map((course) => course.id);
    if (!sourceCourseIds.length) return 0;

    return sequelize.transaction(async (transaction) => {
        const provisions = await ScormCourseProvision.findAll({
            where: { sourceCourseId: { [Op.in]: sourceCourseIds } },
            attributes: ['id', 'courseId'],
            transaction
        });
        const provisionedCourseIds = provisions.map((provision) => provision.courseId);

        await ScormCourseCatalogGrant.destroy({
            where: { sourceCourseId: { [Op.in]: sourceCourseIds } },
            transaction
        });
        await ScormCourseProvision.update(
            { active: false },
            { where: { sourceCourseId: { [Op.in]: sourceCourseIds } }, transaction }
        );
        if (provisionedCourseIds.length) {
            await ScormCourse.update(
                { status: 'archived' },
                { where: { id: { [Op.in]: provisionedCourseIds } }, transaction }
            );
        }
        return provisions.length;
    });
}

module.exports = {
    syncAvailableCourses,
    setDefaultCourse,
    grantCourseToTenant,
    removeGrant,
    catalogAdminData,
    provisionMapForHost,
    assertProvisionedCourse,
    retireCatalogSourcesForPackage
};
