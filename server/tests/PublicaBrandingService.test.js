const { expect } = require('chai');
const service = require('../services/PublicaBrandingService');

describe('Publica branding and share links', () => {
    const previousAppUrl = process.env.PUBLIC_APP_URL;
    const previousRoot = process.env.PUBLICA_ROOT_DOMAIN;

    beforeEach(() => {
        process.env.PUBLIC_APP_URL = 'https://www.lmsgen.in';
        process.env.PUBLICA_ROOT_DOMAIN = 'lmsgen.in';
    });

    after(() => {
        if (previousAppUrl === undefined) delete process.env.PUBLIC_APP_URL;
        else process.env.PUBLIC_APP_URL = previousAppUrl;
        if (previousRoot === undefined) delete process.env.PUBLICA_ROOT_DOMAIN;
        else process.env.PUBLICA_ROOT_DOMAIN = previousRoot;
    });

    it('keeps the secure token as a fallback while preferring a custom slug', () => {
        expect(service.shareIdentifier({ shareToken: 'secure-token', shareSlug: null })).to.equal('secure-token');
        expect(service.shareIdentifier({ shareToken: 'secure-token', shareSlug: 'security-guide' })).to.equal('security-guide');
        expect(service.publicationUrl({ shareToken: 'secure-token', shareSlug: 'security-guide' })).to.equal('https://www.lmsgen.in/publica/security-guide');
    });

    it('builds a branded library URL on the paid LMSGEN subdomain', () => {
        expect(service.libraryUrl({ shareToken: 'token', shareSlug: 'insights', customSubdomain: 'acme' }))
            .to.equal('https://acme.lmsgen.in/publica-library/insights');
    });

    it('rejects invalid and reserved public identifiers', () => {
        expect(() => service.cleanShareSlug('Not Valid!')).to.throw('lowercase letters');
        expect(() => service.cleanSubdomain('api')).to.throw('reserved');
        expect(service.cleanShareSlug('my-publication-2026')).to.equal('my-publication-2026');
    });

    it('only enables subdomains for upgraded or protected Publica allowances', () => {
        expect(service.hasPaidBranding({ max: 3, unlimited: false, protected: false })).to.equal(false);
        expect(service.hasPaidBranding({ max: 10, unlimited: false, protected: false })).to.equal(true);
        expect(service.hasPaidBranding({ max: null, unlimited: true, protected: false })).to.equal(true);
        expect(service.hasPaidBranding({ protected: true })).to.equal(true);
    });
});
