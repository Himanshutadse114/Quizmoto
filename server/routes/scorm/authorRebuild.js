const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const { featureFlags } = require('../../config/featureFlags');
const { planExperienceV5 } = require('../../services/scorm/ScormExperiencePlanner');
const { ensureQuizIntegrity } = require('../../services/scorm/ScormQuizQualityService');
const { buildScormPackageZip } = require('../../services/scorm/ScormReplicateMediaFinalizer');
const { getTheme, normalizeThemeId } = require('../../services/scorm/ScormThemeCatalog');
const { ScormPackage } = require('../../models/scorm');
const { ensureCourseForPackage } = require('../../services/scorm/ScormCourseWorkspaceService');
const { getObjectStorage } = require('../../storage/ObjectStorage');
const { packageZipKey } = require('../../services/scorm/storageKeys');
const { unpackPackage } = require('../../services/scorm/ScormUnpackService');
const { reuseExistingCourseMedia } = require('../../services/scorm/ScormCourseMediaReuseService');
const {
    cleanId: cleanProgressId,
    setProgress,
    failProgress
} = require('../../services/scorm/ScormGenerationProgress');
const logger = require('../../utils/logger');

function reporter(progressId, userId) {
    const id = cleanProgressId(progressId);
    if (!id) return () => {};
    return (patch = {}) => setProgress(id, userId, {
        task: 'generate',
        status: 'running',
        ...patch
    });
}

function errorStatus(code) {
    if (code === 'SCORM_REBUILD_MEDIA_MISSING') return 409;
    if (code === 'SCORM_QUIZ_INCOMPLETE') return 422;
    return 500;
}

function stripV7CourseFormatMetadata(rawAnalysis) {
    const analysis = rawAnalysis && typeof rawAnalysis === 'object' ? rawAnalysis : {};
    const {
        experienceProfile,
        interactionEngineVersion,
        preferredTemplateId,
        interactionTemplateHints,
        ...legacyAnalysis
    } = analysis;

    return {
        ...legacyAnalysis,
        slides: (Array.isArray(analysis.slides) ? analysis.slides : []).map((slide) => {
            if (!slide || typeof slide !== 'object') return slide;

            const cleanedSlide = { ...slide };
            if (cleanedSlide.interaction && typeof cleanedSlide.interaction === 'object') {
                const interaction = { ...cleanedSlide.interaction };
                delete interaction.templateId;
                cleanedSlide.interaction = interaction;
            }

            return cleanedSlide;
        })
    };
}

// Intercepts only editor rebuilds. New-course generation falls through to the
// normal author route, where visuals are created once. Rebuilds never call any
// image-generation service: existing packaged visuals are copied into the new ZIP.
router.post('/generate', auth, async (req, res, next) => {
    const replaceId = req.body?.replacePackageId || req.body?.packageId || null;
    if (!replaceId) return next();

    if (!featureFlags.scormAiAuthor) {
        return res.status(403).json({ message: 'Course authoring is disabled.' });
    }

    const progressId = cleanProgressId(req.body?.progressId);
    const report = reporter(progressId, req.userId);

    if (progressId) {
        setProgress(progressId, req.userId, {
            task: 'generate',
            status: 'running',
            percent: 2,
            stage: 'Preparing course update',
            detail: 'Applying your text and knowledge-check changes while preserving the existing visuals.'
        });
    }

    try {
        let analysis = req.body?.analysis;
        if (!analysis || typeof analysis !== 'object') {
            return res.status(400).json({ message: 'Edited course content is required.' });
        }

        const pkg = await ScormPackage.findOne({
            where: { id: replaceId, hostId: req.userId }
        });
        if (!pkg || pkg.status === 'deleted') {
            return res.status(404).json({ message: 'Package to rebuild not found.' });
        }

        const selectedThemeId = normalizeThemeId(
            req.body?.themeId || req.body?.templateId || analysis?.themeId || pkg.templateId || 1
        );
        const selectedTheme = getTheme(selectedThemeId);

        report({
            percent: 5,
            stage: 'Checking edited course content',
            detail: 'Validating slide structure and knowledge checks before rebuilding.'
        });

        // Courses authored while the V7 template experiment was live may have
        // persisted profile/template metadata in their saved analysis. Rebuilds
        // must discard those V7-only selectors before the legacy V5 planner runs,
        // otherwise the newer slide format can survive even after the code rollback.
        analysis = stripV7CourseFormatMetadata(analysis);
        analysis = planExperienceV5(analysis);
        analysis = ensureQuizIntegrity(analysis);
        analysis = {
            ...(analysis || {}),
            themeId: selectedThemeId,
            themeName: selectedTheme.name,
            experienceVersion: 5
        };
        if (req.body?.title) analysis.title = req.body.title;

        const storage = getObjectStorage();
        const media = await reuseExistingCourseMedia({
            pkg,
            analysis,
            storage,
            onProgress: report
        });
        analysis = media.analysis;

        report({
            percent: 78,
            stage: 'Rebuilding course package',
            detail: 'Combining your updated content with the existing course visuals.'
        });

        const zipBuf = await buildScormPackageZip(analysis, {
            templateId: selectedThemeId,
            logoDataUrl: req.body?.logoDataUrl || null,
            replicateMediaFiles: media.files
        });

        report({
            percent: 86,
            stage: 'Saving course update',
            detail: 'Replacing the existing package with the updated course.'
        });

        pkg.title = String(analysis.title || pkg.title || 'Course').slice(0, 200);
        pkg.status = 'processing';
        pkg.source = 'ai_author';
        pkg.standard = 'scorm_1_2';
        pkg.byteSize = zipBuf.length;
        pkg.templateId = selectedThemeId;
        pkg.analysisJson = JSON.stringify(analysis);
        pkg.errorMessage = null;
        await pkg.save();

        const zipKey = packageZipKey(pkg.id);
        await storage.putObject({ key: zipKey, body: zipBuf, contentType: 'application/zip' });
        pkg.storageKeyZip = zipKey;
        await pkg.save();

        report({
            percent: 93,
            stage: 'Preparing learner files',
            detail: 'Refreshing the course files for preview and learner launch.'
        });

        try {
            await unpackPackage(pkg.id);
        } catch (err) {
            logger.error('scorm_rebuild_unpack_failed', {
                module: 'scorm',
                packageId: pkg.id,
                error: err.message
            });
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

        if (progressId) {
            setProgress(progressId, req.userId, {
                task: 'generate',
                status: 'complete',
                percent: 100,
                stage: 'Course updated',
                detail: 'Your edits are saved and the existing visuals were preserved.'
            });
        }

        return res.status(201).json({
            ok: true,
            packageId: pkg.id,
            courseId: course?.id || null,
            workspaceReady: Boolean(course),
            status: pkg.status,
            entryHref: pkg.entryHref,
            standard: pkg.standard,
            title: pkg.title,
            templateId: selectedThemeId,
            theme: {
                id: selectedThemeId,
                name: selectedTheme.name,
                slug: selectedTheme.slug
            },
            media: media.metadata || {
                reusedOnRebuild: true,
                totalImagesGenerated: 0,
                estimatedImageCostUsd: 0
            },
            visualsRegenerated: false,
            errorMessage: pkg.errorMessage
        });
    } catch (err) {
        if (progressId) failProgress(progressId, req.userId, err);
        logger.error('scorm_course_rebuild_failed', {
            module: 'scorm',
            packageId: replaceId,
            error: err.message,
            code: err.code || null
        });
        return res.status(errorStatus(err.code)).json({
            message: err.message || 'Course rebuild failed.',
            code: err.code || 'SCORM_REBUILD_ERROR'
        });
    }
});

module.exports = router;
