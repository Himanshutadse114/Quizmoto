const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const { sequelize } = require('../../config/database');
const { acceptInvite } = require('../../services/scorm/ScormInviteService');
const LearningState = require('../../services/scorm/ScormLearningStateService');
const {
    ScormRegistration,
    ScormCourse,
    ScormAttempt,
    ScormCmiState,
    ScormRuntimeSnapshot,
    ScormXapiStatement
} = require('../../models/scorm');

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function isValidEmail(value) {
    const email = normalizeEmail(value);
    return email.length > 0 && email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function joinInvite(req, res) {
    try {
        const { inviteCode, learnerName, learnerEmail } = req.body || {};
        if (!inviteCode) return res.status(400).json({ message: 'inviteCode required' });
        if (!String(learnerName || '').trim()) {
            return res.status(400).json({ message: 'learnerName required' });
        }
        if (!String(learnerEmail || '').trim()) {
            return res.status(400).json({ message: 'learnerEmail required' });
        }
        if (!isValidEmail(learnerEmail)) {
            return res.status(400).json({ message: 'Enter a valid email address' });
        }

        const result = await acceptInvite({
            inviteCode: String(inviteCode).trim(),
            learnerName: String(learnerName).trim(),
            learnerEmail: normalizeEmail(learnerEmail)
        });
        const pkg = result.course.package;
        const registrationId = result.registration.id;
        const entryHref = pkg ? pkg.entryHref : null;

        res.status(201).json({
            registrationId,
            attemptNo: result.attemptNo || 1,
            course: {
                id: result.course.id,
                title: result.course.title,
                description: result.course.description
            },
            packageId: pkg ? pkg.id : null,
            entryHref,
            token: result.token,
            playToken: result.token,
            playerPath: `/scorm/player/${registrationId}`,
            playUrl: `/api/scorm/play/${registrationId}`
        });
    } catch (err) {
        const code = Number(err?.status) || (err.code === 'NOT_FOUND'
            ? 404
            : ['LEARNER_NOT_APPROVED', 'LEARNER_ROSTER_EMPTY', 'SCORM_LEARNER_LIMIT_REACHED'].includes(err.code)
                ? 403
                : ['PACKAGE_NOT_READY', 'PACKAGE_LAUNCH_MISSING'].includes(err.code)
                    ? 409
                    : ['EMAIL_REQUIRED', 'EMAIL_INVALID'].includes(err.code)
                        ? 400
                        : 500);
        console.error('[scorm-invite] join failed', {
            inviteCode: req.body?.inviteCode || null,
            error: err?.message || String(err),
            code: err?.code || null,
            dbCode: err?.original?.code || err?.parent?.code || null
        });
        res.status(code).json({ message: err.message, code: err.code });
    }
}

router.post('/accept', joinInvite);
router.post('/join', joinInvite);

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

router.delete('/:id', auth, async (req, res) => {
    try {
        const registrationId = String(req.params.id || '').trim();
        const reg = await ScormRegistration.findByPk(registrationId, {
            include: [{ model: ScormCourse, as: 'course' }]
        });
        if (!reg || !reg.course || reg.course.hostId !== req.userId || reg.isPreview) {
            return res.status(404).json({ message: 'Learner registration not found' });
        }

        await LearningState.ensureReady();

        await sequelize.transaction(async (transaction) => {
            await ScormXapiStatement.destroy({ where: { registrationId }, transaction });
            await ScormRuntimeSnapshot.destroy({ where: { registrationId }, transaction });
            await ScormCmiState.destroy({ where: { registrationId }, transaction });
            await ScormAttempt.destroy({ where: { registrationId }, transaction });
            await ScormRegistration.destroy({ where: { id: registrationId }, transaction });
        });

        res.json({
            ok: true,
            deletedRegistrationId: registrationId,
            learnerEmail: reg.learnerEmail || null
        });
    } catch (err) {
        console.error('[scorm-registration] delete failed', {
            registrationId: req.params.id,
            hostId: req.userId,
            error: err?.message || String(err),
            dbCode: err?.original?.code || err?.parent?.code || null
        });
        res.status(500).json({ message: 'Unable to delete learner registration' });
    }
});

module.exports = router;
