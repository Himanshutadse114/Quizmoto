const { getEntitlement } = require('./ScormEntitlementService');

function avatarExportBuyerId(req = {}) {
    return req.authenticatedUserId || req.userId || null;
}

async function complimentaryAvatarExportSource(req = {}) {
    if (req.scormRole === 'super_admin') return 'super_admin';
    if (req.scormEntitlement?.permissions?.avatarStudioFreeExports === true) return 'tenant';
    if (!req.scormEmail) return null;

    const personal = await getEntitlement(req.scormEmail, 'user');
    return personal?.permissions?.avatarStudioFreeExports === true ? 'user' : null;
}

module.exports = {
    avatarExportBuyerId,
    complimentaryAvatarExportSource
};
