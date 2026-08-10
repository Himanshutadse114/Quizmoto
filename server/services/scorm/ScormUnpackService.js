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

    try {
        const prefix = packageContentPrefix(packageId);
        let aiAnalysis = null;

        const result = await validateAndExtractSequential(zipBuf, async (relPath, data) => {
            if (relPath === 'content.json' && !aiAnalysis) {
                aiAnalysis = parseAiAnalysis(data);
            }

            const key = packageContentKey(packageId, relPath);
            const ct = guessContentType(relPath);
            await storage.putObject({ key, body: data, contentType: ct });
        });

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
