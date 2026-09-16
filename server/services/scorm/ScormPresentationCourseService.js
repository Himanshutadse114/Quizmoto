'use strict';

const path = require('path');
const { generateQuiz } = require('../QuizAiGenerationService');
const { ScormPackage } = require('../../models/scorm');
const { getObjectStorage } = require('../../storage/ObjectStorage');
const { packageZipKey } = require('./storageKeys');
const { unpackPackage } = require('./ScormUnpackService');
const { ensureCourseForPackage } = require('./ScormCourseWorkspaceService');
const { renderPresentation } = require('./ScormPresentationRenderer');
const { buildPresentationScormZip } = require('./ScormPresentationPackageBuilder');
const logger = require('../../utils/logger');

function noop() {}

function cleanSourceName(value, fallback = 'presentation') {
    const name = path.basename(String(value || fallback)).replace(/[\u0000-\u001f]/g, '').trim();
    return name.slice(0, 180) || fallback;
}

function titleFromPayload(payload, sourceName) {
    const explicit = String(payload.title || payload.topic || '').trim();
    if (explicit) return explicit.slice(0, 200);
    const inferred = path.basename(sourceName, path.extname(sourceName)).replace(/[_-]+/g, ' ').trim();
    return (inferred || 'Presentation Course').slice(0, 200);
}

async function readPresentationSource(payload, userId) {
    const sourceName = cleanSourceName(payload.sourceFileName || payload.fileName || 'presentation');
    const mimeType = String(payload.sourceMimeType || payload.mimeType || 'application/octet-stream').slice(0, 180);
    const key = String(payload.sourceKey || '').trim();
    if (key) {
        const allowedPrefix = `ai-author/source/${String(userId || 'unknown')}/`;
        if (!key.startsWith(allowedPrefix)) {
            const error = new Error('Invalid presentation source reference.');
            error.code = 'SCORM_SOURCE_FORBIDDEN';
            throw error;
        }
        const storage = getObjectStorage();
        return {
            key,
            storage,
            sourceName,
            mimeType,
            buffer: await storage.getObjectBuffer(key)
        };
    }

    const raw = String(payload.fileBase64 || '').replace(/^data:[^;]+;base64,/, '');
    if (!raw) {
        const error = new Error('Upload a PPTX or PDF presentation before creating this course.');
        error.code = 'SCORM_PRESENTATION_SOURCE_REQUIRED';
        throw error;
    }
    return {
        key: '',
        storage: null,
        sourceName,
        mimeType,
        buffer: Buffer.from(raw, 'base64')
    };
}

async function removePresentationSource(source) {
    if (!source?.key || !source.storage) return;
    try {
        await source.storage.deleteObject(source.key);
    } catch (error) {
        logger.warn('scorm_presentation_source_cleanup_failed', {
            module: 'scorm',
            key: source.key,
            error: error.message
        });
    }
}

async function generatePresentationCourse({ payload = {}, userId, onProgress = noop, checkCancelled = noop }) {
    let source = null;
    try {
        checkCancelled();
        onProgress({
            percent: 5,
            stage: 'Reading presentation',
            detail: 'Checking the uploaded deck and preparing its original slides.'
        });
        source = await readPresentationSource(payload, userId);
        const title = titleFromPayload(payload, source.sourceName);

        checkCancelled();
        onProgress({
            percent: 14,
            stage: 'Preserving slides',
            detail: 'Rendering every slide as a consistent, fast-loading course image.'
        });
        const rendered = await renderPresentation({
            sourceBuffer: source.buffer,
            mimeType: source.mimeType,
            fileName: source.sourceName
        });
        source.buffer = null;

        checkCancelled();
        onProgress({
            percent: 52,
            stage: 'Creating knowledge check',
            detail: 'Reading the presentation and creating a quiz from its learning content.'
        });
        const quiz = await generateQuiz({
            topic: title,
            description: String(payload.description || '').trim(),
            fileBase64: rendered.quizSourceBuffer.toString('base64'),
            mimeType: rendered.quizSourceMimeType,
            fileName: rendered.quizSourceFileName,
            maxUploadMb: 100
        });
        rendered.quizSourceBuffer = null;
        rendered.pdfBuffer = null;

        checkCancelled();
        onProgress({
            percent: 78,
            stage: 'Building tracked course',
            detail: 'Adding responsive playback, resume data, completion, score and quiz tracking.'
        });
        const passScore = Math.max(0, Math.min(100, Number(payload.passScore) || 70));
        const zipBuffer = await buildPresentationScormZip({
            title,
            slides: rendered.slides,
            quiz,
            theme: rendered.theme,
            passScore
        });

        const metadata = {
            courseMode: 'presentation',
            title,
            description: String(payload.description || '').trim().slice(0, 4000),
            presentation: {
                sourceFileName: source.sourceName,
                sourceKind: rendered.kind,
                slideCount: rendered.slides.length,
                width: rendered.width,
                height: rendered.height,
                aspectRatio: rendered.aspectRatio,
                totalSlideBytes: rendered.totalBytes,
                renderEngine: rendered.renderEngine,
                theme: rendered.theme
            },
            quiz: {
                title: quiz.title,
                questionCount: quiz.questions.length,
                questions: quiz.questions
            },
            passScore,
            tracking: {
                standard: 'scorm_1_2',
                resume: true,
                progress: true,
                score: true,
                interactions: true
            }
        };

        checkCancelled();
        onProgress({
            percent: 87,
            stage: 'Saving course',
            detail: 'Saving the SCORM package and presentation metadata.'
        });
        const pkg = await ScormPackage.create({
            hostId: userId,
            title,
            description: metadata.description || null,
            status: 'processing',
            source: 'presentation_import',
            standard: 'scorm_1_2',
            byteSize: zipBuffer.length,
            templateId: null,
            analysisJson: JSON.stringify(metadata)
        });

        const storage = getObjectStorage();
        const zipKey = packageZipKey(pkg.id);
        await storage.putObject({ key: zipKey, body: zipBuffer, contentType: 'application/zip' });
        pkg.storageKeyZip = zipKey;
        await pkg.save();

        checkCancelled();
        onProgress({
            percent: 93,
            stage: 'Preparing learner files',
            detail: 'Preparing the course for preview and learner launch.'
        });
        await unpackPackage(pkg.id);
        await pkg.reload();

        let course = null;
        if (pkg.status === 'ready') {
            checkCancelled();
            onProgress({
                percent: 98,
                stage: 'Finalising course workspace',
                detail: 'Connecting the tracked presentation to the course workspace.'
            });
            course = await ensureCourseForPackage({ packageId: pkg.id, hostId: userId, title });
            if (course) {
                const settings = course.settings && typeof course.settings === 'object' ? course.settings : {};
                course.settings = {
                    ...settings,
                    courseMode: 'presentation',
                    presentationTheme: rendered.theme,
                    passScore
                };
                await course.save();
            }
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
            courseMode: 'presentation',
            slideCount: rendered.slides.length,
            renderEngine: rendered.renderEngine,
            quizQuestionCount: quiz.questions.length,
            theme: rendered.theme,
            errorMessage: pkg.errorMessage
        };
    } finally {
        await removePresentationSource(source);
    }
}

module.exports = {
    cleanSourceName,
    titleFromPayload,
    readPresentationSource,
    generatePresentationCourse
};
