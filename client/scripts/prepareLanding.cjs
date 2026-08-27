const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const clientDir = path.resolve(__dirname, '..');
const sourceDir = path.join(clientDir, 'landing-site');
const outputDir = path.join(clientDir, 'public', 'landing');
const EXPECTED_PARTS = 6;
const EXPECTED_PART_SIZE = 8000;
const EXPECTED_LAST_PART_SIZE = 3080;
const EXPECTED_HTML_SHA256 = 'e3b3fb067683a087c995421f949496898670439893a69eab178436943e750653';

const partFiles = fs.readdirSync(sourceDir)
  .filter((name) => /^atelora-part\d+\.b64$/i.test(name))
  .sort((a, b) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0));

if (partFiles.length !== EXPECTED_PARTS) {
  throw new Error(`Expected ${EXPECTED_PARTS} verified Atelora landing parts, found ${partFiles.length}.`);
}

const parts = partFiles.map((name, index) => {
  const compact = fs.readFileSync(path.join(sourceDir, name), 'utf8').replace(/\s+/g, '');
  const expectedSize = index === EXPECTED_PARTS - 1 ? EXPECTED_LAST_PART_SIZE : EXPECTED_PART_SIZE;

  if (compact.length !== expectedSize) {
    throw new Error(`Atelora landing part ${name} has invalid length ${compact.length}; expected ${expectedSize}.`);
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) {
    throw new Error(`Atelora landing part ${name} contains non-base64 characters.`);
  }
  return compact;
});

const encoded = parts.join('');
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

const forbiddenLegacyCopy = [
  /Local Marketing That Your Locations Actually Use/i,
  /Trusted by leading brands to manage local marketing at scale/i,
  /Built for Real Local Marketing Challenges/i,
];
for (const pattern of forbiddenLegacyCopy) {
  if (pattern.test(htmlText)) {
    throw new Error(`Atelora landing validation failed: legacy visible copy matched ${pattern}.`);
  }
}

if (!/Create Learning Your Teams Actually Want to Complete/i.test(htmlText)) {
  throw new Error('Atelora landing validation failed: expected Atelora hero copy is missing.');
}
if (!/\/atelora-landing-logo\.svg/i.test(htmlText)) {
  throw new Error('Atelora landing validation failed: Atelora logo reference is missing.');
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'index.html'), html);

console.log(`Prepared verified Atelora primary website in public/landing (${html.length} bytes from ${partFiles.length} parts).`);
