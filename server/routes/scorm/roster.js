const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const { sequelize } = require('../../config/database');
const { ScormLearnerRoster } = require('../../models/scorm');

const MAX_BULK = 10000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeRows(rows) {
    const seen = new Set();
    const valid = [];
    const invalid = [];

    for (const raw of Array.isArray(rows) ? rows : []) {
        const input = typeof raw === 'string' ? { email: raw } : (raw || {});
        const email = normalizeEmail(input.email);
        if (!email || !EMAIL_RE.test(email)) {
            if (String(input.email || '').trim()) invalid.push(String(input.email).trim());
            continue;
        }
        if (seen.has(email)) continue;
        seen.add(email);
        valid.push({
            email,
            learnerName: String(input.learnerName || input.name || '').trim().slice(0, 255) || null
        });
    }

    return { valid, invalid };
}

router.get('/', auth, async (req, res) => {
    try {
        const rows = await ScormLearnerRoster.findAll({
            where: { hostId: req.userId },
            order: [['email', 'ASC']]
        });
        res.json({
            ok: true,
            total: rows.length,
            roster: rows.map((row) => ({
                id: row.id,
                email: row.email,
                learnerName: row.learnerName,
                source: row.source,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt
            }))
        });
    } catch (err) {
        res.status(500).json({ message: 'Unable to load learner roster' });
    }
});

router.put('/', auth, async (req, res) => {
    try {
        const mode = String(req.body?.mode || 'append').toLowerCase() === 'replace' ? 'replace' : 'append';
        const { valid, invalid } = normalizeRows(req.body?.learners || req.body?.emails || []);
        if (!valid.length) return res.status(400).json({ message: 'Add at least one valid learner email address.' });
        if (valid.length > MAX_BULK) return res.status(413).json({ message: `A maximum of ${MAX_BULK} learner emails can be uploaded at once.` });

        await sequelize.transaction(async (transaction) => {
            if (mode === 'replace') {
                await ScormLearnerRoster.destroy({ where: { hostId: req.userId }, transaction });
            }

            await ScormLearnerRoster.bulkCreate(
                valid.map((row) => ({
                    hostId: req.userId,
                    email: row.email,
                    learnerName: row.learnerName,
                    source: 'upload'
                })),
                { transaction, ignoreDuplicates: true }
            );
        });

        const total = await ScormLearnerRoster.count({ where: { hostId: req.userId } });
        res.json({
            ok: true,
            mode,
            accepted: valid.length,
            invalid,
            total
        });
    } catch (err) {
        res.status(500).json({ message: 'Unable to update learner roster' });
    }
});

router.post('/', auth, async (req, res) => {
    try {
        const email = normalizeEmail(req.body?.email);
        if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
        const learnerName = String(req.body?.learnerName || req.body?.name || '').trim().slice(0, 255) || null;
        const [row, created] = await ScormLearnerRoster.findOrCreate({
            where: { hostId: req.userId, email },
            defaults: { learnerName, source: 'manual' }
        });
        if (!created && learnerName && row.learnerName !== learnerName) {
            row.learnerName = learnerName;
            await row.save();
        }
        res.status(created ? 201 : 200).json({ ok: true, roster: row });
    } catch (err) {
        res.status(500).json({ message: 'Unable to add learner' });
    }
});

router.delete('/:id', auth, async (req, res) => {
    try {
        const removed = await ScormLearnerRoster.destroy({
            where: { id: req.params.id, hostId: req.userId }
        });
        if (!removed) return res.status(404).json({ message: 'Learner not found in roster' });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ message: 'Unable to remove learner' });
    }
});

router.delete('/', auth, async (req, res) => {
    try {
        const removed = await ScormLearnerRoster.destroy({ where: { hostId: req.userId } });
        res.json({ ok: true, removed });
    } catch (err) {
        res.status(500).json({ message: 'Unable to clear learner roster' });
    }
});

module.exports = router;
