const { Op } = require('sequelize');
const BlogPost = require('../models/BlogPost');

const ALLOWED_STATUSES = new Set(['draft', 'published']);
const DEFAULT_PAGE_SIZE = 8;
const MAX_PAGE_SIZE = 100;

function cleanText(value) {
    return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

function slugify(value) {
    return cleanText(value)
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 180);
}

function hasEmbeddedMedia(value) {
    const text = String(value || '');
    return /<\s*(img|picture|video|audio|iframe|svg)\b/i.test(text)
        || /!\[[^\]]*\]\s*\(/.test(text)
        || /data:image\//i.test(text);
}

function hasHtml(value) {
    return /<\/?[a-z][^>]*>/i.test(String(value || ''));
}

function validationError(message, field) {
    const error = new Error(message);
    error.status = 400;
    error.code = 'BLOG_VALIDATION_FAILED';
    error.field = field;
    return error;
}

function normalizePayload(input = {}, { partial = false } = {}) {
    const payload = {};
    const stringFields = ['title', 'slug', 'excerpt', 'body', 'category', 'authorName', 'status'];
    for (const field of stringFields) {
        if (Object.prototype.hasOwnProperty.call(input, field)) payload[field] = cleanText(input[field]);
    }

    if (!partial || Object.prototype.hasOwnProperty.call(payload, 'title')) {
        if (!payload.title) throw validationError('A blog title is required.', 'title');
        if (payload.title.length > 220) throw validationError('The title must be 220 characters or fewer.', 'title');
    }
    if (!partial || Object.prototype.hasOwnProperty.call(payload, 'excerpt')) {
        if (!payload.excerpt) throw validationError('A short excerpt is required.', 'excerpt');
        if (payload.excerpt.length > 700) throw validationError('The excerpt must be 700 characters or fewer.', 'excerpt');
    }
    if (!partial || Object.prototype.hasOwnProperty.call(payload, 'body')) {
        if (!payload.body) throw validationError('Article content is required.', 'body');
        if (payload.body.length > 100000) throw validationError('Article content is too long.', 'body');
    }

    for (const field of ['title', 'excerpt', 'body']) {
        if (!Object.prototype.hasOwnProperty.call(payload, field)) continue;
        if (hasEmbeddedMedia(payload[field])) {
            throw validationError('LMSGEN blog posts are text-only. Remove embedded images or media.', field);
        }
        if (hasHtml(payload[field])) {
            throw validationError('Use plain text only. HTML is not supported in blog posts.', field);
        }
    }

    if (!partial || Object.prototype.hasOwnProperty.call(payload, 'category')) {
        payload.category = payload.category || 'Learning Design';
        if (payload.category.length > 80) throw validationError('The topic must be 80 characters or fewer.', 'category');
    }
    if (!partial || Object.prototype.hasOwnProperty.call(payload, 'authorName')) {
        payload.authorName = payload.authorName || 'LMSGEN Team';
        if (payload.authorName.length > 120) throw validationError('The author name must be 120 characters or fewer.', 'authorName');
    }

    if (!partial || Object.prototype.hasOwnProperty.call(payload, 'status')) {
        payload.status = payload.status || 'draft';
        if (!ALLOWED_STATUSES.has(payload.status)) throw validationError('Status must be draft or published.', 'status');
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'slug')) payload.slug = slugify(payload.slug);
    if (!partial && !payload.slug) payload.slug = slugify(payload.title);
    if (Object.prototype.hasOwnProperty.call(payload, 'slug') && !payload.slug) {
        throw validationError('Enter a valid URL slug.', 'slug');
    }
    if (!partial && !payload.slug) throw validationError('A valid URL slug could not be generated.', 'slug');

    return payload;
}

function serializePost(post, { summary = false } = {}) {
    const value = post?.get ? post.get({ plain: true }) : post;
    if (!value) return null;
    const serialized = {
        id: value.id,
        slug: value.slug,
        title: value.title,
        excerpt: value.excerpt,
        category: value.category,
        authorName: value.authorName,
        status: value.status,
        publishedAt: value.publishedAt || null,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt
    };
    if (!summary) serialized.body = value.body;
    return serialized;
}

function pagination(input = {}) {
    const page = Math.max(1, Number.parseInt(input.page, 10) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(input.limit, 10) || DEFAULT_PAGE_SIZE));
    return { page, limit, offset: (page - 1) * limit };
}

async function categoryCounts() {
    const rows = await BlogPost.findAll({
        where: { status: 'published', publishedAt: { [Op.lte]: new Date() } },
        attributes: ['category']
    });
    const counts = new Map();
    for (const row of rows) {
        const category = row.category || 'Learning Design';
        counts.set(category, (counts.get(category) || 0) + 1);
    }
    return [...counts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

async function listPublished(query = {}) {
    const { page, limit, offset } = pagination(query);
    const where = { status: 'published', publishedAt: { [Op.lte]: new Date() } };
    const category = cleanText(query.category);
    if (category && category.toLowerCase() !== 'all') where.category = category;
    const result = await BlogPost.findAndCountAll({
        where,
        order: [['publishedAt', 'DESC'], ['createdAt', 'DESC']],
        limit,
        offset
    });
    return {
        posts: result.rows.map((post) => serializePost(post, { summary: true })),
        pagination: { page, limit, total: result.count, pages: Math.max(1, Math.ceil(result.count / limit)) },
        categories: await categoryCounts()
    };
}

async function getPublished(slug) {
    const post = await BlogPost.findOne({
        where: {
            slug: slugify(slug),
            status: 'published',
            publishedAt: { [Op.lte]: new Date() }
        }
    });
    return serializePost(post);
}

async function listAdmin() {
    const posts = await BlogPost.findAll({ order: [['updatedAt', 'DESC']] });
    return posts.map((post) => serializePost(post));
}

async function ensureUniqueSlug(slug, excludeId = null) {
    const where = { slug };
    if (excludeId) where.id = { [Op.ne]: excludeId };
    const existing = await BlogPost.findOne({ where, attributes: ['id'] });
    if (!existing) return;
    const error = new Error('That blog URL is already in use. Choose a different slug.');
    error.status = 409;
    error.code = 'BLOG_SLUG_EXISTS';
    throw error;
}

async function createPost(input, actorUserId) {
    const payload = normalizePayload(input);
    await ensureUniqueSlug(payload.slug);
    if (payload.status === 'published') payload.publishedAt = new Date();
    const post = await BlogPost.create({
        ...payload,
        createdByUserId: actorUserId || null,
        updatedByUserId: actorUserId || null
    });
    return serializePost(post);
}

async function updatePost(id, input, actorUserId) {
    const post = await BlogPost.findByPk(id);
    if (!post) {
        const error = new Error('Blog post not found.');
        error.status = 404;
        error.code = 'BLOG_POST_NOT_FOUND';
        throw error;
    }
    const payload = normalizePayload(input, { partial: true });
    if (payload.slug) await ensureUniqueSlug(payload.slug, post.id);
    if (payload.status === 'published' && post.status !== 'published') payload.publishedAt = new Date();
    if (payload.status === 'draft') payload.publishedAt = null;
    await post.update({ ...payload, updatedByUserId: actorUserId || null });
    return serializePost(post);
}

async function deletePost(id) {
    const post = await BlogPost.findByPk(id);
    if (!post) {
        const error = new Error('Blog post not found.');
        error.status = 404;
        error.code = 'BLOG_POST_NOT_FOUND';
        throw error;
    }
    await post.destroy();
}

module.exports = {
    slugify,
    normalizePayload,
    serializePost,
    listPublished,
    getPublished,
    listAdmin,
    createPost,
    updatePost,
    deletePost
};
