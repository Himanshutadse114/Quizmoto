const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const { acceptInvite } = require('../../services/scorm/ScormInviteService');
const { ScormRegistration, ScormCourse } = require('../../models/scorm');

router.post('/accept', async (req, res) => {
    try {
        const { inviteCode, learnerName, learnerEmail } = req.body || {};
        if (!inviteCode) return res.status(400).json({ message: 'inviteCode required' });
        const result = await acceptInvite({
            inviteCode,
            learnerName,
            learnerEmail
        });
        const pkg = result.course.package;
        res.status(201).json({
            registrationId: result.registration.id,
            course: {
                id: result.course.id,
                title: result.course.title,
                description: result.course.description
            },
            packageId: pkg ? pkg.id : null,
            entryHref: pkg ? pkg.entryHref : null,
            token: result.token
        });
    } catch (err) {
        const code = err.code === 'NOT_FOUND' ? 404 : err.code === 'PACKAGE_NOT_READY' ? 409 : 500;
        res.status(code).json({ message: err.message, code: err.code });
    }
});

router.post('/:id/revoke', auth, async (req, res) => {
    try {
        const reg = await ScormRegistration.findByPk(req.params.id, {
            include: [{ model: ScormCourse, as: 'course' }]
        });
        if (!reg || !reg.course || reg.course.hostId !== req.userId) {
            return res.status(404).json({ message: 'Not found' });
        }
        reg.status = 'revoked';
        await reg.save();
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
