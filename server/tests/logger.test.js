const { expect } = require('chai');
const logger = require('../utils/logger');

describe('Structured logger (P3-T08)', () => {
    const originalLog = console.log;
    const originalError = console.error;
    let lines;

    beforeEach(() => {
        lines = [];
        console.log = (msg) => {
            lines.push(String(msg));
        };
        console.error = (msg) => {
            lines.push(String(msg));
        };
        process.env.LOG_FORMAT = 'json';
        process.env.LOG_LEVEL = 'debug';
    });

    afterEach(() => {
        console.log = originalLog;
        console.error = originalError;
        delete process.env.LOG_FORMAT;
        delete process.env.LOG_LEVEL;
    });

    it('emits JSON with level and message', () => {
        logger.info('hello', { module: 'test', foo: 1 });
        expect(lines.length).to.equal(1);
        const obj = JSON.parse(lines[0]);
        expect(obj.level).to.equal('info');
        expect(obj.message).to.equal('hello');
        expect(obj.module).to.equal('test');
        expect(obj.foo).to.equal(1);
        expect(obj.timestamp).to.be.a('string');
    });

    it('http helper includes method path status duration', () => {
        const req = { method: 'GET', url: '/health', originalUrl: '/health' };
        const res = { statusCode: 200 };
        logger.http(req, res, 12);
        const obj = JSON.parse(lines[0]);
        expect(obj.message).to.equal('http_request');
        expect(obj.method).to.equal('GET');
        expect(obj.path).to.equal('/health');
        expect(obj.statusCode).to.equal(200);
        expect(obj.durationMs).to.equal(12);
        expect(obj.module).to.equal('http');
    });

    it('job helper marks failures as error level', () => {
        logger.job('job_failed', { jobId: 'abc', type: 'REPORT_PDF' });
        const obj = JSON.parse(lines[0]);
        expect(obj.level).to.equal('error');
        expect(obj.message).to.equal('job_failed');
        expect(obj.jobId).to.equal('abc');
    });

    it('respects LOG_LEVEL (suppresses debug when info)', () => {
        process.env.LOG_LEVEL = 'info';
        logger.debug('hidden');
        logger.info('visible');
        expect(lines.length).to.equal(1);
        expect(JSON.parse(lines[0]).message).to.equal('visible');
    });
});
