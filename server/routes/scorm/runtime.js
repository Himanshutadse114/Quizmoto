const express = require('express');
const router = express.Router();
const Runtime = require('../../services/scorm/ScormRuntimeService');
const {
    ScormRegistration,
    ScormCmiState,
    ScormCourse,
    ScormPackage
} = require('../../models/scorm');
const Realtime = require('../../services/scorm/ScormRealtime');

function bearer(req) {
    const h = req.header('Authorization') || '';
    return h.replace(/^Bearer\s+/i, '').trim();
}

async function bootstrapAiAuthorProgress(regId) {
    try {
        const reg = await ScormRegistration.findByPk(regId, {
            include: [{
                model: ScormCourse,
                as: 'course',
                include: [{ model: ScormPackage, as: 'package' }]
            }]
        });
        if (!reg?.course?.package || reg.course.package.source !== 'ai_author') return false;

        const state = await ScormCmiState.findOne({ where: { registrationId: reg.id } });
        if (!state) return false;

        let changed = false;
        if (state.lessonLocation == null || String(state.lessonLocation).trim() === '') {
            state.lessonLocation = '0';
            changed = true;
        }
        if (!state.lessonStatus || state.lessonStatus === 'not attempted') {
            state.lessonStatus = 'incomplete';
            changed = true;
        }
        if (changed) await state.save();
        return changed;
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
        const token = bearer(req);
        const result = await Runtime.initialize(req.params.regId, token);
        const bootstrapped = await bootstrapAiAuthorProgress(req.params.regId);
        if (bootstrapped) await Runtime.commit(req.params.regId, token);
        await emitRegistration(req.params.regId, 'initialize');
        res.json(result);
    } catch (err) {
        const code = err.code === 'FORBIDDEN' ? 403 : err.code === 'NOT_FOUND' ? 404 : 500;
        res.status(code).json({ message: err.message, errorCode: 101 });
    }
});

router.get('/:regId/get', async (req, res) => {
    try {
        const result = await Runtime.getValue(req.params.regId, bearer(req), req.query.el || req.query.element);
        res.json(result);
    } catch (err) {
        const code = err.code === 'FORBIDDEN' ? 403 : err.code === 'NOT_FOUND' ? 404 : 500;
        res.status(code).json({ message: err.message, errorCode: 101, value: '' });
    }
});

router.post('/:regId/set', async (req, res) => {
    try {
        const { element, value, values } = req.body || {};
        const token = bearer(req);
        const result = values && typeof values === 'object' && !Array.isArray(values)
            ? await Runtime.setValues(req.params.regId, token, values)
            : await Runtime.setValue(req.params.regId, token, element, value);
        res.json(result);
    } catch (err) {
        const code = err.code === 'FORBIDDEN' ? 403 : err.code === 'NOT_FOUND' ? 404 : 500;
        res.status(code).json({ message: err.message, errorCode: 101, value: 'false' });
    }
});

router.post('/:regId/commit', async (req, res) => {
    try {
        const result = await Runtime.commit(req.params.regId, bearer(req), req.body?.values);
        await emitRegistration(req.params.regId, 'commit', result.registration || null);
        res.json(result);
    } catch (err) {
        const code = err.code === 'FORBIDDEN' ? 403 : err.code === 'NOT_FOUND' ? 404 : 500;
        res.status(code).json({ message: err.message, errorCode: 101, value: 'false' });
    }
});

router.post('/:regId/finish', async (req, res) => {
    try {
        const result = await Runtime.finish(req.params.regId, bearer(req), req.body?.values);
        await emitRegistration(req.params.regId, 'finish', result.registration || null);
        res.json(result);
    } catch (err) {
        const code = err.code === 'FORBIDDEN' ? 403 : err.code === 'NOT_FOUND' ? 404 : 500;
        res.status(code).json({ message: err.message, errorCode: 101, value: 'false' });
    }
});

module.exports = router;
