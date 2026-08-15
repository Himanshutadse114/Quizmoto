/**
 * AI author: source brief / policy / PDF / PPT -> SCORM 1.2 package.
 * Gemini API keys remain server-side.
 */
const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const { featureFlags, scormMaxUploadMb } = require('../../config/featureFlags');
const { analyzePolicy } = require('../../services/scorm/PolicyAnalysisService');
const { planExperienceV5 } = require('../../services/scorm/ScormExperiencePlanner');
const { buildScormPackageZip } = require('../../services/scorm/ScormAnswerTrackingPackageFinalizer');
const { getTheme, listThemes, normalizeThemeId } = require('../../services/scorm/ScormThemeCatalog');
const { ScormPackage } = require('../../models/scorm');
const { ensureCourseForPackage } = require('../../services/scorm/ScormCourseWorkspaceService');
const { getObjectStorage } = require('../../storage/ObjectStorage');
const { packageZipKey } = require('../../services/scorm/storageKeys');
const { unpackPackage } = require('../../services/scorm/ScormUnpackService');
const { generateQuiz } = require('../../services/QuizAiGenerationService');
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

router.post('/quiz-generate', auth, async (req, res) => {
    try {
        const body = req.body || {};
        const quiz = await generateQuiz({
            topic: body.topic || body.prompt || '',
            description: body.description || '',
            fileBase64: body.fileBase64 || '',
            mimeType: body.mimeType || '',
            fileName: body.fileName || ''
        });
        res.json(quiz);
    } catch (err) {
        const code = err.code || 'QUIZ_AI_ERROR';
        const status = code === 'QUIZ_AI_SOURCE_REQUIRED'
            ? 400
            : code === 'QUIZ_AI_FILE_TOO_LARGE'
                ? 413
                : code === 'GEMINI_KEY_MISSING'
                    ? 503
                    : code === 'GEMINI_QUOTA'
                        ? 429
                        : 500;
        logger.error('live_quiz_ai_generate_failed', { module: 'quiz', error: err.message, code });
        res.status(status).json({ message: err.message || 'AI failed to generate quiz. Please try again.', code });
    }
});

router.post('/analyze', auth, async (req, res) => {
    try {
        const { fileBase64, mimeType, detailLevel, titleHint, templateId, themeId, topic, description } = req.body || {};
        const cleanTopic = String(topic || '').trim();
        const cleanDescription = String(description || '').trim();
        const brief = [
            cleanTopic ? `Topic: ${cleanTopic}` : '',
            cleanDescription ? `Description and learning context:\n${cleanDescription}` : ''
        ].filter(Boolean).join('\n\n');

        if (!fileBase64 && !brief) {
            return res.status(400).json({ message: 'Add a topic and description or upload a source document.' });
        }

        const sourceBase64 = fileBase64
            ? String(fileBase64).replace(/^data:[^;]+;base64,/, '')
            : Buffer.from(brief, 'utf8').toString('base64');
        const sourceMimeType = fileBase64 ? (mimeType || 'application/pdf') : 'text/plain';
        const approxBytes = Math.floor((sourceBase64.length * 3) / 4);
        const max = scormMaxUploadMb() * 1024 * 1024;
        if (approxBytes > max) return res.status(413).json({ message: `Max upload ${scormMaxUploadMb()} MB` });

        const selectedThemeId = normalizeThemeId(themeId || templateId || 1);
        const selectedTheme = getTheme(selectedThemeId);
        let analysis = await analyzePolicy({
            fileBase64: sourceBase64,
            mimeType: sourceMimeType,
            detailLevel: detailLevel || 'detailed'
        });
        analysis = planExperienceV5(analysis);
        if ((titleHint || cleanTopic) && !analysis.title) analysis.title = titleHint || cleanTopic;
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
        const { fileBase64, mimeType, detailLevel, templateId, themeId, logoDataUrl, title, topic, description } = req.body || {};
        const selectedThemeId = normalizeThemeId(themeId || templateId || analysis?.themeId || 1);
        const selectedTheme = getTheme(selectedThemeId);

        if (!analysis) {
            const cleanTopic = String(topic || '').trim();
            const cleanDescription = String(description || '').trim();
            const brief = [cleanTopic ? `Topic: ${cleanTopic}` : '', cleanDescription ? `Description and learning context:\n${cleanDescription}` : ''].filter(Boolean).join('\n\n');
            if (!fileBase64 && !brief) return res.status(400).json({ message: 'analysis, source document, or topic/description required' });
            const raw = fileBase64
                ? String(fileBase64).replace(/^data:[^;]+;base64,/, '')
                : Buffer.from(brief, 'utf8').toString('base64');
            analysis = await analyzePolicy({ fileBase64: raw, mimeType: fileBase64 ? (mimeType || 'application/pdf') : 'text/plain', detailLevel: detailLevel || 'detailed' });
        }
        analysis = planExperienceV5(analysis);
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

        let course = null;
        if (pkg.status === 'ready') {
            course = await ensureCourseForPackage({
                packageId: pkg.id,
                hostId: req.userId,
                title: pkg.title
            });
        }

        res.status(201).json({
            ok: true,
            packageId: pkg.id,
            courseId: course?.id || null,
            workspaceReady: Boolean(course),
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