const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const clientDir = path.resolve(__dirname, '..');
const sourceDir = path.join(clientDir, 'landing-site');
const outputDir = path.join(clientDir, 'public', 'landing');
const EXPECTED_CHUNK_SIZE = 20000;

const chunkFiles = fs.existsSync(sourceDir)
  ? fs.readdirSync(sourceDir)
      .filter((name) => /^chunk\d+\.b64$/i.test(name))
      .sort((a, b) => {
        const aNumber = Number(a.match(/\d+/)?.[0] || 0);
        const bNumber = Number(b.match(/\d+/)?.[0] || 0);
        return aNumber - bNumber;
      })
  : [];

if (!chunkFiles.length) {
  throw new Error(`Primary landing source chunks not found in ${sourceDir}`);
}

function normaliseChunk(name, index) {
  const filePath = path.join(sourceDir, name);
  const raw = fs.readFileSync(filePath, 'utf8');
  let compact = raw.replace(/\s+/g, '');

  // All chunks except the last were generated on exact 20,000-character
  // boundaries. Guard against accidental trailing characters introduced while
  // committing a chunk, which would otherwise corrupt the gzip stream.
  const isLast = index === chunkFiles.length - 1;
  if (!isLast) {
    if (compact.length < EXPECTED_CHUNK_SIZE) {
      throw new Error(
        `Landing source ${name} is truncated: expected ${EXPECTED_CHUNK_SIZE} base64 characters, found ${compact.length}.`
      );
    }

    if (compact.length > EXPECTED_CHUNK_SIZE) {
      console.warn(
        `Landing source ${name} contains ${compact.length - EXPECTED_CHUNK_SIZE} extra base64 characters; trimming to the expected chunk boundary.`
      );
      compact = compact.slice(0, EXPECTED_CHUNK_SIZE);
    }
  }

  return compact;
}

const chunks = chunkFiles.map(normaliseChunk);
const encoded = chunks.join('');

if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
  throw new Error(
    `Landing source is not valid base64 after reconstruction (length ${encoded.length}).`
  );
}

let html;
try {
  const compressed = Buffer.from(encoded, 'base64');
  html = zlib.gunzipSync(compressed);
} catch (error) {
  throw new Error(
    `Unable to reconstruct primary landing website from ${chunkFiles.join(', ')}: ${error.message}`
  );
}

const htmlText = html.toString('utf8');
if (!/<html[\s>]/i.test(htmlText) || !/<\/html>/i.test(htmlText)) {
  throw new Error('Reconstructed landing source is not a complete HTML document.');
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'index.html'), html);

console.log(
  `Prepared primary marketing website in public/landing (${html.length} bytes from ${chunkFiles.length} source chunks).`
);
