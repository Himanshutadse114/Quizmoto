const express = require('express');
const router = express.Router();
const { getObjectStorage } = require('../../storage/ObjectStorage');
const { packageContentKey } = require('../../services/scorm/storageKeys');
const { ScormPackage, ScormRegistration, ScormCourse } = require('../../models/scorm');
const jwt = require('jsonwebtoken');
const { guessContentType } = require('../../services/scorm/ScormUnpackService');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

/**
 * Resolve packageId from a registration JWT or host JWT + packageId hint.
 * Path-based tokens are required so relative scripts/CSS in the SCO
 * keep the same /t/:token/ prefix and stay authorized.
 */
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
        return {
            packageId: reg.course.packageId,
            registrationId: reg.id
        };
    }

    if (decoded.userId && packageIdHint) {
        const pkg = await ScormPackage.findOne({
            where: { id: packageIdHint, hostId: decoded.userId }
        });
        if (!pkg) return null;
        return { packageId: pkg.id, registrationId: null };
    }

    return null;
}

async function sendContent(res, packageId, rel) {
    const key = packageContentKey(packageId, rel);
    const storage = getObjectStorage();
    const buf = await storage.getObjectBuffer(key);
    res.setHeader('Content-Type', guessContentType(rel));
    res.setHeader('Cache-Control', 'private, max-age=300');
    // Allow iframe embedding from the frontend origin
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buf);
}

function normalizeRel(pathParam) {
    let rel = pathParam || '';
    if (Array.isArray(rel)) rel = rel.join('/');
    return String(rel).replace(/^\/+/, '');
}

/**
 * Preferred: token in the path so relative assets inherit auth.
 * Example: /api/scorm/content/t/<jwt>/index_lms.html
 *          /api/scorm/content/t/<jwt>/lms/scormdriver.js
 */
router.get('/t/:accessToken/*path', async (req, res) => {
    try {
        const accessToken = decodeURIComponent(req.params.accessToken || '');
        const rel = normalizeRel(req.params.path);
        const access = await resolvePackageAccess(accessToken, null);
        if (!access) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        await sendContent(res, access.packageId, rel);
    } catch (err) {
        res.status(404).json({ message: 'Content not found' });
    }
});

/**
 * Legacy: packageId in path + ?token= query (only works for the entry HTML;
 * relative scripts lose the query and 401). Kept for short transition.
 */
router.get('/:packageId/*path', async (req, res) => {
    try {
        const packageId = req.params.packageId;
        // Skip if this looks like the /t/ route was mis-matched
        if (packageId === 't') {
            return res.status(404).json({ message: 'Not found' });
        }
        const rel = normalizeRel(req.params.path);
        const auth = (req.header('Authorization') || '').replace(/^Bearer\s+/i, '');
        const token = auth || req.query.token;
        const access = await resolvePackageAccess(token, packageId);
        if (!access || access.packageId !== packageId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        await sendContent(res, packageId, rel);
    } catch (err) {
        res.status(404).json({ message: 'Content not found' });
    }
});

module.exports = router;
