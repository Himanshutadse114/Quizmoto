const { JOB_TYPES } = require('../jobTypes');
const JobQueueService = require('../JobQueueService');
const { unpackPackage } = require('../../services/scorm/ScormUnpackService');
const { ScormPackage } = require('../../models/scorm');
const { getObjectStorage } = require('../../storage/ObjectStorage');
const { packageZipKey, packageMetaKey } = require('../../services/scorm/storageKeys');
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
    if (!pkg) return { ok: true, deleted: false };
    const storage = getObjectStorage();
    try {
        await storage.deleteObject(pkg.storageKeyZip || packageZipKey(packageId));
    } catch (_) { /* ignore */ }
    try {
        await storage.deleteObject(packageMetaKey(packageId));
    } catch (_) { /* ignore */ }
    pkg.status = 'deleted';
    await pkg.save();
    logger.info('scorm_package_deleted', { module: 'scorm', packageId });
    return { ok: true, deleted: true };
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
