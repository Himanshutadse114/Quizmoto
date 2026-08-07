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
    packageMetaKey,
    sourceUploadKey
};
