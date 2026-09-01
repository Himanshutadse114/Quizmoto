const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const {
    serializeWorkspace,
    listWorkspaceMembers,
    inviteWorkspaceMember,
    changeWorkspaceMemberRole,
    removeWorkspaceMember
} = require('../../services/scorm/ScormWorkspaceService');
const { sendTeamInviteEmail } = require('../../services/mail/TransactionalMailService');

function requireWorkspaceAdmin(req, res, next) {
    const canManageWorkspace = req.scormRole === 'admin' || req.scormRole === 'super_admin';
    if (!canManageWorkspace || !req.scormWorkspace) {
        return res.status(403).json({
            message: 'Workspace Admin access is required to manage team roles.',
            code: 'SCORM_WORKSPACE_ADMIN_REQUIRED'
        });
    }
    next();
}

function sendError(res, err, fallback) {
    const status = Number(err?.status) || 500;
    return res.status(status).json({
        message: err?.message || fallback,
        code: err?.code || 'SCORM_TEAM_ERROR'
    });
}

router.get('/', auth, requireWorkspaceAdmin, async (req, res) => {
    try {
        const members = await listWorkspaceMembers(req.scormWorkspace.id);
        res.json({
            workspace: serializeWorkspace(req.scormWorkspace),
            currentRole: req.scormRole,
            members
        });
    } catch (err) {
        console.error('[scorm-team] list failed', err);
        sendError(res, err, 'Could not load workspace team members.');
    }
});

router.post('/', auth, requireWorkspaceAdmin, async (req, res) => {
    try {
        const member = await inviteWorkspaceMember({
            workspace: req.scormWorkspace,
            actorUserId: req.authenticatedUserId,
            actorEmail: req.scormEmail,
            email: req.body?.email,
            displayName: req.body?.displayName || req.body?.name || null,
            role: req.body?.role
        });
        const mail = await sendTeamInviteEmail({
            member,
            workspaceName: req.scormWorkspace.name,
            invitedByEmail: req.scormEmail
        });
        res.status(201).json({ ok: true, member, mail });
    } catch (err) {
        console.error('[scorm-team] invite failed', err);
        sendError(res, err, 'Could not add this team member.');
    }
});

router.patch('/:id', auth, requireWorkspaceAdmin, async (req, res) => {
    try {
        const member = await changeWorkspaceMemberRole({
            workspaceId: req.scormWorkspace.id,
            memberId: req.params.id,
            actorUserId: req.authenticatedUserId,
            actorEmail: req.scormEmail,
            role: req.body?.role
        });
        res.json({ ok: true, member });
    } catch (err) {
        console.error('[scorm-team] role update failed', err);
        sendError(res, err, 'Could not update this team member.');
    }
});

router.delete('/:id', auth, requireWorkspaceAdmin, async (req, res) => {
    try {
        const result = await removeWorkspaceMember({
            workspaceId: req.scormWorkspace.id,
            memberId: req.params.id
        });
        res.json(result);
    } catch (err) {
        console.error('[scorm-team] remove failed', err);
        sendError(res, err, 'Could not remove this team member.');
    }
});

module.exports = router;
