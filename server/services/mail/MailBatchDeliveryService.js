const logger = require('../../utils/logger');

const DEFAULT_BATCH_COUNT = 5;
const DEFAULT_DELAY_SECONDS = 60;
const MIN_DELAY_SECONDS = 15;
const MAX_DELAY_SECONDS = 3600;
const MAX_BATCH_COUNT = 50;

function integerInRange(value, fallback, minimum, maximum) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(maximum, Math.max(minimum, parsed));
}

function deliveryPlan(recipientCount, input = {}) {
    const recipients = Math.max(0, Number.parseInt(recipientCount, 10) || 0);
    const requestedBatchCount = integerInRange(
        input.batchCount ?? input.mailBatchCount,
        DEFAULT_BATCH_COUNT,
        1,
        MAX_BATCH_COUNT
    );
    const batchCount = recipients > 0 ? Math.min(requestedBatchCount, recipients) : requestedBatchCount;
    const delaySeconds = integerInRange(
        input.delaySeconds ?? input.mailBatchDelaySeconds,
        DEFAULT_DELAY_SECONDS,
        MIN_DELAY_SECONDS,
        MAX_DELAY_SECONDS
    );
    const batchSize = recipients > 0 ? Math.ceil(recipients / batchCount) : 0;

    return {
        recipientCount: recipients,
        batchCount,
        batchSize,
        delaySeconds,
        estimatedDurationSeconds: batchCount > 1 ? (batchCount - 1) * delaySeconds : 0
    };
}

function sleep(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function sendInBatches(items, sender, input = {}, options = {}) {
    const recipients = Array.isArray(items) ? items : [];
    const plan = deliveryPlan(recipients.length, input);
    const wait = options.sleepFn || sleep;
    const messageGapMs = integerInRange(
        options.messageGapMs ?? process.env.MAIL_MESSAGE_GAP_MS,
        350,
        0,
        5000
    );
    const results = [];

    delivery:
    for (let batchIndex = 0; batchIndex < plan.batchCount; batchIndex += 1) {
        const start = batchIndex * plan.batchSize;
        const batch = recipients.slice(start, start + plan.batchSize);
        if (!batch.length) break;

        for (let itemIndex = 0; itemIndex < batch.length; itemIndex += 1) {
            if (options.shouldContinue && !(await options.shouldContinue({ batchIndex, itemIndex, plan }))) {
                logger.warn('mail_batch_delivery_cancelled', {
                    module: 'mail',
                    batchIndex: batchIndex + 1,
                    itemIndex: itemIndex + 1,
                    batchCount: plan.batchCount,
                    context: options.context
                });
                break delivery;
            }

            try {
                results.push(await sender(batch[itemIndex], {
                    batchIndex,
                    itemIndex,
                    plan
                }));
            } catch (error) {
                results.push({ sent: false, reason: error.code || error.message || 'MAIL_SEND_FAILED' });
                logger.error('mail_batch_message_failed', {
                    module: 'mail',
                    error: error.message,
                    batchIndex: batchIndex + 1,
                    batchCount: plan.batchCount,
                    context: options.context
                });
            }
            if (messageGapMs > 0 && itemIndex < batch.length - 1) await wait(messageGapMs);
        }

        if (batchIndex < plan.batchCount - 1) await wait(plan.delaySeconds * 1000);
    }

    return { plan, results };
}

function runInBackground(task, context = {}) {
    setImmediate(() => {
        Promise.resolve()
            .then(task)
            .catch((error) => logger.error('mail_batch_delivery_failed', {
                module: 'mail',
                error: error.message,
                code: error.code,
                ...context
            }));
    });
}

module.exports = {
    DEFAULT_BATCH_COUNT,
    DEFAULT_DELAY_SECONDS,
    MIN_DELAY_SECONDS,
    MAX_DELAY_SECONDS,
    MAX_BATCH_COUNT,
    deliveryPlan,
    sendInBatches,
    runInBackground
};
