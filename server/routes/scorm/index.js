const express = require('express');
const router = express.Router();
const { featureFlags } = require('../../config/featureFlags');
const { injectRuntimeRepair } = require('../../services/scorm/ScormRuntimeRepair');
const { injectCourseUiPolish } = require('../../services/scorm/ScormCourseUiPolish');
const { startCampaignPerformanceIndexEnsure } = require('../../services/scorm/ScormCampaignPerformanceIndexService');

startCampaignPerformanceIndexEnsure();

function repairServedScormHtml(req, res, next) {
    const originalSend = res.send.bind(res);
    res.send = function repairedSend(body) {
        try {
            const contentType = String(res.getHeader('Content-Type') || '').toLowerCase();
            const isHtml = contentType.includes('text/html');
            if (isHtml && (typeof body === 'string' || Buffer.isBuffer(body))) {
                const source = Buffer.isBuffer(body) ? body.toString('utf8') : body;
                if (/scorm_api_wrapper\.js|\bdoLMSInitialize\b|quizmoto[-_]scorm/i.test(source)) {
                    const patched = injectCourseUiPolish(injectRuntimeRepair(source));
                    if (patched !== source) {
                        body = Buffer.isBuffer(body) ? Buffer.from(patched, 'utf8') : patched;
                        res.setHeader('Cache-Control', 'private, no-store');
                        res.removeHeader('Content-Length');
                    }
                }
            }
        } catch (err) {
            console.warn('[scorm-content] runtime repair skipped', { path: req.originalUrl, error: err?.message || String(err) });
        }
        return originalSend(body);
    };
    next();
}

router.use((req, res, next) => {
    if (!featureFlags.scormLms) return res.status(404).json({ message: 'SCORM AI is not enabled' });
    next();
});

router.use('/otp', require('./mailOtp'));
router.use('/mail', require('./mailAdmin'));
router.use('/staff-auth', require('./staffAuthPublic'));
router.use('/flipbook-tenants', require('./flipbookTenants'));

// Assignment tracking must run before general public Flipbook analytics so an
// opaque campaign assignment token can bind the reader session to its learner,
// campaign and optional course without changing the mature Flipbook reader.
router.use('/flipbooks', require('../flipbookAssignmentTracking'));
router.use('/flipbooks', require('../flipbookAnalytics'));
router.use('/flipbooks', require('../flipbookLibrary'));
router.use('/flipbooks', require('../flipbooks'));

router.use('/packages', require('./packages'));
router.use('/courses', require('./courses'));
router.use('/tracking', require('./tracking'));
router.use('/preview', require('./preview'));
router.use('/slide-preview', require('./slidePreview'));
router.use('/registrations', require('./registrations'));
router.use('/roster', require('./roster'));
router.use('/assignments', require('./assignments'));
router.use('/campaigns', require('./campaigns'));
router.use('/learner-access', require('./authConfig'));
router.use('/session', require('./session'));
router.use('/runtime', require('./runtime'));
router.use('/content', repairServedScormHtml, require('./content'));
router.use('/play', require('./play'));
router.use('/xapi', require('./xapi'));
router.use('/author', require('./authorTemplates'));
router.use('/author', require('./authorRebuild'));
router.use('/author', require('./authorAsync'));
router.use('/author', require('./author'));
router.use('/team', require('./team'));
router.use('/platform-users', require('./platformUsers'));
router.use('/access', require('./access'));

router.get('/features', (req, res) => {
    res.json({
        scormLms: featureFlags.scormLms,
        scormAiAuthor: featureFlags.scormAiAuthor,
        scormPublicInvites: featureFlags.scormPublicInvites,
        learnerDashboard: true,
        workspaceRbac: true,
        workspaceSso: true,
        staffSso: true,
        campaignDelivery: true,
        emailDelivery: true,
        emailOtp: true,
        emailHealthCheck: true,
        flipbooks: true,
        flipbookAssignments: true,
        tenantFlipbookManagement: true,
        standards: {
            scorm12: true,
            scorm2004: true,
            xapi: true,
            sequencing2004: false,
            fullLrs: false
        },
        policyToScorm: true
    });
});

router.repairServedScormHtml = repairServedScormHtml;
module.exports = router;
