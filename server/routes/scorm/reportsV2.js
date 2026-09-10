const express = require('express');
const fs = require('fs');
const router = express.Router();
const auth = require('../middleware');
const { REPORT_TYPES, buildReport, generateReportFile } = require('../../services/scorm/LmsgenReportService');

function reportContext(req) {
    return {
        hostId: req.userId,
        workspaceId: req.scormWorkspaceId || null,
        isSuperAdmin: req.scormRole === 'super_admin'
    };
}

router.get('/catalog', auth, async (req, res) => {
    const types = [
        { id: 'overview', label: 'Overview', description: 'Tenant-wide learning, campaigns and Flipbook performance.' },
        { id: 'courses', label: 'Courses', description: 'Course learner counts, completion and average scores.' },
        { id: 'learners', label: 'Learners', description: 'One consolidated record per learner across courses and Flipbooks.' },
        { id: 'campaigns', label: 'Campaigns', description: 'Campaign delivery with course and Flipbook completion.' },
        { id: 'flipbooks', label: 'Flipbooks', description: 'Reader reach, sessions, completion and active reading time.' },
        { id: 'assignments', label: 'Assignments', description: 'Course and Flipbook assignment evidence in one report.' }
    ];
    if (req.scormRole === 'super_admin') {
        types.push({ id: 'tenants', label: 'Tenants', description: 'Platform-wide tenant capacity, usage and Flipbook inventory.' });
    }
    res.json({ schemaVersion: 'lmsgen-report-v2', reportTypes: types });
});

router.get('/data', auth, async (req, res) => {
    try {
        const type = REPORT_TYPES.includes(String(req.query.type || '').toLowerCase()) ? String(req.query.type).toLowerCase() : 'overview';
        const report = await buildReport({ type, ...reportContext(req) });
        res.setHeader('Cache-Control', 'no-store');
        res.json(report);
    } catch (err) {
        console.error('[lmsgen-reports] data failed', err);
        res.status(err.status || 500).json({ message: err.message || 'Could not build this LMSGEN report.', code: err.code });
    }
});

router.get('/export', auth, async (req, res) => {
    let generated = null;
    try {
        const type = REPORT_TYPES.includes(String(req.query.type || '').toLowerCase()) ? String(req.query.type).toLowerCase() : 'overview';
        const format = String(req.query.format || 'pdf').toLowerCase();
        generated = await generateReportFile({ type, format, ...reportContext(req) });
        res.download(generated.outputPath, generated.downloadName, (err) => {
            try { if (generated?.outputPath && fs.existsSync(generated.outputPath)) fs.unlinkSync(generated.outputPath); } catch (_) {}
            if (err && !res.headersSent) res.status(500).json({ message: 'Report download failed.' });
        });
    } catch (err) {
        try { if (generated?.outputPath && fs.existsSync(generated.outputPath)) fs.unlinkSync(generated.outputPath); } catch (_) {}
        console.error('[lmsgen-reports] export failed', err);
        res.status(err.status || 500).json({ message: err.message || 'Could not generate this LMSGEN report.', code: err.code });
    }
});

module.exports = router;
