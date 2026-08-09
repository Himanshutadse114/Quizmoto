const express = require('express');
const router = express.Router();
const { getObjectStorage } = require('../../storage/ObjectStorage');
const { packageContentKey } = require('../../services/scorm/storageKeys');
const { ScormPackage, ScormRegistration, ScormCourse } = require('../../models/scorm');
const jwt = require('jsonwebtoken');
const { guessContentType } = require('../../services/scorm/ScormUnpackService');
const {
    patchTrackingRuntime,
    patchMobileCourse
} = require('../../services/scorm/ScormTrackingPackageFinalizer');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

async function resolvePackageAccess(accessToken, packageIdHint) {
    if (!accessToken) return null;
    let decoded;
    try {
        decoded = jwt.verify(accessToken, JWT_SECRET);
    } catch (_) {
        return null;
    }

    if (decoded.typ === 'scorm_reg' && decoded.scormRegId) {
        const reg = await ScormRegistration.findByPk(decoded.scormRegId, {
            include: [{ model: ScormCourse, as: 'course' }]
        });
        if (!reg || reg.status === 'revoked' || !reg.course) return null;
        return { packageId: reg.course.packageId, registrationId: reg.id };
    }

    if (decoded.userId && packageIdHint) {
        const pkg = await ScormPackage.findOne({ where: { id: packageIdHint, hostId: decoded.userId } });
        if (!pkg) return null;
        return { packageId: pkg.id, registrationId: null };
    }

    return null;
}

function patchAuthoredHtml(source) {
    let patched = String(source || '');

    // patchTrackingRuntime is deliberately idempotent so stored v4/v5 modules can
    // receive newer resume/tracking fixes without duplicating injected helpers.
    patched = patchTrackingRuntime(patched);

    // Older interaction tracking committed synchronously inside the answer click
    // handler. The player buffers authored SetValue calls, so the interaction can
    // ride the next progress/periodic/exit commit and feedback paints immediately.
    patched = patched.replace(
        "if(typeof doLMSCommit==='function')doLMSCommit();",
        ''
    );

    return patchMobileCourse(patched);
}

async function patchAiAuthorHtmlIfNeeded(packageId, rel, buf) {
    if (!/\.html?$/i.test(String(rel || ''))) return { buffer: buf, patched: false };

    const pkg = await ScormPackage.findByPk(packageId, { attributes: ['id', 'source'] });
    if (!pkg || pkg.source !== 'ai_author') return { buffer: buf, patched: false };

    const source = buf.toString('utf8');
    const patched = patchAuthoredHtml(source);
    if (patched === source) return { buffer: buf, patched: false };

    return { buffer: Buffer.from(patched, 'utf8'), patched: true };
}

async function sendContent(res, packageId, rel) {
    const key = packageContentKey(packageId, rel);
    const storage = getObjectStorage();
    const buf = await storage.getObjectBuffer(key);
    const served = await patchAiAuthorHtmlIfNeeded(packageId, rel, buf);

    res.setHeader('Content-Type', guessContentType(rel));
    res.setHeader('Cache-Control', served.patched ? 'private, no-store' : 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
    res.send(served.buffer);
}

function normalizeRel(pathParam) {
    let rel = pathParam || '';
    if (Array.isArray(rel)) rel = rel.join('/');
    return String(rel).replace(/^\/+/, '');
}

router.get('/t/:accessToken/*path', async (req, res) => {
    try {
        const accessToken = decodeURIComponent(req.params.accessToken || '');
        const rel = normalizeRel(req.params.path);
        const access = await resolvePackageAccess(accessToken, null);
        if (!access) return res.status(401).json({ message: 'Unauthorized' });
        await sendContent(res, access.packageId, rel);
    } catch (err) {
        res.status(404).json({ message: 'Content not found' });
    }
});

router.get('/:packageId/*path', async (req, res) => {
    try {
        const packageId = req.params.packageId;
        if (packageId === 't') return res.status(404).json({ message: 'Not found' });
        const rel = normalizeRel(req.params.path);
        const auth = (req.header('Authorization') || '').replace(/^Bearer\s+/i, '');
        const token = auth || req.query.token;
        const access = await resolvePackageAccess(token, packageId);
        if (!access || access.packageId !== packageId) return res.status(401).json({ message: 'Unauthorized' });
        await sendContent(res, packageId, rel);
    } catch (err) {
        res.status(404).json({ message: 'Content not found' });
    }
});

router.patchAuthoredHtml = patchAuthoredHtml;
module.exports = router;
