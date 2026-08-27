const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const clientDir = path.resolve(__dirname, '..');
const sourceDir = path.join(clientDir, 'landing-site');
const outputDir = path.join(clientDir, 'public', 'landing');
const EXPECTED_CHUNK_SIZE = 20000;
const EXPECTED_HTML_SHA256 = 'e3b3fb067683a087c995421f949496898670439893a69eab178436943e750653';

const chunkFiles = fs.readdirSync(sourceDir)
  .filter((name) => /^chunk\d+\.b64$/i.test(name))
  .sort((a, b) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0));

if (!chunkFiles.length) {
  throw new Error(`Atelora landing source chunks not found in ${sourceDir}`);
}

const chunks = chunkFiles.map((name, index) => {
  const compact = fs.readFileSync(path.join(sourceDir, name), 'utf8').replace(/\s+/g, '');
  const isLast = index === chunkFiles.length - 1;

  if (!isLast && compact.length !== EXPECTED_CHUNK_SIZE) {
    throw new Error(`Atelora landing source ${name} has invalid length ${compact.length}; expected ${EXPECTED_CHUNK_SIZE}.`);
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) {
    throw new Error(`Atelora landing source ${name} contains non-base64 characters.`);
  }
  return compact;
});

const encoded = chunks.join('');
if (encoded.length % 4 !== 0) {
  throw new Error(`Atelora landing base64 length ${encoded.length} is not divisible by 4.`);
}

let html;
try {
  html = zlib.gunzipSync(Buffer.from(encoded, 'base64'));
} catch (error) {
  throw new Error(`Unable to reconstruct Atelora landing website: ${error.message}`);
}

const htmlText = html.toString('utf8');
if (!/<html[\s>]/i.test(htmlText) || !/<\/html>/i.test(htmlText)) {
  throw new Error('Reconstructed Atelora landing source is not a complete HTML document.');
}

const hash = crypto.createHash('sha256').update(html).digest('hex');
if (hash !== EXPECTED_HTML_SHA256) {
  throw new Error(`Atelora landing checksum mismatch: ${hash}`);
}

if (/Local Marketing That Your Locations Actually Use/i.test(htmlText) || /Book a Demo/i.test(htmlText)) {
  throw new Error('Atelora landing validation failed: legacy source-site copy is still present.');
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'index.html'), html);

console.log(`Prepared Atelora primary website in public/landing (${html.length} bytes from ${chunkFiles.length} verified chunks).`);
