/**
 * Remove all object-storage artifacts for a SCORM package from R2/S3/local.
 * Keys live under: scorm/packages/{packageId}/
 */
const { getObjectStorage } = require('../../storage/ObjectStorage');
const {
    packageZipKey,
    packageMetaKey,
    packageContentPrefix
} = require('./storageKeys');
const logger = require('../../utils/logger');

async function deletePackageFromStorage(packageId, storageKeyZip) {
    if (!packageId) {
        return { ok: false, deleted: 0 };
    }
    const storage = getObjectStorage();
    let deleted = 0;

    // Full tree: zip + meta + every unpacked content file
    const prefix = `scorm/packages/${packageId}/`;
    if (typeof storage.deletePrefix === 'function') {
        try {
            const result = await storage.deletePrefix(prefix);
            deleted += result.deleted || 0;
            logger.info('scorm_storage_prefix_deleted', {
                module: 'scorm',
                packageId,
                deleted: result.deleted,
                driver: storage.driver
            });
            return { ok: true, deleted, prefix };
        } catch (err) {
            logger.error('scorm_storage_prefix_delete_failed', {
                module: 'scorm',
                packageId,
                error: err.message
            });
        }
    }

    // Fallback: individual keys
    const keys = [
        storageKeyZip || packageZipKey(packageId),
        packageMetaKey(packageId)
    ];
    for (const key of keys) {
        try {
            await storage.deleteObject(key);
            deleted += 1;
        } catch (_) {
            /* ignore missing */
        }
    }

    // Best-effort content prefix listing if available
    if (typeof storage.listKeys === 'function') {
        try {
            const contentKeys = await storage.listKeys(packageContentPrefix(packageId));
            for (const key of contentKeys) {
                try {
                    await storage.deleteObject(key);
                    deleted += 1;
                } catch (_) {
                    /* ignore */
                }
            }
        } catch (_) {
            /* ignore */
        }
    }

    return { ok: true, deleted, prefix };
}

module.exports = {
    deletePackageFromStorage
};
