/**
 * Minimal xAPI (Tin Can) statement receiver.
 * Accepts statements authenticated by a SCORM registration JWT and mirrors
 * score / completion onto the host roster when present.
 */
const { v4: uuidv4 } = require('uuid');
const {
    ScormRegistration,
    ScormXapiStatement,
    ScormCmiState
} = require('../../models/scorm');
const { verifyRegistrationToken } = require('./ScormInviteService');
const Runtime = require('./ScormRuntimeService');

function bearer(req) {
    const h = req.header('Authorization') || '';
    return h.replace(/^Bearer\s+/i, '').trim();
}

function asArray(body) {
    if (Array.isArray(body)) return body;
    if (body && typeof body === 'object') return [body];
    return [];
}

function extractVerbId(stmt) {
    return (stmt.verb && (stmt.verb.id || stmt.verb)) || null;
}

function extractObjectId(stmt) {
    if (!stmt.object) return null;
    if (typeof stmt.object === 'string') return stmt.object;
    return stmt.object.id || null;
}

function extractScore(result) {
    if (!result || !result.score) return {};
    const s = result.score;
    return {
        raw: s.raw != null ? Number(s.raw) : null,
        scaled: s.scaled != null ? Number(s.scaled) : null,
        min: s.min != null ? Number(s.min) : null,
        max: s.max != null ? Number(s.max) : null
    };
}

async function authorizeRegistration(token) {
    const decoded = verifyRegistrationToken(token);
    const reg = await ScormRegistration.findByPk(decoded.scormRegId);
    if (!reg || reg.status === 'revoked') {
        const err = new Error('Registration not found or revoked');
        err.code = 'NOT_FOUND';
        throw err;
    }
    return reg;
}

async function mirrorToRoster(reg, stmt) {
    const result = stmt.result || {};
    const score = extractScore(result);
    let changed = false;

    if (score.raw != null && !Number.isNaN(score.raw)) {
        reg.lastScoreRaw = score.raw;
        changed = true;
    } else if (score.scaled != null && !Number.isNaN(score.scaled) && score.max != null) {
        reg.lastScoreRaw = Math.round(score.scaled * score.max);
        changed = true;
    }

    const verb = extractVerbId(stmt) || '';
    // Common xAPI verb IDs
    if (/passed/i.test(verb) || result.success === true) {
        reg.lastLessonStatus = 'passed';
        changed = true;
    } else if (/failed/i.test(verb) || result.success === false) {
        reg.lastLessonStatus = 'failed';
        changed = true;
    } else if (/completed/i.test(verb) || result.completion === true) {
        if (reg.lastLessonStatus !== 'passed' && reg.lastLessonStatus !== 'failed') {
            reg.lastLessonStatus = 'completed';
            changed = true;
        }
    } else if (/initialized|launched|experienced|attempted/i.test(verb)) {
        if (!reg.lastLessonStatus || reg.lastLessonStatus === 'not attempted') {
            reg.lastLessonStatus = 'incomplete';
            changed = true;
        }
    }

    if (result.duration) {
        const secs = Runtime.parseTimeToSeconds(String(result.duration));
        if (secs > 0) {
            reg.lastTotalTime = Runtime.formatTime(secs);
            changed = true;
        }
    }

    if (changed) {
        reg.lastCommitAt = new Date();
        if (reg.status === 'invited') reg.status = 'active';
        if (['passed', 'failed', 'completed'].includes(reg.lastLessonStatus)) {
            reg.status = 'completed';
        }
        await reg.save();
    }

    // Keep CMI state in sync when possible
    try {
        let state = await ScormCmiState.findOne({ where: { registrationId: reg.id } });
        if (state) {
            if (score.raw != null && !Number.isNaN(score.raw)) state.scoreRaw = score.raw;
            if (score.min != null && !Number.isNaN(score.min)) state.scoreMin = score.min;
            if (score.max != null && !Number.isNaN(score.max)) state.scoreMax = score.max;
            if (reg.lastLessonStatus) state.lessonStatus = reg.lastLessonStatus;
            if (reg.lastTotalTime) state.totalTime = reg.lastTotalTime;
            await state.save();
        }
    } catch (_) {
        /* non-fatal */
    }
}

async function storeStatements(token, body) {
    const reg = await authorizeRegistration(token);
    const statements = asArray(body);
    if (statements.length === 0) {
        const err = new Error('No statements provided');
        err.code = 'BAD_REQUEST';
        throw err;
    }

    const ids = [];
    for (const stmt of statements) {
        if (!stmt || typeof stmt !== 'object') continue;
        const statementId = stmt.id || uuidv4();
        stmt.id = statementId;
        if (!stmt.timestamp) stmt.timestamp = new Date().toISOString();

        const score = extractScore(stmt.result || {});
        await ScormXapiStatement.create({
            registrationId: reg.id,
            statementId,
            actorJson: stmt.actor ? JSON.stringify(stmt.actor) : null,
            verbId: extractVerbId(stmt),
            objectId: extractObjectId(stmt),
            resultScoreRaw: score.raw,
            resultScoreScaled: score.scaled,
            resultSuccess: stmt.result && typeof stmt.result.success === 'boolean' ? stmt.result.success : null,
            resultCompletion:
                stmt.result && typeof stmt.result.completion === 'boolean' ? stmt.result.completion : null,
            resultDuration: stmt.result && stmt.result.duration ? String(stmt.result.duration) : null,
            statementJson: JSON.stringify(stmt),
            storedAt: new Date()
        });

        await mirrorToRoster(reg, stmt);
        ids.push(statementId);
    }

    return { ok: true, statementIds: ids, registrationId: reg.id };
}

async function listStatements(token, { limit = 50 } = {}) {
    const reg = await authorizeRegistration(token);
    const rows = await ScormXapiStatement.findAll({
        where: { registrationId: reg.id },
        order: [['storedAt', 'DESC']],
        limit: Math.min(Number(limit) || 50, 200)
    });
    return rows.map((r) => {
        try {
            return JSON.parse(r.statementJson);
        } catch {
            return { id: r.statementId };
        }
    });
}

module.exports = {
    bearer,
    storeStatements,
    listStatements,
    authorizeRegistration
};
