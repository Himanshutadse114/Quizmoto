const { expect } = require('chai');
const {
    MAX_PAGE_BYTES,
    createPageStorageKey,
    validateStoredPage,
    appendStoredPage
} = require('../services/FlipbookService');

describe('Publica direct page upload', function () {
    function book() {
        return {
            id: 'book-1',
            ownerUserId: 42,
            pages: [],
            pageCount: 0,
            async save() {}
        };
    }

    it('creates an owner-scoped unpredictable object key', () => {
        const key = createPageStorageKey(book(), 'image/jpeg');
        expect(key).to.match(/^flipbooks\/42\/book-1\/direct-[a-f0-9]{32}\.jpg$/);
    });

    it('rejects oversized files and keys outside the publication', () => {
        const flipbook = book();
        expect(() => validateStoredPage({
            flipbook,
            key: 'flipbooks/42/book-1/page.jpg',
            contentType: 'image/jpeg',
            byteSize: MAX_PAGE_BYTES + 1
        })).to.throw(/smaller than/i);
        expect(() => validateStoredPage({
            flipbook,
            key: 'flipbooks/99/other/page.jpg',
            contentType: 'image/jpeg',
            byteSize: 100
        })).to.throw(/invalid publication page/i);
    });

    it('attaches validated storage metadata without proxying page bytes', async () => {
        const flipbook = book();
        const key = createPageStorageKey(flipbook, 'image/webp');
        const page = await appendStoredPage({
            flipbook,
            key,
            contentType: 'image/webp',
            byteSize: 2500,
            width: 1200,
            height: 1600
        });
        expect(page).to.include({ key, contentType: 'image/webp', byteSize: 2500, width: 1200, height: 1600 });
        expect(flipbook.pageCount).to.equal(1);
    });
});
