const { expect } = require('chai');
const proxyquire = require('proxyquire');
const { Op } = require('sequelize');

describe('Publica short library links', () => {
    function fixture(overrides = {}) {
        const stored = { id: 'library-id', shareToken: 'a'.repeat(48), shareSlug: null };
        const library = { ...stored, reload: async () => Object.assign(library, stored) };
        const calls = [];
        const model = {
            findOne: async () => null,
            update: async (values, options) => { calls.push({ values, options }); Object.assign(stored, values); return [1]; },
            ...overrides
        };
        const service = proxyquire('../services/PublicaLibraryLinkService', { '../models/FlipbookLibrary': model });
        return { service, library, stored, calls };
    }

    it('assigns a URL-safe 16-character alias without changing the legacy token', async () => {
        const { service, library, calls } = fixture();
        await service.assignLibraryLink(library);
        expect(library.shareSlug).to.match(/^[A-Za-z0-9_-]{16}$/);
        expect(library.shareToken).to.equal('a'.repeat(48));
        expect(calls[0].options.where).to.deep.equal({ id: 'library-id', shareSlug: null });
        expect(calls[0].values).not.to.have.property('shareToken');
    });

    it('keeps an existing alias stable across owner visits', async () => {
        const { service, library, calls } = fixture();
        library.shareSlug = 'already-issued';
        await service.assignLibraryLink(library);
        expect(library.shareSlug).to.equal('already-issued');
        expect(calls).to.have.length(0);
    });

    it('checks both aliases and old tokens before retrying a collision', async () => {
        let lookups = 0;
        const { service, library } = fixture({ findOne: async ({ where }) => {
            expect(where[Op.or]).to.have.length(2);
            lookups += 1;
            return lookups === 1 ? { id: 'other-library' } : null;
        } });
        await service.assignLibraryLink(library);
        expect(lookups).to.equal(2);
    });

    it('retries the database unique constraint and preserves a concurrent winner', async () => {
        let updates = 0;
        const { service, library, stored } = fixture({ update: async () => {
            updates += 1;
            if (updates === 1) throw Object.assign(new Error('Collision'), { name: 'SequelizeUniqueConstraintError' });
            stored.shareSlug = 'winner-from-another-request';
            return [0];
        } });
        await service.assignLibraryLink(library);
        expect(library.shareSlug).to.equal('winner-from-another-request');
        expect(updates).to.equal(2);
    });

    it('regenerates both identifiers in one update only when requested', async () => {
        const { service, library, calls } = fixture();
        library.shareSlug = 'old-link';
        await service.assignLibraryLink(library, { regenerate: true });
        expect(library.shareSlug).to.match(/^[A-Za-z0-9_-]{16}$/);
        expect(library.shareToken).to.match(/^[a-f0-9]{48}$/).and.not.to.equal('a'.repeat(48));
        expect(calls[0].options.where).to.deep.equal({ id: 'library-id' });
    });

    it('bounds collision retries and does not hide storage failures', async () => {
        const { service, library } = fixture({ findOne: async () => ({ id: 'taken' }) });
        try { await service.assignLibraryLink(library); throw new Error('Expected failure'); }
        catch (error) { expect(error.code).to.equal('PUBLICA_LIBRARY_LINK_UNAVAILABLE'); }
        const failed = fixture({ update: async () => { throw new Error('Storage offline'); } });
        try { await failed.service.assignLibraryLink(failed.library); throw new Error('Expected failure'); }
        catch (error) { expect(error.message).to.equal('Storage offline'); }
    });
});
