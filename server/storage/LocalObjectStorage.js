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
        this.rootDir = options.rootDir || path.join(__dirname, '../data/artifacts');
        ensureDirSync(this.rootDir);
        this.driver = 'local';
    }

    _safeKey(key) {
        if (!key || typeof key !== 'string') {
            throw new Error('storage key is required');
        }
        if (key.includes('\0')) {
            throw new Error('invalid storage key');
        }
        if (path.isAbsolute(key) || /(^|[\\/])\.\.([\\/]|$)/.test(key) || key.includes('..')) {
            throw new Error('invalid storage key');
        }
        const normalized = path.normalize(key).replace(/\\/g, '/');
        if (
            !normalized ||
            normalized === '.' ||
            normalized.startsWith('../') ||
            normalized.includes('/../') ||
            normalized.includes('..')
        ) {
            throw new Error('invalid storage key');
        }
        const resolved = path.resolve(this.rootDir, normalized);
        const rootResolved = path.resolve(this.rootDir);
        if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) {
            throw new Error('invalid storage key');
        }
        return normalized;
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

    async listKeys(prefix) {
        const safePrefix = this._safeKey(prefix || '').replace(/\/+$/, '');
        const startDir = path.join(this.rootDir, safePrefix);
        const keys = [];

        async function walk(dir, relBase) {
            let entries;
            try {
                entries = await fsp.readdir(dir, { withFileTypes: true });
            } catch (err) {
                if (err.code === 'ENOENT') return;
                throw err;
            }
            for (const ent of entries) {
                if (ent.name.endsWith('.meta.json')) continue;
                const rel = relBase ? `${relBase}/${ent.name}` : ent.name;
                const full = path.join(dir, ent.name);
                if (ent.isDirectory()) {
                    await walk(full, rel);
                } else {
                    keys.push(safePrefix ? `${safePrefix}/${rel}` : rel);
                }
            }
        }

        // If prefix is a file path, just check that one key
        try {
            const st = await fsp.stat(startDir);
            if (st.isFile()) {
                return [safePrefix];
            }
        } catch (_) {
            /* may be a prefix dir */
        }

        await walk(startDir, '');
        return keys.map((k) => k.replace(/\\/g, '/'));
    }

    async deletePrefix(prefix) {
        const keys = await this.listKeys(prefix);
        for (const key of keys) {
            await this.deleteObject(key);
        }
        // Best-effort remove empty dirs under prefix
        const safePrefix = this._safeKey(prefix || '').replace(/\/+$/, '');
        const startDir = path.join(this.rootDir, safePrefix);
        try {
            await fsp.rm(startDir, { recursive: true, force: true });
        } catch (_) {
            /* ignore */
        }
        return { deleted: keys.length, keys: keys.length };
    }
}

module.exports = LocalObjectStorage;
