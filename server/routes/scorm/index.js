const express = require('express');
const router = express.Router();
const { featureFlags } = require('../../config/featureFlags');

router.use((req, res, next) => {
    if (!featureFlags.scormLms) {
        return res.status(404).json({ message: 'SCORM World is not enabled' });
    }
    next();
});

router.use('/packages', require('./packages'));
router.use('/courses', require('./courses'));
router.use('/registrations', require('./registrations'));
router.use('/runtime', require('./runtime'));
router.use('/content', require('./content'));
router.use('/play', require('./play'));
router.use('/xapi', require('./xapi'));
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
        }
    });
});

module.exports = router;
