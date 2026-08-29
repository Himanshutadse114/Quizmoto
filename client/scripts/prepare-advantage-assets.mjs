import fs from 'node:fs/promises';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(clientRoot, '..');
const homePath = path.join(clientRoot, 'dist', 'landing', 'index.html');
const zipPath = path.join(repoRoot, 'modern-learning-topic-specific-assets.zip');
const outputRoot = path.join(clientRoot, 'dist', 'modern-learning-assets');

const ASSETS = [
  {
    file: '01-ai-course-creation.png',
    alt: 'AI-assisted course creation illustration',
    type: 'image',
    source: 'images/wsB1maxoJ7NH.avif',
  },
  {
    file: '02-learning-delivery.png',
    alt: 'SCORM-ready learning delivery illustration',
    type: 'lottie',
    source: 'Co-Op%20Budget%20Management%20v2.0%20(1).lottie',
  },
  {
    file: '05-analytics-progress.png',
    alt: 'Learner tracking and progress analytics illustration',
    type: 'lottie',
    source: '6728fca4f75259aa3ab71331_hp-jungle.lottie',
  },
  {
    file: '03-live-engagement-quizmoto.png',
    alt: 'Live Quizmoto learner engagement illustration',
    type: 'lottie',
    source: '6728dfcb0b80e81f9747fb63_Localyzer%20HP%20Cyan%20Animation%20v1.0.lottie',
  },
  {
    file: '04-content-library.png',
    alt: 'Central learning content library illustration',
    type: 'lottie',
    source: '6728ea56786208229f9b7f93_hp-lemon.lottie',
  },
  {
    file: '06-access-control.png',
    alt: 'Role-based access control and approvals illustration',
    type: 'lottie',
    source: '6728fc510e2a5530bdbda852_hp-violet.lottie',
  },
];

function findEndOfCentralDirectory(buffer) {
  const signature = 0x06054b50;
  const minimumOffset = Math.max(0, buffer.length - 22 - 0xffff);

  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === signature) return offset;
  }

  throw new Error('Modern learning asset ZIP is missing a valid end-of-central-directory record.');
}

async function extractAssets() {
  const zip = await fs.readFile(zipPath);
  const eocdOffset = findEndOfCentralDirectory(zip);
  const entryCount = zip.readUInt16LE(eocdOffset + 10);
  let centralOffset = zip.readUInt32LE(eocdOffset + 16);
  const expectedFiles = new Set(ASSETS.map(({ file }) => file));
  const extractedFiles = new Set();

  await fs.mkdir(outputRoot, { recursive: true });

  for (let index = 0; index < entryCount; index += 1) {
    if (zip.readUInt32LE(centralOffset) !== 0x02014b50) {
      throw new Error(`Invalid modern learning ZIP central directory entry at index ${index}.`);
    }

    const compressionMethod = zip.readUInt16LE(centralOffset + 10);
    const compressedSize = zip.readUInt32LE(centralOffset + 20);
    const uncompressedSize = zip.readUInt32LE(centralOffset + 24);
    const fileNameLength = zip.readUInt16LE(centralOffset + 28);
    const extraLength = zip.readUInt16LE(centralOffset + 30);
    const commentLength = zip.readUInt16LE(centralOffset + 32);
    const localHeaderOffset = zip.readUInt32LE(centralOffset + 42);
    const fileName = zip
      .subarray(centralOffset + 46, centralOffset + 46 + fileNameLength)
      .toString('utf8');
    const baseName = path.basename(fileName);

    if (expectedFiles.has(baseName)) {
      if (zip.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
        throw new Error(`Invalid local ZIP header for ${baseName}.`);
      }

      const localFileNameLength = zip.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = zip.readUInt16LE(localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
      const compressedData = zip.subarray(dataOffset, dataOffset + compressedSize);
      let fileData;

      if (compressionMethod === 0) {
        fileData = compressedData;
      } else if (compressionMethod === 8) {
        fileData = inflateRawSync(compressedData);
      } else {
        throw new Error(`Unsupported ZIP compression method ${compressionMethod} for ${baseName}.`);
      }

      if (fileData.length !== uncompressedSize) {
        throw new Error(`Extracted size mismatch for ${baseName}.`);
      }

      await fs.writeFile(path.join(outputRoot, baseName), fileData);
      extractedFiles.add(baseName);
    }

    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  const missingFiles = [...expectedFiles].filter((file) => !extractedFiles.has(file));
  if (missingFiles.length) {
    throw new Error(`Modern learning asset ZIP is missing: ${missingFiles.join(', ')}`);
  }

  console.log(`Prepared ${extractedFiles.size} modern learning artwork assets.`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function artworkMarkup(asset) {
  return `<div class="lmsgen-advantage-art-shell">
                        <img
                          src="/modern-learning-assets/${asset.file}"
                          loading="lazy"
                          alt="${asset.alt}"
                          class="lmsgen-advantage-art"
                        />
                      </div>`;
}

function replaceAdvantageArtwork(html) {
  const sectionStart = html.indexOf('<section class="hp-advg-s">');
  const sectionEnd = html.indexOf('</section>', sectionStart);

  if (sectionStart === -1 || sectionEnd === -1) {
    throw new Error('Could not locate the modern learning advantage section.');
  }

  const before = html.slice(0, sectionStart);
  let section = html.slice(sectionStart, sectionEnd + '</section>'.length);
  const after = html.slice(sectionEnd + '</section>'.length);

  for (const asset of ASSETS) {
    if (asset.type === 'image') {
      const pattern = new RegExp(
        `<img\\s+src="${escapeRegExp(asset.source)}"[\\s\\S]*?class="global-img-zoom"\\s*\\/>`,
      );

      if (!pattern.test(section)) {
        throw new Error(`Could not locate advantage image source: ${asset.source}`);
      }

      section = section.replace(pattern, artworkMarkup(asset));
      continue;
    }

    const pattern = new RegExp(
      `<div\\s+[^>]*data-animation-type="lottie"[^>]*data-src="[^"]*${escapeRegExp(asset.source)}[^"]*"[^>]*>[\\s\\S]*?<\\/div>`,
      'i',
    );

    if (!pattern.test(section)) {
      throw new Error(`Could not locate advantage animation source: ${asset.source}`);
    }

    section = section.replace(pattern, artworkMarkup(asset));
  }

  return `${before}${section}${after}`;
}

function ensureStylesheet(html) {
  const href = '/landing/css/lmsgen-advantage-assets.css?v=1';
  if (html.includes('lmsgen-advantage-assets.css')) return html;
  return html.replace(/<\/head>/i, `    <link rel="stylesheet" href="${href}" />\n  </head>`);
}

try {
  await extractAssets();
  let html = await fs.readFile(homePath, 'utf8');
  html = replaceAdvantageArtwork(html);
  html = ensureStylesheet(html);
  await fs.writeFile(homePath, html, 'utf8');
  console.log('Prepared topic-specific artwork for the modern learning advantage section.');
} catch (error) {
  console.error('Failed to prepare modern learning advantage artwork:', error);
  process.exitCode = 1;
}
