/**
 * AI author: policy/PDF/PPT -> SCORM 1.2 package into host library.
 * Behind SCORM_LMS + SCORM_AI_AUTHOR flags.
 */
const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const { featureFlags, scormMaxUploadMb } = require('../../config/featureFlags');
const { analyzePolicy } = require('../../services/scorm/PolicyAnalysisService');
const { buildScormPackageZip } = require('../../services/scorm/ScormTrackingPackageFinalizer');
const { getTheme, listThemes, normalizeThemeId } = require('../../services/scorm/ScormThemeCatalog');
const { ScormPackage } = require('../../models/scorm');
const { getObjectStorage } = require('../../storage/ObjectStorage');
const { packageZipKey } = require('../../services/scorm/storageKeys');
const { unpackPackage } = require('../../services/scorm/ScormUnpackService');
const logger = require('../../utils/logger');

router.use((req, res, next) => {
    if (!featureFlags.scormAiAuthor) {
        return res.status(403).json({
            message: 'AI author is disabled. Set SCORM_AI_AUTHOR=true and GEMINI_API_KEY on the server.'
        });
    }
    next();
});

router.get('/themes', auth, (_req, res) => {
    res.json({
        ok: true,
        version: 5,
        themes: listThemes().map((theme) => ({
            id: theme.id,
            slug: theme.slug,
            name: theme.name,
            description: theme.description,
            primary: theme.primary,
            primaryDark: theme.primaryDark,
            accent: theme.accent,
            bg: theme.bg,
            bg2: theme.bg2,
            surface: theme.surface,
            visualBg: theme.visualBg,
            visualBg2: theme.visualBg2
        }))
    });
});

router.post('/analyze', auth, async (req, res) => {
    try {
        const { fileBase64, mimeType, detailLevel, titleHint, templateId, themeId } = req.body || {};
        if (!fileBase64) return res.status(400).json({ message: 'fileBase64 required' });
        const raw = String(fileBase64).replace(/^data:[^;]+;base64,/, '');
        const approxBytes = Math.floor((raw.length * 3) / 4);
        const max = scormMaxUploadMb() * 1024 * 1024;
        if (approxBytes > max) return res.status(413).json({ message: `Max upload ${scormMaxUploadMb()} MB` });

        const selectedThemeId = normalizeThemeId(themeId || templateId || 1);
        const selectedTheme = getTheme(selectedThemeId);
        const analysis = await analyzePolicy({
            fileBase64: raw,
            mimeType: mimeType || 'application/pdf',
            detailLevel: detailLevel || 'detailed'
        });
        if (titleHint && !analysis.title) analysis.title = titleHint;
        analysis.themeId = selectedThemeId;
        analysis.themeName = selectedTheme.name;
        analysis.experienceVersion = 5;
        res.json({ ok: true, analysis, templateId: selectedThemeId, theme: { id: selectedThemeId, name: selectedTheme.name, slug: selectedTheme.slug } });
    } catch (err) {
        logger.error('scorm_ai_analyze_failed', { module: 'scorm', error: err.message, code: err.code });
        const status = err.code === 'GEMINI_KEY_MISSING' ? 503 : 500;
        res.status(status).json({ message: err.message, code: err.code || 'AI_ERROR' });
    }
});

router.post('/generate', auth, async (req, res) => {
    try {
        let analysis = req.body?.analysis;
        const { fileBase64, mimeType, detailLevel, templateId, themeId, logoDataUrl, title } = req.body || {};
        const selectedThemeId = normalizeThemeId(themeId || templateId || analysis?.themeId || 1);
        const selectedTheme = getTheme(selectedThemeId);

        if (!analysis) {
            if (!fileBase64) return res.status(400).json({ message: 'analysis or fileBase64 required' });
            const raw = String(fileBase64).replace(/^data:[^;]+;base64,/, '');
            analysis = await analyzePolicy({ fileBase64: raw, mimeType: mimeType || 'application/pdf', detailLevel: detailLevel || 'detailed' });
        }
        analysis = {
            ...(analysis || {}),
            themeId: selectedThemeId,
            themeName: selectedTheme.name,
            experienceVersion: 5
        };
        if (title) analysis.title = title;

        const zipBuf = await buildScormPackageZip(analysis, {
            templateId: selectedThemeId,
            logoDataUrl: logoDataUrl || null
        });
        const replaceId = req.body?.replacePackageId || req.body?.packageId || null;
        let pkg = null;
        if (replaceId) {
            pkg = await ScormPackage.findOne({ where: { id: replaceId, hostId: req.userId } });
            if (!pkg || pkg.status === 'deleted') return res.status(404).json({ message: 'Package to replace not found' });
        }
        if (!pkg) {
            pkg = await ScormPackage.create({
                hostId: req.userId,
                title: String(analysis.title || 'AI Course').slice(0, 200),
                status: 'processing',
                source: 'ai_author',
                standard: 'scorm_1_2',
                byteSize: zipBuf.length,
                templateId: selectedThemeId,
                analysisJson: JSON.stringify(analysis)
            });
        } else {
            pkg.title = String(analysis.title || pkg.title || 'AI Course').slice(0, 200);
            pkg.status = 'processing';
            pkg.source = 'ai_author';
            pkg.standard = 'scorm_1_2';
            pkg.byteSize = zipBuf.length;
            pkg.templateId = selectedThemeId;
            pkg.analysisJson = JSON.stringify(analysis);
            pkg.errorMessage = null;
            await pkg.save();
        }

        const storage = getObjectStorage();
        const zipKey = packageZipKey(pkg.id);
        await storage.putObject({ key: zipKey, body: zipBuf, contentType: 'application/zip' });
        pkg.storageKeyZip = zipKey;
        await pkg.save();
        try {
            await unpackPackage(pkg.id);
        } catch (e) {
            logger.error('scorm_ai_unpack_failed', { module: 'scorm', packageId: pkg.id, error: e.message });
        }
        await pkg.reload();
        res.status(201).json({
            ok: true,
            packageId: pkg.id,
            status: pkg.status,
            entryHref: pkg.entryHref,
            standard: pkg.standard,
            title: pkg.title,
            templateId: selectedThemeId,
            theme: { id: selectedThemeId, name: selectedTheme.name, slug: selectedTheme.slug },
            errorMessage: pkg.errorMessage
        });
    } catch (err) {
        logger.error('scorm_ai_generate_failed', { module: 'scorm', error: err.message, code: err.code });
        const status = err.code === 'GEMINI_KEY_MISSING' ? 503 : 500;
        res.status(status).json({ message: err.message, code: err.code || 'AI_ERROR' });
    }
});

module.exports = router;
