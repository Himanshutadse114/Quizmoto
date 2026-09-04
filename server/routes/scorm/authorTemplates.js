const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const { listCourseTemplates } = require('../../services/scorm/ScormTemplateCatalog');

router.get('/templates', auth, (_req, res) => {
    res.setHeader('Cache-Control', 'private, max-age=60');
    return res.json({
        ok: true,
        templateEngineVersion: 1,
        templates: listCourseTemplates()
    });
});

module.exports = router;
