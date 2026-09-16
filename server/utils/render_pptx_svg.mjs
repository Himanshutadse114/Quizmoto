import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PptxRenderer } from 'pptx-svg';

const [sourcePath, outputDir] = process.argv.slice(2);

if (!sourcePath || !outputDir) {
    throw new Error('Usage: render_pptx_svg.mjs <source.pptx> <output-directory>');
}

const wasmPath = fileURLToPath(import.meta.resolve('pptx-svg/wasm'));
const renderer = new PptxRenderer({ logLevel: 'error' });
await renderer.init(await readFile(wasmPath));

const source = await readFile(sourcePath);
const arrayBuffer = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
const result = await renderer.loadPptx(arrayBuffer);
const slideCount = Number(result?.slideCount || 0);

if (!slideCount) {
    throw new Error('The PowerPoint compatibility renderer found no slides.');
}

await mkdir(outputDir, { recursive: true });
for (let index = 0; index < slideCount; index += 1) {
    const svg = renderer.renderSlideSvg(index);
    if (!svg || !svg.includes('<svg')) {
        throw new Error(`The PowerPoint compatibility renderer could not render slide ${index + 1}.`);
    }
    const fileName = `fallback-slide-${String(index + 1).padStart(3, '0')}.svg`;
    await writeFile(path.join(outputDir, fileName), svg, 'utf8');
}

process.stdout.write(JSON.stringify({ slideCount }));
