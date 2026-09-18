/**
 * S3-compatible object storage (Cloudflare R2 / AWS S3).
 * Requires: @aws-sdk/client-s3
 * Env: S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_REGION, optional S3_ENDPOINT
 */

class S3ObjectStorage {
    constructor(options = {}) {
        this.bucket = options.bucket;
        if (!this.bucket) {
            throw new Error('S3_BUCKET is required when STORAGE_DRIVER=s3');
        }

        let S3Client;
        let PutObjectCommand;
        let GetObjectCommand;
        let DeleteObjectCommand;
        let DeleteObjectsCommand;
        let HeadObjectCommand;
        let ListObjectsV2Command;
        let CopyObjectCommand;
        let GetBucketCorsCommand;
        let PutBucketCorsCommand;

        try {
            const sdk = require('@aws-sdk/client-s3');
            S3Client = sdk.S3Client;
            PutObjectCommand = sdk.PutObjectCommand;
            GetObjectCommand = sdk.GetObjectCommand;
            DeleteObjectCommand = sdk.DeleteObjectCommand;
            DeleteObjectsCommand = sdk.DeleteObjectsCommand;
            HeadObjectCommand = sdk.HeadObjectCommand;
            ListObjectsV2Command = sdk.ListObjectsV2Command;
            CopyObjectCommand = sdk.CopyObjectCommand;
            GetBucketCorsCommand = sdk.GetBucketCorsCommand;
            PutBucketCorsCommand = sdk.PutBucketCorsCommand;
        } catch (err) {
            const e = new Error(
                'STORAGE_DRIVER=s3 requires @aws-sdk/client-s3. Run: npm install @aws-sdk/client-s3'
            );
            e.code = 'S3_SDK_MISSING';
            throw e;
        }

        const clientConfig = {
            region: options.region || 'us-east-1'
        };
        if (options.endpoint) {
            clientConfig.endpoint = options.endpoint;
            clientConfig.forcePathStyle = options.forcePathStyle !== false;
        }

        this.client = new S3Client(clientConfig);
        this.PutObjectCommand = PutObjectCommand;
        this.GetObjectCommand = GetObjectCommand;
        this.DeleteObjectCommand = DeleteObjectCommand;
        this.DeleteObjectsCommand = DeleteObjectsCommand;
        this.HeadObjectCommand = HeadObjectCommand;
        this.ListObjectsV2Command = ListObjectsV2Command;
        this.CopyObjectCommand = CopyObjectCommand;
        this.GetBucketCorsCommand = GetBucketCorsCommand;
        this.PutBucketCorsCommand = PutBucketCorsCommand;
        this.corsReadyPromise = null;
        this.driver = 's3';
    }

    _safeKey(key) {
        if (!key || typeof key !== 'string') {
            throw new Error('storage key is required');
        }
        return key.replace(/^\/+/, '');
    }

    resolveLocalPath() {
        return null;
    }

    async putObject({ key, body, contentType }) {
        const safeKey = this._safeKey(key);
        const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
        await this.client.send(
            new this.PutObjectCommand({
                Bucket: this.bucket,
                Key: safeKey,
                Body: buf,
                ContentType: contentType || 'application/octet-stream'
            })
        );
        return { key: safeKey, size: buf.length, contentType: contentType || null };
    }

    async putObjectStream({ key, stream, contentType, contentLength }) {
        const safeKey = this._safeKey(key);
        const size = Number(contentLength);
        if (!Number.isSafeInteger(size) || size <= 0) {
            const error = new Error('A valid content length is required for streamed S3 uploads.');
            error.code = 'STREAM_CONTENT_LENGTH_REQUIRED';
            throw error;
        }
        await this.client.send(
            new this.PutObjectCommand({
                Bucket: this.bucket,
                Key: safeKey,
                Body: stream,
                ContentLength: size,
                ContentType: contentType || 'application/octet-stream'
            })
        );
        return { key: safeKey, size, contentType: contentType || null };
    }

    async exists(key) {
        try {
            await this.client.send(
                new this.HeadObjectCommand({
                    Bucket: this.bucket,
                    Key: this._safeKey(key)
                })
            );
            return true;
        } catch (err) {
            if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
                return false;
            }
            throw err;
        }
    }

    async headObject(key) {
        try {
            const out = await this.client.send(
                new this.HeadObjectCommand({
                    Bucket: this.bucket,
                    Key: this._safeKey(key)
                })
            );
            return {
                key: this._safeKey(key),
                contentLength: Number(out.ContentLength || 0),
                contentType: out.ContentType || 'application/octet-stream',
                etag: out.ETag || null,
                lastModified: out.LastModified || null
            };
        } catch (err) {
            if (err.name === 'NotFound' || err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
                const e = new Error('Object not found');
                e.code = 'OBJECT_NOT_FOUND';
                throw e;
            }
            throw err;
        }
    }

    async createSignedGetUrl(key, options = {}) {
        const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
        const expiresIn = Math.max(30, Math.min(86400, Number(options.expiresIn || 900)));
        const command = new this.GetObjectCommand({
            Bucket: this.bucket,
            Key: this._safeKey(key),
            ...(options.responseContentType ? { ResponseContentType: options.responseContentType } : {}),
            ...(options.responseContentDisposition ? { ResponseContentDisposition: options.responseContentDisposition } : {})
        });
        return getSignedUrl(this.client, command, { expiresIn });
    }

    async createSignedPutUrl(key, options = {}) {
        const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
        const expiresIn = Math.max(30, Math.min(3600, Number(options.expiresIn || 600)));
        const contentType = options.contentType || 'application/octet-stream';
        const command = new this.PutObjectCommand({
            Bucket: this.bucket,
            Key: this._safeKey(key),
            ContentType: contentType
        });
        return getSignedUrl(this.client, command, { expiresIn });
    }

    async ensureBrowserCors(origins = []) {
        if (this.corsReadyPromise) return this.corsReadyPromise;
        this.corsReadyPromise = (async () => {
            const allowedOrigins = [...new Set(origins.map((value) => String(value || '').replace(/\/$/, '')).filter(Boolean))];
            if (!allowedOrigins.length) return false;
            let rules = [];
            try {
                const current = await this.client.send(new this.GetBucketCorsCommand({ Bucket: this.bucket }));
                rules = Array.isArray(current.CORSRules) ? current.CORSRules : [];
            } catch (error) {
                const status = Number(error.$metadata?.httpStatusCode || 0);
                if (![0, 404].includes(status) && error.name !== 'NoSuchCORSConfiguration') throw error;
            }
            const id = 'lmsgen-direct-browser-transfers';
            const retained = rules.filter((rule) => String(rule.ID || '') !== id);
            const matching = rules.find((rule) => String(rule.ID || '') === id);
            const desired = {
                ID: id,
                AllowedHeaders: ['content-type'],
                AllowedMethods: ['GET', 'HEAD', 'PUT'],
                AllowedOrigins: allowedOrigins,
                ExposeHeaders: ['ETag', 'Content-Length', 'Content-Range'],
                MaxAgeSeconds: 7200
            };
            const normalized = (value) => JSON.stringify({
                ...value,
                AllowedHeaders: [...(value?.AllowedHeaders || [])].sort(),
                AllowedMethods: [...(value?.AllowedMethods || [])].sort(),
                AllowedOrigins: [...(value?.AllowedOrigins || [])].sort(),
                ExposeHeaders: [...(value?.ExposeHeaders || [])].sort()
            });
            if (matching && normalized(matching) === normalized(desired)) return true;
            await this.client.send(new this.PutBucketCorsCommand({
                Bucket: this.bucket,
                CORSConfiguration: { CORSRules: [...retained, desired] }
            }));
            return true;
        })().catch((error) => {
            this.corsReadyPromise = null;
            throw error;
        });
        return this.corsReadyPromise;
    }

    async copyObject(sourceKey, destinationKey, options = {}) {
        const source = `${this.bucket}/${this._safeKey(sourceKey)}`
            .split('/')
            .map((part) => encodeURIComponent(part))
            .join('/');
        const safeDestination = this._safeKey(destinationKey);
        await this.client.send(new this.CopyObjectCommand({
            Bucket: this.bucket,
            Key: safeDestination,
            CopySource: source,
            ...(options.contentType ? {
                ContentType: options.contentType,
                MetadataDirective: 'REPLACE'
            } : {})
        }));
        return { key: safeDestination };
    }

    async getObjectStream(key, options = {}) {
        try {
            const start = Number(options.start);
            const end = Number(options.end);
            const hasRange = Number.isFinite(start) && start >= 0;
            const out = await this.client.send(
                new this.GetObjectCommand({
                    Bucket: this.bucket,
                    Key: this._safeKey(key),
                    ...(hasRange ? { Range: `bytes=${start}-${Number.isFinite(end) ? end : ''}` } : {})
                })
            );
            return {
                stream: out.Body,
                contentType: out.ContentType || 'application/octet-stream',
                contentLength: out.ContentLength,
                contentRange: out.ContentRange || null
            };
        } catch (err) {
            if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
                const e = new Error('Object not found');
                e.code = 'OBJECT_NOT_FOUND';
                throw e;
            }
            throw err;
        }
    }

    async getObjectBuffer(key) {
        const { stream } = await this.getObjectStream(key);
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    }

    async deleteObject(key) {
        await this.client.send(
            new this.DeleteObjectCommand({
                Bucket: this.bucket,
                Key: this._safeKey(key)
            })
        );
    }

    /** List object keys under a prefix (paginated). */
    async listKeys(prefix, { maxKeys = 10000 } = {}) {
        const safePrefix = this._safeKey(prefix || '');
        const keys = [];
        let ContinuationToken;
        do {
            const out = await this.client.send(
                new this.ListObjectsV2Command({
                    Bucket: this.bucket,
                    Prefix: safePrefix,
                    ContinuationToken,
                    MaxKeys: Math.min(1000, maxKeys - keys.length)
                })
            );
            for (const obj of out.Contents || []) {
                if (obj.Key) keys.push(obj.Key);
            }
            ContinuationToken = out.IsTruncated ? out.NextContinuationToken : undefined;
        } while (ContinuationToken && keys.length < maxKeys);
        return keys;
    }

    /** Delete every object under a prefix (R2/S3 has no true folder delete). */
    async deletePrefix(prefix) {
        const keys = await this.listKeys(prefix);
        if (keys.length === 0) return { deleted: 0 };

        let deleted = 0;
        // DeleteObjects accepts up to 1000 keys per request
        for (let i = 0; i < keys.length; i += 1000) {
            const chunk = keys.slice(i, i + 1000);
            const out = await this.client.send(
                new this.DeleteObjectsCommand({
                    Bucket: this.bucket,
                    Delete: {
                        Objects: chunk.map((Key) => ({ Key })),
                        Quiet: true
                    }
                })
            );
            deleted += chunk.length - (out.Errors ? out.Errors.length : 0);
        }
        return { deleted, keys: keys.length };
    }
}

module.exports = S3ObjectStorage;
