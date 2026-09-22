const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();
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
    it('reports SMTP acceptance only when the relay accepts the recipient', async () => {
        const service = proxyquire('../services/awareness/AwarenessMailDeliveryService', {
            nodemailer: {
                createTransport: () => ({
                    sendMail: async () => ({
                        accepted: ['learner@example.com'],
                        rejected: [],
                        pending: [],
                        response: '250 2.0.0 Message accepted for delivery',
                        messageId: '<accepted@example.com>',
                        envelope: { from: 'training@example.com', to: ['learner@example.com'] }
                    })
                })
            },
            '../mail/MailService': {
                isConfigured: () => true,
                providerConfig: () => ({
                    provider: 'smtp',
                    host: 'smtp.example.com',
                    port: 465,
                    secure: true,
                    user: 'training@example.com',
                    pass: 'secret',
                    fromName: 'LMSGEN',
                    fromAddress: 'training@example.com'
                }),
                verifyConnection: async () => ({ ok: true, configured: true, provider: 'smtp' })
            }
        });

        const result = await service.sendContent({
            to: 'learner@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
            text: 'Test'
        });

        expect(result.sent).to.equal(true);
        expect(result.state).to.equal('accepted');
        expect(result.accepted).to.deep.equal(['learner@example.com']);
        expect(result.providerResponse).to.include('250 2.0.0');
    });

    it('fails instead of claiming success when SMTP does not accept the recipient', async () => {
        const service = proxyquire('../services/awareness/AwarenessMailDeliveryService', {
            nodemailer: {
                createTransport: () => ({
                    sendMail: async () => ({
                        accepted: [],
                        rejected: ['learner@example.com'],
                        pending: [],
                        response: '550 5.1.1 Recipient rejected',
                        messageId: '<rejected@example.com>'
                    })
                })
            },
            '../mail/MailService': {
                isConfigured: () => true,
                providerConfig: () => ({
                    provider: 'smtp',
                    host: 'smtp.example.com',
                    port: 465,
                    secure: true,
                    user: 'training@example.com',
                    pass: 'secret',
                    fromName: 'LMSGEN',
                    fromAddress: 'training@example.com'
                }),
                verifyConnection: async () => ({ ok: true, configured: true, provider: 'smtp' })
            }
        });

        let error;
        try {
            await service.sendContent({
                to: 'learner@example.com',
                subject: 'Test',
                html: '<p>Test</p>',
                text: 'Test'
            });
        } catch (caught) {
            error = caught;
        }
        expect(error).to.exist;
        expect(error.code).to.equal('SMTP_RECIPIENT_NOT_ACCEPTED');
        expect(error.providerResponse).to.include('550');
    });

});
