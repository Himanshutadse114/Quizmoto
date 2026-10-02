const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const {
    catalogAdminData,
    setDefaultCourse,
    grantCourseToTenant,
    removeGrant
} = require('../../services/scorm/ScormCourseCatalogService');

function requireSuperAdmin(req, res, next) {
    if (req.scormRole !== 'super_admin') {
        return res.status(403).json({ message: 'Super Admin access is required.', code: 'SCORM_SUPER_ADMIN_REQUIRED' });
    }
    next();
}

router.use(auth, requireSuperAdmin);

router.get('/', async (req, res) => {
    try {
        res.json(await catalogAdminData(req.userId));
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to load the course catalogue.', code: err.code });
    }
});

router.put('/defaults/:courseId', async (req, res) => {
    try {
        await setDefaultCourse({ courseId: req.params.courseId, sourceHostId: req.userId, actorUserId: req.authenticatedUserId });
        res.json({ ok: true });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to add the default course.', code: err.code });
    }
});

router.delete('/defaults/:courseId', async (req, res) => {
    try {
        await removeGrant({ courseId: req.params.courseId });
        res.json({ ok: true });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to remove the default course.', code: err.code });
    }
});

router.put('/tenants/:workspaceId/courses/:courseId', async (req, res) => {
    try {
        await grantCourseToTenant({
            courseId: req.params.courseId,
            workspaceId: req.params.workspaceId,
            sourceHostId: req.userId,
            actorUserId: req.authenticatedUserId
        });
        res.json({ ok: true });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to assign the course.', code: err.code });
    }
});

router.delete('/tenants/:workspaceId/courses/:courseId', async (req, res) => {
    try {
        await removeGrant({ courseId: req.params.courseId, workspaceId: req.params.workspaceId });
        res.json({ ok: true });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to remove the tenant course.', code: err.code });
    }
});

module.exports = router;
