const { expect } = require('chai');
const vm = require('vm');
const { injectBranding } = require('../services/scorm/ScormCourseBrandingService');

describe('SCORM course branding logo regression', () => {
    it('reuses an existing generated header image instead of inserting a second logo', () => {
        const logo = 'data:image/png;base64,AA==';
        const html = injectBranding(
            '<!doctype html><html><head></head><body><div id="app"><header><img src="logo.jpeg" alt="Logo"><h1>Course</h1></header></div></body></html>',
            { logoDataUrl: logo }
        );
        const match = html.match(/<script id="lmsgen-course-branding-script-v1">([\s\S]*?)<\/script>/);
        expect(match).to.not.equal(null);

        const classes = new Set();
        let inserted = 0;
        const image = {
            tagName: 'IMG',
            src: 'logo.jpeg',
            alt: 'Logo',
            decoding: '',
            classList: {
                contains(name) { return classes.has(name); },
                add(name) { classes.add(name); }
            }
        };
        const header = {
            firstChild: image,
            querySelector(selector) {
                if (selector === '.qmx-brand-logo') return classes.has('qmx-brand-logo') ? image : null;
                if (selector === 'img') return image;
                if (selector === '.brand-mark') return null;
                return null;
            },
            insertBefore() { inserted += 1; }
        };
        const document = {
            readyState: 'complete',
            querySelector() { return header; },
            createElement() { inserted += 1; return {}; },
            addEventListener() {}
        };

        vm.runInNewContext(match[1], { document });

        expect(inserted).to.equal(0);
        expect(classes.has('qmx-brand-logo')).to.equal(true);
        expect(image.src).to.equal(logo);
        expect(image.alt).to.equal('Course brand logo');
    });
});
