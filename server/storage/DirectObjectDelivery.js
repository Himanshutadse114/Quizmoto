const path = require('path');
const logger = require('../utils/logger');

const browserCorsReadiness = new WeakMap();

function isStoragePolicyPermissionError(error) {
    const status = Number(error?.$metadata?.httpStatusCode || error?.statusCode || error?.status || 0);
    const code = String(error?.code || error?.name || '').toLowerCase();
    return status === 401
        || status === 403
        || ['accessdenied', 'forbidden', 'unauthorized', 'unauthorizedoperation'].includes(code);
}

function clampSeconds(value, fallback, max = 86400) {
    const parsed = Number(value);
    return Math.max(30, Math.min(max, Number.isFinite(parsed) ? parsed : fallback));
}

function isDirectDeliveryEnabled(storage) {
    return process.env.DIRECT_OBJECT_DELIVERY !== '0'
        && storage?.driver === 's3'
        && typeof storage.createSignedGetUrl === 'function';
}

function isDirectUploadEnabled(storage) {
    return process.env.DIRECT_OBJECT_UPLOADS !== '0'
        && storage?.driver === 's3'
        && typeof storage.createSignedPutUrl === 'function'
        && typeof storage.headObject === 'function';
}

function browserOrigins() {
    const configured = [process.env.FRONTEND_URL, process.env.CLIENT_URL, process.env.CORS_ORIGIN]
        .flatMap((value) => String(value || '').split(','));
    const defaults = ['https://lmsgen.in', 'https://www.lmsgen.in'];
    if (process.env.NODE_ENV !== 'production') defaults.push('http://localhost:4173', 'http://localhost:5173');
    return [...new Set([...defaults, ...configured]
        .map((value) => String(value || '').trim().replace(/\/$/, ''))
        .filter((value) => /^https?:\/\//i.test(value)))];
}

async function prepareDirectUpload(storage) {
    if (!isDirectUploadEnabled(storage)) return false;
    if (typeof storage.ensureBrowserCors === 'function' && process.env.DIRECT_OBJECT_MANAGE_CORS !== '0') {
        if (!browserCorsReadiness.has(storage)) {
            const readiness = Promise.resolve()
                .then(() => storage.ensureBrowserCors(browserOrigins()))
                .catch((error) => {
                    // Object read/write tokens commonly cannot manage bucket-level
                    // CORS. The browser policy may already be configured, so do not
                    // prevent a signed upload merely because that optional check is
                    // forbidden.
                    if (isStoragePolicyPermissionError(error)) {
                        logger.warn('direct_upload_cors_management_unavailable', {
                            module: 'storage',
                            status: Number(error?.$metadata?.httpStatusCode || error?.statusCode || error?.status || 0) || null,
                            code: String(error?.code || error?.name || 'ACCESS_DENIED')
                        });
                        return false;
                    }
                    browserCorsReadiness.delete(storage);
                    throw error;
                });
            browserCorsReadiness.set(storage, readiness);
        }
        await browserCorsReadiness.get(storage);
    }
    return true;
}

function safeDownloadName(value, fallback = 'download.bin') {
    const cleaned = String(value || fallback)
        .replace(/[\r\n"\\/]+/g, '_')
        .replace(/[^a-zA-Z0-9._ -]+/g, '_')
        .trim()
        .slice(0, 120);
    return cleaned || fallback;
}

async function signedReadUrl(storage, key, options = {}) {
    if (!isDirectDeliveryEnabled(storage)) return null;
    return storage.createSignedGetUrl(key, {
        expiresIn: clampSeconds(
            options.expiresIn,
            clampSeconds(process.env.DIRECT_OBJECT_READ_TTL_SECONDS, 3600)
        ),
        responseContentType: options.contentType,
        responseContentDisposition: options.downloadName
            ? `attachment; filename="${safeDownloadName(options.downloadName, path.basename(String(key || 'download.bin')))}"`
            : options.contentDisposition
    });
}

async function redirectToSignedObject(res, storage, key, options = {}) {
    const url = await signedReadUrl(storage, key, options);
    if (!url) return false;
    res.setHeader('Cache-Control', 'private, no-store');
    res.redirect(options.statusCode || 307, url);
    return true;
}

module.exports = {
    clampSeconds,
    isDirectDeliveryEnabled,
    isDirectUploadEnabled,
    isStoragePolicyPermissionError,
    prepareDirectUpload,
    browserOrigins,
    safeDownloadName,
    signedReadUrl,
    redirectToSignedObject
};
