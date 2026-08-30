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
  { file: 'solutions/index.html', base: '/landing/solutions/', solutions: true },
  { file: 'about/index.html', base: '/landing/about/', visibleLogoVariant: 'light' },
  { file: 'blog/index.html', base: '/landing/blog/', visibleLogoVariant: 'light' },
  { file: 'contact/index.html', base: '/landing/contact/' },
  ...BLOG_POST_SLUGS.map((slug) => ({
    file: `blog/${slug}.html`,
    base: '/landing/blog/',
    visibleLogoVariant: 'light',
  })),
];

const HERO_HEADING = 'Save 95% of time and budget on every custom SCORM course.';
const HERO_DESCRIPTION =
  'Send your brief today and get a SCORM course in minutes. Then publish on LMSGEN, invite learners, or host a live Quizmoto quiz with a join code.';
const HERO_EYEBROW = 'Create with AI. Publish on LMSGEN. Run live Quizmoto quizzes.';

const HOME_REPLACEMENTS = [
  ['For modern L&D and security awareness teams', HERO_EYEBROW],
  ['One workspace for modern learning teams', HERO_EYEBROW],
  ['Create with AI. Publish on LMSGEN. Invite your team.', HERO_EYEBROW],
  ['Engage Learners with Quizmoto', 'Engage teams with live Quizmoto'],
  ['Publish on LMSGEN and invite your team', 'Engage teams with live Quizmoto'],
  ['Track Progress with Clear Analytics', 'Publish SCORM or track in LMSGEN'],
  ['Or export SCORM to your own LMS', 'Publish SCORM or track in LMSGEN'],
  ['<div>How It Works</div>', '<div>See solutions</div>'],
];

const FEATURE_CARD_TEXT_REPLACEMENTS = [
  ['<div>COURSE</div>', '<div>LIBRARY</div>'],
  ['<div>TRACK</div>', '<div>MANAGE</div>'],
  ['Learner Workspace', 'Learner Hub'],
  ['Learners \u00b7 Teams \u00b7 Cohorts', 'Courses \u00b7 Progress \u00b7 Achievements'],
  ['Quizmoto Ready', 'Live Quizmoto'],
  ['Interactive \u00b7 Ready to play', 'Live quizzes \u00b7 Leaderboards'],
  ['SCORM Course', 'Content Library'],
  ['Cybersecurity Awareness \u00b7 15 min', 'Courses \u00b7 Templates \u00b7 Media'],
  ['Learner Progress', 'Access Control'],
  ['1,600 completed \u00b7 3,000 assigned', 'Users \u00b7 Roles \u00b7 Permissions'],
  ['Learning Analytics', 'Analytics & Reports'],
  ['Completed \u00b7 In progress', 'Progress \u00b7 Completion \u00b7 Insights'],
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

const SOLUTIONS_ART = [
  {
    needles: ['/atelora-marketing/hero-dashboard.png', 'class="sl-hero-img"'],
    src: '/landing/images/lmsgen/01-hero-flow-diagram.svg',
    alt: 'LMSGEN flow \u2014 brief to AI studio, SCORM, live quiz and tracking',
    className: 'sl-hero-img',
    eager: true,
  },
  {
    needles: ['VyBZeYruR0D7.avif'],
    src: '/landing/images/lmsgen/02-ai-from-documents.svg',
    alt: 'LMSGEN turns documents into structured courses',
    className: 'sl-feat-common-img',
  },
  {
    needles: ['oewMe8h2dCg6.webp'],
    src: '/landing/images/lmsgen/10-scorm-package.svg',
    alt: 'Publish in LMSGEN or export a SCORM package',
    className: 'sl-feat-common-img',
  },
  {
    needles: ['zhRy34iPucqP.webp'],
    src: '/landing/images/lmsgen/11-quizmoto-live.svg',
    alt: 'Quizmoto live quiz \u2014 separate realtime feature',
    className: 'sl-feat-common-img',
  },
  {
    needles: ['OZYUHzO7MAJm.webp'],
    src: '/landing/images/lmsgen/04-tracking-dashboard.svg',
    alt: 'LMSGEN learner tracking dashboard',
    className: 'sl-feat-common-img',
  },
  {
    needles: ['Lnk1e804fwiG.avif'],
    src: '/landing/images/lmsgen/12-admin-roles.svg',
    alt: 'Admin roles, approvals and access controls',
    className: 'sl-feat-common-img',
  },
  {
    needles: ['VmibnvpQBDCL.webp'],
    src: '/landing/images/lmsgen/13-brand-templates.svg',
    alt: 'Create on-brand courses from source documents',
  },
  {
    needles: ['3PzYFFT4Gt1T.webp'],
    src: '/landing/images/lmsgen/14-studio-scale.svg',
    alt: 'LMSGEN course studio at scale',
  },
  {
    needles: ['BRthsAMA0EpT.avif'],
    src: '/landing/images/lmsgen/15-self-paced.svg',
    alt: 'Self-paced course template',
  },
  {
    needles: ['B7PxdsT6Thjn.avif'],
    src: '/landing/images/lmsgen/16-bulk-assign.svg',
    alt: 'Bulk-assign a course from a share link',
  },
  {
    needles: ['Ny57VpmJ8qg7.avif'],
    src: '/landing/images/lmsgen/17-learning-paths.svg',
    alt: 'Personalized learning paths',
  },
  {
    needles: ['eoEnoGnd37MW.avif'],
    src: '/landing/images/lmsgen/18-learner-mgmt.svg',
    alt: 'Learner access and reporting dashboard',
    className: 'sl-feat-common-img',
  },
];

const SOLUTIONS_TEXT = [
  [
    'Turn passive training into active participation with live Quizmoto quizzes and game-based sessions.',
    'Quizmoto is a separate live-quiz feature. Run realtime quizzes in your workspace \u2014 users join and play together, live.',
  ],
  [
    'Add live Quizmoto quizzes and game-based checks to any course, for any team.',
    'Use Quizmoto as its own live-quiz tool in the same workspace. Host a session, share a join code, and play in realtime.',
  ],
  [
    'Run fast, competitive live quizzes that make training more memorable.',
    'Quizmoto is a separate feature in your LMSGEN workspace. Conduct live quizzes where participants join with a code and play in realtime \u2014 it is not the SCORM course player.',
  ],
  ['Quizmoto, Live', 'Quizmoto \u2014 a separate live-quiz feature'],
  [
    'Package and deliver standards-ready SCORM courses through any LMS in minutes.',
    'LMSGEN has its own LMS \u2014 publish a course and start tracking learners right away. You can also export the course as SCORM and add it to your own LMS.',
  ],
  [
    'From first draft to final report, Atelora keeps course creation and delivery fast and consistent.',
    'From first draft to final report, LMSGEN keeps course creation and delivery fast and consistent.',
  ],
];

const ANTI_FOUC_STYLE = `<style id="lmsgen-anti-fouc">
  html, body { background: #0A0F0E !important; }
  .sl-features-key-c { display: none !important; }
  body.atelora-home-refresh .hp-hero-img-c.new > :not(.atelora-hero-product) {
    display: none !important;
  }
</style>`;

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

function replaceMatchingImgTag(html, needle, src, alt, className, eager) {
  const start = html.indexOf(needle);
  if (start === -1) return { html, replaced: false };

  const tagStart = html.lastIndexOf('<img', start);
  if (tagStart === -1) return { html, replaced: false };

  const tagEnd = html.indexOf('>', start);
  if (tagEnd === -1) return { html, replaced: false };

  const loading = eager ? 'eager' : 'lazy';
  const cls = className ? ` class="${className}"` : '';
  const tag = `<img src="${src}?v=20260830f" alt="${alt}" loading="${loading}" decoding="async"${cls} />`;
  return { html: html.slice(0, tagStart) + tag + html.slice(tagEnd + 1), replaced: true };
}

function stripKeyFeaturesBlock(html) {
  const marker = html.indexOf('class="sl-features-key-c"');
  if (marker === -1) return html;

  const containerStart = html.lastIndexOf('<div class="container">', marker);
  const sepStart = html.lastIndexOf('<div class="global-separator"></div>', containerStart === -1 ? marker : containerStart);
  const from = sepStart !== -1 ? sepStart : containerStart;
  if (from === -1) return html;

  const sectionClose = html.indexOf('</section>', marker);
  if (sectionClose === -1) return html;

  return `${html.slice(0, from)}</section>${html.slice(sectionClose + '</section>'.length)}`;
}

function prepareSolutions(html) {
  html = stripKeyFeaturesBlock(html);

  for (const art of SOLUTIONS_ART) {
    let replaced = false;
    for (const needle of art.needles) {
      const result = replaceMatchingImgTag(html, needle, art.src, art.alt, art.className, art.eager);
      if (result.replaced) {
        html = result.html;
        replaced = true;
        break;
      }
    }
    if (!replaced) {
      console.warn(`Solutions image not found for ${art.src}`);
    }
  }

  for (const [from, to] of SOLUTIONS_TEXT) {
    html = html.split(from).join(to);
  }

  html = html.split('content="../images/oVItWEnycNKS.png"').join(
    'content="/landing/images/lmsgen/08-og-banner.svg"',
  );

  return html;
}

function brandMarketingHtml(html, visibleLogoVariant = 'dark') {
  return html
    .replace(
      /\/landing\/images\/logos\/atelora-landing-logo\.svg/g,
      '/branding/lmsgen-logo-light.png',
    )
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

  if (!/<base\s+href=/i.test(html)) {
    inserts.push(`<base href="${baseHref}" target="_top" />`);
  }

  if (!html.includes('/landing/css/atelora-home-refresh.css')) {
    inserts.push('<link rel="stylesheet" href="/landing/css/atelora-home-refresh.css" />');
  }

  if (!html.includes('/landing/css/lmsgen-advantage-assets.css')) {
    inserts.push('<link rel="stylesheet" href="/landing/css/lmsgen-advantage-assets.css?v=20260830v" />');
  }

  if (!html.includes('id="lmsgen-anti-fouc"')) {
    inserts.push(ANTI_FOUC_STYLE);
  }

  if (!html.includes('href="/branding/lmsgen-favicon.png"')) {
    inserts.push('<link rel="icon" type="image/png" href="/branding/lmsgen-favicon.png" />');
  }

  if (!inserts.length) return html;
  return html.replace(/<head>/i, `<head>\n    ${inserts.join('\n    ')}`);
}

function ensureNavMenu(html) {
  if (html.includes('/landing/js/nav-menu.js') || html.includes('js/nav-menu.js')) return html;
  return html.replace(
    /<\/body>/i,
    '    <script src="/landing/js/nav-menu.js"></script>\n  </body>',
  );
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

function applyHeroCopy(html) {
  html = html.replace(
    /<div class="caption text-color-lemon font-weight-normal">[\s\S]*?<\/div>/,
    `<div class="caption text-color-lemon font-weight-normal">\n                ${HERO_EYEBROW}\n              </div>`,
  );
  html = html.replace(
    /<h1 class="hp-hero-h1">[\s\S]*?<\/h1>/,
    `<h1 class="hp-hero-h1">${HERO_HEADING}</h1>`,
  );
  html = html.replace(
    /<p class="hp-hero-p">[\s\S]*?<\/p>/,
    `<p class="hp-hero-p">\n                ${HERO_DESCRIPTION}\n              </p>`,
  );
  return html;
}

function prepareHome(html) {
  for (const [from, to] of HOME_REPLACEMENTS) {
    html = html.split(from).join(to);
  }

  html = applyHeroCopy(html);

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

  html = html.replace(/<!--\s*Last Published:[\s\S]*?-->\s*/i, '');
  html = ensureHeadAssets(html, page.base);
  html = ensureBodyClasses(html, [
    'atelora-site-refresh',
    ...(page.home ? ['atelora-home-refresh'] : []),
    ...(page.solutions ? ['lmsgen-solutions-ready'] : []),
  ]);

  if (page.home) html = prepareHome(html);
  if (page.solutions) html = prepareSolutions(html);

  if (page.file === 'contact/index.html') {
    html = html.replace(
      '<title>Contact</title>',
      '<title>Contact LMSGEN | Learning Platform</title>',
    );
  }

  html = brandMarketingHtml(html, page.visibleLogoVariant);
  html = ensureNavMenu(html);

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
