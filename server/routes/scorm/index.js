const express = require('express');
const router = express.Router();
const { featureFlags } = require('../../config/featureFlags');

router.use((req, res, next) => {
    if (!featureFlags.scormLms) {
        return res.status(404).json({ message: 'SCORM AI is not enabled' });
    }
    next();
});

// Public email verification endpoints. Rate limits and one-time hashing are
// enforced inside the router; verification codes are never stored in plaintext.
router.use('/otp', require('./mailOtp'));

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
router.use('/session', require('./session'));
router.use('/runtime', require('./runtime'));
router.use('/content', require('./content'));
router.use('/play', require('./play'));
router.use('/xapi', require('./xapi'));
// Rebuild interception must run before the normal author route so edits reuse
// the existing packaged visuals instead of calling image generation again.
router.use('/author', require('./authorRebuild'));
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

module.exports = router;
