const { expect } = require('chai');
const express = require('express');
const request = require('supertest');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

function createApp() {
    const service = {
        listPublished: sinon.stub().resolves({ posts: [], pagination: { page: 1, limit: 8, total: 0, pages: 1 }, categories: [] }),
        getPublished: sinon.stub().resolves(null),
        listAdmin: sinon.stub().resolves([]),
        createPost: sinon.stub().resolves({ id: 10, slug: 'new-article', status: 'draft' }),
        updatePost: sinon.stub().resolves({ id: 10, slug: 'new-article', status: 'published' }),
        deletePost: sinon.stub().resolves()
    };
    const auth = (req, res, next) => {
        req.scormRole = req.get('x-test-role') || 'admin';
        req.authenticatedUserId = 73;
        next();
    };
    const router = proxyquire('../routes/blog', {
        './middleware': auth,
        '../services/BlogPostService': service
    });
    const app = express();
    app.use(express.json());
    app.use('/api/blog', router);
    return { app, service };
}

describe('Blog routes', () => {
    it('keeps the published article list public', async () => {
        const { app, service } = createApp();
        const response = await request(app).get('/api/blog/posts');

        expect(response.status).to.equal(200);
        expect(service.listPublished.calledOnce).to.equal(true);
    });

    it('blocks non-Super-Admins from the blog manager', async () => {
        const { app, service } = createApp();
        const response = await request(app).get('/api/blog/admin/posts').set('x-test-role', 'admin');

        expect(response.status).to.equal(403);
        expect(response.body.code).to.equal('SCORM_SUPER_ADMIN_REQUIRED');
        expect(service.listAdmin.called).to.equal(false);
    });

    it('allows a Super Admin to create an article', async () => {
        const { app, service } = createApp();
        const payload = { title: 'New article', excerpt: 'Summary', body: 'Body' };
        const response = await request(app)
            .post('/api/blog/admin/posts')
            .set('x-test-role', 'super_admin')
            .send(payload);

        expect(response.status).to.equal(201);
        expect(response.body.post.slug).to.equal('new-article');
        expect(service.createPost.calledOnceWith(payload, 73)).to.equal(true);
    });
});
