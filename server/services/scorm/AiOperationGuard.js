const crypto = require('crypto');
const { reserveAiOperation, finalizeAiOperation } = require('./ScormAiUsageService');

async function runMeteredAiOperation(req, { kind, source }, operation) {
    const hostId = req.userId;
    const operationKey = `${kind}:${hostId}:${crypto.randomUUID()}`;
    await reserveAiOperation({
        hostId,
        entitlementEmail: req.scormEntitlementEmail || req.authenticatedUser?.email || null,
        operationKey,
        kind,
        source
    });
    try {
        const result = await operation();
        await finalizeAiOperation(operationKey, 'completed');
        return result;
    } catch (error) {
        await finalizeAiOperation(operationKey, 'failed').catch(() => {});
        throw error;
    }
}

module.exports = { runMeteredAiOperation };
