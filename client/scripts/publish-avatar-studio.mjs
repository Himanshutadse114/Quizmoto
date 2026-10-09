import { access, cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(clientRoot, 'avatar-studio', 'dist');
const destination = path.join(clientRoot, 'dist', 'avatar-studio');

await access(path.join(source, 'index.html'));
await rm(destination, { recursive: true, force: true });
await mkdir(path.dirname(destination), { recursive: true });
await cp(source, destination, { recursive: true });

console.log('Published LMSGEN Avatar Studio to dist/avatar-studio.');
