const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const {
    ScormCourse,
    ScormPackage,
    ScormRegistration
} = require('../../models/scorm');
const { createInviteCode, signRegistrationToken } = require('../../services/scorm/ScormInviteService');

router.get('/', auth, async (req, res) => {
    const courses = await ScormCourse.findAll({
        where: { hostId: req.userId },
        include: [{ model: ScormPackage, as: 'package' }],
        order: [['createdAt', 'DESC']]
    });
    res.json(courses.filter((c) => c.status !== 'archived'));
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
        attributes: ['id', 'title', 'description', 'inviteCode', 'status']
    });
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json(course);
});

router.get('/:id', auth, async (req, res) => {
    const course = await ScormCourse.findOne({
        where: { id: req.params.id, hostId: req.userId },
        include: [{ model: ScormPackage, as: 'package' }]
    });
    if (!course) return res.status(404).json({ message: 'Not found' });
    res.json(course);
});

router.patch('/:id', auth, async (req, res) => {
    try {
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
    const course = await ScormCourse.findOne({ where: { id: req.params.id, hostId: req.userId } });
    if (!course) return res.status(404).json({ message: 'Not found' });
    const regs = await ScormRegistration.findAll({
        where: { courseId: course.id },
        order: [['updatedAt', 'DESC']]
    });
    res.json(regs);
});

router.post('/:id/preview', auth, async (req, res) => {
    try {
        const course = await ScormCourse.findOne({
            where: { id: req.params.id, hostId: req.userId },
            include: [{ model: ScormPackage, as: 'package' }]
        });
        if (!course) return res.status(404).json({ message: 'Not found' });
        if (!course.package || course.package.status !== 'ready') {
            return res.status(400).json({ message: 'Package not ready' });
        }
        const reg = await ScormRegistration.create({
            courseId: course.id,
            learnerName: 'Host Preview',
            learnerEmail: null,
            status: 'active',
            isPreview: true
        });
        const token = signRegistrationToken(reg.id, course.id);
        res.status(201).json({
            registrationId: reg.id,
            token,
            packageId: course.package.id,
            entryHref: course.package.entryHref
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
