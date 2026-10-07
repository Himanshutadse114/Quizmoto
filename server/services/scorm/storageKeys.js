/**
 * R2 / object-storage key conventions for SCORM packages.
 */

function packageZipKey(packageId) {
    return `scorm/packages/${packageId}/package.zip`;
}

function packageContentPrefix(packageId) {
    return `scorm/packages/${packageId}/content/`;
}

function packageContentKey(packageId, relativePath) {
    const clean = String(relativePath || '').replace(/^\/+/, '').replace(/\\/g, '/');
    return `${packageContentPrefix(packageId)}${clean}`;
}

/**
 * Resolve content for both ordinary packages and catalogue-managed packages.
 * Catalogue packages keep their own database id but intentionally reuse the
 * source package's R2 content prefix instead of duplicating every object.
 */
function storedPackageContentKey(pkg, relativePath) {
    const clean = String(relativePath || '').replace(/^\/+/, '').replace(/\\/g, '/');
    const configuredPrefix = typeof pkg === 'object' && pkg
        ? String(pkg.storagePrefixContent || '').replace(/\\/g, '/').replace(/^\/+/, '')
        : '';
    if (configuredPrefix) {
        return `${configuredPrefix.replace(/\/*$/, '/')}${clean}`;
    }
    const packageId = typeof pkg === 'object' && pkg ? pkg.id : pkg;
    return packageContentKey(packageId, clean);
}

function packageMetaKey(packageId) {
    return `scorm/packages/${packageId}/meta.json`;
}

function sourceUploadKey(hostId, sourceId, filename) {
    const safe = String(filename || 'source.bin').replace(/[^a-zA-Z0-9._-]/g, '_');
    return `scorm/sources/${hostId}/${sourceId}/${safe}`;
}

module.exports = {
    packageZipKey,
    packageContentPrefix,
    packageContentKey,
    storedPackageContentKey,
    packageMetaKey,
    sourceUploadKey
};
