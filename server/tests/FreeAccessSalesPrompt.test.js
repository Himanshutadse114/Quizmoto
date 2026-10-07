const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

describe('free access sales prompt', () => {
    const shell = fs.readFileSync(
        path.join(__dirname, '../../client/src/pages/Scorm/ScormPlatformShell.jsx'),
        'utf8'
    );

    it('uses concise copy and links free users to the main sales contact page', () => {
        expect(shell).to.include('Demo mode');
        expect(shell).to.include("https://www.lmsgen.in/contact");
        expect(shell).to.include('Activate');
        expect(shell).not.to.include('LMSGEN tenant features unlock after the Super Admin assigns this email to a tenant.');
    });

    it('shows the same sales prompt in desktop and mobile navigation', () => {
        const occurrences = shell.match(/<FreeAccessCard \/>/g) || [];
        expect(occurrences).to.have.length(2);
    });
});
