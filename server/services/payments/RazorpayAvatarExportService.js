const crypto = require('crypto');

const AVATAR_EXPORT_AMOUNT = 10_000;
const AVATAR_EXPORT_CURRENCY = 'INR';
const RAZORPAY_API = 'https://api.razorpay.com/v1';

function configuredCredentials() {
    const keyId = String(process.env.RAZORPAY_KEY_ID || '').trim();
    const keySecret = String(process.env.RAZORPAY_KEY_SECRET || '').trim();
    if (!keyId || !keySecret) {
        const error = new Error('Avatar export payments are not configured.');
        error.status = 503;
        throw error;
    }
    return { keyId, keySecret };
}

async function razorpayRequest(path, init = {}) {
    const { keyId, keySecret } = configuredCredentials();
    const response = await fetch(`${RAZORPAY_API}${path}`, {
        ...init,
        headers: {
            Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
            'Content-Type': 'application/json',
            ...init.headers
        }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(payload?.error?.description || 'Payment provider request failed.');
        error.status = 502;
        throw error;
    }
    return payload;
}

async function createAvatarExportOrder({ userId, avatarName, fingerprint }) {
    const receipt = `avatar_${userId}_${Date.now().toString(36)}`.slice(0, 40);
    return razorpayRequest('/orders', {
        method: 'POST',
        body: JSON.stringify({
            amount: AVATAR_EXPORT_AMOUNT,
            currency: AVATAR_EXPORT_CURRENCY,
            receipt,
            notes: {
                product: 'lmsgen-avatar-export',
                userId: String(userId),
                avatarName: String(avatarName).slice(0, 120),
                fingerprint
            }
        })
    });
}

const fetchPayment = (paymentId) => razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`);

function verifyCheckoutSignature({ orderId, paymentId, signature, secret }) {
    const expected = crypto
        .createHmac('sha256', secret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
    const supplied = Buffer.from(String(signature || ''), 'utf8');
    const trusted = Buffer.from(expected, 'utf8');
    return supplied.length === trusted.length && crypto.timingSafeEqual(supplied, trusted);
}

function assertCapturedPayment(payment, purchase) {
    const valid = payment
        && payment.id === purchase.razorpayPaymentId
        && payment.order_id === purchase.razorpayOrderId
        && Number(payment.amount) === AVATAR_EXPORT_AMOUNT
        && payment.currency === AVATAR_EXPORT_CURRENCY
        && (payment.captured === true || payment.status === 'captured');
    if (!valid) {
        const error = new Error('The payment has not been captured for this avatar export.');
        error.status = 409;
        throw error;
    }
    return true;
}

module.exports = {
    AVATAR_EXPORT_AMOUNT,
    AVATAR_EXPORT_CURRENCY,
    configuredCredentials,
    createAvatarExportOrder,
    fetchPayment,
    verifyCheckoutSignature,
    assertCapturedPayment
};
