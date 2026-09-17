const crypto = require('crypto');
const User = require('../models/User');
const FlipbookLibrary = require('../models/FlipbookLibrary');
const { ScormWorkspaceMember } = require('../models/scorm');

const ACCOUNT_STATUSES = new Set(['active', 'removed', 'blocked']);
const MAX_AVATAR_DATA_LENGTH = 750000;

function fail(message, code, status = 400) {
    const err = new Error(message);
    err.code = code;
    err.status = status;
    return err;
}

function accountStatus(user) {
    const value = String(user?.accountStatus || 'active').trim().toLowerCase();
    return ACCOUNT_STATUSES.has(value) ? value : 'active';
}

function assertActiveAccount(user) {
    if (!user) throw fail('Platform account no longer exists.', 'PLATFORM_AUTH_REQUIRED', 401);
    const status = accountStatus(user);
    if (status === 'blocked') {
        throw fail('This account has been blocked. Contact the LMSGEN administrator.', 'PLATFORM_ACCOUNT_BLOCKED', 403);
    }
    if (status === 'removed') {
        throw fail('This account has been removed. Register again or contact the LMSGEN administrator.', 'PLATFORM_ACCOUNT_REMOVED', 403);
    }
    return user;
}

function cleanDisplayName(value) {
    const name = String(value || '').replace(/\s+/g, ' ').trim();
    if (name.length < 2 || name.length > 80) {
        throw fail('Name must be between 2 and 80 characters.', 'ACCOUNT_NAME_INVALID');
    }
    return name;
}

function cleanLibraryTitle(value) {
    const title = String(value || '').replace(/\s+/g, ' ').trim();
    if (title.length < 2 || title.length > 180) {
        throw fail('Publica library name must be between 2 and 180 characters.', 'PUBLICA_LIBRARY_NAME_INVALID');
    }
    return title;
}

function cleanAvatar(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const avatar = String(value).trim();
    if (/^https:\/\//i.test(avatar)) {
        if (avatar.length > 2048) throw fail('Avatar URL is too long.', 'ACCOUNT_AVATAR_INVALID');
        return avatar;
    }
    if (/^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i.test(avatar)) {
        if (avatar.length > MAX_AVATAR_DATA_LENGTH) {
            throw fail('Avatar image is too large. Choose an image under 500 KB.', 'ACCOUNT_AVATAR_TOO_LARGE', 413);
        }
        return avatar;
    }
    throw fail('Use a secure image URL or upload a PNG, JPEG, or WebP avatar.', 'ACCOUNT_AVATAR_INVALID');
}

function shareToken() {
    return crypto.randomBytes(24).toString('hex');
}

async function getOrCreateLibrary(user) {
    const [library] = await FlipbookLibrary.findOrCreate({
        where: { ownerUserId: user.id },
        defaults: {
            ownerUserId: user.id,
            ownerEmail: String(user.email || '').trim().toLowerCase() || null,
            title: `${user.displayName || user.username || 'My'} Publica Library`.slice(0, 180),
            description: null,
            shareToken: shareToken(),
            shareEnabled: true
        }
    });
    return library;
}

function profilePayload(user, library = null) {
    return {
        id: user.id,
        displayName: user.displayName || user.username || '',
        username: user.displayName || user.username || '',
        email: user.email || null,
        avatar: user.avatar || null,
        accountStatus: accountStatus(user),
        publicaLibraryName: library?.title || null
    };
}

async function getAccountProfile(userId) {
    const user = assertActiveAccount(await User.findByPk(userId));
    const library = await getOrCreateLibrary(user);
    return profilePayload(user, library);
}

async function updateAccountProfile({ userId, displayName, avatar, publicaLibraryName }) {
    const user = assertActiveAccount(await User.findByPk(userId));
    const library = await getOrCreateLibrary(user);

    if (displayName !== undefined) user.displayName = cleanDisplayName(displayName);
    if (avatar !== undefined) user.avatar = cleanAvatar(avatar);
    if (publicaLibraryName !== undefined) library.title = cleanLibraryTitle(publicaLibraryName);

    await user.save();
    await library.save();

    const membership = user.email
        ? await ScormWorkspaceMember.findOne({ where: { email: String(user.email).trim().toLowerCase() } })
        : await ScormWorkspaceMember.findOne({ where: { userId: user.id } });
    if (membership && user.displayName) {
        membership.displayName = user.displayName;
        await membership.save();
    }

    return profilePayload(user, library);
}

module.exports = {
    accountStatus,
    assertActiveAccount,
    cleanAvatar,
    cleanDisplayName,
    cleanLibraryTitle,
    getOrCreateLibrary,
    getAccountProfile,
    updateAccountProfile,
    profilePayload
};
