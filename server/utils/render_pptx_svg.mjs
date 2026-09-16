import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PptxRenderer } from 'pptx-svg';
import JSZip from 'jszip';

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
const archive = await JSZip.loadAsync(source);

if (!slideCount) {
    throw new Error('The PowerPoint compatibility renderer found no slides.');
}

await mkdir(outputDir, { recursive: true });
for (let index = 0; index < slideCount; index += 1) {
    let svg = renderer.renderSlideSvg(index);
    if (!svg || !svg.includes('<svg')) {
        throw new Error(`The PowerPoint compatibility renderer could not render slide ${index + 1}.`);
    }

    const slideXml = await archive.file(`ppt/slides/slide${index + 1}.xml`)?.async('string');
    if (slideXml) {
        const spacingByBox = new Map();
        for (const match of slideXml.matchAll(/<p:sp\b[\s\S]*?<\/p:sp>/gi)) {
            const shape = match[0];
            if (!/<p:txBody\b/i.test(shape)) continue;
            const offset = shape.match(/<a:off\b[^>]*\bx="(\d+)"[^>]*\by="(\d+)"[^>]*\/>/i);
            const extent = shape.match(/<a:ext\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"[^>]*\/>/i);
            if (!offset || !extent) continue;
            const spacing = Number(shape.match(/<a:lnSpc>\s*<a:spcPct\b[^>]*\bval="(\d+)"/i)?.[1] || 100000);
            spacingByBox.set(`${offset[1]}:${offset[2]}:${extent[1]}:${extent[2]}`, spacing);
        }

        svg = svg.replace(/<g\b[^>]*>/gi, (tag) => {
            const x = tag.match(/\bdata-ooxml-x="(\d+)"/i)?.[1];
            const y = tag.match(/\bdata-ooxml-y="(\d+)"/i)?.[1];
            const cx = tag.match(/\bdata-ooxml-cx="(\d+)"/i)?.[1];
            const cy = tag.match(/\bdata-ooxml-cy="(\d+)"/i)?.[1];
            const spacing = spacingByBox.get(`${x}:${y}:${cx}:${cy}`);
            return spacing
                ? tag.replace('<g', `<g data-ooxml-line-spacing="${spacing}"`)
                : tag;
        });
    }

    const fileName = `fallback-slide-${String(index + 1).padStart(3, '0')}.svg`;
    await writeFile(path.join(outputDir, fileName), svg, 'utf8');
}

process.stdout.write(JSON.stringify({ slideCount }));
