'use strict';

const path = require('path');
const JSZip = require('jszip');
const sharp = require('sharp');
const { generateQuiz } = require('../QuizAiGenerationService');
const { ScormPackage } = require('../../models/scorm');
const { getObjectStorage } = require('../../storage/ObjectStorage');
const { packageZipKey } = require('./storageKeys');
const { unpackPackage } = require('./ScormUnpackService');
const { ensureCourseForPackage } = require('./ScormCourseWorkspaceService');
const { renderPresentation } = require('./ScormPresentationRenderer');
const {
    buildPresentationScormZip,
    normalizeQuiz,
    QUIZMOTO_PRESENTATION_THEME
} = require('./ScormPresentationPackageBuilder');
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

function parseMetadata(value) {
    try {
        const parsed = JSON.parse(String(value || '{}'));
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
        return {};
    }
}

function hasPresentationSource(payload = {}) {
    return Boolean(String(payload.sourceKey || '').trim() || String(payload.fileBase64 || '').trim());
}

function quizQuestionCount(value) {
    if (Array.isArray(value)) return value.length;
    return Array.isArray(value?.questions) ? value.questions.length : 0;
}

function validateEditedQuiz(value) {
    const normalized = normalizeQuiz(Array.isArray(value) ? { questions: value } : value);
    const suppliedCount = quizQuestionCount(value);
    if (!suppliedCount || normalized.questions.length !== suppliedCount) {
        const error = new Error('Complete every quiz question, all four answers and the correct-answer selection before rebuilding.');
        error.code = 'SCORM_PRESENTATION_QUIZ_INVALID';
        throw error;
    }
    return normalized;
}

async function loadExistingPresentation(pkg, metadata = {}) {
    if (!pkg?.storageKeyZip) {
        const error = new Error('The existing presentation package is unavailable. Upload the PPTX again to rebuild it.');
        error.code = 'SCORM_PRESENTATION_PACKAGE_MISSING';
        throw error;
    }
    const storage = getObjectStorage();
    const zip = await JSZip.loadAsync(await storage.getObjectBuffer(pkg.storageKeyZip));
    const names = Object.keys(zip.files)
        .filter((name) => /^slides\/slide-\d+\.webp$/i.test(name))
        .sort((a, b) => Number(a.match(/(\d+)\.webp$/i)?.[1] || 0) - Number(b.match(/(\d+)\.webp$/i)?.[1] || 0));
    if (!names.length) {
        const error = new Error('The existing course has no reusable presentation slides. Upload the PPTX again to rebuild it.');
        error.code = 'SCORM_PRESENTATION_SLIDES_MISSING';
        throw error;
    }
    const slides = [];
    for (const name of names) {
        const body = await zip.file(name).async('nodebuffer');
        const image = await sharp(body).metadata();
        slides.push({
            path: name,
            body,
            contentType: 'image/webp',
            width: Number(image.width) || Number(metadata.presentation?.width) || 960,
            height: Number(image.height) || Number(metadata.presentation?.height) || 540,
            byteSize: body.length
        });
    }
    return {
        slides,
        kind: metadata.presentation?.sourceKind || 'pptx',
        width: slides[0].width,
        height: slides[0].height,
        aspectRatio: Math.round((slides[0].width / slides[0].height) * 10000) / 10000,
        totalBytes: slides.reduce((sum, slide) => sum + slide.byteSize, 0),
        renderEngine: metadata.presentation?.renderEngine || 'existing-package',
        quizSourceBuffer: null,
        pdfBuffer: null
    };
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
        const replaceId = String(payload.replacePackageId || payload.packageId || '').trim();
        let pkg = null;
        let storedMetadata = {};
        if (replaceId) {
            pkg = await ScormPackage.findOne({ where: { id: replaceId, hostId: userId } });
            if (!pkg || pkg.status === 'deleted' || pkg.source !== 'presentation_import') {
                const error = new Error('Editable presentation package not found.');
                error.code = 'SCORM_PRESENTATION_PACKAGE_NOT_FOUND';
                throw error;
            }
            storedMetadata = parseMetadata(pkg.analysisJson);
        }

        checkCancelled();
        onProgress({
            percent: 5,
            stage: 'Reading presentation',
            detail: hasPresentationSource(payload)
                ? 'Checking the uploaded deck and preparing its original slides.'
                : 'Loading the existing slides and editable knowledge check.'
        });
        const hasNewSource = hasPresentationSource(payload);
        if (!hasNewSource && !pkg) {
            const error = new Error('Upload a PPTX or PDF presentation before creating this course.');
            error.code = 'SCORM_PRESENTATION_SOURCE_REQUIRED';
            throw error;
        }
        if (hasNewSource) source = await readPresentationSource(payload, userId);
        const sourceName = source?.sourceName || storedMetadata.presentation?.sourceFileName || pkg?.title || 'presentation.pptx';
        const title = titleFromPayload(payload, sourceName) || pkg?.title;

        checkCancelled();
        onProgress({
            percent: 14,
            stage: 'Preserving slides',
            detail: hasNewSource
                ? 'Rendering every slide as a consistent, fast-loading course image.'
                : 'Reusing the exact slide images already stored in this course.'
        });
        const rendered = hasNewSource
            ? await renderPresentation({
                sourceBuffer: source.buffer,
                mimeType: source.mimeType,
                fileName: source.sourceName
            })
            : await loadExistingPresentation(pkg, storedMetadata);
        if (source) source.buffer = null;

        checkCancelled();
        onProgress({
            percent: 52,
            stage: 'Creating knowledge check',
            detail: payload.quiz
                ? 'Validating the edited quiz and learner explanations.'
                : 'Reading the presentation and creating a quiz from its learning content.'
        });
        let quiz = null;
        if (payload.quiz) {
            quiz = validateEditedQuiz(payload.quiz);
        } else if (storedMetadata.quiz && quizQuestionCount(storedMetadata.quiz)) {
            quiz = validateEditedQuiz(storedMetadata.quiz);
        } else {
            quiz = await generateQuiz({
                topic: title,
                description: String(payload.description || '').trim(),
                fileBase64: rendered.quizSourceBuffer.toString('base64'),
                mimeType: rendered.quizSourceMimeType,
                fileName: rendered.quizSourceFileName,
                maxUploadMb: 100
            });
        }
        rendered.quizSourceBuffer = null;
        rendered.pdfBuffer = null;

        checkCancelled();
        onProgress({
            percent: 78,
            stage: 'Building tracked course',
            detail: 'Adding responsive playback, resume data, completion, score and quiz tracking.'
        });
        const numericPassScore = Number(payload.passScore);
        const passScore = Math.max(0, Math.min(100, Number.isFinite(numericPassScore) ? numericPassScore : 70));
        const zipBuffer = await buildPresentationScormZip({
            title,
            slides: rendered.slides,
            quiz,
            passScore
        });

        const metadata = {
            courseMode: 'presentation',
            title,
            description: String(payload.description || '').trim().slice(0, 4000),
            presentation: {
                sourceFileName: sourceName,
                sourceKind: rendered.kind,
                slideCount: rendered.slides.length,
                width: rendered.width,
                height: rendered.height,
                aspectRatio: rendered.aspectRatio,
                totalSlideBytes: rendered.totalBytes,
                renderEngine: rendered.renderEngine,
                theme: QUIZMOTO_PRESENTATION_THEME
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
        if (!pkg) {
            pkg = await ScormPackage.create({
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
        } else {
            pkg.title = title;
            pkg.description = metadata.description || null;
            pkg.status = 'processing';
            pkg.source = 'presentation_import';
            pkg.standard = 'scorm_1_2';
            pkg.byteSize = zipBuffer.length;
            pkg.analysisJson = JSON.stringify(metadata);
            pkg.errorMessage = null;
            await pkg.save();
        }

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
                    presentationTheme: QUIZMOTO_PRESENTATION_THEME,
                    passScore
                };
                course.title = title;
                course.description = metadata.description || course.description;
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
            theme: QUIZMOTO_PRESENTATION_THEME,
            errorMessage: pkg.errorMessage
        };
    } finally {
        await removePresentationSource(source);
    }
}

module.exports = {
    cleanSourceName,
    titleFromPayload,
    hasPresentationSource,
    validateEditedQuiz,
    loadExistingPresentation,
    readPresentationSource,
    generatePresentationCourse
};
