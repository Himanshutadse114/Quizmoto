const express = require('express');
const router = express.Router();
const { featureFlags } = require('../../config/featureFlags');
const { injectRuntimeRepair } = require('../../services/scorm/ScormRuntimeRepair');
const { injectCourseUiPolish } = require('../../services/scorm/ScormCourseUiPolish');
const { startCampaignPerformanceIndexEnsure } = require('../../services/scorm/ScormCampaignPerformanceIndexService');

// The SCORM router is required only after the database connection and additive
// schema migration are ready. Create missing campaign performance indexes in the
// background without delaying HTTP startup or the first Campaigns request.
startCampaignPerformanceIndexEnsure();

function repairServedScormHtml(req, res, next) {
    const originalSend = res.send.bind(res);
    res.send = function repairedSend(body) {
        try {
            const contentType = String(res.getHeader('Content-Type') || '').toLowerCase();
            const isHtml = contentType.includes('text/html');
            if (isHtml && (typeof body === 'string' || Buffer.isBuffer(body))) {
                const source = Buffer.isBuffer(body) ? body.toString('utf8') : body;
                // Only LMSGEN/Quizmoto packages use this generated wrapper. Do not
                // rewrite arbitrary third-party HTML that happens to be served by
                // the content router.
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
            console.warn('[scorm-content] runtime repair skipped', {
                path: req.originalUrl,
                error: err?.message || String(err)
            });
        }
        return originalSend(body);
    };
    next();
}

router.use((req, res, next) => {
    if (!featureFlags.scormLms) {
        return res.status(404).json({ message: 'SCORM AI is not enabled' });
    }
    next();
});

// Public email verification endpoints. Rate limits and one-time hashing are
// enforced inside the router; verification codes are never stored in plaintext.
router.use('/otp', require('./mailOtp'));

// SMTP connection and delivery test endpoints are protected by the normal SCORM
// Admin middleware and never expose mailbox credentials.
router.use('/mail', require('./mailAdmin'));

// Workspace-specific staff sign-in is public by design. Each provider endpoint
// verifies the IdP token and then requires an existing Admin/Co-admin/Analytics
// Viewer workspace membership before a protected SCORM session is issued.
router.use('/staff-auth', require('./staffAuthPublic'));

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
router.use('/branding', require('./branding'));
router.use('/session', require('./session'));
router.use('/runtime', require('./runtime'));
router.use('/content', repairServedScormHtml, require('./content'));
router.use('/play', require('./play'));
router.use('/xapi', require('./xapi'));
// Rebuild interception must run before the normal author route so edits reuse
// the existing packaged visuals instead of calling image generation again.
router.use('/author', require('./authorRebuild'));
// New AI course generation requests are accepted immediately and run in an
// isolated child process. This keeps Gemini/FAL/ZIP work off the web request
// process so dashboard, campaign and tracking APIs remain responsive.
router.use('/author', require('./authorAsync'));
router.use('/author', require('./author'));
router.use('/team', require('./team'));
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
