const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const {
    ADMIN_CONTACT_EMAIL,
    SUPER_ADMIN_EMAIL,
    listGrants,
    addGrant,
    removeGrant
} = require('../../services/scorm/ScormAccessService');

function requireSuperAdmin(req, res, next) {
    if (req.scormRole !== 'super_admin') {
        return res.status(403).json({
            message: 'Super administrator access is required.',
            code: 'SCORM_SUPER_ADMIN_REQUIRED'
        });
    }
    next();
}

function serializeGrant(grant) {
    return {
        id: grant.id,
        email: grant.email,
        role: grant.role,
        addedByEmail: grant.addedByEmail || null,
        createdAt: grant.createdAt,
        updatedAt: grant.updatedAt,
        protected: grant.role === 'super_admin' || grant.email === SUPER_ADMIN_EMAIL
    };
}

router.get('/me', auth, async (req, res) => {
    res.json({
        email: req.scormEmail || null,
        role: req.scormRole || 'user',
        isSuperAdmin: req.scormRole === 'super_admin',
        adminContact: ADMIN_CONTACT_EMAIL
    });
});

router.get('/', auth, requireSuperAdmin, async (req, res) => {
    try {
        const grants = await listGrants();
        res.json({
            superAdminEmail: SUPER_ADMIN_EMAIL,
            adminContact: ADMIN_CONTACT_EMAIL,
            grants: grants.map(serializeGrant)
        });
    } catch (err) {
        console.error('[scorm-access] list failed', err);
        res.status(500).json({ message: 'Could not load SCORM AI access list.' });
    }
});

router.post('/', auth, requireSuperAdmin, async (req, res) => {
    try {
        const grant = await addGrant({
            email: req.body?.email,
            addedByUserId: req.userId,
            addedByEmail: req.scormEmail
        });
        res.status(201).json({ grant: serializeGrant(grant) });
    } catch (err) {
        if (err.code === 'INVALID_EMAIL') {
            return res.status(400).json({ message: err.message });
        }
        console.error('[scorm-access] add failed', err);
        res.status(500).json({ message: 'Could not add SCORM AI access.' });
    }
});

router.delete('/:id', auth, requireSuperAdmin, async (req, res) => {
    try {
        const result = await removeGrant(req.params.id);
        if (!result.removed && result.reason === 'not_found') {
            return res.status(404).json({ message: 'Access grant not found.' });
        }
        if (!result.removed && result.reason === 'super_admin') {
            return res.status(400).json({ message: 'The SCORM AI super administrator cannot be removed.' });
        }
        res.json({ removed: true, id: Number(req.params.id) || req.params.id });
    } catch (err) {
        console.error('[scorm-access] remove failed', err);
        res.status(500).json({ message: 'Could not remove SCORM AI access.' });
    }
});

module.exports = router;
