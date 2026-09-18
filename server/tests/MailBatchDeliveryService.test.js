const { expect } = require('chai');
const {
    deliveryPlan,
    sendInBatches
} = require('../services/mail/MailBatchDeliveryService');

describe('MailBatchDeliveryService', function () {
    it('divides recipients into the requested number of controlled batches', async function () {
        const sent = [];
        const waits = [];
        const outcome = await sendInBatches(
            ['a', 'b', 'c', 'd', 'e'],
            async (item, meta) => {
                sent.push({ item, batch: meta.batchIndex });
                return { sent: true };
            },
            { batchCount: 2, delaySeconds: 30 },
            {
                messageGapMs: 0,
                sleepFn: async (milliseconds) => waits.push(milliseconds)
            }
        );

        expect(outcome.plan).to.include({ recipientCount: 5, batchCount: 2, batchSize: 3, delaySeconds: 30 });
        expect(sent).to.deep.equal([
            { item: 'a', batch: 0 },
            { item: 'b', batch: 0 },
            { item: 'c', batch: 0 },
            { item: 'd', batch: 1 },
            { item: 'e', batch: 1 }
        ]);
        expect(waits).to.deep.equal([30000]);
    });

    it('uses safe defaults and caps invalid administrator values', function () {
        expect(deliveryPlan(100, {})).to.include({ batchCount: 5, batchSize: 20, delaySeconds: 60 });
        expect(deliveryPlan(3, { batchCount: 999, delaySeconds: 1 })).to.include({
            batchCount: 3,
            batchSize: 1,
            delaySeconds: 15
        });
    });

    it('checks whether delivery should continue before every recipient', async function () {
        const sent = [];
        let checks = 0;
        const outcome = await sendInBatches(
            [1, 2, 3, 4],
            async (item) => {
                sent.push(item);
                return { sent: true };
            },
            { batchCount: 2, delaySeconds: 15 },
            {
                messageGapMs: 0,
                sleepFn: async () => {},
                shouldContinue: async () => {
                    checks += 1;
                    return checks <= 2;
                }
            }
        );

        expect(sent).to.deep.equal([1, 2]);
        expect(outcome.results).to.have.length(2);
        expect(checks).to.equal(3);
    });
});
