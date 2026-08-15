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

async function joinInvite(req, res) {
    try {
        const { inviteCode, learnerName, learnerEmail } = req.body || {};
        if (!inviteCode) return res.status(400).json({ message: 'inviteCode required' });
        if (!String(learnerName || '').trim()) {
            return res.status(400).json({ message: 'learnerName required' });
        }

        const result = await acceptInvite({
            inviteCode: String(inviteCode).trim(),
            learnerName: String(learnerName).trim(),
            learnerEmail: learnerEmail ? String(learnerEmail).trim() : null
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
            // Backwards-compatible alias for older learner clients.
            playToken: result.token,
            playerPath: `/scorm/player/${registrationId}`,
            playUrl: `/api/scorm/play/${registrationId}`
        });
    } catch (err) {
        const code = err.code === 'NOT_FOUND'
            ? 404
            : ['PACKAGE_NOT_READY', 'PACKAGE_LAUNCH_MISSING'].includes(err.code)
                ? 409
                : 500;
        console.error('[scorm-invite] join failed', {
            inviteCode: req.body?.inviteCode || null,
            error: err?.message || String(err),
            code: err?.code || null,
            dbCode: err?.original?.code || err?.parent?.code || null
        });
        res.status(code).json({ message: err.message, code: err.code });
    }
}

// /accept is canonical. /join remains as a compatibility alias because older
// deployed learner bundles used that URL.
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

// Permanently remove a learner registration and every SCORM record owned by it.
// This is intentionally different from revoke: revoke preserves audit evidence;
// delete removes the learner from tracking/reports for this course.
router.delete('/:id', auth, async (req, res) => {
    try {
        const registrationId = String(req.params.id || '').trim();
        const reg = await ScormRegistration.findByPk(registrationId, {
            include: [{ model: ScormCourse, as: 'course' }]
        });
        if (!reg || !reg.course || reg.course.hostId !== req.userId || reg.isPreview) {
            return res.status(404).json({ message: 'Learner registration not found' });
        }

        // The V2 learning-state table is created lazily and is not represented by
        // a Sequelize model, so ensure it exists before entering the transaction.
        await LearningState.ensureReady();

        await sequelize.transaction(async (transaction) => {
            await sequelize.query(
                'DELETE FROM scorm_learning_state_v2 WHERE registration_id = :registrationId',
                { replacements: { registrationId }, transaction }
            );
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