const express = require('express');
const auth = require('../middleware');
const AvatarExportPurchase = require('../../models/scorm/AvatarExportPurchase');
const {
    avatarExportBuyerId,
    complimentaryAvatarExportSource
} = require('../../services/scorm/AvatarStudioAccessService');
const {
    AVATAR_EXPORT_AMOUNT,
    AVATAR_EXPORT_CURRENCY,
    configuredCredentials,
    createAvatarExportOrder,
    fetchPayment,
    verifyCheckoutSignature,
    assertCapturedPayment
} = require('../../services/payments/RazorpayAvatarExportService');

const router = express.Router();
const FINGERPRINT = /^[a-f0-9]{64}$/;

router.use(auth);
router.use((req, res, next) => {
    if (req.authScope !== 'scorm') {
        return res.status(401).json({ message: 'LMSGEN platform login required.' });
    }
    return next();
});

router.get('/entitlement', async (req, res) => {
    const fingerprint = String(req.query.fingerprint || '').toLowerCase();
    if (!FINGERPRINT.test(fingerprint)) {
        return res.status(400).json({ message: 'A valid avatar fingerprint is required.' });
    }
    const complimentarySource = await complimentaryAvatarExportSource(req);
    if (complimentarySource) {
        return res.json({ purchased: true, complimentary: true, source: complimentarySource });
    }
    const purchase = await AvatarExportPurchase.findOne({
        where: { userId: avatarExportBuyerId(req), avatarFingerprint: fingerprint, status: 'paid' }
    });
    return res.json({
        purchased: Boolean(purchase),
        complimentary: false,
        source: purchase ? 'purchase' : null
    });
});

router.post('/orders', async (req, res, next) => {
    try {
        const fingerprint = String(req.body?.fingerprint || '').toLowerCase();
        const avatarName = String(req.body?.avatarName || '').trim().slice(0, 120);
        if (!FINGERPRINT.test(fingerprint) || !avatarName) {
            return res.status(400).json({ message: 'Avatar name and fingerprint are required.' });
        }

        const complimentarySource = await complimentaryAvatarExportSource(req);
        if (complimentarySource) {
            return res.json({ purchased: true, complimentary: true, source: complimentarySource });
        }
        const buyerId = avatarExportBuyerId(req);
        const paid = await AvatarExportPurchase.findOne({
            where: { userId: buyerId, avatarFingerprint: fingerprint, status: 'paid' }
        });
        if (paid) return res.json({ purchased: true, complimentary: false, source: 'purchase' });

        const { keyId } = configuredCredentials();
        const order = await createAvatarExportOrder({
            userId: buyerId,
            avatarName,
            fingerprint
        });
        const purchase = await AvatarExportPurchase.create({
            userId: buyerId,
            avatarFingerprint: fingerprint,
            avatarName,
            razorpayOrderId: order.id,
            amount: AVATAR_EXPORT_AMOUNT,
            currency: AVATAR_EXPORT_CURRENCY,
            status: 'created'
        });

        return res.status(201).json({
            purchased: false,
            purchaseId: purchase.id,
            keyId,
            orderId: order.id,
            amount: AVATAR_EXPORT_AMOUNT,
            currency: AVATAR_EXPORT_CURRENCY
        });
    } catch (error) {
        return next(error);
    }
});

router.post('/verify', async (req, res, next) => {
    try {
        const orderId = String(req.body?.orderId || '').trim();
        const paymentId = String(req.body?.paymentId || '').trim();
        const signature = String(req.body?.signature || '').trim();
        if (!orderId || !paymentId || !signature) {
            return res.status(400).json({ message: 'Complete payment verification details are required.' });
        }

        const purchase = await AvatarExportPurchase.findOne({
            where: { userId: avatarExportBuyerId(req), razorpayOrderId: orderId }
        });
        if (!purchase) return res.status(404).json({ message: 'Avatar export order was not found.' });
        if (purchase.status === 'paid') return res.json({ purchased: true });

        const { keySecret } = configuredCredentials();
        if (!verifyCheckoutSignature({ orderId, paymentId, signature, secret: keySecret })) {
            return res.status(400).json({ message: 'Payment signature verification failed.' });
        }

        purchase.razorpayPaymentId = paymentId;
        const payment = await fetchPayment(paymentId);
        assertCapturedPayment(payment, purchase);
        purchase.status = 'paid';
        purchase.paidAt = new Date();
        await purchase.save();

        return res.json({ purchased: true });
    } catch (error) {
        return next(error);
    }
});

router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = Number(error?.status) || 500;
    console.error('[avatar-studio-payments]', {
        code: error?.code || 'UNEXPECTED_PAYMENT_ERROR',
        message: error?.message || 'Unknown payment error',
        path: req.originalUrl,
        status
    });
    return res.status(status).json({
        message: error?.expose === true || status < 500
            ? error.message
            : 'Avatar export payment is temporarily unavailable.'
    });
});

module.exports = router;
