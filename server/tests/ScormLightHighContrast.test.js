const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

const css = fs.readFileSync(
    path.join(__dirname, '../../client/src/lmsgenLightFinal.css'),
    'utf8'
);

function rgb(hex) {
    const value = hex.replace('#', '');
    return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
}

function luminance(hex) {
    const channels = rgb(hex).map((channel) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
    const lighter = Math.max(luminance(foreground), luminance(background));
    const darker = Math.min(luminance(foreground), luminance(background));
    return (lighter + 0.05) / (darker + 0.05);
}

describe('LMSGEN high-contrast light theme', () => {
    it('keeps primary, body, muted and teal copy above WCAG AA on white', () => {
        expect(contrast('#071b17', '#ffffff')).to.be.greaterThan(7);
        expect(contrast('#263f3a', '#ffffff')).to.be.greaterThan(7);
        expect(contrast('#435b56', '#ffffff')).to.be.greaterThan(4.5);
        expect(contrast('#075e56', '#ffffff')).to.be.greaterThan(6);
    });

    it('defines distinct canvas, surface, border, navigation and focus states', () => {
        expect(css).to.include('--scorm-canvas: #e7efed');
        expect(css).to.include('--scorm-line-strong: #78928c');
        expect(css).to.include('background: linear-gradient(90deg, #c9ebe6 0%, #e2f3f0 100%)');
        expect(css).to.include('outline: 2px solid #087b71');
    });

    it('applies the same contrast standard to authentication screens', () => {
        expect(css).to.include('html body .scorm-auth-workbench.scorm-theme-light');
        expect(css).to.include('--sa-border-strong: #78928c');
        expect(css).to.include('background: #16b8aa !important');
    });
});
