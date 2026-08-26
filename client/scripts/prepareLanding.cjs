const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const clientDir = path.resolve(__dirname, '..');
const archiveCandidates = [
  process.env.LANDING_ZIP && path.resolve(process.env.LANDING_ZIP),
  path.join(clientDir, 'landing-website-updated.zip'),
  path.resolve(clientDir, '..', 'landing-website-updated.zip'),
].filter(Boolean);

const archivePath = archiveCandidates.find((candidate) => fs.existsSync(candidate));
if (!archivePath) {
  throw new Error(`Landing website ZIP not found. Checked: ${archiveCandidates.join(', ')}`);
}

const outputDir = path.join(clientDir, 'public', 'landing');
const tempDir = path.join(clientDir, '.landing-template-temp');

fs.rmSync(tempDir, { recursive: true, force: true });
fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(tempDir, { recursive: true });
fs.mkdirSync(path.dirname(outputDir), { recursive: true });

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  return !result.error && result.status === 0;
}

function commandAvailable(command, args = ['--version']) {
  const result = spawnSync(command, args, { stdio: 'ignore' });
  return !result.error && result.status === 0;
}

let extracted = false;
if (process.platform === 'win32' && commandAvailable('powershell', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'])) {
  extracted = run('powershell', [
    '-NoProfile',
    '-Command',
    `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${tempDir.replace(/'/g, "''")}' -Force`,
  ]);
} else if (commandAvailable('unzip', ['-v'])) {
  extracted = run('unzip', ['-q', '-o', archivePath, '-d', tempDir]);
} else if (commandAvailable('python3', ['--version'])) {
  extracted = run('python3', ['-m', 'zipfile', '-e', archivePath, tempDir]);
} else if (commandAvailable('python', ['--version'])) {
  extracted = run('python', ['-m', 'zipfile', '-e', archivePath, tempDir]);
}

if (!extracted) {
  throw new Error('Unable to extract landing website ZIP. Install unzip, Python 3, or use PowerShell on Windows.');
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, files);
    else files.push(fullPath);
  }
  return files;
}

const extractedFiles = walk(tempDir);
const indexCandidates = extractedFiles
  .filter((file) => path.basename(file).toLowerCase() === 'index.html')
  .filter((file) => !file.split(path.sep).includes('__MACOSX'))
  .sort((a, b) => {
    const depthA = path.relative(tempDir, a).split(path.sep).length;
    const depthB = path.relative(tempDir, b).split(path.sep).length;
    return depthA - depthB || a.length - b.length;
  });

if (!indexCandidates.length) {
  throw new Error('No index.html found inside landing-website-updated.zip');
}

const sourceIndex = indexCandidates[0];
const sourceRoot = path.dirname(sourceIndex);
fs.cpSync(sourceRoot, outputDir, { recursive: true, force: true });

const textExtensions = new Set([
  '.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.json', '.xml', '.txt', '.svg', '.md', '.map',
]);

function patchBrand(text) {
  return text
    .replace(/https?:\/\/(?:www\.)?scorms\.ai/gi, '')
    .replace(/SCORMs\.ai/gi, 'Atelora')
    .replace(/SCORMs\s+AI/gi, 'Atelora')
    .replace(/SCORMsAI/gi, 'Atelora')
    .replace(/scorms\.ai/gi, 'Atelora');
}

const localBrandBridge = `
<style id="atelora-brand-style">
  .atelora-runtime-logo {
    display: block !important;
    width: 132px !important;
    max-width: 132px !important;
    height: auto !important;
    object-fit: contain !important;
  }
</style>
<script id="atelora-brand-bridge">
(function () {
  var BRAND_RE = /SCORMs\\.ai|SCORMs\\s+AI|SCORMsAI|scorms\\.ai/gi;
  var BRAND_LOGO = '/atelora-landing-logo.svg';

  function brandValue(value) {
    return typeof value === 'string' ? value.replace(BRAND_RE, 'Atelora') : value;
  }

  function patchText(root) {
    var walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT);
    var node;
    var touched = [];
    while ((node = walker.nextNode())) {
      if (node.nodeValue && BRAND_RE.test(node.nodeValue)) touched.push(node);
      BRAND_RE.lastIndex = 0;
    }
    touched.forEach(function (textNode) {
      textNode.nodeValue = brandValue(textNode.nodeValue);
    });
  }

  function patchAttributes(root) {
    var nodes = (root || document).querySelectorAll ? (root || document).querySelectorAll('*') : [];
    nodes.forEach(function (el) {
      ['alt', 'title', 'aria-label', 'data-label'].forEach(function (name) {
        if (!el.hasAttribute || !el.hasAttribute(name)) return;
        var value = el.getAttribute(name);
        var next = brandValue(value);
        if (next !== value) el.setAttribute(name, next);
      });
    });
  }

  function useAteloraLogo(el) {
    if (!el || el.dataset && el.dataset.ateloraLogo === '1') return;
    var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 132, height: 32 };
    if (el.tagName && el.tagName.toLowerCase() === 'img') {
      el.src = BRAND_LOGO;
      el.removeAttribute('srcset');
      el.alt = 'Atelora';
      el.classList.add('atelora-runtime-logo');
      el.style.width = Math.max(118, Math.min(150, rect.width || 132)) + 'px';
      el.style.height = 'auto';
      if (el.dataset) el.dataset.ateloraLogo = '1';
      return;
    }

    var img = document.createElement('img');
    img.src = BRAND_LOGO;
    img.alt = 'Atelora';
    img.className = 'atelora-runtime-logo';
    img.style.width = Math.max(118, Math.min(150, rect.width || 132)) + 'px';
    img.style.height = 'auto';
    img.dataset.ateloraLogo = '1';
    if (el.className && typeof el.className === 'string') img.className += ' ' + el.className;
    el.replaceWith(img);
  }

  function patchHeaderLogo() {
    var selectors = [
      'header img', 'header svg', 'nav img', 'nav svg',
      '[role="banner"] img', '[role="banner"] svg',
      'img[alt*="scorm" i]', 'img[title*="scorm" i]'
    ];
    var candidates = Array.prototype.slice.call(document.querySelectorAll(selectors.join(',')));

    var explicit = candidates.find(function (el) {
      var meta = [
        el.getAttribute && el.getAttribute('alt'),
        el.getAttribute && el.getAttribute('title'),
        el.getAttribute && el.getAttribute('src'),
        el.getAttribute && el.getAttribute('aria-label'),
        el.parentElement && el.parentElement.getAttribute && el.parentElement.getAttribute('aria-label')
      ].filter(Boolean).join(' ');
      return /scorms?\\.?ai/i.test(meta);
    });

    if (explicit) {
      useAteloraLogo(explicit);
      return;
    }

    var likely = candidates.find(function (el) {
      if (!el.getBoundingClientRect) return false;
      var rect = el.getBoundingClientRect();
      return rect.top >= 0 && rect.top < 180 && rect.width >= 70 && rect.width <= 260 && rect.height > 14 && rect.height <= 90;
    });

    if (likely) useAteloraLogo(likely);
  }

  function patchHeaderBackgroundLogo() {
    var containers = document.querySelectorAll('header *, nav *, [role="banner"] *');
    containers.forEach(function (el) {
      var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
      if (!rect || rect.top < 0 || rect.top > 180 || rect.width < 70 || rect.width > 260 || rect.height > 90) return;
      var bg = window.getComputedStyle ? window.getComputedStyle(el).backgroundImage : '';
      if (/scorm|logo/i.test(bg || '') && bg !== 'none') {
        el.style.backgroundImage = 'url("' + BRAND_LOGO + '")';
        el.style.backgroundSize = 'contain';
        el.style.backgroundRepeat = 'no-repeat';
        el.style.backgroundPosition = 'left center';
      }
    });
  }

  function patchLinks() {
    document.querySelectorAll('a').forEach(function (link) {
      var label = (link.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
      var href = link.getAttribute('href') || '';
      if (/scorms\\.ai/i.test(href)) link.setAttribute('href', '#');
      if (label.indexOf('explore atelora') !== -1 || label.indexOf('start a pilot') !== -1) {
        link.setAttribute('href', '/login');
        link.setAttribute('target', '_top');
      }
    });
  }

  function patchAll() {
    if (!document.body) return;
    patchText(document.body);
    patchAttributes(document);
    patchHeaderLogo();
    patchHeaderBackgroundLogo();
    patchLinks();
    if (document.title) document.title = brandValue(document.title);
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    var link = target && target.closest ? target.closest('a') : null;
    if (!link) return;
    var label = (link.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
    if (label.indexOf('explore atelora') !== -1 || label.indexOf('start a pilot') !== -1) {
      event.preventDefault();
      window.top.location.href = '/login';
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', patchAll);
  else patchAll();

  var observer = new MutationObserver(function () {
    window.clearTimeout(window.__ateloraBrandTimer);
    window.__ateloraBrandTimer = window.setTimeout(patchAll, 50);
  });
  if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(patchAll, 300);
  window.setTimeout(patchAll, 1200);
})();
</script>
`;

let patchedCount = 0;
for (const file of walk(outputDir)) {
  if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  let next = patchBrand(text);
  if (/\.html?$/i.test(file) && /<\/body\s*>/i.test(next) && !next.includes('id="atelora-brand-bridge"')) {
    next = next.replace(/<\/body\s*>/i, `${localBrandBridge}</body>`);
  }

  if (next !== text) {
    fs.writeFileSync(file, next, 'utf8');
    patchedCount += 1;
  }
}

fs.rmSync(tempDir, { recursive: true, force: true });
console.log(`Prepared Atelora landing site from ${path.basename(archivePath)} (${patchedCount} text files updated).`);
