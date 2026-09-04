const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const { featureFlags } = require('../../config/featureFlags');
const { planExperienceV5 } = require('../../services/scorm/ScormExperiencePlanner');
const { ensureQuizIntegrity } = require('../../services/scorm/ScormQuizQualityService');
const { buildScormPackageZip } = require('../../services/scorm/ScormReplicateMediaFinalizer');
const { getTheme, normalizeThemeId } = require('../../services/scorm/ScormThemeCatalog');
const {
    applyTemplateBinding,
    assertRequestedTemplateMatchesBinding,
    publicTemplateBinding,
    resolveExistingCourseTemplateBinding
} = require('../../services/scorm/ScormTemplateBindingService');
const { validateTemplateAnalysis } = require('../../services/scorm/ScormTemplateValidator');
const {
    hasPlannedSlideDesign,
    preserveCourseDesign
} = require('../../services/scorm/ScormRebuildDesignPreserver');
const { applyTemplateRuntimeToZip } = require('../../services/scorm/ScormTemplateRuntime');
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
    if (code === 'SCORM_REBUILD_MEDIA_MISSING' || code === 'SCORM_TEMPLATE_LOCKED') return 409;
    if (code === 'SCORM_QUIZ_INCOMPLETE' || code === 'SCORM_TEMPLATE_SCHEMA_INVALID') return 422;
    return 500;
}

function parseStoredAnalysis(pkg) {
    try {
        const parsed = JSON.parse(pkg?.analysisJson || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
        return {};
    }
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
// normal author route. A rebuild is deliberately design-preserving: it may edit
// learner content but it cannot silently switch the course template or redraw a
// slide using another layout family.
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
            detail: 'Applying your text and knowledge-check changes while preserving the existing course design.'
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

        const storedAnalysis = parseStoredAnalysis(pkg);
        const binding = resolveExistingCourseTemplateBinding({ analysis: storedAnalysis, pkg });
        assertRequestedTemplateMatchesBinding(req.body || {}, binding);

        // Theme remains a legacy visual setting. Rebuilds take it from the saved
        // package rather than trusting a new request, so even the legacy styling
        // cannot drift during a normal edit-and-rebuild operation.
        const selectedThemeId = normalizeThemeId(storedAnalysis?.themeId || pkg.templateId || 1);
        const selectedTheme = getTheme(selectedThemeId);
        const templateEngineVersion = Number(storedAnalysis?.templateEngineVersion || 0);

        report({
            percent: 5,
            stage: 'Checking edited course content',
            detail: 'Validating content while keeping the saved template, slide layouts and interactions locked.'
        });

        if (templateEngineVersion >= 1) {
            // Versioned template courses preserve the exact design identity chosen
            // at creation. Content may change, but rebuild does not run the layout
            // planner again.
            analysis = preserveCourseDesign(analysis, storedAnalysis);
            analysis = applyTemplateBinding(analysis, binding);
            analysis = {
                ...analysis,
                templateEngineVersion,
                templatePlanner: storedAnalysis.templatePlanner || `${binding.templateId}@${binding.templateVersion}`
            };
        } else {
            // Legacy courses keep the behaviour they were created with. If their
            // saved analysis already contains planned layouts, preserve those
            // layouts rather than recalculating them on every text edit.
            analysis = stripV7CourseFormatMetadata(analysis);
            if (hasPlannedSlideDesign(storedAnalysis)) {
                analysis = preserveCourseDesign(analysis, storedAnalysis);
            } else {
                analysis = planExperienceV5(analysis);
            }
            analysis = applyTemplateBinding(analysis, binding);
            analysis.templateEngineVersion = 0;
        }

        analysis = ensureQuizIntegrity(analysis);
        analysis = {
            ...(analysis || {}),
            themeId: selectedThemeId,
            themeName: selectedTheme.name,
            experienceVersion: 5
        };
        if (templateEngineVersion >= 1) validateTemplateAnalysis(analysis, binding);
        if (req.body?.title) analysis.title = req.body.title;

        const storage = getObjectStorage();
        const media = await reuseExistingCourseMedia({
            pkg,
            analysis,
            storage,
            onProgress: report
        });
        analysis = media.analysis;
        if (templateEngineVersion >= 1) validateTemplateAnalysis(analysis, binding);

        report({
            percent: 78,
            stage: 'Rebuilding course package',
            detail: 'Combining the updated content with the saved template, layouts and existing visuals.'
        });

        let zipBuf = await buildScormPackageZip(analysis, {
            templateId: selectedThemeId,
            logoDataUrl: req.body?.logoDataUrl || null,
            replicateMediaFiles: media.files
        });
        if (templateEngineVersion >= 1) {
            zipBuf = await applyTemplateRuntimeToZip(zipBuf, analysis);
        }

        report({
            percent: 86,
            stage: 'Saving course update',
            detail: 'Replacing the existing package without changing its course template.'
        });

        pkg.title = String(analysis.title || pkg.title || 'Course').slice(0, 200);
        pkg.status = 'processing';
        pkg.source = 'ai_author';
        pkg.standard = 'scorm_1_2';
        pkg.byteSize = zipBuf.length;
        // Retain legacy numeric theme id for backwards compatibility. The real
        // course template binding is stored in analysisJson.templateBinding.
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
                detail: 'Your edits are saved and the original template, layouts and visuals were preserved.'
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
            courseTemplate: publicTemplateBinding(binding),
            media: media.metadata || {
                reusedOnRebuild: true,
                totalImagesGenerated: 0,
                estimatedImageCostUsd: 0
            },
            visualsRegenerated: false,
            designPreserved: true,
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
            code: err.code || 'SCORM_REBUILD_ERROR',
            ...(Array.isArray(err.details) ? { details: err.details } : {})
        });
    }
});

module.exports = router;
