const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const clientDir = path.resolve(__dirname, '..');
const sourceDir = path.join(clientDir, 'landing-site');
const outputDir = path.join(clientDir, 'public', 'landing');

const chunkFiles = fs.existsSync(sourceDir)
  ? fs.readdirSync(sourceDir).filter((name) => /^chunk\d+\.b64$/i.test(name)).sort()
  : [];

if (!chunkFiles.length) {
  throw new Error(`Primary landing source chunks not found in ${sourceDir}`);
}

const encoded = chunkFiles
  .map((name) => fs.readFileSync(path.join(sourceDir, name), 'utf8').trim())
  .join('');
const html = zlib.gunzipSync(Buffer.from(encoded, 'base64'));

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'index.html'), html);

console.log(`Prepared primary marketing website in public/landing (${html.length} bytes).`);
