const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const {
    ScormCourse,
    ScormPackage,
    ScormRegistration
} = require('../../models/scorm');
const { createInviteCode, signRegistrationToken } = require('../../services/scorm/ScormInviteService');
const { prepareCoursePreview } = require('../../services/scorm/ScormPreviewService');
const { resolveCourseOrPackageId } = require('../../services/scorm/ScormCourseWorkspaceService');
const ScormReportService = require('../../services/ScormReportService');
const ScormIndividualLearnerReportService = require('../../services/scorm/ScormIndividualLearnerReportService');

router.get('/', auth, async (req, res) => {
    const courses = await ScormCourse.findAll({
        where: { hostId: req.userId },
        include: [{ model: ScormPackage, as: 'package' }],
        order: [['createdAt', 'DESC']]
    });
    res.json(
        courses.filter(
            (c) => c.status !== 'archived' && c.package && c.package.status !== 'deleted'
        )
    );
});

router.get('/reports/all', auth, async (req, res) => {
    try {
        const reports = await ScormReportService.listCourseReports(req.userId);
        res.json(reports);
    } catch (err) {
        console.error('[scorm-reports] list failed', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/reports/learners', auth, async (req, res) => {
    try {
        const query = String(req.query.q || '').slice(0, 160);
        const learners = await ScormIndividualLearnerReportService.searchLearners(req.userId, query);
        res.json(learners);
    } catch (err) {
        console.error('[scorm-reports] learner search failed', err);
        res.status(500).json({ message: 'Unable to search learners' });
    }
});

router.get('/reports/learner', auth, async (req, res) => {
    try {
        const email = String(req.query.email || '').trim();
        const format = String(req.query.format || 'pdf').toLowerCase();
        if (!email) return res.status(400).json({ message: 'Learner email is required' });
        if (!['pdf', 'excel'].includes(format)) return res.status(400).json({ message: 'Invalid format' });

        const generated = await ScormIndividualLearnerReportService.generateLearnerReportFile({
            hostId: req.userId,
            email,
            format
        });

        res.download(generated.outputPath, generated.downloadName, (err) => {
            ScormReportService.safeUnlink(generated.outputPath);
            if (err && !res.headersSent) res.status(500).json({ message: 'Learner report download failed' });
        });
    } catch (err) {
        console.error('[scorm-reports] learner export failed', {
            message: err && err.message,
            code: err && err.code
        });
        if (err.code === 'LEARNER_EMAIL_REQUIRED') return res.status(400).json({ message: 'Learner email is required' });
        if (err.code === 'LEARNER_NOT_FOUND') return res.status(404).json({ message: 'Learner not found for this SCORM AI account' });
        if (err.code === 'INVALID_FORMAT') return res.status(400).json({ message: 'Invalid format' });
        res.status(500).json({ message: 'Learner report generation failed' });
    }
});

router.post('/', auth, async (req, res) => {
    try {
        const { packageId, title, description } = req.body || {};
        if (!packageId) return res.status(400).json({ message: 'packageId required' });
        const pkg = await ScormPackage.findOne({ where: { id: packageId, hostId: req.userId } });
        if (!pkg || pkg.status !== 'ready') {
            return res.status(400).json({ message: 'Package not found or not ready' });
        }
        const inviteCode = await createInviteCode();
        const course = await ScormCourse.create({
            hostId: req.userId,
            packageId: pkg.id,
            title: (title || pkg.title || 'Untitled course').slice(0, 200),
            description: description || null,
            inviteCode,
            status: 'draft'
        });
        res.status(201).json(course);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/code/:inviteCode', async (req, res) => {
    const course = await ScormCourse.findOne({
        where: { inviteCode: req.params.inviteCode, status: 'published' },
        include: [{ model: ScormPackage, as: 'package' }],
        attributes: ['id', 'title', 'description', 'inviteCode', 'status', 'packageId']
    });
    if (!course || !course.package || course.package.status === 'deleted') {
        return res.status(404).json({ message: 'Course not found' });
    }
    res.json({
        id: course.id,
        title: course.title,
        description: course.description,
        inviteCode: course.inviteCode,
        status: course.status
    });
});

router.get('/:id/report', auth, async (req, res) => {
    try {
        const format = String(req.query.format || 'pdf').toLowerCase();
        if (!['pdf', 'excel'].includes(format)) return res.status(400).json({ message: 'Invalid format' });

        const generated = await ScormReportService.generateReportFile({
            courseId: req.params.id,
            hostId: req.userId,
            format
        });

        res.download(generated.outputPath, generated.downloadName, (err) => {
            ScormReportService.safeUnlink(generated.outputPath);
            if (err && !res.headersSent) res.status(500).json({ message: 'Report download failed' });
        });
    } catch (err) {
        console.error('[scorm-reports] export failed', {
            message: err && err.message,
            code: err && err.code,
            stack: err && err.stack ? String(err.stack).slice(0, 1500) : null
        });
        if (err.code === 'COURSE_NOT_FOUND') return res.status(404).json({ message: 'Course not found' });
        if (err.code === 'INVALID_FORMAT') return res.status(400).json({ message: 'Invalid format' });
        res.status(500).json({
            message: 'Report generation failed',
            detail: process.env.NODE_ENV === 'production' ? undefined : (err && err.message)
        });
    }
});

router.get('/:id', auth, async (req, res) => {
    await resolveCourseOrPackageId({ id: req.params.id, hostId: req.userId });
    const course = await ScormCourse.findOne({
        where: { id: req.params.id, hostId: req.userId },
        include: [{ model: ScormPackage, as: 'package' }]
    });
    if (!course || course.status === 'archived') return res.status(404).json({ message: 'Not found' });
    res.json(course);
});

router.patch('/:id', auth, async (req, res) => {
    try {
        await resolveCourseOrPackageId({ id: req.params.id, hostId: req.userId });
        const course = await ScormCourse.findOne({ where: { id: req.params.id, hostId: req.userId } });
        if (!course) return res.status(404).json({ message: 'Not found' });
        const { title, description, status, settings } = req.body || {};
        if (title != null) course.title = String(title).slice(0, 200);
        if (description != null) course.description = description;
        if (settings != null) course.settings = settings;
        if (status != null) {
            if (!['draft', 'published', 'archived'].includes(status)) {
                return res.status(400).json({ message: 'Invalid status' });
            }
            if (status === 'published') {
                const pkg = await ScormPackage.findByPk(course.packageId);
                if (!pkg || pkg.status !== 'ready') {
                    return res.status(400).json({ message: 'Package must be ready to publish' });
                }
                if (!course.inviteCode) course.inviteCode = await createInviteCode();
                course.publishedAt = new Date();
            }
            course.status = status;
        }
        await course.save();
        res.json(course);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/:id/registrations', auth, async (req, res) => {
    await resolveCourseOrPackageId({ id: req.params.id, hostId: req.userId });
    const course = await ScormCourse.findOne({ where: { id: req.params.id, hostId: req.userId } });
    if (!course) return res.status(404).json({ message: 'Not found' });
    const regs = await ScormRegistration.findAll({
        where: { courseId: course.id, isPreview: false },
        order: [['updatedAt', 'DESC']]
    });
    res.json(regs);
});

router.post('/:id/preview', auth, async (req, res) => {
    try {
        await resolveCourseOrPackageId({ id: req.params.id, hostId: req.userId });
        const course = await ScormCourse.findOne({
            where: { id: req.params.id, hostId: req.userId },
            include: [{ model: ScormPackage, as: 'package' }]
        });
        if (!course) return res.status(404).json({ message: 'Not found' });
        if (!course.package || course.package.status !== 'ready') {
            return res.status(400).json({ message: 'Package not ready' });
        }

        const prepared = await prepareCoursePreview(course.id);
        const reg = prepared.registration;
        const token = signRegistrationToken(reg.id, course.id);

        res.status(201).json({
            registrationId: reg.id,
            token,
            packageId: course.package.id,
            entryHref: course.package.entryHref,
            playUrl: `/api/scorm/play/${reg.id}`,
            qaOnly: true,
            reusedPreview: prepared.reused,
            deduplicatedPreviews: prepared.removedDuplicates
        });
    } catch (err) {
        if (err.code === 'COURSE_NOT_FOUND') return res.status(404).json({ message: 'Not found' });
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
