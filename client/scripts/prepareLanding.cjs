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
  const protectedUrls = [];
  text = text.replace(/https?:\/\/(?:www\.)?scorms\.ai[^\s"'<>)]*/gi, (match) => {
    const token = `__ATELORA_PROTECTED_URL_${protectedUrls.length}__`;
    protectedUrls.push(match);
    return token;
  });

  text = text
    .replace(/SCORMs\.ai/gi, 'Atelora')
    .replace(/SCORMs\s+AI/gi, 'Atelora')
    .replace(/SCORMsAI/gi, 'Atelora');

  protectedUrls.forEach((url, index) => {
    text = text.replace(`__ATELORA_PROTECTED_URL_${index}__`, url);
  });

  return text;
}

const localNavBridge = `\n<script id="atelora-local-nav">\n(function () {\n  document.addEventListener('click', function (event) {\n    var target = event.target;\n    var link = target && target.closest ? target.closest('a') : null;\n    if (!link) return;\n    var label = (link.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();\n    if (label.indexOf('explore atelora') !== -1) {\n      event.preventDefault();\n      window.top.location.href = '/login';\n    }\n  });\n})();\n</script>\n`;

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
  if (/\.html?$/i.test(file) && /<\/body\s*>/i.test(next) && !next.includes('id="atelora-local-nav"')) {
    next = next.replace(/<\/body\s*>/i, `${localNavBridge}</body>`);
  }
  if (next !== text) {
    fs.writeFileSync(file, next, 'utf8');
    patchedCount += 1;
  }
}

fs.rmSync(tempDir, { recursive: true, force: true });
console.log(`Prepared Atelora landing site from ${path.basename(archivePath)} (${patchedCount} text files updated).`);
