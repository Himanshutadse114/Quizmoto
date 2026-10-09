import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const studioRoot = path.join(clientRoot, 'avatar-studio');
const pnpmCommand = path.join(
  clientRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
);

function runPnpm(args, env = process.env) {
  const result = spawnSync(pnpmCommand, ['--dir', studioRoot, ...args], {
    cwd: clientRoot,
    env,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

runPnpm(['install', '--frozen-lockfile'], {
  ...process.env,
  CI: 'true',
});
runPnpm(['build'], {
  ...process.env,
  VITE_LMSGEN_PAID_EXPORTS: '1',
});

console.log('Built LMSGEN Avatar Studio with paid exports enabled.');
