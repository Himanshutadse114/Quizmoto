const User = require('../../models/User');
const { ScormWorkspace } = require('../../models/scorm');
const { getAccessRole } = require('./ScormAccessService');
const { resolveWorkspaceContext } = require('./ScormWorkspaceService');

// Keeps stored logos small: this is a header-height mark, not a hero image.
// 300KB of base64 covers a crisp PNG/SVG logo with headroom.
const MAX_LOGO_BASE64_BYTES = 300 * 1024;
const LOGO_DATA_URL_PATTERN = /^data:image\/(png|jpe?g|webp|svg\+xml);base64,([a-zA-Z0-9+/]+=*)$/;

function fail(message, code, status = 400) {
    const err = new Error(message);
    err.code = code;
    err.status = status;
    return err;
}

function normalizeLogoDataUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const match = raw.match(LOGO_DATA_URL_PATTERN);
    if (!match) {
        throw fail('Logo must be a PNG, JPEG, WebP or SVG image.', 'SCORM_LOGO_INVALID_FORMAT', 422);
    }
    if (match[2].length > MAX_LOGO_BASE64_BYTES) {
        throw fail('Logo file is too large. Please upload an image under 200KB.', 'SCORM_LOGO_TOO_LARGE', 422);
    }
    return raw;
}

async function getWorkspaceBranding(workspaceId) {
    if (!workspaceId) throw fail('Workspace is required.', 'SCORM_WORKSPACE_REQUIRED');
    const workspace = await ScormWorkspace.findByPk(workspaceId);
    if (!workspace) throw fail('Workspace not found.', 'SCORM_WORKSPACE_NOT_FOUND', 404);
    return { logoDataUrl: workspace.logoDataUrl || null };
}

async function saveWorkspaceBranding({ workspaceId, logoDataUrl }) {
    if (!workspaceId) throw fail('Workspace is required.', 'SCORM_WORKSPACE_REQUIRED');
    const workspace = await ScormWorkspace.findByPk(workspaceId);
    if (!workspace) throw fail('Workspace not found.', 'SCORM_WORKSPACE_NOT_FOUND', 404);

    workspace.logoDataUrl = normalizeLogoDataUrl(logoDataUrl);
    await workspace.save();
    return { logoDataUrl: workspace.logoDataUrl || null };
}

// Course packaging for the background/async generation queue only has a
// userId, no request context. This mirrors the workspace resolution the
// request middleware already performs, so a queued course picks up the same
// tenant logo a synchronous request would via req.scormWorkspace. Branding
// lookup failures must never fail course generation, so this always resolves
// to null instead of throwing.
async function resolveWorkspaceLogoForUserId(userId) {
    if (!userId) return null;
    try {
        const user = await User.findByPk(userId);
        if (!user) return null;
        const role = await getAccessRole(user.email);
        if (!role) return null;
        const { workspace } = await resolveWorkspaceContext({ user, role });
        return workspace?.logoDataUrl || null;
    } catch (_) {
        return null;
    }
}

module.exports = {
    getWorkspaceBranding,
    saveWorkspaceBranding,
    resolveWorkspaceLogoForUserId
};
