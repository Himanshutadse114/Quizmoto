// Bundles the vanilla Genny mascot (avatar-web + definition + behavior) into a
// single self-contained file that the static marketing pages can load with one
// <script type="module"> tag. Runs as `prebuild` so Vite copies the output
// from public/ into dist/ like any other static asset.
import esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(scriptDir, '..');

const result = await esbuild.build({
  entryPoints: [path.join(clientRoot, 'src/components/mascot/genny-vanilla.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  outfile: path.join(clientRoot, 'public/landing/js/genny-mascot.js'),
  loader: { '.json': 'json', '.css': 'text' },
  logLevel: 'warning',
});

if (result.errors.length) {
  console.error('Genny mascot bundle failed:', result.errors);
  process.exitCode = 1;
} else {
  console.log('Bundled Genny mascot -> public/landing/js/genny-mascot.js');
}
