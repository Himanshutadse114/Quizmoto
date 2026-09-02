const { analyzePolicy } = require('./CourseAiService');
const { prepareReplicateCourseMedia } = require('./ReplicateCourseMediaService');
const { planExperienceV5 } = require('./ScormExperiencePlanner');
const { ensureQuizIntegrity } = require('./ScormQuizQualityService');
const { buildScormPackageZip } = require('./ScormReplicateMediaFinalizer');
const { getTheme, normalizeThemeId } = require('./ScormThemeCatalog');
const { ScormPackage } = require('../../models/scorm');
const { ensureCourseForPackage } = require('./ScormCourseWorkspaceService');
const { getObjectStorage } = require('../../storage/ObjectStorage');
const { packageZipKey } = require('./storageKeys');
const { unpackPackage } = require('./ScormUnpackService');
const logger = require('../../utils/logger');

function noop() {}

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

    checkCancelled();
    if (!analysis) {
        const cleanTopic = String(topic || '').trim();
        const cleanDescription = String(description || '').trim();
        const brief = [
            cleanTopic ? `Topic: ${cleanTopic}` : '',
            cleanDescription ? `Description and learning context:\n${cleanDescription}` : ''
        ].filter(Boolean).join('\n\n');

        if (!fileBase64 && !brief) {
            const error = new Error('analysis, source document, or topic/description required');
            error.code = 'SCORM_AI_SOURCE_REQUIRED';
            throw error;
        }

        const raw = fileBase64
            ? String(fileBase64).replace(/^data:[^;]+;base64,/, '')
            : Buffer.from(brief, 'utf8').toString('base64');

        analysis = await analyzePolicy({
            fileBase64: raw,
            mimeType: fileBase64 ? (mimeType || 'application/pdf') : 'text/plain',
            detailLevel: detailLevel || 'detailed',
            onProgress
        });
        checkCancelled();
    }

    onProgress({ percent: 4, stage: 'Formatting course structure', detail: 'Balancing text, images and varied learner layouts before image generation.' });
    analysis = planExperienceV5(analysis);
    onProgress({ percent: 5, stage: 'Checking knowledge checks', detail: 'Guaranteeing complete quiz questions and learner explanations before packaging.' });
    analysis = ensureQuizIntegrity(analysis);
    analysis = {
        ...(analysis || {}),
        themeId: selectedThemeId,
        themeName: selectedTheme.name,
        experienceVersion: 5
    };
    if (title) analysis.title = title;

    checkCancelled();
    const media = await prepareReplicateCourseMedia(analysis, {
        onProgress,
        checkCancelled
    });
    analysis = media.analysis;
    checkCancelled();

    onProgress({ percent: 80, stage: 'Building the SCORM package', detail: 'Combining course content, images, varied layouts, quiz explanations and tracking into the learner package.' });
    const zipBuf = await buildScormPackageZip(analysis, {
        templateId: selectedThemeId,
        logoDataUrl: logoDataUrl || null,
        replicateMediaFiles: media.files
    });
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
        media: media.metadata || null,
        errorMessage: pkg.errorMessage
    };
}

module.exports = { generateScormCourse };
