const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PHASE0_COMMIT = '95c7a750253f8b23aad970d802cc4b84ffe12abf'; // verified baseline
const uid = Date.now();
const PHASE0_DIR = `C:\\phase0-bench-${uid}`;
const PHASE1_DIR = `C:\\phase1-bench-${uid}`;
const REPO_DIR = 'C:\\kahoot-awareness';

function run(cmd, cwd = REPO_DIR) {
    console.log(`> [${cwd}] ${cmd}`);
    try {
        return execSync(cmd, { cwd, encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
        console.error(`Command failed: ${cmd}\n${e.stdout}\n${e.stderr}`);
        throw e;
    }
}

function cleanup() {
    console.log('Cleaning up worktrees...');
    try { run(`git worktree remove ${PHASE0_DIR} --force`); } catch (e) {}
    try { run(`git worktree remove ${PHASE1_DIR} --force`); } catch (e) {}
    
    if (fs.existsSync(PHASE0_DIR)) fs.rmSync(PHASE0_DIR, { recursive: true, force: true });
    if (fs.existsSync(PHASE1_DIR)) fs.rmSync(PHASE1_DIR, { recursive: true, force: true });
}

async function main() {
    cleanup();

    console.log(`Setting up Phase 0 worktree at ${PHASE0_DIR}...`);
    run(`git worktree add ${PHASE0_DIR} ${PHASE0_COMMIT}`);
    
    console.log(`Setting up Phase 1 worktree at ${PHASE1_DIR}...`);
    run(`git worktree add ${PHASE1_DIR} HEAD`);

    const benchmarkScriptPath = path.join(REPO_DIR, 'server', 'benchmark.js');
    const benchmarkContent = fs.readFileSync(benchmarkScriptPath, 'utf8');

    // Run for Phase 0
    console.log('--- Running Phase 0 Benchmark ---');
    fs.writeFileSync(path.join(PHASE0_DIR, 'server', 'benchmark.js'), benchmarkContent);
    // Phase 0 might need --legacy-peer-deps or --force for older deps on Node 22
    run('npm install --no-audit --no-fund --legacy-peer-deps', path.join(PHASE0_DIR, 'server'));
    
    // We use SQLite for a neutral baseline since Postgres was added in Phase 1
    const phase0Output = run('set NODE_ENV=test&& set DB_DIALECT=sqlite&& node benchmark.js', path.join(PHASE0_DIR, 'server'));
    console.log(phase0Output);

    // Run for Phase 1
    console.log('--- Running Phase 1 Benchmark ---');
    fs.writeFileSync(path.join(PHASE1_DIR, 'server', 'benchmark.js'), benchmarkContent);
    run('npm install --no-audit --no-fund', path.join(PHASE1_DIR, 'server'));
    const phase1Output = run('set NODE_ENV=test&& set DB_DIALECT=sqlite&& node benchmark.js', path.join(PHASE1_DIR, 'server'));
    console.log(phase1Output);

    cleanup();
    
    console.log('=============================');
    console.log('BENCHMARK COMPARISON COMPLETE');
    console.log('=============================');
    console.log('Update PERFORMANCE_COMPARISON.md with these exact numbers.');
}

main().catch(err => {
    console.error('Benchmark script failed:', err);
    cleanup();
    process.exit(1);
});
