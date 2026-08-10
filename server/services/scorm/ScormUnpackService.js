/**
 * Unpack a stored SCORM ZIP into object storage content prefix.
 */
const { ScormPackage } = require('../../models/scorm');
const { getObjectStorage } = require('../../storage/ObjectStorage');
const { packageZipKey, packageContentKey, packageContentPrefix, packageMetaKey } = require('./storageKeys');
const { validateAndExtractSequential } = require('./ScormZipValidator');
const logger = require('../../utils/logger');

function parseAiAnalysis(data) {
    try {
        if (!data) return null;
        const analysis = JSON.parse(Buffer.from(data).toString('utf8'));
        if (!analysis || !analysis.title || !Array.isArray(analysis.slides)) return null;
        return analysis;
    } catch (_) {
        return null;
    }
}

function positiveInt(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * Keep ZIP inflation memory-safe while allowing several storage writes to overlap.
 * This matters especially for Storyline/Rise packages containing hundreds of small
 * files, where waiting for every S3/R2/local write serially makes validation slow.
 */
function createBoundedUploadQueue(storage, packageId) {
    const concurrency = positiveInt(
        process.env.SCORM_UNPACK_UPLOAD_CONCURRENCY,
        storage.driver === 's3' ? 6 : 4
    );
    const pendingMb = positiveInt(process.env.SCORM_UNPACK_PENDING_MB, 24);
    const maxPendingBytes = pendingMb * 1024 * 1024;

    const active = new Set();
    let pendingBytes = 0;
    let firstError = null;

    function start(relPath, data) {
        const task = {
            bytes: data.length,
            promise: null
        };
        const key = packageContentKey(packageId, relPath);
        const contentType = guessContentType(relPath);

        pendingBytes += task.bytes;
        active.add(task);

        task.promise = storage
            .putObject({ key, body: data, contentType })
            .catch((err) => {
                if (!firstError) firstError = err;
            })
            .finally(() => {
                pendingBytes -= task.bytes;
                active.delete(task);
            });
    }

    async function waitForCapacity(nextBytes) {
        while (
            active.size > 0 &&
            (active.size >= concurrency || pendingBytes + nextBytes > maxPendingBytes)
        ) {
            await Promise.race(Array.from(active, (task) => task.promise));
            if (firstError) throw firstError;
        }
        if (firstError) throw firstError;
    }

    return {
        async enqueue(relPath, data) {
            await waitForCapacity(data.length);
            start(relPath, data);
        },
        async drain() {
            if (active.size > 0) {
                await Promise.all(Array.from(active, (task) => task.promise));
            }
            if (firstError) throw firstError;
        },
        get stats() {
            return {
                concurrency,
                maxPendingBytes,
                active: active.size,
                pendingBytes
            };
        }
    };
}

async function unpackPackage(packageId) {
    const pkg = await ScormPackage.findByPk(packageId);
    if (!pkg) {
        const err = new Error('Package not found');
        err.code = 'NOT_FOUND';
        throw err;
    }

    pkg.status = 'processing';
    pkg.errorMessage = null;
    await pkg.save();

    const storage = getObjectStorage();
    const zipKey = pkg.storageKeyZip || packageZipKey(packageId);

    let zipBuf;
    try {
        zipBuf = await storage.getObjectBuffer(zipKey);
    } catch (e) {
        pkg.status = 'failed';
        pkg.errorMessage = 'ZIP not found in storage';
        await pkg.save();
        throw e;
    }

    const compressedByteSize = zipBuf.length;
    let uploads = null;

    try {
        const prefix = packageContentPrefix(packageId);
        let aiAnalysis = null;
        uploads = createBoundedUploadQueue(storage, packageId);

        logger.info('scorm_unpack_started', {
            module: 'scorm',
            packageId,
            compressedByteSize,
            storageDriver: storage.driver || 'unknown',
            uploadConcurrency: uploads.stats.concurrency,
            uploadPendingBytes: uploads.stats.maxPendingBytes
        });

        const result = await validateAndExtractSequential(zipBuf, async (relPath, data) => {
            if (relPath === 'content.json' && !aiAnalysis) {
                aiAnalysis = parseAiAnalysis(data);
            }

            // The queue applies both a concurrency cap and a byte budget. Small
            // assets upload in parallel; large media automatically applies
            // back-pressure so peak memory stays bounded.
            await uploads.enqueue(relPath, data);
        });

        // Ensure the final in-flight storage writes have completed before marking
        // the package ready.
        await uploads.drain();

        // Release the compressed archive before the remaining metadata/database
        // writes so GC can reclaim it as soon as possible.
        zipBuf = null;

        const meta = {
            entryHref: result.entryHref,
            manifestPath: result.manifestPath,
            standard: result.standard,
            fileCount: result.fileCount,
            manifestHash: result.manifestHash,
            totalUncompressed: result.totalUncompressed
        };
        await storage.putObject({
            key: packageMetaKey(packageId),
            body: Buffer.from(JSON.stringify(meta, null, 2)),
            contentType: 'application/json'
        });

        pkg.storagePrefixContent = prefix;
        pkg.entryHref = result.entryHref;
        pkg.standard = result.standard;
        pkg.manifestHash = result.manifestHash;
        pkg.fileCount = result.fileCount;
        pkg.byteSize = compressedByteSize;
        pkg.status = 'ready';
        pkg.errorMessage = null;
        if (aiAnalysis) {
            pkg.source = 'ai_author';
            pkg.analysisJson = JSON.stringify(aiAnalysis);
        }
        await pkg.save();

        logger.info('scorm_unpack_ok', {
            module: 'scorm',
            packageId,
            entryHref: result.entryHref,
            fileCount: result.fileCount,
            totalUncompressed: result.totalUncompressed
        });
        return pkg;
    } catch (err) {
        if (uploads) {
            await uploads.drain().catch(() => {});
        }
        zipBuf = null;
        pkg.status = 'failed';
        pkg.errorMessage = err.message || 'Unpack failed';
        await pkg.save();
        logger.error('scorm_unpack_failed', {
            module: 'scorm',
            packageId,
            code: err.code,
            error: err.message
        });
        throw err;
    }
}

function guessContentType(path) {
    const p = path.toLowerCase();
    if (p.endsWith('.html') || p.endsWith('.htm')) return 'text/html; charset=utf-8';
    if (p.endsWith('.js')) return 'application/javascript';
    if (p.endsWith('.css')) return 'text/css';
    if (p.endsWith('.json')) return 'application/json';
    if (p.endsWith('.xml')) return 'application/xml';
    if (p.endsWith('.png')) return 'image/png';
    if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/jpeg';
    if (p.endsWith('.gif')) return 'image/gif';
    if (p.endsWith('.svg')) return 'image/svg+xml';
    if (p.endsWith('.woff2')) return 'font/woff2';
    if (p.endsWith('.woff')) return 'font/woff';
    if (p.endsWith('.ttf')) return 'font/ttf';
    if (p.endsWith('.mp3')) return 'audio/mpeg';
    if (p.endsWith('.wav')) return 'audio/wav';
    if (p.endsWith('.mp4')) return 'video/mp4';
    if (p.endsWith('.webm')) return 'video/webm';
    return 'application/octet-stream';
}

module.exports = { unpackPackage, guessContentType };
