const { spawn } = require('child_process');
const path = require('path');

const runCommand = (command, args, cwd, env = process.env) => {
    return new Promise((resolve, reject) => {
        console.log(`\n======================================================`);
        console.log(`[EXEC] ${command} ${args.join(' ')}`);
        console.log(`[CWD]  ${cwd}`);
        console.log(`======================================================\n`);
        
        const proc = spawn(command, args, {
            cwd,
            env,
            stdio: 'inherit',
            shell: true // needed for Windows cross-env and path resolution
        });

        proc.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Command failed with exit code ${code}`));
            } else {
                resolve();
            }
        });
    });
};

const fs = require('fs');

const DOCKER_CONTAINER = 'quizmoto-phase1c-postgres-test';
const TEST_RUN_ID = `critical-${Date.now()}`;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const main = async () => {
    const rootDir = path.resolve(__dirname, '..');
    const serverDir = path.join(rootDir, 'server');
    const clientDir = path.join(rootDir, 'client');
    const tmpRoot = path.join(serverDir, 'data', 'tmp');
    const testTempDir = path.join(tmpRoot, `test_${TEST_RUN_ID}`);
    let pgStarted = false;

    // Provide the test run ID to all processes
    const env = { 
        ...process.env, 
        TEST_RUN_ID,
        TEST_TEMP_DIR_ROOT: tmpRoot 
    };

    try {
        console.log(`--- STARTING CRITICAL QUALITY GATE (Run ID: ${TEST_RUN_ID}) ---`);

        // 1. Docker PG Setup
        console.log('\n[1/5] Starting isolated PostgreSQL container...');
        try {
            await runCommand('docker', ['stop', DOCKER_CONTAINER], rootDir, env).catch(() => {});
            await runCommand('docker', ['rm', '-v', DOCKER_CONTAINER], rootDir, env).catch(() => {});
        } catch (e) {}

        await runCommand('docker', [
            'run', '--name', DOCKER_CONTAINER,
            '-e', 'POSTGRES_USER=testuser',
            '-e', 'POSTGRES_PASSWORD=testpass',
            '-e', 'POSTGRES_DB=quizmototest',
            '-p', '5434:5432',
            '-d', 'postgres:15-alpine'
        ], rootDir, env);
        pgStarted = true;

        console.log('Waiting 10s for Postgres to become fully ready...');
        await sleep(10000);

        // 2. Backend Units/Integration/Socket tests + Coverage
        console.log('\n[2/5] Running Backend Unit & Socket Tests (SQLite/Memory) with Coverage...');
        await runCommand('npm', ['run', 'test:coverage'], serverDir, env);

        // 3. PostgreSQL tests
        console.log('\n[3/5] Running PostgreSQL Dialect Integration Tests...');
        await runCommand('npm', ['run', 'test:postgres'], serverDir, env);

        // 4. Client build
        console.log('\n[4/5] Building Frontend...');
        await runCommand('npm', ['run', 'build'], clientDir, env);

        // 5. Playwright E2E
        console.log('\n[5/5] Running Playwright E2E (Golden Flow)...');
        await runCommand('npx', ['playwright', 'test'], rootDir, env);

        console.log('\n✅ CRITICAL QUALITY GATE PASSED!');
        process.exitCode = 0;

    } catch (error) {
        console.error(`\n❌ CRITICAL QUALITY GATE FAILED:`, error.message);
        process.exitCode = 1;
    } finally {
        if (pgStarted) {
            console.log('\n[TEARDOWN] Cleaning up isolated PostgreSQL container...');
            try {
                await runCommand('docker', ['stop', DOCKER_CONTAINER], rootDir, env).catch(() => {});
                await runCommand('docker', ['rm', '-v', DOCKER_CONTAINER], rootDir, env).catch(() => {});
                
                // Assert container is gone
                const dockerPs = require('child_process').execSync('docker ps -a').toString();
                if (dockerPs.includes(DOCKER_CONTAINER)) {
                    console.error('[TEARDOWN ERROR] Container was not fully removed!');
                } else {
                    console.log('[TEARDOWN] PostgreSQL container and volume successfully removed.');
                }
            } catch (err) {
                console.error('[TEARDOWN] Error cleaning up Docker:', err.message);
            }
        }
        
        console.log('\n[TEARDOWN] Verifying file cleanup...');
        if (fs.existsSync(testTempDir)) {
            console.error(`[TEARDOWN ERROR] Temporary test directory was not cleaned up: ${testTempDir}`);
            fs.rmSync(testTempDir, { recursive: true, force: true });
        } else {
            console.log('[TEARDOWN] File cleanup verified.');
        }
    }
};

main();
