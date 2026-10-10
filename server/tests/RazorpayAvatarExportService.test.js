const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
    AVATAR_EXPORT_AMOUNT,
    configuredCredentials,
    verifyCheckoutSignature,
    assertCapturedPayment
} = require('../services/payments/RazorpayAvatarExportService');

describe('Razorpay avatar export payments', () => {
    it('charges exactly ₹100 in paise', () => {
        assert.equal(AVATAR_EXPORT_AMOUNT, 10_000);
    });

    it('normalizes credentials copied into Render with wrapping quotes', () => {
        const previousKeyId = process.env.RAZORPAY_KEY_ID;
        const previousKeySecret = process.env.RAZORPAY_KEY_SECRET;
        try {
            process.env.RAZORPAY_KEY_ID = '"rzp_live_example"';
            process.env.RAZORPAY_KEY_SECRET = "'secret_example'";
            assert.deepEqual(configuredCredentials(), {
                keyId: 'rzp_live_example',
                keySecret: 'secret_example'
            });
        } finally {
            if (previousKeyId === undefined) delete process.env.RAZORPAY_KEY_ID;
            else process.env.RAZORPAY_KEY_ID = previousKeyId;
            if (previousKeySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
            else process.env.RAZORPAY_KEY_SECRET = previousKeySecret;
        }
    });

    it('verifies the signed checkout response', () => {
        const orderId = 'order_test';
        const paymentId = 'pay_test';
        const secret = 'test_secret';
        const signature = crypto
            .createHmac('sha256', secret)
            .update(`${orderId}|${paymentId}`)
            .digest('hex');

        assert.equal(verifyCheckoutSignature({ orderId, paymentId, signature, secret }), true);
        assert.equal(verifyCheckoutSignature({ orderId, paymentId, signature: `${signature}0`, secret }), false);
    });

    it('accepts only the captured fixed-price INR payment for the stored order', () => {
        const purchase = { razorpayOrderId: 'order_test', razorpayPaymentId: 'pay_test' };
        assert.equal(assertCapturedPayment({
            id: 'pay_test',
            order_id: 'order_test',
            amount: AVATAR_EXPORT_AMOUNT,
            currency: 'INR',
            captured: true,
            status: 'captured'
        }, purchase), true);

        assert.throws(() => assertCapturedPayment({
            id: 'pay_test',
            order_id: 'order_test',
            amount: 100,
            currency: 'INR',
            captured: true,
            status: 'captured'
        }, purchase), /has not been captured/);
    });
});
