const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const {
    ScormCourse,
    ScormPackage,
    ScormRegistration,
    ScormCmiState,
    ScormRuntimeSnapshot
} = require('../../models/scorm');
const { serializePreviewStats } = require('../../services/scorm/ScormPreviewStatsService');
const LearningState = require('../../services/scorm/ScormLearningStateService');

router.get('/course/:courseId', auth, async (req, res) => {
    try {
        const course = await ScormCourse.findOne({
            where: { id: req.params.courseId, hostId: req.userId },
            include: [{
                model: ScormPackage,
                as: 'package',
                attributes: ['id', 'title', 'status', 'analysisJson', 'standard', 'source']
            }]
        });

        if (!course || course.status === 'archived') {
            return res.status(404).json({ message: 'Course not found' });
        }

        const registration = await ScormRegistration.findOne({
            where: { courseId: course.id, isPreview: true },
            include: [
                { model: ScormRuntimeSnapshot, as: 'runtimeSnapshot', required: false },
                { model: ScormCmiState, as: 'cmiState', required: false }
            ],
            order: [['updatedAt', 'DESC']]
        });

        res.set('Cache-Control', 'no-store');
        if (!registration) {
            return res.json({
                available: false,
                courseId: course.id,
                preview: null
            });
        }

        // The learner/player shell now persists to scorm_learning_state_v2. The
        // preview panel historically loaded only the legacy runtime tables, which
        // left completion/location/status stuck at their old values even though
        // the new POST /api/scorm/session saves were succeeding.
        const v2States = await LearningState.listByRegistrationIds([registration.id]);
        const learningStateV2 = v2States.get(String(registration.id)) || null;
        const previewRegistration = learningStateV2
            ? { ...registration.toJSON(), learningStateV2 }
            : registration;

        return res.json({
            available: true,
            courseId: course.id,
            preview: serializePreviewStats(previewRegistration, course)
        });
    } catch (err) {
        console.error('[scorm-preview-stats] load failed', err);
        return res.status(500).json({ message: err.message || 'Failed to load preview results' });
    }
});

module.exports = router;
