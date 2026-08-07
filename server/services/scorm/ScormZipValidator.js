/**
 * SCORM ZIP validation — path safety, size limits, imsmanifest discovery.
 */
const JSZip = require('jszip');
const crypto = require('crypto');
const { scormMaxUploadMb } = require('../../config/featureFlags');

const MAX_ENTRIES = Number(process.env.SCORM_MAX_ZIP_ENTRIES) || 2000;
const MAX_UNCOMPRESSED_RATIO = Number(process.env.SCORM_MAX_ZIP_RATIO) || 50;

function isUnsafePath(name) {
    if (!name || typeof name !== 'string') return true;
    const n = name.replace(/\\/g, '/');
    if (n.startsWith('/') || /^[a-zA-Z]:/.test(n)) return true;
    if (n.split('/').some((p) => p === '..')) return true;
    if (n.includes('\0')) return true;
    return false;
}

function findManifestPath(paths) {
    const normalized = paths.map((p) => p.replace(/\\/g, '/'));
    const exact = normalized.find((p) => p === 'imsmanifest.xml' || p.toLowerCase() === 'imsmanifest.xml');
    if (exact) return exact;
    const oneLevel = normalized.find((p) => {
        const parts = p.split('/').filter(Boolean);
        return parts.length === 2 && parts[1].toLowerCase() === 'imsmanifest.xml';
    });
    return oneLevel || null;
}

function detectStandard(manifestXml) {
    const x = String(manifestXml || '');
    if (/adlseq|adlnav|2004/i.test(x) && /imsss|sequencing/i.test(x)) return 'scorm_2004';
    if (/adlcp:scormtype|adlcp:scormType|scormtype\s*=\s*["']sco/i.test(x)) return 'scorm_1_2';
    if (/IMS CP|imscp/i.test(x)) return 'scorm_1_2';
    return 'unknown';
}

function resolveEntryHref(manifestXml) {
    const xml = String(manifestXml || '');
    const scoRes = xml.match(
        /<resource[^>]*adlcp:scormtype\s*=\s*["']sco["'][^>]*href\s*=\s*["']([^"']+)["']/i
    ) || xml.match(
        /<resource[^>]*href\s*=\s*["']([^"']+)["'][^>]*adlcp:scormtype\s*=\s*["']sco["']/i
    ) || xml.match(
        /<resource[^>]*scormtype\s*=\s*["']sco["'][^>]*href\s*=\s*["']([^"']+)["']/i
    );
    if (scoRes) return scoRes[1].replace(/^\.\//, '');

    const anyRes = xml.match(/<resource[^>]*href\s*=\s*["']([^"']+)["']/i);
    if (anyRes) return anyRes[1].replace(/^\.\//, '');

    const item = xml.match(/<item[^>]*identifierref\s*=\s*["']([^"']+)["']/i);
    if (item) {
        const id = item[1];
        const re = new RegExp(
            `<resource[^>]*identifier\\s*=\\s*["']${id.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}["'][^>]*href\\s*=\\s*["']([^"']+)["']`,
            'i'
        );
        const m = xml.match(re);
        if (m) return m[1].replace(/^\.\//, '');
    }
    return null;
}

/**
 * @param {Buffer} zipBuffer
 * @returns {Promise<{ files: Map<string, Buffer>, manifestPath: string, entryHref: string, standard: string, manifestHash: string, fileCount: number, totalUncompressed: number }>}
 */
async function validateAndExtract(zipBuffer) {
    const maxBytes = scormMaxUploadMb() * 1024 * 1024;
    if (!Buffer.isBuffer(zipBuffer) || zipBuffer.length === 0) {
        const err = new Error('Empty or invalid ZIP buffer');
        err.code = 'INVALID_ZIP';
        throw err;
    }
    if (zipBuffer.length > maxBytes) {
        const err = new Error(`Package exceeds max size of ${scormMaxUploadMb()} MB`);
        err.code = 'TOO_LARGE';
        throw err;
    }

    let zip;
    try {
        zip = await JSZip.loadAsync(zipBuffer);
    } catch (e) {
        const err = new Error('Invalid ZIP file');
        err.code = 'INVALID_ZIP';
        throw err;
    }

    const paths = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
    if (paths.length === 0) {
        const err = new Error('ZIP contains no files');
        err.code = 'EMPTY_ZIP';
        throw err;
    }
    if (paths.length > MAX_ENTRIES) {
        const err = new Error(`Too many files in package (max ${MAX_ENTRIES})`);
        err.code = 'TOO_MANY_FILES';
        throw err;
    }

    for (const p of paths) {
        if (isUnsafePath(p)) {
            const err = new Error(`Unsafe path in ZIP: ${p}`);
            err.code = 'UNSAFE_PATH';
            throw err;
        }
    }

    const manifestPath = findManifestPath(paths);
    if (!manifestPath) {
        const err = new Error('Missing imsmanifest.xml');
        err.code = 'NO_MANIFEST';
        throw err;
    }

    const files = new Map();
    let totalUncompressed = 0;
    for (const p of paths) {
        const data = await zip.files[p].async('nodebuffer');
        totalUncompressed += data.length;
        if (totalUncompressed > maxBytes * MAX_UNCOMPRESSED_RATIO) {
            const err = new Error('Uncompressed size too large (possible zip bomb)');
            err.code = 'ZIP_BOMB';
            throw err;
        }
        const norm = p.replace(/\\/g, '/');
        files.set(norm, data);
    }

    const manifestXml = files.get(manifestPath).toString('utf8');
    const standard = detectStandard(manifestXml);
    let entryHref = resolveEntryHref(manifestXml);

    const manifestDir = manifestPath.includes('/')
        ? manifestPath.slice(0, manifestPath.lastIndexOf('/') + 1)
        : '';
    if (entryHref && manifestDir && !files.has(entryHref) && files.has(manifestDir + entryHref)) {
        entryHref = manifestDir + entryHref;
    }

    if (!entryHref || !files.has(entryHref.replace(/^\.\//, ''))) {
        const candidates = [...files.keys()].filter((k) =>
            /index\.html?$/i.test(k) || /\.html?$/i.test(k)
        );
        if (!entryHref && candidates.length) {
            entryHref = candidates.sort((a, b) => a.length - b.length)[0];
        }
        if (!entryHref || !files.has(entryHref)) {
            const err = new Error('Launch entry HTML not found in package');
            err.code = 'MISSING_ENTRY';
            throw err;
        }
    }

    const manifestHash = crypto.createHash('sha256').update(manifestXml).digest('hex').slice(0, 32);

    return {
        files,
        manifestPath,
        entryHref,
        standard: standard === 'unknown' ? 'scorm_1_2' : standard,
        manifestHash,
        fileCount: files.size,
        totalUncompressed
    };
}

module.exports = {
    validateAndExtract,
    isUnsafePath,
    findManifestPath,
    detectStandard,
    resolveEntryHref
};
