const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const {
    ScormCourse,
    ScormPackage,
    ScormRegistration,
    ScormCmiState
} = require('../../models/scorm');
const { serializePreviewStats } = require('../../services/scorm/ScormPreviewStatsService');

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
            include: [{ model: ScormCmiState, as: 'cmiState', required: false }],
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

        return res.json({
            available: true,
            courseId: course.id,
            preview: serializePreviewStats(registration, course)
        });
    } catch (err) {
        console.error('[scorm-preview-stats] load failed', err);
        return res.status(500).json({ message: err.message || 'Failed to load preview results' });
    }
});

module.exports = router;
