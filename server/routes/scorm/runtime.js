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

async function emitRegistration(regId, event) {
    try {
        const reg = await ScormRegistration.findByPk(regId);
        if (!reg) return;
        Realtime.emitRegistrationUpdate({
            courseId: reg.courseId,
            event,
            registration: {
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
            }
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
        // Persist an initial Host Preview / learner state immediately. This also
        // makes older AI-authored packages visible even if their first client-side
        // lesson_location write occurred before LMSInitialize.
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
        if (values && typeof values === 'object') {
            let last = { ok: true, value: 'true', errorCode: 0 };
            for (const [el, val] of Object.entries(values)) {
                last = await Runtime.setValue(req.params.regId, bearer(req), el, val);
                if (!last.ok) break;
            }
            return res.json(last);
        }
        const result = await Runtime.setValue(req.params.regId, bearer(req), element, value);
        res.json(result);
    } catch (err) {
        const code = err.code === 'FORBIDDEN' ? 403 : err.code === 'NOT_FOUND' ? 404 : 500;
        res.status(code).json({ message: err.message, errorCode: 101, value: 'false' });
    }
});

router.post('/:regId/commit', async (req, res) => {
    try {
        const result = await Runtime.commit(req.params.regId, bearer(req));
        await emitRegistration(req.params.regId, 'commit');
        res.json(result);
    } catch (err) {
        const code = err.code === 'FORBIDDEN' ? 403 : err.code === 'NOT_FOUND' ? 404 : 500;
        res.status(code).json({ message: err.message, errorCode: 101, value: 'false' });
    }
});

router.post('/:regId/finish', async (req, res) => {
    try {
        const result = await Runtime.finish(req.params.regId, bearer(req));
        await emitRegistration(req.params.regId, 'finish');
        res.json(result);
    } catch (err) {
        const code = err.code === 'FORBIDDEN' ? 403 : err.code === 'NOT_FOUND' ? 404 : 500;
        res.status(code).json({ message: err.message, errorCode: 101, value: 'false' });
    }
});

module.exports = router;
