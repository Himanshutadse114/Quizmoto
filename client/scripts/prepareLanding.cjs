const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const clientDir = path.resolve(__dirname, '..');
const sourceDir = path.join(clientDir, 'landing-site');
const outputDir = path.join(clientDir, 'public', 'landing');
const contentSourcePath = path.join(sourceDir, 'atelora-content.js');
const EXPECTED_PARTS = 6;
const EXPECTED_PART_SIZE = 8000;
const EXPECTED_LAST_PART_SIZE = 3080;
const EXPECTED_HTML_SHA256 = 'e3b3fb067683a087c995421f949496898670439893a69eab178436943e750653';
const LOCAL_CSS_PATH = '/landing/atelora-clone.css';
const CONTENT_SCRIPT_PATH = '/landing/atelora-content.js';
const STYLESHEET_URLS = [
  'https://cdn.prod.website-files.com/671511cf4e0de2cd564eaa9d/css/9PIWBwGCQe6z.css',
  'https://cdn.prod.website-files.com/671511cf4e0de2cd564eaa9d/css/IHgaQYuRys9z.css',
];

function reconstructLanding() {
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
  if (!fs.existsSync(contentSourcePath)) {
    throw new Error('Atelora landing validation failed: editable content layer is missing.');
  }

  return htmlText;
}

function absolutizeCssUrls(css, stylesheetUrl) {
  return css.replace(/url\((['"]?)([^)'"\s]+)\1\)/gi, (full, quote, rawUrl) => {
    if (/^(data:|blob:|#)/i.test(rawUrl)) return full;
    try {
      return `url("${new URL(rawUrl, stylesheetUrl).href}")`;
    } catch {
      return full;
    }
  });
}

async function downloadLandingCss() {
  const chunks = [];

  for (const stylesheetUrl of STYLESHEET_URLS) {
    const response = await fetch(stylesheetUrl, {
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; AteloraBuild/1.0)',
        accept: 'text/css,*/*;q=0.1',
      },
    });

    if (!response.ok) {
      throw new Error(`Unable to download Atelora stylesheet ${stylesheetUrl}: HTTP ${response.status}`);
    }

    const css = absolutizeCssUrls(await response.text(), stylesheetUrl);
    if (!css.includes('.w-nav') && !css.includes('.global-header')) {
      throw new Error(`Downloaded stylesheet ${stylesheetUrl} does not look like the expected Webflow stylesheet.`);
    }
    chunks.push(`/* Source: ${stylesheetUrl} */\n${css}`);
  }

  return chunks.join('\n\n');
}

function replaceExternalStylesheets(htmlText) {
  let result = htmlText;
  for (const stylesheetUrl of STYLESHEET_URLS) {
    const escaped = stylesheetUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const linkPattern = new RegExp(`<link\\b[^>]*href=["']${escaped}["'][^>]*>`, 'gi');
    result = result.replace(linkPattern, '');
  }

  const localLink = `<link rel="stylesheet" href="${LOCAL_CSS_PATH}" data-atelora-local-style="true">`;
  return result.replace(/<\/head>/i, `${localLink}</head>`);
}

function injectEditableContentLayer(htmlText) {
  const contentScript = `<script src="${CONTENT_SCRIPT_PATH}" data-atelora-content="true"></script>`;
  if (htmlText.includes('data-atelora-content="true"')) return htmlText;
  return htmlText.replace(/<\/body>/i, `${contentScript}</body>`);
}

async function main() {
  const htmlText = reconstructLanding();
  const localCss = await downloadLandingCss();
  const preparedHtml = injectEditableContentLayer(replaceExternalStylesheets(htmlText));

  if (!preparedHtml.includes(LOCAL_CSS_PATH)) {
    throw new Error('Atelora landing validation failed: local stylesheet reference was not created.');
  }
  if (!preparedHtml.includes(CONTENT_SCRIPT_PATH)) {
    throw new Error('Atelora landing validation failed: editable content layer was not injected.');
  }

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'index.html'), preparedHtml, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'atelora-clone.css'), localCss, 'utf8');
  fs.copyFileSync(contentSourcePath, path.join(outputDir, 'atelora-content.js'));

  console.log(`Prepared verified Atelora primary website (${Buffer.byteLength(preparedHtml)} HTML bytes, ${Buffer.byteLength(localCss)} local CSS bytes, editable content layer enabled).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
