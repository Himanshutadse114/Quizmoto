const crypto = require('crypto');
const FlipbookLibrary = require('../models/FlipbookLibrary');
const { publicIdentifierWhere } = require('./PublicaBrandingService');

// 16 URL-safe characters, with 96 bits of randomness. Never expose account IDs.
function createShortIdentifier() {
    return crypto.randomBytes(12).toString('base64url');
}

async function assignLibraryLink(library, { regenerate = false } = {}) {
    if (library.shareSlug && !regenerate) return library;
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const shareSlug = createShortIdentifier();
        if (await FlipbookLibrary.findOne({ where: publicIdentifierWhere(shareSlug), attributes: ['id'] })) continue;
        try {
            const values = { shareSlug };
            if (regenerate) values.shareToken = crypto.randomBytes(24).toString('hex');
            // A concurrent first visit must not replace an alias already handed out.
            await FlipbookLibrary.update(values, {
                where: regenerate ? { id: library.id } : { id: library.id, shareSlug: null }
            });
            await library.reload();
            if (library.shareSlug) return library;
        } catch (error) {
            if (error.name !== 'SequelizeUniqueConstraintError') throw error;
        }
    }
    throw Object.assign(new Error('Unable to create a library link. Please try again.'), { status: 503, code: 'PUBLICA_LIBRARY_LINK_UNAVAILABLE' });
}

module.exports = { createShortIdentifier, assignLibraryLink };
