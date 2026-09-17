const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const { getCampaignCreateOptions } = require('../../services/scorm/ScormCampaignCreateOptionsService');
const { listPublishedTenantFlipbooks } = require('../../services/scorm/ScormFlipbookAssignmentService');

router.get('/', auth, async (req, res) => {
    try {
        if (!req.scormWorkspaceId) {
            return res.status(400).json({
                message: 'A workspace is required to create campaigns.',
                code: 'SCORM_WORKSPACE_REQUIRED'
            });
        }
        const [base, flipbooks] = await Promise.all([
            getCampaignCreateOptions({ hostId: req.userId, workspaceId: req.scormWorkspaceId }),
            listPublishedTenantFlipbooks({ hostId: req.userId, workspaceId: req.scormWorkspaceId })
        ]);
        res.setHeader('Cache-Control', 'no-store');
        return res.json({ ok: true, ...base, flipbooks });
    } catch (error) {
        return res.status(error.status || 500).json({
            message: error.message || 'Unable to load campaign creation options.',
            code: error.code
        });
    }
});

module.exports = router;
