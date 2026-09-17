const express = require('express');
const auth = require('./middleware');
const {
    getAccountProfile,
    updateAccountProfile
} = require('../services/AccountProfileService');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
    try {
        const profile = await getAccountProfile(req.authenticatedUserId || req.userId);
        res.json({ profile });
    } catch (err) {
        res.status(err.status || 500).json({
            message: err.message || 'Could not load account settings.',
            code: err.code
        });
    }
});

router.patch('/', async (req, res) => {
    try {
        const profile = await updateAccountProfile({
            userId: req.authenticatedUserId || req.userId,
            displayName: req.body?.displayName,
            avatar: req.body?.avatar,
            publicaLibraryName: req.body?.publicaLibraryName
        });
        res.json({ ok: true, profile });
    } catch (err) {
        res.status(err.status || 500).json({
            message: err.message || 'Could not save account settings.',
            code: err.code
        });
    }
});

module.exports = router;
