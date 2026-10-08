const { expect } = require('chai');
const proxyquire = require('proxyquire');
const { Op } = require('sequelize');

describe('Publica library link compatibility', () => {
    it('accepts both legacy tokens and aliases and returns the short canonical URL', async () => {
        const legacyToken = 'a'.repeat(48);
        const alias = 'AbCdEf0123456789';
        const library = { id: 'library', title: 'My Library', ownerUserId: 7, shareToken: legacyToken, shareSlug: null, shareEnabled: true };
        const lookup = [];
        const router = proxyquire('../routes/flipbookLibrary', {
            '../models/FlipbookLibrary': {
                sync: async () => {}, getTableName: () => 'flipbook_libraries',
                sequelize: { getQueryInterface: () => ({ describeTable: async () => ({ shareSlug: {} }), showIndex: async () => [{ unique: true, fields: [{ attribute: 'shareSlug' }] }] }) },
                findOne: async ({ where }) => { lookup.push(where); return library; }
            },
            '../models/Flipbook': { findAll: async ({ where }) => { expect(where.ownerUserId).to.equal(7); return []; } },
            '../services/PublicaLibraryLinkService': { assignLibraryLink: async record => { record.shareSlug = alias; return record; } }
        });
        const handler = router.stack.find(layer => layer.route?.path === '/public-library/:shareToken').route.stack[0].handle;
        for (const identifier of [legacyToken, alias]) {
            let payload;
            const res = { setHeader() {}, json(value) { payload = value; } };
            await handler({ params: { shareToken: identifier } }, res, error => { throw error; });
            expect(lookup.at(-1)[Op.or]).to.deep.equal([{ shareToken: identifier }, { shareSlug: identifier }]);
            expect(lookup.at(-1).shareEnabled).to.equal(true);
            expect(payload.library.shareIdentifier).to.equal(alias);
            expect(payload.library.shareUrl).to.equal(`https://www.lmsgen.in/publica-library/${alias}`);
            expect(payload.library.shareToken).to.equal(legacyToken);
        }
    });
});
