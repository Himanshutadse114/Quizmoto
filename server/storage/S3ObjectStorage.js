/**
 * S3-compatible object storage (optional).
 * Requires: npm install @aws-sdk/client-s3
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
        let HeadObjectCommand;

        try {
            const sdk = require('@aws-sdk/client-s3');
            S3Client = sdk.S3Client;
            PutObjectCommand = sdk.PutObjectCommand;
            GetObjectCommand = sdk.GetObjectCommand;
            DeleteObjectCommand = sdk.DeleteObjectCommand;
            HeadObjectCommand = sdk.HeadObjectCommand;
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
        this.HeadObjectCommand = HeadObjectCommand;
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
}

module.exports = S3ObjectStorage;
