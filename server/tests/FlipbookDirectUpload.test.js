const { expect } = require('chai');
const {
    MAX_PAGE_BYTES,
    MAX_THUMBNAIL_BYTES,
    createPageStorageKey,
    createThumbnailStorageKey,
    validateStoredPage,
    validateStoredThumbnail,
    appendStoredPage,
    replaceStoredThumbnail
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

    it('creates and validates a separate owner-scoped thumbnail key', () => {
        const flipbook = book();
        const key = createThumbnailStorageKey(flipbook, 'image/webp');
        expect(key).to.match(/^flipbooks\/42\/book-1\/thumbnail-[a-f0-9]{32}\.webp$/);
        expect(validateStoredThumbnail({ flipbook, key, contentType: 'image/webp', byteSize: 1500 }))
            .to.deep.equal({ key, contentType: 'image/webp', byteSize: 1500 });
        expect(() => validateStoredThumbnail({
            flipbook,
            key: 'flipbooks/99/book-1/thumbnail-bad.jpg',
            contentType: 'image/jpeg',
            byteSize: 100
        })).to.throw(/invalid publication thumbnail/i);
        expect(() => validateStoredThumbnail({ flipbook, key, contentType: 'image/webp', byteSize: MAX_THUMBNAIL_BYTES + 1 }))
            .to.throw(/custom thumbnail/i);
    });

    it('replaces thumbnail metadata without adding a publication page', async () => {
        const flipbook = book();
        const key = createThumbnailStorageKey(flipbook, 'image/jpeg');
        const thumbnail = await replaceStoredThumbnail({
            flipbook,
            key,
            contentType: 'image/jpeg',
            byteSize: 2200,
            width: 1200,
            height: 675
        });
        expect(thumbnail).to.include({ key, width: 1200, height: 675 });
        expect(flipbook.thumbnail).to.deep.equal(thumbnail);
        expect(flipbook.pageCount).to.equal(0);
    });
});
