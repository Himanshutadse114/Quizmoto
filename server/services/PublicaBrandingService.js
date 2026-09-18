const { Op } = require('sequelize');
const Flipbook = require('../models/Flipbook');

function publicAppUrl() {
    return String(process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || 'https://www.lmsgen.in').replace(/\/+$/, '');
}

function cleanIdentifier(value, { label = 'Link name', min = 3, max = 64, allowEmpty = true } = {}) {
    const text = String(value || '').trim().toLowerCase();
    if (!text && allowEmpty) return null;
    if (!text) throw Object.assign(new Error(`${label} is required.`), { status: 400, code: 'PUBLICA_IDENTIFIER_REQUIRED' });
    if (text.length < min || text.length > max || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text)) {
        throw Object.assign(new Error(`${label} must be ${min}-${max} characters using lowercase letters, numbers and single hyphens.`), { status: 400, code: 'PUBLICA_IDENTIFIER_INVALID' });
    }
    return text;
}

function cleanShareSlug(value) {
    return cleanIdentifier(value, { label: 'Custom link', min: 3, max: 64 });
}

function shareIdentifier(record) {
    return record?.shareSlug || record?.shareToken || '';
}

function publicationUrl(book) {
    return `${publicAppUrl()}/publica/${shareIdentifier(book)}`;
}

function libraryUrl(library) {
    return `${publicAppUrl()}/publica-library/${library?.shareToken || ''}`;
}

async function assertBookSlugAvailable(slug, currentId = null) {
    if (!slug) return;
    const where = { shareSlug: slug };
    if (currentId) where.id = { [Op.ne]: currentId };
    if (await Flipbook.findOne({ where, attributes: ['id'] })) {
        throw Object.assign(new Error('That publication link is already in use.'), { status: 409, code: 'PUBLICA_LINK_TAKEN' });
    }
}

function publicIdentifierWhere(identifier) {
    return { [Op.or]: [{ shareToken: identifier }, { shareSlug: identifier }] };
}

module.exports = {
    publicAppUrl,
    cleanShareSlug,
    shareIdentifier,
    publicationUrl,
    libraryUrl,
    assertBookSlugAvailable,
    publicIdentifierWhere
};
