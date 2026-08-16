const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const { fallbackSpec } = require('../../services/scorm/ScormSvgScenePlanner');
const { renderSmartSvg, paletteFromAnalysis } = require('../../services/scorm/ScormSmartSvgRenderer');

router.post('/render', auth, (req, res) => {
    try {
        const body = req.body || {};
        const slide = body.slide && typeof body.slide === 'object' ? body.slide : {};
        const analysis = body.analysis && typeof body.analysis === 'object' ? body.analysis : {};
        const mobile = String(body.device || '').toLowerCase() === 'mobile';
        const index = Number.isInteger(Number(body.index)) ? Number(body.index) : 0;
        const spec = fallbackSpec(slide, index);
        const svg = renderSmartSvg(spec, slide, {
            mobile,
            palette: paletteFromAnalysis(analysis)
        });

        res.json({
            ok: true,
            engine: 'smart-svg-preview',
            device: mobile ? 'mobile' : 'desktop',
            sceneSpec: spec,
            svg
        });
    } catch (err) {
        res.status(500).json({
            message: err.message || 'Unable to render Smart SVG preview',
            code: 'SMART_SVG_PREVIEW_FAILED'
        });
    }
});

module.exports = router;
