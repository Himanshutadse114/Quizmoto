const { analyzePolicy } = require('./CourseAiService');
const { prepareReplicateCourseMedia } = require('./ReplicateCourseMediaService');
const { planExperienceV5 } = require('./ScormExperiencePlanner');
const { planExperienceForTemplate } = require('./ScormTemplateExperiencePlanner');
const { ensureQuizIntegrity } = require('./ScormQuizQualityService');
const { buildScormPackageZip } = require('./ScormReplicateMediaFinalizer');
const { getTheme, normalizeThemeId } = require('./ScormThemeCatalog');
const {
    publicTemplateBinding,
    resolveNewCourseTemplateBinding
} = require('./ScormTemplateBindingService');
const { validateTemplateAnalysis } = require('./ScormTemplateValidator');
const { applyTemplateRuntimeToZip } = require('./ScormTemplateRuntime');
const { ScormPackage } = require('../../models/scorm');
const { ensureCourseForPackage } = require('./ScormCourseWorkspaceService');
const { getObjectStorage } = require('../../storage/ObjectStorage');
const { packageZipKey } = require('./storageKeys');
const { unpackPackage } = require('./ScormUnpackService');
const logger = require('../../utils/logger');

function noop() {}

async function readUploadedSource(payload, userId) {
    const key = String(payload?.sourceKey || '').trim();
    if (!key) return null;
    const allowedPrefix = `ai-author/source/${String(userId || 'unknown')}/`;
    if (!key.startsWith(allowedPrefix)) {
        const error = new Error('Invalid course source reference.');
        error.code = 'SCORM_SOURCE_FORBIDDEN';
        throw error;
    }
    const storage = getObjectStorage();
    const buffer = await storage.getObjectBuffer(key);
    return {
        key,
        storage,
        base64: buffer.toString('base64'),
        mimeType: String(payload.sourceMimeType || payload.mimeType || 'application/pdf')
    };
}

async function removeUploadedSource(uploaded) {
    if (!uploaded?.key || !uploaded?.storage) return;
    try {
        await uploaded.storage.deleteObject(uploaded.key);
    } catch (error) {
        logger.warn('scorm_ai_source_cleanup_failed', { module: 'scorm', key: uploaded.key, error: error.message });
    }
}

function templateEngineRequested(payload, analysis) {
    return Boolean(
        String(payload?.courseTemplateId || payload?.courseStyleId || '').trim()
        || analysis?.templateBinding?.templateId
    );
}

async function generateScormCourse({ payload = {}, userId, onProgress = noop, checkCancelled = noop }) {
    let analysis = payload.analysis;
    const {
        fileBase64,
        mimeType,
        detailLevel,
        templateId,
        themeId,
        logoDataUrl,
        title,
        topic,
        description
    } = payload || {};

    const selectedThemeId = normalizeThemeId(themeId || templateId || analysis?.themeId || 1);
    const selectedTheme = getTheme(selectedThemeId);
    const useTemplateEngine = templateEngineRequested(payload, analysis);
    const templateBinding = useTemplateEngine
        ? resolveNewCourseTemplateBinding(payload, analysis)
        : null;
    let uploadedSource = null;

    checkCancelled();
    if (!analysis) {
        const cleanTopic = String(topic || '').trim();
        const cleanDescription = String(description || '').trim();
        const brief = [
            cleanTopic ? `Topic: ${cleanTopic}` : '',
            cleanDescription ? `Description and learning context:\n${cleanDescription}` : ''
        ].filter(Boolean).join('\n\n');

        uploadedSource = await readUploadedSource(payload, userId);
        const effectiveBase64 = uploadedSource?.base64 || fileBase64 || '';
        const effectiveMimeType = uploadedSource?.mimeType || mimeType || 'application/pdf';

        if (!effectiveBase64 && !brief) {
            const error = new Error('analysis, source document, or topic/description required');
            error.code = 'SCORM_AI_SOURCE_REQUIRED';
            throw error;
        }

        const raw = effectiveBase64
            ? String(effectiveBase64).replace(/^data:[^;]+;base64,/, '')
            : Buffer.from(brief, 'utf8').toString('base64');

        try {
            analysis = await analyzePolicy({
                fileBase64: raw,
                mimeType: effectiveBase64 ? effectiveMimeType : 'text/plain',
                detailLevel: detailLevel || 'detailed',
                onProgress
            });
        } finally {
            await removeUploadedSource(uploadedSource);
            uploadedSource = null;
        }
        checkCancelled();
    } else if (payload.sourceKey) {
        // A reviewed analysis no longer needs the original upload. Clean up a
        // source reference if an older client supplied both.
        uploadedSource = await readUploadedSource(payload, userId);
        await removeUploadedSource(uploadedSource);
        uploadedSource = null;
    }

    onProgress({
        percent: 4,
        stage: 'Formatting course structure',
        detail: useTemplateEngine
            ? 'Applying the selected course template and its allowed interaction patterns.'
            : 'Balancing text, images and varied learner layouts before image generation.'
    });
    analysis = useTemplateEngine
        ? planExperienceForTemplate(analysis, templateBinding)
        : planExperienceV5(analysis);

    onProgress({ percent: 5, stage: 'Checking knowledge checks', detail: 'Guaranteeing complete quiz questions and learner explanations before packaging.' });
    analysis = ensureQuizIntegrity(analysis);
    analysis = {
        ...(analysis || {}),
        themeId: selectedThemeId,
        themeName: selectedTheme.name,
        experienceVersion: 5
    };
    if (useTemplateEngine) validateTemplateAnalysis(analysis, templateBinding);
    if (title) analysis.title = title;

    checkCancelled();
    const media = await prepareReplicateCourseMedia(analysis, {
        onProgress,
        checkCancelled
    });
    analysis = media.analysis;
    if (useTemplateEngine) validateTemplateAnalysis(analysis, templateBinding);
    checkCancelled();

    onProgress({ percent: 80, stage: 'Building the SCORM package', detail: 'Combining course content, images, varied layouts, quiz explanations and tracking into the learner package.' });
    let zipBuf = await buildScormPackageZip(analysis, {
        templateId: selectedThemeId,
        logoDataUrl: logoDataUrl || null,
        replicateMediaFiles: media.files
    });
    if (useTemplateEngine) {
        zipBuf = await applyTemplateRuntimeToZip(zipBuf, analysis);
    }
    checkCancelled();

    const replaceId = payload.replacePackageId || payload.packageId || null;
    let pkg = null;
    if (replaceId) {
        pkg = await ScormPackage.findOne({ where: { id: replaceId, hostId: userId } });
        if (!pkg || pkg.status === 'deleted') {
            const error = new Error('Package to replace not found');
            error.code = 'SCORM_PACKAGE_NOT_FOUND';
            throw error;
        }
    }

    checkCancelled();
    onProgress({ percent: 86, stage: 'Saving generated course', detail: 'Saving the SCORM package and course metadata.' });
    if (!pkg) {
        pkg = await ScormPackage.create({
            hostId: userId,
            title: String(analysis.title || 'AI Course').slice(0, 200),
            status: 'processing',
            source: 'ai_author',
            standard: 'scorm_1_2',
            byteSize: zipBuf.length,
            // This numeric field is retained as the legacy visual theme id.
            // Versioned course-template identity lives in analysis.templateBinding.
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

    checkCancelled();
    const storage = getObjectStorage();
    const zipKey = packageZipKey(pkg.id);
    await storage.putObject({ key: zipKey, body: zipBuf, contentType: 'application/zip' });
    pkg.storageKeyZip = zipKey;
    await pkg.save();

    checkCancelled();
    onProgress({ percent: 92, stage: 'Preparing learner files', detail: 'Unpacking the generated SCORM so it can be previewed and launched.' });
    try {
        await unpackPackage(pkg.id);
    } catch (e) {
        logger.error('scorm_ai_unpack_failed', { module: 'scorm', packageId: pkg.id, error: e.message });
    }
    await pkg.reload();
    checkCancelled();

    let course = null;
    if (pkg.status === 'ready') {
        onProgress({ percent: 97, stage: 'Finalising course workspace', detail: 'Connecting the generated package to the course workspace.' });
        course = await ensureCourseForPackage({
            packageId: pkg.id,
            hostId: userId,
            title: pkg.title
        });
        checkCancelled();
    }

    return {
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
        courseTemplate: useTemplateEngine ? publicTemplateBinding(templateBinding) : null,
        media: media.metadata || null,
        errorMessage: pkg.errorMessage
    };
}

module.exports = { generateScormCourse };
