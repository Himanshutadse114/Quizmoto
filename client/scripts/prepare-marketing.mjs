import fs from 'node:fs/promises';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(clientRoot, '..');
const landingRoot = path.join(clientRoot, 'dist', 'landing');
const featureZipPath = path.join(repoRoot, 'lmsgen-feature-assets-6-images.zip');
const featureAssetsRoot = path.join(clientRoot, 'dist', 'lmsgen-feature-assets');

const BLOG_POST_SLUGS = [
  'why-scorm-courses-go-unfinished',
  'live-quizzes-vs-static-assessments',
  'scorm-1-2-vs-scorm-2004',
  'ai-assisted-authoring-course-timeline',
  'signs-security-awareness-training-needs-refresh',
  'slide-deck-to-scorm-migration-guide',
  'quizmoto-as-a-full-learning-platform',
  'designing-knowledge-checks-that-dont-feel-like-a-test',
];

const pages = [
  { file: 'index.html', base: '/landing/', home: true },
  { file: 'solutions/index.html', base: '/landing/solutions/' },
  { file: 'about/index.html', base: '/landing/about/', visibleLogoVariant: 'light' },
  { file: 'blog/index.html', base: '/landing/blog/', visibleLogoVariant: 'light' },
  { file: 'contact/index.html', base: '/landing/contact/' },
  ...BLOG_POST_SLUGS.map((slug) => ({
    file: `blog/${slug}.html`,
    base: '/landing/blog/',
    visibleLogoVariant: 'light',
  })),
];

const HOME_REPLACEMENTS = [
  ['For modern L&amp;D and security awareness teams', 'One workspace for modern learning teams'],
  ['Save 95% of time and budget on every custom SCORM course.', 'Create, deliver and measure learning in one place.'],
  [
    'Send your brief today, get your next-level SCORM course in your LMS Next minute. AI-powered production',
    'Build SCORM-ready courses with AI, run live Quizmoto sessions, manage learners and track progress',
  ],
  ['at a fraction of the cost and resources.', 'from one connected LMSGEN workspace.'],
  ['<div>How It Works</div>', '<div>See solutions</div>'],
];

const FEATURE_CARD_TEXT_REPLACEMENTS = [
  ['<div>COURSE</div>', '<div>LIBRARY</div>'],
  ['<div>TRACK</div>', '<div>MANAGE</div>'],
  ['Learner Workspace', 'Learner Hub'],
  ['Learners · Teams · Cohorts', 'Courses · Progress · Achievements'],
  ['Quizmoto Ready', 'Live Quizmoto'],
  ['Interactive · Ready to play', 'Live quizzes · Leaderboards'],
  ['SCORM Course', 'Content Library'],
  ['Cybersecurity Awareness · 15 min', 'Courses · Templates · Media'],
  ['Learner Progress', 'Access Control'],
  ['1,600 completed · 3,000 assigned', 'Users · Roles · Permissions'],
  ['Learning Analytics', 'Analytics & Reports'],
  ['Completed · In progress', 'Progress · Completion · Insights'],
];

const FEATURE_ASSETS = [
  {
    source: 'k0VcyWYrW2RY.webp',
    file: '01-ai-course-studio.png',
    alt: 'LMSGEN AI Course Studio dashboard',
  },
  {
    source: '5eVCMAfSY5wt.webp',
    file: '03-learner-hub.png',
    alt: 'LMSGEN Learner Hub dashboard',
  },
  {
    source: '2kzoglR4Cy5k.webp',
    file: '02-live-quizmoto.png',
    alt: 'LMSGEN Live Quizmoto dashboard',
  },
  {
    source: 'uLN1vcZMAWJ7.webp',
    file: '05-content-library.png',
    alt: 'LMSGEN Content Library dashboard',
  },
  {
    source: 'Fzt1dp49TVmE.webp',
    file: '06-access-control.png',
    alt: 'LMSGEN Access Control dashboard',
  },
  {
    source: 'IV3mJqP3eCWA.webp',
    file: '04-analytics-reports.png',
    alt: 'LMSGEN Analytics and Reports dashboard',
  },
];

const HERO_PRODUCT = `<div class="atelora-hero-product" style="width:min(92%,132rem)">
              <div class="atelora-product-shell">
                <div class="atelora-product-chrome" aria-hidden="true">
                  <div class="atelora-window-dots"><i></i><i></i><i></i></div>
                  <div class="atelora-product-title">LMSGEN Platform</div>
                  <div class="atelora-product-chip">Learning workspace</div>
                </div>
                <div class="atelora-product-media">
                  <img src="/atelora-marketing/hero-dashboard.png" alt="LMSGEN learning platform dashboard" loading="eager" decoding="async" />
                </div>
              </div>
            </div>`;

function findEndOfCentralDirectory(buffer) {
  const signature = 0x06054b50;
  const minimumOffset = Math.max(0, buffer.length - 22 - 0xffff);

  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === signature) return offset;
  }

  throw new Error('Feature asset ZIP is missing a valid end-of-central-directory record.');
}

async function extractFeatureAssets() {
  const zip = await fs.readFile(featureZipPath);
  const eocdOffset = findEndOfCentralDirectory(zip);
  const entryCount = zip.readUInt16LE(eocdOffset + 10);
  let centralOffset = zip.readUInt32LE(eocdOffset + 16);
  const expectedFiles = new Set(FEATURE_ASSETS.map(({ file }) => file));
  const extractedFiles = new Set();

  await fs.mkdir(featureAssetsRoot, { recursive: true });

  for (let index = 0; index < entryCount; index += 1) {
    if (zip.readUInt32LE(centralOffset) !== 0x02014b50) {
      throw new Error(`Invalid feature asset ZIP central directory entry at index ${index}.`);
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

      await fs.writeFile(path.join(featureAssetsRoot, baseName), fileData);
      extractedFiles.add(baseName);
    }

    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  const missingFiles = [...expectedFiles].filter((file) => !extractedFiles.has(file));
  if (missingFiles.length) {
    throw new Error(`Feature asset ZIP is missing: ${missingFiles.join(', ')}`);
  }

  console.log(`Prepared ${extractedFiles.size} LMSGEN feature card assets.`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceFeatureCardImages(html) {
  for (const asset of FEATURE_ASSETS) {
    const imagePattern = new RegExp(
      `<img\\s+src="images/${escapeRegExp(asset.source)}"[\\s\\S]*?class="hp-platf-card-img"\\s*\\/>`,
    );
    const replacement = `<img
                        src="/lmsgen-feature-assets/${asset.file}"
                        loading="lazy"
                        width="540"
                        height="641"
                        alt="${asset.alt}"
                        class="hp-platf-card-img lmsgen-feature-card-img"
                      />`;

    if (!imagePattern.test(html)) {
      throw new Error(`Could not locate homepage platform card image: ${asset.source}`);
    }

    html = html.replace(imagePattern, replacement);
  }

  return html;
}

function brandMarketingHtml(html, visibleLogoVariant = 'dark') {
  return html
    // Structured metadata should use the light-background version for broad compatibility.
    .replace(
      /\/landing\/images\/logos\/atelora-landing-logo\.svg/g,
      '/branding/lmsgen-logo-light.png',
    )
    // Visible exported-site logos sit on the dark marketing header by default,
    // but pages whose header keeps its bright turquoise background (no JS
    // scroll-based swap, unlike the homepage) need the dark-text variant -
    // the white-text "dark" logo is nearly invisible against turquoise.
    .replace(
      /(?:\.\.\/)*images\/logos\/atelora-landing-logo\.svg/g,
      `/branding/lmsgen-logo-${visibleLogoVariant}.png`,
    )
    .replace(
      /(?:\.\.\/)*images\/icons\/favicon\.png/g,
      '/branding/lmsgen-favicon.png',
    )
    .replace(
      /(?:\.\.\/)*images\/icons\/apple-touch-icon\.png/g,
      '/branding/lmsgen-favicon.png',
    )
    .replace(/\bAtelora\b/g, 'LMSGEN')
    .replace(/\bATELORA\b/g, 'LMSGEN');
}

function ensureHeadAssets(html, baseHref) {
  const inserts = [];

  // target="_top" matters because this page is served inside the platform
  // app's iframe (see MarketingSite.jsx): without it, every internal link -
  // including "Log in" and links to the other marketing pages - would
  // navigate inside the iframe's own frame instead of the actual browser
  // tab, leaving the user stuck looking at the outer app's chrome around a
  // page that silently changed underneath it.
  if (!/<base\s+href=/i.test(html)) {
    inserts.push(`<base href="${baseHref}" target="_top" />`);
  }

  if (!html.includes('/landing/css/atelora-home-refresh.css')) {
    inserts.push('<link rel="stylesheet" href="/landing/css/atelora-home-refresh.css" />');
  }

  if (!html.includes('href="/branding/lmsgen-favicon.png"')) {
    inserts.push('<link rel="icon" type="image/png" href="/branding/lmsgen-favicon.png" />');
  }

  if (!inserts.length) return html;
  return html.replace(/<head>/i, `<head>\n    ${inserts.join('\n    ')}`);
}

function ensureBodyClasses(html, classes) {
  return html.replace(/<body([^>]*)>/i, (match, attrs = '') => {
    const classMatch = attrs.match(/\sclass=(['"])(.*?)\1/i);

    if (classMatch) {
      const existing = classMatch[2].split(/\s+/).filter(Boolean);
      const merged = [...new Set([...existing, ...classes])].join(' ');
      const updatedAttrs = attrs.replace(
        classMatch[0],
        ` class=${classMatch[1]}${merged}${classMatch[1]}`,
      );
      return `<body${updatedAttrs}>`;
    }

    return `<body${attrs} class="${classes.join(' ')}">`;
  });
}

function prepareHome(html) {
  for (const [from, to] of HOME_REPLACEMENTS) {
    html = html.split(from).join(to);
  }

  for (const [from, to] of FEATURE_CARD_TEXT_REPLACEMENTS) {
    html = html.replace(from, to);
  }

  html = replaceFeatureCardImages(html);

  if (!html.includes('class="atelora-hero-product"')) {
    html = html.replace(
      '<div class="hp-hero-img-c new">',
      `<div class="hp-hero-img-c new">\n            ${HERO_PRODUCT}`,
    );
  }

  return html;
}

async function preparePage(page) {
  const filePath = path.join(landingRoot, page.file);
  let html = await fs.readFile(filePath, 'utf8');

  // Remove the exported-site publication marker and make the built documents
  // self-consistent when served at their friendly public route.
  html = html.replace(/<!--\s*Last Published:[\s\S]*?-->\s*/i, '');
  html = ensureHeadAssets(html, page.base);
  html = ensureBodyClasses(html, [
    'atelora-site-refresh',
    ...(page.home ? ['atelora-home-refresh'] : []),
  ]);

  if (page.home) html = prepareHome(html);

  if (page.file === 'contact/index.html') {
    html = html.replace(
      '<title>Contact</title>',
      '<title>Contact LMSGEN | Learning Platform</title>',
    );
  }

  html = brandMarketingHtml(html, page.visibleLogoVariant);

  await fs.writeFile(filePath, html, 'utf8');
  console.log(`Prepared LMSGEN marketing page: ${page.file}`);
}

try {
  await extractFeatureAssets();
  await Promise.all(pages.map(preparePage));
} catch (error) {
  console.error('Failed to prepare LMSGEN marketing pages:', error);
  process.exitCode = 1;
}
