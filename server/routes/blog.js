const express = require('express');
const auth = require('./middleware');
const {
    listPublished,
    getPublished,
    listAdmin,
    createPost,
    updatePost,
    deletePost
} = require('../services/BlogPostService');

const router = express.Router();

function sendError(res, error, fallback) {
    res.status(error.status || 500).json({
        message: error.message || fallback,
        code: error.code || 'BLOG_REQUEST_FAILED',
        field: error.field
    });
}

function requireSuperAdmin(req, res, next) {
    if (String(req.scormRole || '').toLowerCase() !== 'super_admin') {
        return res.status(403).json({
            message: 'Super Admin access is required to manage the LMSGEN blog.',
            code: 'SCORM_SUPER_ADMIN_REQUIRED'
        });
    }
    next();
}

router.get('/posts', async (req, res) => {
    try {
        res.json(await listPublished(req.query));
    } catch (error) {
        sendError(res, error, 'Unable to load blog posts.');
    }
});

router.get('/posts/:slug', async (req, res) => {
    try {
        const post = await getPublished(req.params.slug);
        if (!post) return res.status(404).json({ message: 'Blog post not found.', code: 'BLOG_POST_NOT_FOUND' });
        res.json({ post });
    } catch (error) {
        sendError(res, error, 'Unable to load the blog post.');
    }
});

router.use('/admin', auth, requireSuperAdmin);

router.get('/admin/posts', async (req, res) => {
    try {
        res.json({ posts: await listAdmin() });
    } catch (error) {
        sendError(res, error, 'Unable to load the blog manager.');
    }
});

router.post('/admin/posts', async (req, res) => {
    try {
        const post = await createPost(req.body, req.authenticatedUserId || req.userId);
        res.status(201).json({ post });
    } catch (error) {
        sendError(res, error, 'Unable to create the blog post.');
    }
});

router.patch('/admin/posts/:id', async (req, res) => {
    try {
        const post = await updatePost(req.params.id, req.body, req.authenticatedUserId || req.userId);
        res.json({ post });
    } catch (error) {
        sendError(res, error, 'Unable to update the blog post.');
    }
});

router.delete('/admin/posts/:id', async (req, res) => {
    try {
        await deletePost(req.params.id);
        res.status(204).end();
    } catch (error) {
        sendError(res, error, 'Unable to delete the blog post.');
    }
});

module.exports = router;
