const express = require('express');
const router = express.Router();
const { featureFlags } = require('../../config/featureFlags');

router.use((req, res, next) => {
    if (!featureFlags.scormLms) {
        return res.status(404).json({ message: 'SCORM AI is not enabled' });
    }
    next();
});

router.use('/packages', require('./packages'));
router.use('/courses', require('./courses'));
router.use('/tracking', require('./tracking'));
router.use('/preview', require('./preview'));
router.use('/registrations', require('./registrations'));
router.use('/session', require('./session'));
router.use('/runtime', require('./runtime'));
router.use('/content', require('./content'));
router.use('/play', require('./play'));
router.use('/xapi', require('./xapi'));
router.use('/author', require('./author'));
router.use('/access', require('./access'));

router.get('/features', (req, res) => {
    res.json({
        scormLms: featureFlags.scormLms,
        scormAiAuthor: featureFlags.scormAiAuthor,
        scormPublicInvites: featureFlags.scormPublicInvites,
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