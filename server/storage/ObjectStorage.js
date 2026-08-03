/**
 * Phase 3 — object storage factory.
 *
 * Drivers:
 * - local (default): filesystem under server/data/artifacts
 * - s3: when STORAGE_DRIVER=s3 and S3_BUCKET is set (optional @aws-sdk/client-s3)
 *
 * Interface (all drivers):
 *   putObject({ key, body, contentType }) -> { key, size }
 *   getObjectStream(key) -> { stream, contentType, contentLength? }
 *   getObjectBuffer(key) -> Buffer
 *   deleteObject(key) -> void
 *   exists(key) -> boolean
 *   resolveLocalPath?(key) -> string | null  (local only)
 */

const LocalObjectStorage = require('./LocalObjectStorage');

let cached = null;

function createObjectStorage(options = {}) {
    const driver = (
        options.driver ||
        process.env.STORAGE_DRIVER ||
        'local'
    ).toLowerCase();

    if (driver === 's3') {
        const S3ObjectStorage = require('./S3ObjectStorage');
        return new S3ObjectStorage({
            bucket: options.bucket || process.env.S3_BUCKET,
            region: options.region || process.env.S3_REGION || 'us-east-1',
            endpoint: options.endpoint || process.env.S3_ENDPOINT || null,
            forcePathStyle:
                options.forcePathStyle != null
                    ? options.forcePathStyle
                    : process.env.S3_FORCE_PATH_STYLE === '1'
        });
    }

    return new LocalObjectStorage({
        rootDir: options.rootDir || process.env.REPORT_ARTIFACTS_DIR || null
    });
}

/** Process-wide singleton (safe for API + worker). */
function getObjectStorage() {
    if (!cached) {
        cached = createObjectStorage();
    }
    return cached;
}

/** Test helper */
function _resetObjectStorageCache() {
    cached = null;
}

module.exports = {
    createObjectStorage,
    getObjectStorage,
    _resetObjectStorageCache
};
