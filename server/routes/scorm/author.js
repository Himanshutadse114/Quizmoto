/**
 * AI author: source brief / policy / PDF / PPT -> SCORM 1.2 package.
 * AI provider keys remain server-side. Replicate is preferred when
 * REPLICATE_API_TOKEN is configured; Gemini remains available as fallback.
 */
const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const { featureFlags, scormMaxUploadMb } = require('../../config/featureFlags');
const { analyzePolicy } = require('../../services/scorm/CourseAiService');
const { prepareReplicateCourseMedia } = require('../../services/scorm/ReplicateCourseMediaService');
const { planExperienceV5 } = require('../../services/scorm/ScormExperiencePlanner');
const { buildScormPackageZip } = require('../../services/scorm/ScormReplicateMediaFinalizer');
const { getTheme, listThemes, normalizeThemeId } = require('../../services/scorm/ScormThemeCatalog');
const { ScormPackage } = require('../../models/scorm');
const { ensureCourseForPackage } = require('../../services/scorm/ScormCourseWorkspaceService');
const { getObjectStorage } = require('../../storage/ObjectStorage');
const { packageZipKey } = require('../../services/scorm/storageKeys');
const { unpackPackage } = require('../../services/scorm/ScormUnpackService');
const { generateQuiz } = require('../../services/QuizAiGenerationService');
const {
    cleanId: cleanProgressId,
    setProgress,
    getProgress,
    failProgress
} = require('../../services/scorm/ScormGenerationProgress');
const logger = require('../../utils/logger');

function aiErrorStatus(code) {
    if (code === 'QUIZ_AI_SOURCE_REQUIRED') return 400;
    if (code === 'QUIZ_AI_FILE_TOO_LARGE') return 413;
    if (code === 'GEMINI_KEY_MISSING' || code === 'REPLICATE_KEY_MISSING') return 503;
    if (code === 'GEMINI_QUOTA' || code === 'REPLICATE_RATE_LIMIT') return 429;
    if (code === 'REPLICATE_BILLING') return 402;
    if (code === 'REPLICATE_SOURCE_NEEDS_TEXT') return 422;
    return 500;
}

function reporter(progressId, userId, task) {
    const id = cleanProgressId(progressId);
    if (!id) return () => {};
    return (patch = {}) => setProgress(id, userId, { task, status: 'running', ...patch });
}

router.use((req, res, next) => {
    if (!featureFlags.scormAiAuthor) {
        return res.status(403).json({
            message: 'AI author is disabled. Set SCORM_AI_AUTHOR=true and configure REPLICATE_API_TOKEN or GEMINI_API_KEY on the server.'
        });
    }
    next();
});

router.get('/progress/:progressId', auth, (req, res) => {
    const progress = getProgress(req.params.progressId, req.userId);
    if (!progress) return res.status(404).json({ ok: false, message: 'Progress not found' });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, progress });
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
        logger.error('live_quiz_ai_generate_failed', { module: 'quiz', error: err.message, code });
        res.status(aiErrorStatus(code)).json({ message: err.message || 'AI failed to generate quiz. Please try again.', code });
    }
});

router.post('/analyze', auth, async (req, res) => {
    const progressId = cleanProgressId(req.body?.progressId);
    const report = reporter(progressId, req.userId, 'analyze');
    if (progressId) {
        setProgress(progressId, req.userId, {
            task: 'analyze',
            status: 'running',
            percent: 1,
            stage: 'Preparing course request',
            detail: 'Preparing your source material and learning requirements.'
        });
    }

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
            detailLevel: detailLevel || 'detailed',
            onProgress: report
        });
        report({ percent: 97, stage: 'Formatting learning content', detail: 'Applying the course layouts and learner interactions.' });
        analysis = planExperienceV5(analysis);
        if ((titleHint || cleanTopic) && !analysis.title) analysis.title = titleHint || cleanTopic;
        analysis.themeId = selectedThemeId;
        analysis.themeName = selectedTheme.name;
        analysis.experienceVersion = 5;
        if (progressId) {
            setProgress(progressId, req.userId, {
                task: 'analyze',
                status: 'complete',
                percent: 100,
                stage: 'Learning content ready',
                detail: 'The course draft is ready for review in the Content Editor.',
                modelStatus: 'succeeded'
            });
        }
        res.json({
            ok: true,
            analysis,
            aiProvider: analysis.aiProvider || 'gemini',
            aiModel: analysis.aiModel || null,
            templateId: selectedThemeId,
            theme: { id: selectedThemeId, name: selectedTheme.name, slug: selectedTheme.slug }
        });
    } catch (err) {
        if (progressId) failProgress(progressId, req.userId, err);
        logger.error('scorm_ai_analyze_failed', { module: 'scorm', error: err.message, code: err.code });
        res.status(aiErrorStatus(err.code)).json({ message: err.message, code: err.code || 'AI_ERROR' });
    }
});

router.post('/generate', auth, async (req, res) => {
    const progressId = cleanProgressId(req.body?.progressId);
    const report = reporter(progressId, req.userId, 'generate');
    if (progressId) {
        setProgress(progressId, req.userId, {
            task: 'generate',
            status: 'running',
            percent: 2,
            stage: 'Preparing final course',
            detail: 'Preparing the reviewed learning content for image generation and SCORM packaging.'
        });
    }

    try {
        let analysis = req.body?.analysis;
        const { fileBase64, mimeType, detailLevel, templateId, themeId, logoDataUrl, title, topic, description } = req.body || {};
        const selectedThemeId = normalizeThemeId(themeId || templateId || analysis?.themeId || 1);
        const selectedTheme = getTheme(selectedThemeId);

        if (!analysis) {
            const cleanTopic = String(topic || '').trim();
            const cleanDescription = String(description || '').trim();
            const brief = [
                cleanTopic ? `Topic: ${cleanTopic}` : '',
                cleanDescription ? `Description and learning context:\n${cleanDescription}` : ''
            ].filter(Boolean).join('\n\n');
            if (!fileBase64 && !brief) return res.status(400).json({ message: 'analysis, source document, or topic/description required' });
            const raw = fileBase64
                ? String(fileBase64).replace(/^data:[^;]+;base64,/, '')
                : Buffer.from(brief, 'utf8').toString('base64');
            analysis = await analyzePolicy({
                fileBase64: raw,
                mimeType: fileBase64 ? (mimeType || 'application/pdf') : 'text/plain',
                detailLevel: detailLevel || 'detailed',
                onProgress: report
            });
        }

        report({ percent: 5, stage: 'Formatting course structure', detail: 'Applying the final learner layouts before creating images.' });
        analysis = planExperienceV5(analysis);
        analysis = {
            ...(analysis || {}),
            themeId: selectedThemeId,
            themeName: selectedTheme.name,
            experienceVersion: 5
        };
        if (title) analysis.title = title;

        // Only raster imagery is generated externally. Audio/TTS is intentionally
        // disabled so generated courses remain visual, lightweight and low-cost.
        const media = await prepareReplicateCourseMedia(analysis, { onProgress: report });
        analysis = media.analysis;

        report({ percent: 80, stage: 'Building the SCORM package', detail: 'Combining course content, images, interactions and tracking into the learner package.' });
        const zipBuf = await buildScormPackageZip(analysis, {
            templateId: selectedThemeId,
            logoDataUrl: logoDataUrl || null,
            replicateMediaFiles: media.files
        });
        const replaceId = req.body?.replacePackageId || req.body?.packageId || null;
        let pkg = null;
        if (replaceId) {
            pkg = await ScormPackage.findOne({ where: { id: replaceId, hostId: req.userId } });
            if (!pkg || pkg.status === 'deleted') return res.status(404).json({ message: 'Package to replace not found' });
        }

        report({ percent: 86, stage: 'Saving generated course', detail: 'Saving the SCORM package and course metadata.' });
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

        report({ percent: 92, stage: 'Preparing learner files', detail: 'Unpacking the generated SCORM so it can be previewed and launched.' });
        try {
            await unpackPackage(pkg.id);
        } catch (e) {
            logger.error('scorm_ai_unpack_failed', { module: 'scorm', packageId: pkg.id, error: e.message });
        }
        await pkg.reload();

        let course = null;
        if (pkg.status === 'ready') {
            report({ percent: 97, stage: 'Finalising course workspace', detail: 'Connecting the generated package to the course workspace.' });
            course = await ensureCourseForPackage({
                packageId: pkg.id,
                hostId: req.userId,
                title: pkg.title
            });
        }

        if (progressId) {
            setProgress(progressId, req.userId, {
                task: 'generate',
                status: 'complete',
                percent: 100,
                stage: 'Course ready',
                detail: 'The generated SCORM course is ready to open.',
                modelStatus: 'succeeded'
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
            media: media.metadata || null,
            errorMessage: pkg.errorMessage
        });
    } catch (err) {
        if (progressId) failProgress(progressId, req.userId, err);
        logger.error('scorm_ai_generate_failed', { module: 'scorm', error: err.message, code: err.code });
        res.status(aiErrorStatus(err.code)).json({ message: err.message, code: err.code || 'AI_ERROR' });
    }
});

module.exports = router;
