const { JOB_TYPES } = require('../jobTypes');
const JobQueueService = require('../JobQueueService');
const { unpackPackage } = require('../../services/scorm/ScormUnpackService');
const { ScormPackage } = require('../../models/scorm');
const { deletePackageFromStorage } = require('../../services/scorm/ScormPackageCleanup');
const logger = require('../../utils/logger');

async function handleValidateUnpack(payload) {
    const packageId = payload && payload.packageId;
    if (!packageId) throw new Error('packageId required');
    const pkg = await unpackPackage(packageId);
    return {
        ok: true,
        packageId: pkg.id,
        status: pkg.status,
        entryHref: pkg.entryHref,
        standard: pkg.standard
    };
}

async function handlePackageDelete(payload) {
    const packageId = payload && payload.packageId;
    if (!packageId) throw new Error('packageId required');
    const pkg = await ScormPackage.findByPk(packageId);
    const storageKeyZip = pkg ? pkg.storageKeyZip : null;

    const result = await deletePackageFromStorage(packageId, storageKeyZip);

    if (pkg) {
        pkg.status = 'deleted';
        await pkg.save();
    }

    logger.info('scorm_package_deleted', {
        module: 'scorm',
        packageId,
        storageDeleted: result.deleted
    });
    return { ok: true, deleted: true, storageDeleted: result.deleted };
}

function registerScormHandlers() {
    JobQueueService.registerHandler(JOB_TYPES.SCORM_VALIDATE_UNPACK, handleValidateUnpack);
    JobQueueService.registerHandler(JOB_TYPES.SCORM_PACKAGE_DELETE, handlePackageDelete);
}

module.exports = {
    handleValidateUnpack,
    handlePackageDelete,
    registerScormHandlers
};
