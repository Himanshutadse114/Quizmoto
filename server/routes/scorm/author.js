/**
 * AI author: policy/PDF/PPT → SCORM 1.2 package into host library.
 * Behind SCORM_LMS + SCORM_AI_AUTHOR flags.
 */
const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const { featureFlags, scormMaxUploadMb } = require('../../config/featureFlags');
const { analyzePolicy } = require('../../services/scorm/PolicyAnalysisService');
const { buildScormPackageZip } = require('../../services/scorm/ScormVisualPackageBuilder');
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

/** Analyze only — returns PolicyAnalysis JSON for preview/edit. */
router.post('/analyze', auth, async (req, res) => {
    try {
        const { fileBase64, mimeType, detailLevel, titleHint } = req.body || {};
        if (!fileBase64) return res.status(400).json({ message: 'fileBase64 required' });

        const raw = String(fileBase64).replace(/^data:[^;]+;base64,/, '');
        const approxBytes = Math.floor((raw.length * 3) / 4);
        const max = scormMaxUploadMb() * 1024 * 1024;
        if (approxBytes > max) {
            return res.status(413).json({ message: `Max upload ${scormMaxUploadMb()} MB` });
        }

        const analysis = await analyzePolicy({
            fileBase64: raw,
            mimeType: mimeType || 'application/pdf',
            detailLevel: detailLevel || 'detailed'
        });

        if (titleHint && !analysis.title) analysis.title = titleHint;

        res.json({ ok: true, analysis });
    } catch (err) {
        logger.error('scorm_ai_analyze_failed', { module: 'scorm', error: err.message, code: err.code });
        const status = err.code === 'GEMINI_KEY_MISSING' ? 503 : 500;
        res.status(status).json({ message: err.message, code: err.code || 'AI_ERROR' });
    }
});

/** Build SCORM ZIP from analysis (or analyze+build) and store in package library. */
router.post('/generate', auth, async (req, res) => {
    try {
        let analysis = req.body?.analysis;
        const { fileBase64, mimeType, detailLevel, templateId, logoDataUrl, title } = req.body || {};

        if (!analysis) {
            if (!fileBase64) {
                return res.status(400).json({ message: 'analysis or fileBase64 required' });
            }
            const raw = String(fileBase64).replace(/^data:[^;]+;base64,/, '');
            analysis = await analyzePolicy({
                fileBase64: raw,
                mimeType: mimeType || 'application/pdf',
                detailLevel: detailLevel || 'detailed'
            });
        }

        if (title) analysis.title = title;

        const zipBuf = await buildScormPackageZip(analysis, {
            templateId: Number(templateId) || 1,
            logoDataUrl: logoDataUrl || null
        });

        const replaceId = req.body?.replacePackageId || req.body?.packageId || null;
        let pkg = null;
        if (replaceId) {
            pkg = await ScormPackage.findOne({ where: { id: replaceId, hostId: req.userId } });
            if (!pkg || pkg.status === 'deleted') {
                return res.status(404).json({ message: 'Package to replace not found' });
            }
        }

        if (!pkg) {
            pkg = await ScormPackage.create({
                hostId: req.userId,
                title: String(analysis.title || 'AI Course').slice(0, 200),
                status: 'processing',
                source: 'ai_author',
                standard: 'scorm_1_2',
                byteSize: zipBuf.length,
                templateId: Number(templateId) || 1,
                analysisJson: JSON.stringify(analysis)
            });
        } else {
            pkg.title = String(analysis.title || pkg.title || 'AI Course').slice(0, 200);
            pkg.status = 'processing';
            pkg.source = 'ai_author';
            pkg.standard = 'scorm_1_2';
            pkg.byteSize = zipBuf.length;
            pkg.templateId = Number(templateId) || pkg.templateId || 1;
            pkg.analysisJson = JSON.stringify(analysis);
            pkg.errorMessage = null;
            await pkg.save();
        }

        const storage = getObjectStorage();
        const zipKey = packageZipKey(pkg.id);
        await storage.putObject({
            key: zipKey,
            body: zipBuf,
            contentType: 'application/zip'
        });
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
            errorMessage: pkg.errorMessage
        });
    } catch (err) {
        logger.error('scorm_ai_generate_failed', { module: 'scorm', error: err.message, code: err.code });
        const status = err.code === 'GEMINI_KEY_MISSING' ? 503 : 500;
        res.status(status).json({ message: err.message, code: err.code || 'AI_ERROR' });
    }
});

module.exports = router;
