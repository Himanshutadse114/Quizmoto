const request = require('supertest');
const { expect } = require('chai');
const { spawn, spawnSync } = require('child_process');
const path = require('path');

const PORT = 5008;
const app = `http://localhost:${PORT}`;

describe('Backend Integration Tests', function() {
    this.timeout(15000);
    let serverProcess;

    before(async () => {
        serverProcess = spawn('node', ['index.js'], {
            cwd: path.join(__dirname, '..'),
            env: { ...process.env, PORT, NODE_ENV: 'test', QUIET: 'true' }
        });

        let lastStderr = '';
        serverProcess.stderr.on('data', (data) => {
            lastStderr += data.toString();
        });

        const deadline = Date.now() + 12000;
        while (Date.now() < deadline) {
            if (serverProcess.exitCode != null) {
                throw new Error(`Backend exited before becoming healthy: ${lastStderr}`);
            }
            try {
                const res = await request(app).get('/health').timeout({ response: 750, deadline: 1000 });
                if (res.status === 200) return;
            } catch (_) {}
            await new Promise((resolve) => setTimeout(resolve, 150));
        }
        throw new Error(`Backend did not become healthy on port ${PORT}: ${lastStderr}`);
    });

    after((done) => {
        if (serverProcess && serverProcess.exitCode == null) {
            const timer = setTimeout(() => {
                try { serverProcess.kill('SIGKILL'); } catch (_) {}
                done();
            }, 3000);
            serverProcess.once('exit', () => {
                clearTimeout(timer);
                done();
            });
            serverProcess.kill();
        } else {
            done();
        }
    });

    it('should return healthy from /health', async () => {
        const res = await request(app).get('/health');
        expect(res.status).to.equal(200);
        expect(res.body.status).to.equal('healthy');
    });

    it('test login should work in test mode', async () => {
        const res = await request(app).post('/api/auth/test-login');
        expect(res.status).to.equal(200);
        expect(res.body).to.have.property('token');
        expect(res.body.username).to.match(/^testhost/);
    });

    it('test login should return 404 outside test mode', () => {
        // Spawn a short-lived script that requires the router with NODE_ENV=production
        // to prove it returns 404. Supply a production-shaped JWT secret so the
        // authentication fail-closed guard is not what this test is exercising.
        const script = `
            const express = require('express');
            const request = require('supertest');
            process.env.NODE_ENV = 'production';
            process.env.JWT_SECRET = 'integration-test-production-secret';
            const auth = require('./routes/auth');
            const app = express();
            app.use('/api/auth', auth);
            request(app).post('/api/auth/test-login').end((err, res) => {
                if (res.status === 404) process.exit(0);
                else process.exit(1);
            });
        `;
        const result = spawnSync('node', ['-e', script], { cwd: path.join(__dirname, '..') });
        expect(result.status).to.equal(0);
    });
});
