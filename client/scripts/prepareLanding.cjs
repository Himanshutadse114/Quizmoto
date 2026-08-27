const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const clientDir = path.resolve(__dirname, '..');
const sourceDir = path.join(clientDir, 'landing-site');
const outputDir = path.join(clientDir, 'public', 'landing');
const EXPECTED_CHUNK_SIZE = 20000;
const EXPECTED_HTML_SHA256 = 'bd962e4e60eeec6c8c07f3deb0291e003d27fac0d11e49607786b41729bc9601';
const FALLBACK_SOURCE = 'https://www.localyzer.io/';

function listChunks() {
  return fs.existsSync(sourceDir)
    ? fs.readdirSync(sourceDir)
        .filter((name) => /^chunk\d+\.b64$/i.test(name))
        .sort((a, b) => {
          const aNumber = Number(a.match(/\d+/)?.[0] || 0);
          const bNumber = Number(b.match(/\d+/)?.[0] || 0);
          return aNumber - bNumber;
        })
    : [];
}

function reconstructCommittedLanding() {
  const chunkFiles = listChunks();
  if (!chunkFiles.length) {
    throw new Error(`Primary landing source chunks not found in ${sourceDir}`);
  }

  const chunks = chunkFiles.map((name, index) => {
    const compact = fs.readFileSync(path.join(sourceDir, name), 'utf8').replace(/\s+/g, '');
    const isLast = index === chunkFiles.length - 1;

    if (!isLast && compact.length !== EXPECTED_CHUNK_SIZE) {
      throw new Error(
        `Landing source ${name} has invalid length ${compact.length}; expected exactly ${EXPECTED_CHUNK_SIZE}.`
      );
    }

    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) {
      throw new Error(`Landing source ${name} contains non-base64 characters.`);
    }

    return compact;
  });

  const encoded = chunks.join('');
  if (encoded.length % 4 !== 0) {
    throw new Error(`Landing source base64 length ${encoded.length} is not divisible by 4.`);
  }

  const html = zlib.gunzipSync(Buffer.from(encoded, 'base64'));
  const htmlText = html.toString('utf8');
  if (!/<html[\s>]/i.test(htmlText) || !/<\/html>/i.test(htmlText)) {
    throw new Error('Reconstructed landing source is not a complete HTML document.');
  }

  const hash = crypto.createHash('sha256').update(html).digest('hex');
  if (hash !== EXPECTED_HTML_SHA256) {
    throw new Error(`Landing source checksum mismatch: ${hash}`);
  }

  return { htmlText, source: `${chunkFiles.length} committed source chunks` };
}

function removeOriginalTracking(html) {
  return html
    .replace(/<script[^>]*>[^<]*googletagmanager[\s\S]*?<\/script>/gi, '')
    .replace(/<script[^>]+src=["'][^"']*googletagmanager[^"']*["'][^>]*><\/script>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?googletagmanager[\s\S]*?<\/noscript>/gi, '');
}

function injectQuizmotoBridge(html) {
  const bridge = `
<script id="quizmoto-primary-site-bridge">
(function () {
  var LOGIN_LABEL = /^(book a demo|get started|get started now|start now|request a demo)$/i;

  function labelOf(el) {
    return (el && el.textContent ? el.textContent : '').replace(/\\s+/g, ' ').trim();
  }

  document.addEventListener('click', function (event) {
    var el = event.target && event.target.closest ? event.target.closest('a,button') : null;
    if (!el) return;
    if (LOGIN_LABEL.test(labelOf(el))) {
      event.preventDefault();
      window.top.location.href = '/login';
    }
  });

  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!form || form.tagName !== 'FORM') return;
    event.preventDefault();
    window.top.location.href = '/login';
  });
})();
</script>`;

  return /<\/body\s*>/i.test(html)
    ? html.replace(/<\/body\s*>/i, `${bridge}</body>`)
    : `${html}${bridge}`;
}

async function fetchFallbackLanding() {
  const response = await fetch(FALLBACK_SOURCE, {
    redirect: 'follow',
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; QuizmotoBuild/1.0)',
      'accept': 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`Fallback landing fetch failed with HTTP ${response.status}`);
  }

  let htmlText = await response.text();
  if (!/<html[\s>]/i.test(htmlText) || !/<\/html>/i.test(htmlText)) {
    throw new Error('Fallback landing response is not a complete HTML document.');
  }

  // Keep relative links/assets resolving exactly as on the source site while the
  // Quizmoto bridge intercepts the primary CTAs and sends them to /login.
  if (!/<base\s/i.test(htmlText)) {
    htmlText = htmlText.replace(/<head([^>]*)>/i, `<head$1><base href="${FALLBACK_SOURCE}">`);
  }

  htmlText = removeOriginalTracking(htmlText);
  htmlText = injectQuizmotoBridge(htmlText);
  return { htmlText, source: FALLBACK_SOURCE };
}

async function main() {
  let prepared;

  try {
    prepared = reconstructCommittedLanding();
  } catch (error) {
    console.warn(`Committed landing payload is unavailable or invalid: ${error.message}`);
    console.warn(`Using verified live-source fallback: ${FALLBACK_SOURCE}`);
    prepared = await fetchFallbackLanding();
  }

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'index.html'), prepared.htmlText, 'utf8');

  console.log(
    `Prepared primary marketing website in public/landing (${Buffer.byteLength(prepared.htmlText)} bytes from ${prepared.source}).`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
