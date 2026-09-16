const { expect } = require('chai');
const sharp = require('sharp');
const {
    presentationKind,
    processRasterSlides,
    sanitizePptxForCompatibility,
    normalizePptxSvgFontFamilies
} = require('../services/scorm/ScormPresentationRenderer');
const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');

async function sampleSlide(accent) {
    return sharp({
        create: {
            width: 1800,
            height: 1013,
            channels: 3,
            background: '#f8fafc'
        }
    })
        .composite([{
            input: Buffer.from(`<svg width="1800" height="1013" xmlns="http://www.w3.org/2000/svg"><rect x="100" y="120" width="900" height="120" rx="24" fill="${accent}"/><rect x="100" y="300" width="1450" height="18" fill="#334155"/></svg>`)
        }])
        .png()
        .toBuffer();
}

describe('ScormPresentationRenderer', () => {
    it('accepts PPTX and PDF presentation sources only', () => {
        expect(presentationKind('application/pdf', 'deck.bin')).to.equal('pdf');
        expect(presentationKind('', 'deck.pptx')).to.equal('pptx');
        expect(() => presentationKind('image/png', 'deck.png'))
            .to.throw('support PPTX and PDF')
            .with.property('code', 'SCORM_PRESENTATION_TYPE_UNSUPPORTED');
    });

    it('normalizes every slide to fixed dimensions and compact WebP files', async () => {
        const result = await processRasterSlides([
            await sampleSlide('#0f766e'),
            await sampleSlide('#f97316')
        ], { maxEdge: 1200, maxBytes: 180 * 1024 });

        expect(result.slides).to.have.length(2);
        expect(result.width).to.equal(1200);
        expect(result.height).to.be.lessThan(700);
        for (const slide of result.slides) {
            expect(slide.width).to.equal(result.width);
            expect(slide.height).to.equal(result.height);
            expect(slide.path).to.match(/^slides\/slide-\d{3}\.webp$/);
            expect(slide.byteSize).to.be.lessThan(180 * 1024);
            const metadata = await sharp(slide.body).metadata();
            expect(metadata.format).to.equal('webp');
            expect(metadata.width).to.equal(result.width);
            expect(metadata.height).to.equal(result.height);
        }
        expect(result.theme.primary).to.match(/^#[0-9a-f]{6}$/);
        expect(result.theme.background).to.match(/^#[0-9a-f]{6}$/);
    });

    it('creates a visual-only compatibility copy when exported notes are malformed', async () => {
        const archive = new JSZip();
        archive.file('[Content_Types].xml', '<?xml version="1.0"?><Types><Override PartName="/ppt/notesSlides/notesSlide1.xml" ContentType="notes"/><Override PartName="/ppt/slides/slide1.xml" ContentType="slide"/></Types>');
        archive.file('ppt/slides/slide1.xml', '<slide>Visible slide</slide>');
        archive.file('ppt/slides/_rels/slide1.xml.rels', '<?xml version="1.0"?><Relationships><Relationship Id="note" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide1.xml"/><Relationship Id="image" Type="image" Target="../media/image.png"/></Relationships>');
        archive.file('ppt/notesSlides/notesSlide1.xml', '<notes>Broken note</notes>');

        const compatible = await sanitizePptxForCompatibility(await archive.generateAsync({ type: 'nodebuffer' }));
        const repaired = await JSZip.loadAsync(compatible);
        const names = Object.keys(repaired.files);
        const rels = await repaired.file('ppt/slides/_rels/slide1.xml.rels').async('string');
        const contentTypes = await repaired.file('[Content_Types].xml').async('string');

        expect(names).to.include('ppt/slides/slide1.xml');
        expect(names).not.to.include('ppt/notesSlides/notesSlide1.xml');
        expect(rels).not.to.include('notesSlide');
        expect(rels).to.include('Target="../media/image.png"');
        expect(contentTypes).not.to.include('/ppt/notesSlides/');
    });

    it('keeps PowerPoint bold face names on their real CSS font family', () => {
        const svg = '<svg><text font-family="Calibri, sans-serif">Body</text><tspan font-weight="bold" font-family="Lato Bold, Lato Bold, sans-serif">Title</tspan></svg>';
        const normalized = normalizePptxSvgFontFamilies(svg);

        expect(normalized).to.include('font-family="Calibri, sans-serif"');
        expect(normalized).to.include('font-weight="bold" font-family="Lato, Lato, sans-serif"');
        expect(normalized).not.to.include('Lato Bold');
    });

    it('prefers the fidelity-preserving office renderer before the compatibility fallback', () => {
        const rendererSource = fs.readFileSync(path.join(__dirname, '..', 'services', 'scorm', 'ScormPresentationRenderer.js'), 'utf8');
        const runnerSource = fs.readFileSync(path.join(__dirname, '..', 'utils', 'render_pptx_svg.mjs'), 'utf8');
        const officeRender = rendererSource.indexOf('const pdfPath = await convertPptxToPdf');
        const directRender = rendererSource.indexOf('rawSlides = await renderPptxWithSvgEngine', officeRender);

        expect(officeRender).to.be.greaterThan(-1);
        expect(directRender).to.be.greaterThan(officeRender);
        expect(rendererSource).to.include('--experimental-wasm-imported-strings');
        expect(runnerSource).to.include("import { PptxRenderer } from 'pptx-svg'");
        expect(runnerSource).to.include('renderer.renderSlideSvg(index)');
    });
});
