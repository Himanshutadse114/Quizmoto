const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

const clientRoot = path.join(__dirname, '..', '..', 'client', 'src');

function source(relativePath) {
    return fs.readFileSync(path.join(clientRoot, relativePath), 'utf8');
}

function luminance(hex) {
    const values = hex.match(/[0-9a-f]{2}/gi).map((value) => parseInt(value, 16) / 255);
    const channels = values.map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}

function contrast(first, second) {
    const a = luminance(first);
    const b = luminance(second);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe('Quizmoto teal product theme', () => {
    it('loads the teal product layer after the legacy Quizmoto boundary', () => {
        const app = source('App.jsx');
        const legacy = app.indexOf("import './pages/Host/quizmotoClassicBoundary.css'");
        const teal = app.indexOf("import './pages/Host/quizmotoTealTheme.css'");
        expect(legacy).to.be.greaterThan(-1);
        expect(teal).to.be.greaterThan(legacy);
    });

    it('maps the old Quizmoto utility names onto the teal game palette', () => {
        const index = source('index.css');
        expect(index).to.include('--color-quizmoto-blue: #0f766e');
        expect(index).to.include('--color-quizmoto-purple: #0f6f67');
        expect(index).to.include('--color-quizmoto-darkPurple: #062f2b');
    });

    it('keeps all four game answers distinct and readable', () => {
        expect(contrast('#c94458', '#ffffff')).to.be.at.least(4.5);
        expect(contrast('#0f766e', '#ffffff')).to.be.at.least(4.5);
        expect(contrast('#f2bd3f', '#302306')).to.be.at.least(4.5);
        expect(contrast('#238653', '#ffffff')).to.be.at.least(4.5);
        const theme = source(path.join('pages', 'Host', 'quizmotoTealTheme.css'));
        expect(theme).to.include('.bg-quizmoto-red');
        expect(theme).to.include('.bg-quizmoto-blue');
        expect(theme).to.include('.bg-quizmoto-yellow');
        expect(theme).to.include('.bg-quizmoto-green');
    });

    it('includes keyboard focus, mobile and reduced-motion treatment', () => {
        const theme = source(path.join('pages', 'Host', 'quizmotoTealTheme.css'));
        expect(theme).to.include(':focus-visible');
        expect(theme).to.include('@media (max-width: 840px)');
        expect(theme).to.include('@media (prefers-reduced-motion: reduce)');
    });

    it('keeps lobby copy readable and removes floating shapes from host questions', () => {
        const lobby = source(path.join('pages', 'Host', 'Lobby.jsx'));
        const app = source('App.jsx');
        expect(lobby).to.include('quizmoto-host-lobby');
        expect(lobby).to.include('text-[#dcf5f1]');
        expect(lobby).not.to.include("'bg-white/10 text-white/20 cursor-not-allowed");
        expect(app).to.include("!pathname.startsWith('/host/game') && pathname !== '/player/game'");
        expect(app).to.include('{showQuizBackgroundShapes && (');
    });

    it('uses accessible dark teal text on white live-game controls', () => {
        const theme = source(path.join('pages', 'Host', 'quizmotoTealTheme.css'));
        expect(contrast('#075e57', '#ffffff')).to.be.at.least(4.5);
        expect(theme).to.include('.bg-white.text-quizmoto-purple');
        expect(theme).to.include('color: #075e57 !important');
        expect(theme).to.include('[class*="text-white/50"]');
    });
});
