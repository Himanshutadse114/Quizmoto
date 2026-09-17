const { Op } = require('sequelize');
const Flipbook = require('../models/Flipbook');
const FlipbookLibrary = require('../models/FlipbookLibrary');

const RESERVED_SUBDOMAINS = new Set([
    'www', 'api', 'app', 'admin', 'auth', 'login', 'mail', 'smtp', 'cdn',
    'assets', 'static', 'support', 'status', 'help', 'blog', 'contact'
]);

function publicAppUrl() {
    return String(process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || 'https://www.lmsgen.in').replace(/\/+$/, '');
}

function rootDomain() {
    const configured = String(process.env.PUBLICA_ROOT_DOMAIN || '').trim().toLowerCase().replace(/^\.+|\.+$/g, '');
    if (configured) return configured;
    try {
        return new URL(publicAppUrl()).hostname.replace(/^www\./i, '');
    } catch (_) {
        return 'lmsgen.in';
    }
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

function cleanSubdomain(value) {
    const subdomain = cleanIdentifier(value, { label: 'Subdomain', min: 3, max: 63 });
    if (subdomain && RESERVED_SUBDOMAINS.has(subdomain)) {
        throw Object.assign(new Error('That subdomain is reserved by LMSGEN. Choose another name.'), { status: 409, code: 'PUBLICA_SUBDOMAIN_RESERVED' });
    }
    return subdomain;
}

function shareIdentifier(record) {
    return record?.shareSlug || record?.shareToken || '';
}

function customOrigin(subdomain) {
    if (!subdomain) return publicAppUrl();
    return `${process.env.PUBLICA_CUSTOM_DOMAIN_PROTOCOL || 'https'}://${subdomain}.${rootDomain()}`;
}

function publicationUrl(book, options = {}) {
    return `${customOrigin(options.customSubdomain)}/publica/${shareIdentifier(book)}`;
}

function libraryUrl(library) {
    return `${customOrigin(library?.customSubdomain)}/publica-library/${shareIdentifier(library)}`;
}

function hasPaidBranding(quota) {
    return Boolean(quota?.protected || quota?.unlimited || (Number.isFinite(Number(quota?.max)) && Number(quota.max) > 3));
}

async function assertBookSlugAvailable(slug, currentId = null) {
    if (!slug) return;
    const where = { shareSlug: slug };
    if (currentId) where.id = { [Op.ne]: currentId };
    if (await Flipbook.findOne({ where, attributes: ['id'] })) {
        throw Object.assign(new Error('That publication link is already in use.'), { status: 409, code: 'PUBLICA_LINK_TAKEN' });
    }
}

async function assertLibrarySlugAvailable(slug, currentId = null) {
    if (!slug) return;
    const where = { shareSlug: slug };
    if (currentId) where.id = { [Op.ne]: currentId };
    if (await FlipbookLibrary.findOne({ where, attributes: ['id'] })) {
        throw Object.assign(new Error('That library link is already in use.'), { status: 409, code: 'PUBLICA_LINK_TAKEN' });
    }
}

async function assertSubdomainAvailable(subdomain, currentId = null) {
    if (!subdomain) return;
    const where = { customSubdomain: subdomain };
    if (currentId) where.id = { [Op.ne]: currentId };
    if (await FlipbookLibrary.findOne({ where, attributes: ['id'] })) {
        throw Object.assign(new Error('That Publica subdomain is already in use.'), { status: 409, code: 'PUBLICA_SUBDOMAIN_TAKEN' });
    }
}

function publicIdentifierWhere(identifier) {
    return { [Op.or]: [{ shareToken: identifier }, { shareSlug: identifier }] };
}

module.exports = {
    RESERVED_SUBDOMAINS,
    publicAppUrl,
    rootDomain,
    cleanShareSlug,
    cleanSubdomain,
    shareIdentifier,
    publicationUrl,
    libraryUrl,
    hasPaidBranding,
    assertBookSlugAvailable,
    assertLibrarySlugAvailable,
    assertSubdomainAvailable,
    publicIdentifierWhere
};
