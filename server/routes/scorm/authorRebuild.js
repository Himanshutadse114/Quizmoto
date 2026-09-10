const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const { featureFlags } = require('../../config/featureFlags');
const { planExperienceV5 } = require('../../services/scorm/ScormExperiencePlanner');
const { planExperienceForTemplate } = require('../../services/scorm/ScormTemplateExperiencePlanner');
const { planScenarioGraph } = require('../../services/scorm/ScormScenarioGraphPlanner');
const { ensureQuizIntegrity } = require('../../services/scorm/ScormQuizQualityService');
const { buildScormPackageZip } = require('../../services/scorm/ScormReplicateMediaFinalizer');
const { getTheme, normalizeThemeId } = require('../../services/scorm/ScormThemeCatalog');
const {
    applyTemplateBinding,
    assertRequestedTemplateMatchesBinding,
    publicTemplateBinding
} = require('../../services/scorm/ScormTemplateBindingService');
const { resolveRebuildTemplateBinding } = require('../../services/scorm/ScormTemplateRebuildMigration');
const { validateTemplateAnalysis } = require('../../services/scorm/ScormTemplateValidator');
const {
    hasPlannedSlideDesign,
    preserveCourseDesign
} = require('../../services/scorm/ScormRebuildDesignPreserver');
const { applyTemplateRuntimeToZip } = require('../../services/scorm/ScormTemplateRuntime');
const { applyVisualProductRuntimeToZip } = require('../../services/scorm/ScormVisualProductRuntime');
const { applyScenarioLearningRuntimeToZip } = require('../../services/scorm/ScormScenarioLearningRuntime');
const { applyScenarioBranchingRuntimeToZip } = require('../../services/scorm/ScormScenarioBranchingRuntime');
const { applyCourseChromeRuntimeToZip } = require('../../services/scorm/ScormCourseChromeRuntime');
const { applyScenarioDecisionUxRuntimeToZip } = require('../../services/scorm/ScormScenarioDecisionUxRuntime');
const { ScormPackage, ScormCourse } = require('../../models/scorm');
const { ensureCourseForPackage } = require('../../services/scorm/ScormCourseWorkspaceService');
const { getObjectStorage } = require('../../storage/ObjectStorage');
const { packageZipKey } = require('../../services/scorm/storageKeys');
const { unpackPackage } = require('../../services/scorm/ScormUnpackService');
const { reuseExistingCourseMedia } = require('../../services/scorm/ScormCourseMediaReuseService');
const {
    normaliseCourseBranding,
    publicBranding,
    applyCourseBrandingToZip
} = require('../../services/scorm/ScormCourseBrandingService');
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
    if (code === 'SCORM_BRANDING_LOGO_TOO_LARGE' || code === 'SCORM_BRANDING_LOGO_INVALID') return 422;
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

function courseSettings(course) {
    const settings = course?.settings;
    return settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};
}

function resolveRebuildBranding({ requestBody, editedAnalysis, storedAnalysis, course }) {
    const settings = courseSettings(course);
    const candidates = [
        requestBody?.branding,
        editedAnalysis?.branding,
        storedAnalysis?.branding,
        settings.branding,
        requestBody?.logoDataUrl || requestBody?.primaryColor || requestBody?.accentColor || requestBody?.secondaryColor
            ? {
                logoDataUrl: requestBody?.logoDataUrl || '',
                primaryColor: requestBody?.primaryColor,
                accentColor: requestBody?.accentColor || requestBody?.secondaryColor
            }
            : null
    ];
    const selected = candidates.find((value) => value && typeof value === 'object');
    return selected ? normaliseCourseBranding(selected) : null;
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

function upgradeProgressCopy(migration) {
    if (migration?.upgradeKind === 'visual-product') {
        return {
            stage: 'Upgrading Visual Product Training',
            detail: 'Applying the new visual-first walkthrough layout while keeping the existing course media and navigation.',
            packageDetail: 'Combining the new visual walkthrough runtime with the existing images and current course menu.',
            savedDetail: `Visual Product Training was upgraded from ${migration.previousVersion} to ${migration.currentVersion}.`,
            completeDetail: 'Visual Product Training now uses the dedicated media-first walkthrough experience with callouts, guided steps and visual comparisons.'
        };
    }
    return {
        stage: 'Updating Clean & Professional layout',
        detail: 'Applying the restored classic flip-card course layout while keeping the existing course media and menu.',
        packageDetail: 'Combining the restored flip-card learner layout with the existing visuals and current course menu.',
        savedDetail: `Clean & Professional was upgraded from ${migration?.previousVersion} to ${migration?.currentVersion}.`,
        completeDetail: 'Clean & Professional now uses the restored flip-card learner experience with the current course menu.'
    };
}

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
            detail: 'Applying your text and knowledge-check changes while preserving reusable course assets.'
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
        const existingCourse = await ScormCourse.findOne({
            where: { packageId: pkg.id, hostId: req.userId },
            order: [['createdAt', 'ASC']]
        });
        const courseBranding = resolveRebuildBranding({
            requestBody: req.body || {},
            editedAnalysis: analysis,
            storedAnalysis,
            course: existingCourse
        });
        const brandingForAnalysis = courseBranding ? publicBranding(courseBranding) : null;

        const migration = resolveRebuildTemplateBinding({ analysis: storedAnalysis, pkg });
        const binding = migration.binding;
        const upgradeCopy = upgradeProgressCopy(migration);
        assertRequestedTemplateMatchesBinding(req.body || {}, binding);

        const selectedThemeId = normalizeThemeId(storedAnalysis?.themeId || pkg.templateId || 1);
        const selectedTheme = getTheme(selectedThemeId);
        let templateEngineVersion = Number(storedAnalysis?.templateEngineVersion || 0);

        report({
            percent: 5,
            stage: migration.templateUpgraded ? upgradeCopy.stage : 'Checking edited course content',
            detail: migration.templateUpgraded
                ? upgradeCopy.detail
                : 'Validating content while keeping the saved template, slide layouts, branding and interactions locked.'
        });

        if (migration.templateUpgraded) {
            analysis = stripV7CourseFormatMetadata(analysis);
            analysis = planExperienceForTemplate(analysis, binding);
            templateEngineVersion = 1;
        } else if (templateEngineVersion >= 1) {
            analysis = preserveCourseDesign(analysis, storedAnalysis);
            analysis = applyTemplateBinding(analysis, binding);
            analysis = {
                ...analysis,
                templateEngineVersion,
                templatePlanner: storedAnalysis.templatePlanner || `${binding.templateId}@${binding.templateVersion}`
            };
        } else {
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
        if (binding?.templateId === 'scenario-learning') {
            analysis = planScenarioGraph(analysis, binding);
        }
        analysis = {
            ...(analysis || {}),
            themeId: selectedThemeId,
            themeName: selectedTheme.name,
            experienceVersion: 5,
            ...(brandingForAnalysis ? { branding: brandingForAnalysis } : {})
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
        analysis = {
            ...(media.analysis || analysis),
            ...(brandingForAnalysis ? { branding: brandingForAnalysis } : {})
        };
        if (binding?.templateId === 'scenario-learning') {
            analysis = planScenarioGraph(analysis, binding);
            if (brandingForAnalysis) analysis.branding = brandingForAnalysis;
        }
        if (templateEngineVersion >= 1) validateTemplateAnalysis(analysis, binding);

        report({
            percent: 78,
            stage: 'Rebuilding course package',
            detail: migration.templateUpgraded
                ? upgradeCopy.packageDetail
                : 'Combining the updated content with the saved template, branding, layouts and existing visuals.'
        });

        let zipBuf = await buildScormPackageZip(analysis, {
            templateId: selectedThemeId,
            logoDataUrl: courseBranding?.logoDataUrl || req.body?.logoDataUrl || null,
            replicateMediaFiles: media.files
        });
        if (templateEngineVersion >= 1) {
            zipBuf = await applyTemplateRuntimeToZip(zipBuf, analysis);
            zipBuf = await applyVisualProductRuntimeToZip(zipBuf, analysis);
            zipBuf = await applyScenarioLearningRuntimeToZip(zipBuf, analysis);
            zipBuf = await applyScenarioBranchingRuntimeToZip(zipBuf, analysis);
            zipBuf = await applyCourseChromeRuntimeToZip(zipBuf, analysis);
            zipBuf = await applyScenarioDecisionUxRuntimeToZip(zipBuf, analysis);
        }

        // Branding is deliberately the final presentation layer. This is not
        // conditional on templateEngineVersion so legacy courses and upgraded
        // templates keep exactly the same logo and colours after a rebuild.
        if (courseBranding) {
            const branded = await applyCourseBrandingToZip(zipBuf, courseBranding);
            zipBuf = branded.zipBuffer;
        }

        report({
            percent: 86,
            stage: 'Saving course update',
            detail: migration.templateUpgraded
                ? upgradeCopy.savedDetail
                : 'Replacing the existing package without changing its course template or branding.'
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

        let course = existingCourse;
        if (pkg.status === 'ready') {
            course = await ensureCourseForPackage({
                packageId: pkg.id,
                hostId: req.userId,
                title: pkg.title
            });
        }

        if (course && brandingForAnalysis) {
            const settings = courseSettings(course);
            course.settings = {
                ...settings,
                branding: brandingForAnalysis
            };
            await course.save();
        }

        if (progressId) {
            setProgress(progressId, req.userId, {
                task: 'generate',
                status: 'complete',
                percent: 100,
                stage: 'Course updated',
                detail: migration.templateUpgraded
                    ? upgradeCopy.completeDetail
                    : 'Your edits are saved and the original template, branding, layouts and visuals were preserved.'
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
            branding: brandingForAnalysis,
            courseTemplate: publicTemplateBinding(binding),
            templateUpgraded: migration.templateUpgraded,
            previousTemplateVersion: migration.previousVersion,
            media: media.metadata || {
                reusedOnRebuild: true,
                totalImagesGenerated: 0,
                estimatedImageCostUsd: 0
            },
            visualsRegenerated: false,
            designPreserved: !migration.templateUpgraded,
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
