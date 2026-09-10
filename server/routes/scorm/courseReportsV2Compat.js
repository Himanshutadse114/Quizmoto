const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const {
    generateCourseReportFile,
    safeUnlink
} = require('../../services/scorm/LmsgenCourseReportCompatService');

// Compatibility route for the existing Reports UI. Keep the public URL stable,
// but generate the file with the current LMSGEN report schema and renderer.
// This deliberately fails closed: it never falls back to the legacy Quizmoto
// PDF generator if the LMSGEN renderer cannot run.
router.get('/:id/report', auth, async (req, res) => {
    let generated = null;
    try {
        const format = String(req.query.format || 'pdf').toLowerCase();
        generated = await generateCourseReportFile({
            courseId: req.params.id,
            hostId: req.userId,
            workspaceId: req.scormWorkspaceId || null,
            format
        });

        res.download(generated.outputPath, generated.downloadName, (err) => {
            safeUnlink(generated?.outputPath);
            if (err && !res.headersSent) {
                res.status(500).json({ message: 'LMSGEN report download failed.' });
            }
        });
    } catch (err) {
        safeUnlink(generated?.outputPath);
        console.error('[lmsgen-course-report] export failed', {
            courseId: req.params.id,
            hostId: req.userId,
            message: err?.message,
            code: err?.code
        });
        res.status(err.status || 500).json({
            message: err.message || 'Could not generate this LMSGEN course report.',
            code: err.code || 'LMSGEN_COURSE_REPORT_FAILED'
        });
    }
});

module.exports = router;
