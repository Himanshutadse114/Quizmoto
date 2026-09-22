const { expect } = require('chai');
const {
    createEml,
    normaliseEmailList
} = require('../services/awareness/AwarenessMailDeliveryService');

describe('AwarenessMailDeliveryService', () => {
    it('normalises and deduplicates recipient addresses', () => {
        expect(normaliseEmailList(' A@example.com; a@example.com, b@example.com bad-address '))
            .to.deep.equal(['a@example.com', 'b@example.com']);
    });

    it('creates a valid EML with multiple inline CID visuals', async () => {
        const message = await createEml({
            to: ['learner@example.com'],
            subject: 'Awareness test',
            html: '<html><body><img src="cid:awareness-hero@lmsgen"><img src="cid:awareness-point-1@lmsgen"><p>Learn safely.</p></body></html>',
            text: 'Learn safely.',
            attachments: [
                {
                    filename: 'hero.jpg',
                    content: Buffer.from('hero-image'),
                    contentType: 'image/jpeg',
                    cid: 'awareness-hero@lmsgen',
                    contentDisposition: 'inline'
                },
                {
                    filename: 'point-1.jpg',
                    content: Buffer.from('point-image'),
                    contentType: 'image/jpeg',
                    cid: 'awareness-point-1@lmsgen',
                    contentDisposition: 'inline'
                }
            ]
        });

        const source = message.toString('utf8');
        expect(source).to.include('Subject: Awareness test');
        expect(source).to.include('learner@example.com');
        expect(source).to.include('Content-ID: <awareness-hero@lmsgen>');
        expect(source).to.include('Content-ID: <awareness-point-1@lmsgen>');
        expect(source).to.include('multipart/related');
    });
});
