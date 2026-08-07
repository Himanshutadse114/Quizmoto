const express = require('express');
const router = express.Router();
const { getObjectStorage } = require('../../storage/ObjectStorage');
const { packageContentKey } = require('../../services/scorm/storageKeys');
const { ScormPackage, ScormRegistration, ScormCourse } = require('../../models/scorm');
const jwt = require('jsonwebtoken');
const { guessContentType } = require('../../services/scorm/ScormUnpackService');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

async function authorizeContent(req, packageId) {
    const auth = (req.header('Authorization') || '').replace(/^Bearer\s+/i, '');
    const token = auth || req.query.token;
    if (!token) return false;

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.userId) {
            const pkg = await ScormPackage.findOne({ where: { id: packageId, hostId: decoded.userId } });
            return !!pkg;
        }
        if (decoded.typ === 'scorm_reg' && decoded.scormRegId) {
            const reg = await ScormRegistration.findByPk(decoded.scormRegId, {
                include: [{ model: ScormCourse, as: 'course' }]
            });
            return !!(reg && reg.course && reg.course.packageId === packageId && reg.status !== 'revoked');
        }
    } catch (_) {
        return false;
    }
    return false;
}

// Express 5 / path-to-regexp v8: wildcard must be a named parameter (*path)
router.get('/:packageId/*path', async (req, res) => {
    try {
        const packageId = req.params.packageId;
        // path may be a string or (rarely) an array depending on matcher
        let rel = req.params.path || '';
        if (Array.isArray(rel)) rel = rel.join('/');
        rel = String(rel).replace(/^\/+/, '');

        if (!(await authorizeContent(req, packageId))) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const key = packageContentKey(packageId, rel);
        const storage = getObjectStorage();
        const buf = await storage.getObjectBuffer(key);
        res.setHeader('Content-Type', guessContentType(rel));
        res.setHeader('Cache-Control', 'private, max-age=300');
        res.send(buf);
    } catch (err) {
        res.status(404).json({ message: 'Content not found' });
    }
});

module.exports = router;
