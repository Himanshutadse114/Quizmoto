const { expect } = require('chai');
const proxyquire = require('proxyquire');

describe('Publica public reader sharing', () => {
    it('passes the canonical public link to a single share handler', async () => {
        const book = { title: 'Public reader', shareToken: 'secure-token', shareSlug: 'reader-guide', pageCount: 2 };
        const router = proxyquire('../routes/flipbooks', {
            '../models/Flipbook': { findOne: async () => book },
            '../services/FlipbookService': { ensureFlipbookSchema: async () => {} }
        });
        const handler = router.stack.find(layer => layer.route?.path === '/public/:shareToken/view' && layer.route.methods.get).route.stack[0].handle;
        let html = '';
        const res = { setHeader() {}, type() { return this; }, send(value) { html = value; } };
        await handler({ params: { shareToken: 'reader-guide' } }, res, error => { throw error; });
        expect(html).to.include('"shareUrl":"https://www.lmsgen.in/publica/reader-guide"');
        expect(html.match(/shareButton\.onclick\s*=\s*async/g)).to.have.length(1);
        expect(html).to.include('Link copied');
    });
});
