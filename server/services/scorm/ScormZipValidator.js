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

function immediate() {
    return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Validate a SCORM ZIP and extract one file at a time.
 *
 * This is the production-safe path for large Storyline/Rise packages. JSZip still
 * parses the compressed archive, but we never retain every inflated file in RAM at
 * once. `onFile` is awaited before the next entry is inflated, which keeps peak
 * memory close to compressed ZIP size + the largest individual file.
 *
 * @param {Buffer} zipBuffer
 * @param {(path: string, data: Buffer) => Promise<void>|void} onFile
 * @returns {Promise<{ manifestPath: string, entryHref: string, standard: string, manifestHash: string, fileCount: number, totalUncompressed: number }>}
 */
async function validateAndExtractSequential(zipBuffer, onFile = async () => {}) {
    const maxBytes = scormMaxUploadMb() * 1024 * 1024;
    const maxUncompressedBytes = maxBytes * MAX_UNCOMPRESSED_RATIO;

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
    } catch (_) {
        const err = new Error('Invalid ZIP file');
        err.code = 'INVALID_ZIP';
        throw err;
    }

    const entries = Object.keys(zip.files)
        .filter((p) => !zip.files[p].dir)
        .map((raw) => ({ raw, norm: raw.replace(/\\/g, '/') }));

    if (entries.length === 0) {
        const err = new Error('ZIP contains no files');
        err.code = 'EMPTY_ZIP';
        throw err;
    }
    if (entries.length > MAX_ENTRIES) {
        const err = new Error(`Too many files in package (max ${MAX_ENTRIES})`);
        err.code = 'TOO_MANY_FILES';
        throw err;
    }

    for (const entry of entries) {
        if (isUnsafePath(entry.norm)) {
            const err = new Error(`Unsafe path in ZIP: ${entry.norm}`);
            err.code = 'UNSAFE_PATH';
            throw err;
        }
    }

    // JSZip exposes central-directory uncompressed sizes on loaded entries. Use
    // those values as an early zip-bomb guard before any large file is inflated.
    let declaredUncompressed = 0;
    for (const entry of entries) {
        const declared = Number(zip.files[entry.raw]?._data?.uncompressedSize);
        if (Number.isFinite(declared) && declared >= 0) declaredUncompressed += declared;
        if (declaredUncompressed > maxUncompressedBytes) {
            const err = new Error('Uncompressed size too large (possible zip bomb)');
            err.code = 'ZIP_BOMB';
            throw err;
        }
    }

    const normalizedPaths = entries.map((entry) => entry.norm);
    const pathSet = new Set(normalizedPaths);
    const manifestPath = findManifestPath(normalizedPaths);
    if (!manifestPath) {
        const err = new Error('Missing imsmanifest.xml');
        err.code = 'NO_MANIFEST';
        throw err;
    }

    const manifestEntry = entries.find((entry) => entry.norm === manifestPath);
    let manifestXml;
    try {
        manifestXml = await zip.files[manifestEntry.raw].async('string');
    } catch (_) {
        const err = new Error('Unable to read imsmanifest.xml');
        err.code = 'INVALID_MANIFEST';
        throw err;
    }

    const standard = detectStandard(manifestXml);
    let entryHref = resolveEntryHref(manifestXml);
    if (entryHref) entryHref = entryHref.replace(/\\/g, '/').replace(/^\.\//, '');

    const manifestDir = manifestPath.includes('/')
        ? manifestPath.slice(0, manifestPath.lastIndexOf('/') + 1)
        : '';

    if (entryHref && manifestDir && !pathSet.has(entryHref) && pathSet.has(manifestDir + entryHref)) {
        entryHref = manifestDir + entryHref;
    }

    if (!entryHref || !pathSet.has(entryHref)) {
        const candidates = normalizedPaths.filter((k) => /index\.html?$/i.test(k) || /\.html?$/i.test(k));
        if (!entryHref && candidates.length) {
            entryHref = candidates.sort((a, b) => a.length - b.length)[0];
        }
        if (!entryHref || !pathSet.has(entryHref)) {
            const err = new Error('Launch entry HTML not found in package');
            err.code = 'MISSING_ENTRY';
            throw err;
        }
    }

    let totalUncompressed = 0;
    for (let i = 0; i < entries.length; i += 1) {
        const entry = entries[i];
        const data = await zip.files[entry.raw].async('nodebuffer');
        totalUncompressed += data.length;
        if (totalUncompressed > maxUncompressedBytes) {
            const err = new Error('Uncompressed size too large (possible zip bomb)');
            err.code = 'ZIP_BOMB';
            throw err;
        }

        await onFile(entry.norm, data);

        // Give the HTTP server and GC regular opportunities to run while a large
        // package is being expanded in the same process.
        if ((i + 1) % 4 === 0) await immediate();
    }

    const manifestHash = crypto.createHash('sha256').update(manifestXml).digest('hex').slice(0, 32);

    return {
        manifestPath,
        entryHref,
        standard: standard === 'unknown' ? 'scorm_1_2' : standard,
        manifestHash,
        fileCount: entries.length,
        totalUncompressed
    };
}

/**
 * Backwards-compatible helper used by tests/legacy callers that still need all
 * extracted files. Production unpacking uses validateAndExtractSequential().
 */
async function validateAndExtract(zipBuffer) {
    const files = new Map();
    const result = await validateAndExtractSequential(zipBuffer, async (path, data) => {
        files.set(path, data);
    });
    return { ...result, files };
}

module.exports = {
    validateAndExtract,
    validateAndExtractSequential,
    isUnsafePath,
    findManifestPath,
    detectStandard,
    resolveEntryHref
};
