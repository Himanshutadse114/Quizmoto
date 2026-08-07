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
router.get('/features', (req, res) => {
    res.json({
        scormLms: featureFlags.scormLms,
        scormAiAuthor: featureFlags.scormAiAuthor,
        scormPublicInvites: featureFlags.scormPublicInvites
    });
});

module.exports = router;
