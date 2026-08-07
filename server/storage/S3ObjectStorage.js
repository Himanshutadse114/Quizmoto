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

        try {
            const sdk = require('@aws-sdk/client-s3');
            S3Client = sdk.S3Client;
            PutObjectCommand = sdk.PutObjectCommand;
            GetObjectCommand = sdk.GetObjectCommand;
            DeleteObjectCommand = sdk.DeleteObjectCommand;
            DeleteObjectsCommand = sdk.DeleteObjectsCommand;
            HeadObjectCommand = sdk.HeadObjectCommand;
            ListObjectsV2Command = sdk.ListObjectsV2Command;
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

    async getObjectStream(key) {
        try {
            const out = await this.client.send(
                new this.GetObjectCommand({
                    Bucket: this.bucket,
                    Key: this._safeKey(key)
                })
            );
            return {
                stream: out.Body,
                contentType: out.ContentType || 'application/octet-stream',
                contentLength: out.ContentLength
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
