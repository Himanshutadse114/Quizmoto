const { expect } = require('chai');
const BlogPost = require('../models/BlogPost');
const {
    slugify,
    normalizePayload,
    createPost,
    updatePost,
    listPublished,
    getPublished
} = require('../services/BlogPostService');

describe('BlogPostService', () => {
    beforeEach(async () => {
        await BlogPost.sync({ force: true });
    });

    it('creates a text-only draft with an LMSGEN author default', async () => {
        const post = await createPost({
            title: 'A Practical Learning Guide',
            excerpt: 'A concise introduction to the topic.',
            body: 'Start with one clear outcome.\n\nThen build one useful practice activity.',
            category: 'Learning Design'
        }, 42);

        expect(post.slug).to.equal('a-practical-learning-guide');
        expect(post.authorName).to.equal('LMSGEN Team');
        expect(post.status).to.equal('draft');
        expect(post.publishedAt).to.equal(null);
    });

    it('rejects images, embedded media and HTML', () => {
        expect(() => normalizePayload({
            title: 'Image post',
            excerpt: 'This should not pass.',
            body: '![Diagram](https://example.com/diagram.png)'
        })).to.throw('text-only');

        expect(() => normalizePayload({
            title: 'HTML post',
            excerpt: 'This should not pass.',
            body: '<h2>Hidden markup</h2>'
        })).to.throw('plain text only');
    });

    it('publishes, lists and retrieves posts while keeping drafts private', async () => {
        const published = await createPost({
            title: 'Published insight',
            excerpt: 'Visible on the public blog.',
            body: 'A complete text-only article.',
            category: 'Security Awareness',
            status: 'published'
        }, 7);
        await createPost({
            title: 'Draft insight',
            excerpt: 'Not ready yet.',
            body: 'A draft article.',
            category: 'Security Awareness'
        }, 7);

        const result = await listPublished({ limit: 10 });
        expect(result.posts.map((post) => post.slug)).to.deep.equal([published.slug]);
        expect(result.posts[0]).not.to.have.property('body');
        expect(result.categories).to.deep.equal([{ name: 'Security Awareness', count: 1 }]);

        const detail = await getPublished(published.slug);
        expect(detail.body).to.equal('A complete text-only article.');
        expect(await getPublished('draft-insight')).to.equal(null);
    });

    it('updates publishing state and keeps URLs unique', async () => {
        const first = await createPost({
            title: 'First post',
            excerpt: 'First excerpt.',
            body: 'First body.'
        }, 1);
        await createPost({
            title: 'Second post',
            excerpt: 'Second excerpt.',
            body: 'Second body.'
        }, 1);

        const published = await updatePost(first.id, { status: 'published' }, 2);
        expect(published.publishedAt).to.be.instanceOf(Date);

        let conflict;
        try {
            await updatePost(first.id, { slug: slugify('Second post') }, 2);
        } catch (error) {
            conflict = error;
        }
        expect(conflict?.status).to.equal(409);
        expect(conflict?.code).to.equal('BLOG_SLUG_EXISTS');
    });
});
