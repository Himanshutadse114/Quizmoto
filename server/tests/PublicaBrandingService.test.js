const { expect } = require('chai');
const service = require('../services/PublicaBrandingService');

describe('Publica branding and share links', () => {
    const previousAppUrl = process.env.PUBLIC_APP_URL;

    beforeEach(() => {
        process.env.PUBLIC_APP_URL = 'https://www.lmsgen.in';
    });

    after(() => {
        if (previousAppUrl === undefined) delete process.env.PUBLIC_APP_URL;
        else process.env.PUBLIC_APP_URL = previousAppUrl;
    });

    it('keeps the secure token as a fallback while preferring a custom slug', () => {
        expect(service.shareIdentifier({ shareToken: 'secure-token', shareSlug: null })).to.equal('secure-token');
        expect(service.shareIdentifier({ shareToken: 'secure-token', shareSlug: 'security-guide' })).to.equal('security-guide');
        expect(service.publicationUrl({ shareToken: 'secure-token', shareSlug: 'security-guide' })).to.equal('https://www.lmsgen.in/publica/security-guide');
    });

    it('always builds library URLs from their collision-proof secure token', () => {
        expect(service.libraryUrl({ shareToken: 'token', shareSlug: 'insights' }))
            .to.equal('https://www.lmsgen.in/publica-library/token');
    });

    it('rejects invalid public identifiers', () => {
        expect(() => service.cleanShareSlug('Not Valid!')).to.throw('lowercase letters');
        expect(service.cleanShareSlug('my-publication-2026')).to.equal('my-publication-2026');
    });
});
