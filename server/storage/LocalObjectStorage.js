/**
 * Local filesystem object storage.
 * Default root: server/data/artifacts
 */

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');

function ensureDirSync(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

class LocalObjectStorage {
    constructor(options = {}) {
        this.rootDir =
            options.rootDir ||
            path.join(__dirname, '../data/artifacts');
        ensureDirSync(this.rootDir);
        this.driver = 'local';
    }

    _safeKey(key) {
        if (!key || typeof key !== 'string') {
            throw new Error('storage key is required');
        }
        // Prevent path traversal
        const normalized = path.normalize(key).replace(/^(\.\.[/\\])+/, '');
        if (normalized.includes('..')) {
            throw new Error('invalid storage key');
        }
        return normalized.replace(/\\/g, '/');
    }

    resolveLocalPath(key) {
        const safe = this._safeKey(key);
        return path.join(this.rootDir, safe);
    }

    async putObject({ key, body, contentType }) {
        const filePath = this.resolveLocalPath(key);
        ensureDirSync(path.dirname(filePath));

        const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
        await fsp.writeFile(filePath, buf);

        // Optional sidecar for content-type
        if (contentType) {
            await fsp.writeFile(`${filePath}.meta.json`, JSON.stringify({ contentType }), 'utf8');
        }

        return { key: this._safeKey(key), size: buf.length, contentType: contentType || null };
    }

    async exists(key) {
        try {
            await fsp.access(this.resolveLocalPath(key));
            return true;
        } catch (_) {
            return false;
        }
    }

    async _readMeta(filePath) {
        try {
            const raw = await fsp.readFile(`${filePath}.meta.json`, 'utf8');
            return JSON.parse(raw);
        } catch (_) {
            return {};
        }
    }

    async getObjectStream(key) {
        const filePath = this.resolveLocalPath(key);
        if (!(await this.exists(key))) {
            const err = new Error('Object not found');
            err.code = 'OBJECT_NOT_FOUND';
            throw err;
        }
        const meta = await this._readMeta(filePath);
        const stat = await fsp.stat(filePath);
        return {
            stream: fs.createReadStream(filePath),
            contentType: meta.contentType || 'application/octet-stream',
            contentLength: stat.size
        };
    }

    async getObjectBuffer(key) {
        const filePath = this.resolveLocalPath(key);
        if (!(await this.exists(key))) {
            const err = new Error('Object not found');
            err.code = 'OBJECT_NOT_FOUND';
            throw err;
        }
        return fsp.readFile(filePath);
    }

    async deleteObject(key) {
        const filePath = this.resolveLocalPath(key);
        try {
            await fsp.unlink(filePath);
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }
        try {
            await fsp.unlink(`${filePath}.meta.json`);
        } catch (_) {
            /* ignore */
        }
    }
}

module.exports = LocalObjectStorage;
