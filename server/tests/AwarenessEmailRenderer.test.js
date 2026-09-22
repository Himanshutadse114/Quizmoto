const { expect } = require('chai');
const {
    LAYOUT_CATALOG,
    cleanText,
    layoutVisualSlots,
    normaliseContent,
    renderAwarenessEmail,
    safeHttpUrl
} = require('../services/awareness/AwarenessEmailRenderer');

const sample = {
    title: 'QR Code Phishing Awareness',
    topic: 'QR Code Phishing',
    subject: 'Pause before you scan',
    preheader: 'A quick guide to safer QR code use',
    heroAltText: 'Phone scanning a QR code in a workplace setting',
    content: {
        headline: 'Scan with care',
        intro: 'QR codes can hide the destination until after they are scanned.',
        bodyParagraphs: [
            'Treat unexpected QR codes like unfamiliar links.',
            'Use the same verification habits you would use for email links.'
        ],
        keyPoints: [
            { title: 'Check the source', body: 'Only scan codes from a trusted and expected source.' },
            { title: 'Review the address', body: 'Check the destination before entering information.' },
            { title: 'Verify the request', body: 'Confirm unusual requests through a known contact route.' },
            { title: 'Avoid unexpected sign-ins', body: 'Do not enter credentials after an unexpected QR-code prompt.' },
            { title: 'Report concerns', body: 'Report unusual QR prompts through your normal support channel.' }
        ],
        ctaLabel: 'Review the guidance',
        ctaUrl: 'https://example.com/guidance',
        footerNote: 'Security awareness learning update.'
    }
};

function imageSources(layoutId) {
    return Object.fromEntries(
        layoutVisualSlots(layoutId).map((slot) => [slot, `cid:awareness-${slot}@lmsgen`])
    );
}

describe('AwarenessEmailRenderer', () => {
    it('provides eight distinct reference-derived awareness email layouts', () => {
        expect(LAYOUT_CATALOG).to.have.length(8);
        expect(new Set(LAYOUT_CATALOG.map((item) => item.id)).size).to.equal(8);
        expect(LAYOUT_CATALOG.map((item) => item.name)).to.deep.equal([
            'Editorial Newsletter',
            'High-Risk Brief',
            'Best Practices Guide',
            'Exposure Field Brief',
            'Attack Storyboard',
            'Human Risk Playbook',
            'Modern Threat Dossier',
            'AI Threat Signal'
        ]);
    });

    it('defines the intended 2–5 visual slots for each layout', () => {
        expect(LAYOUT_CATALOG.map((item) => layoutVisualSlots(item.id).length))
            .to.deep.equal([3, 2, 5, 2, 5, 5, 5, 5]);
        expect(layoutVisualSlots('story-spotlight')).to.deep.equal([
            'hero', 'point-1', 'point-2', 'point-3', 'banner'
        ]);
    });

    it('renders every layout as compact email-safe HTML with its layout-aware visuals', () => {
        for (const layout of LAYOUT_CATALOG) {
            const sources = imageSources(layout.id);
            const rendered = renderAwarenessEmail(
                { ...sample, layoutId: layout.id },
                { imageSources: sources }
            );
            expect(rendered.html).to.include('<table');
            expect(rendered.html).to.not.match(/<script\b/i);
            expect(rendered.html).to.not.match(/<iframe\b/i);
            expect(Buffer.byteLength(rendered.html, 'utf8')).to.be.lessThan(70 * 1024);
            expect(rendered.text).to.include('Scan with care');
            for (const slot of layoutVisualSlots(layout.id)) {
                expect(rendered.html).to.include(sources[slot]);
            }
        }
    });

    it('keeps every layout readable when images are unavailable or blocked', () => {
        for (const layout of LAYOUT_CATALOG) {
            const rendered = renderAwarenessEmail({ ...sample, layoutId: layout.id });
            expect(rendered.html).to.include('Scan with care');
            expect(rendered.html).to.include('Check the source');
            expect(rendered.html).to.not.include('undefined');
            expect(rendered.text).to.include('Report concerns');
        }
    });

    it('keeps the legacy single hero source compatible', () => {
        const rendered = renderAwarenessEmail(
            { ...sample, layoutId: 'editorial-hero' },
            { heroSrc: 'cid:awareness-hero@lmsgen' }
        );
        expect(rendered.html).to.include('cid:awareness-hero@lmsgen');
    });

    it('escapes user text instead of treating it as HTML', () => {
        const rendered = renderAwarenessEmail({
            ...sample,
            layoutId: 'editorial-hero',
            content: {
                ...sample.content,
                headline: '<script>alert(1)</script> Safe learning'
            }
        });
        expect(rendered.html).to.include('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(rendered.html).to.not.include('<script>alert(1)</script>');
    });

    it('accepts only http and https CTA links', () => {
        expect(safeHttpUrl('https://example.com')).to.equal('https://example.com/');
        expect(safeHttpUrl('javascript:alert(1)')).to.equal('');
        expect(safeHttpUrl('data:text/html,hello')).to.equal('');
    });

    it('normalises text-only editable fields and limits collection sizes', () => {
        const content = normaliseContent({
            headline: '  Headline  ',
            bodyParagraphs: ['One', 'Two', 'Three', 'Four'],
            keyPoints: Array.from({ length: 8 }, (_, index) => ({ title: `T${index}`, body: `B${index}` })),
            ctaUrl: 'https://example.com'
        });
        expect(cleanText('\u0000 Hello ')).to.equal('Hello');
        expect(content.bodyParagraphs).to.have.length(3);
        expect(content.keyPoints).to.have.length(5);
        expect(content.ctaUrl).to.equal('https://example.com/');
    });
});
