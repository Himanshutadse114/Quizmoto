const express = require('express');
const router = express.Router();
const Runtime = require('../../services/scorm/ScormRuntimeService');
const { ensureScormRuntimeSchema } = require('../../services/scorm/ScormRuntimeSchemaGuard');
const {
    ScormRegistration,
    ScormCourse,
    ScormPackage
} = require('../../models/scorm');
const Realtime = require('../../services/scorm/ScormRealtime');

function bearer(req) {
    const h = req.header('Authorization') || '';
    return h.replace(/^Bearer\s+/i, '').trim();
}

function runtimeHttpCode(err) {
    if (err?.code === 'FORBIDDEN') return 403;
    if (err?.code === 'NOT_FOUND') return 404;
    return 500;
}

function runtimeFailurePayload(err, value = 'false') {
    return {
        message: err?.message || 'SCORM runtime operation failed',
        errorCode: 101,
        value,
        failureKind: err?.name || null,
        dbCode: err?.original?.code || err?.parent?.code || null,
        constraint: err?.original?.constraint || err?.parent?.constraint || null
    };
}

function logRuntimeFailure(operation, req, err, elements = []) {
    const dbCode = err?.original?.code || err?.parent?.code || null;
    const safeElements = Array.from(new Set((elements || []).filter(Boolean).map(String))).slice(0, 20);
    console.error('[scorm-runtime] operation failed', {
        operation,
        registrationId: req.params?.regId || null,
        elements: safeElements,
        error: err?.message || String(err),
        code: err?.code || null,
        dbCode
    });
}

async function ensureRuntimeReady() {
    // Keep the legacy guard while old CMI rows are used as a compatibility
    // projection/migration source. Canonical commits use runtime snapshots.
    await ensureScormRuntimeSchema();
}

async function bootstrapAiAuthorProgress(regId, token) {
    try {
        const reg = await ScormRegistration.findByPk(regId, {
            include: [{
                model: ScormCourse,
                as: 'course',
                include: [{ model: ScormPackage, as: 'package' }]
            }]
        });
        if (!reg?.course?.package || reg.course.package.source !== 'ai_author') return false;

        const [location, status] = await Promise.all([
            Runtime.getValue(regId, token, 'cmi.core.lesson_location'),
            Runtime.getValue(regId, token, 'cmi.core.lesson_status')
        ]);
        const values = {};
        if (!String(location?.value || '').trim()) values['cmi.core.lesson_location'] = '0';
        if (!status?.value || status.value === 'not attempted') values['cmi.core.lesson_status'] = 'incomplete';
        if (!Object.keys(values).length) return false;
        await Runtime.commit(regId, token, values);
        return true;
    } catch (_) {
        return false;
    }
}

async function emitRegistration(regId, event, snapshot = null) {
    try {
        let registration = snapshot;
        if (!registration) {
            const reg = await ScormRegistration.findByPk(regId);
            if (!reg) return;
            registration = {
                id: reg.id,
                courseId: reg.courseId,
                learnerName: reg.learnerName,
                learnerEmail: reg.learnerEmail,
                status: reg.status,
                isPreview: reg.isPreview,
                lastLessonStatus: reg.lastLessonStatus,
                lastScoreRaw: reg.lastScoreRaw,
                lastTotalTime: reg.lastTotalTime,
                lastCommitAt: reg.lastCommitAt,
                updatedAt: reg.updatedAt
            };
        }
        Realtime.emitRegistrationUpdate({
            courseId: registration.courseId,
            event,
            registration
        });
    } catch (_) {
        // Realtime is an optimization only; runtime persistence must never fail because of it.
    }
}

router.post('/:regId/initialize', async (req, res) => {
    try {
        await ensureRuntimeReady();
        const token = bearer(req);
        const result = await Runtime.initialize(req.params.regId, token);
        await bootstrapAiAuthorProgress(req.params.regId, token);
        await emitRegistration(req.params.regId, 'initialize');
        res.json(result);
    } catch (err) {
        logRuntimeFailure('initialize', req, err);
        res.status(runtimeHttpCode(err)).json(runtimeFailurePayload(err, ''));
    }
});

router.get('/:regId/get', async (req, res) => {
    const element = req.query.el || req.query.element;
    try {
        await ensureRuntimeReady();
        const result = await Runtime.getValue(req.params.regId, bearer(req), element);
        res.json(result);
    } catch (err) {
        logRuntimeFailure('get', req, err, [element]);
        res.status(runtimeHttpCode(err)).json(runtimeFailurePayload(err, ''));
    }
});

router.post('/:regId/set', async (req, res) => {
    const { element, value, values } = req.body || {};
    const elements = values && typeof values === 'object' && !Array.isArray(values)
        ? Object.keys(values)
        : [element];
    try {
        await ensureRuntimeReady();
        const token = bearer(req);
        const result = values && typeof values === 'object' && !Array.isArray(values)
            ? await Runtime.setValues(req.params.regId, token, values)
            : await Runtime.setValue(req.params.regId, token, element, value);
        res.json(result);
    } catch (err) {
        logRuntimeFailure('set', req, err, elements);
        res.status(runtimeHttpCode(err)).json(runtimeFailurePayload(err));
    }
});

router.post('/:regId/commit', async (req, res) => {
    const values = req.body?.values;
    try {
        await ensureRuntimeReady();
        const result = await Runtime.commit(req.params.regId, bearer(req), values);
        await emitRegistration(req.params.regId, 'commit', result.registration || null);
        res.json(result);
    } catch (err) {
        logRuntimeFailure('commit', req, err, values && typeof values === 'object' ? Object.keys(values) : []);
        res.status(runtimeHttpCode(err)).json(runtimeFailurePayload(err));
    }
});

router.post('/:regId/finish', async (req, res) => {
    const values = req.body?.values;
    try {
        await ensureRuntimeReady();
        const result = await Runtime.finish(req.params.regId, bearer(req), values);
        await emitRegistration(req.params.regId, 'finish', result.registration || null);
        res.json(result);
    } catch (err) {
        logRuntimeFailure('finish', req, err, values && typeof values === 'object' ? Object.keys(values) : []);
        res.status(runtimeHttpCode(err)).json(runtimeFailurePayload(err));
    }
});

module.exports = router;
