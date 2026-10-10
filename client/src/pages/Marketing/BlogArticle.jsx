import { Fragment, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { apiUrl } from '../../config';
import { LEGACY_BLOG_POSTS } from '../../data/legacyBlogPosts';
import BlogLayout from './BlogLayout';
import { formatBlogDate } from './blogUtils';

function plainTextBlocks(body) {
  const lines = String(body || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let paragraph = [];
  let list = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) blocks.push({ type: 'list', items: list });
    list = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
    } else if (line.startsWith('## ')) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'heading', text: line.slice(3) });
    } else if (line.startsWith('- ')) {
      flushParagraph();
      list.push(line.slice(2));
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

function TextArticle({ body }) {
  return plainTextBlocks(body).map((block, index) => (
    <Fragment key={`${block.type}-${index}`}>
      {block.type === 'heading' && <h2>{block.text}</h2>}
      {block.type === 'paragraph' && <p>{block.text}</p>}
      {block.type === 'list' && <ul>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>}
    </Fragment>
  ));
}

function sanitizeLegacyArticle(html) {
  const documentNode = new DOMParser().parseFromString(html, 'text/html');
  const source = documentNode.querySelector('.blog-post-prose');
  if (!source) return '';
  source.querySelectorAll('img, picture, video, audio, iframe, svg, script, style, form').forEach((node) => node.remove());
  source.querySelectorAll('*').forEach((node) => {
    const href = node.tagName === 'A' ? node.getAttribute('href') : null;
    [...node.attributes].forEach((attribute) => node.removeAttribute(attribute.name));
    if (href && !href.trim().toLowerCase().startsWith('javascript:')) node.setAttribute('href', href);
  });
  return source.innerHTML;
}

async function loadLegacyArticle(slug) {
  const metadata = LEGACY_BLOG_POSTS.find((post) => post.slug === slug);
  if (!metadata) return null;
  const response = await fetch(`/landing/blog/${encodeURIComponent(slug)}.html`);
  if (!response.ok) throw new Error('Article not found');
  return { ...metadata, legacyHtml: sanitizeLegacyArticle(await response.text()) };
}

export default function BlogArticle() {
  const { slug } = useParams();
  return <BlogArticleContent key={slug} slug={slug} />;
}

function BlogArticleContent({ slug }) {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    axios.get(apiUrl(`/api/blog/posts/${encodeURIComponent(slug)}`))
      .then((response) => response.data?.post)
      .catch(async (requestError) => {
        if (requestError.response?.status !== 404) {
          const legacy = await loadLegacyArticle(slug);
          if (legacy) return legacy;
          throw requestError;
        }
        return loadLegacyArticle(slug);
      })
      .then((loadedPost) => {
        if (!active) return;
        if (!loadedPost) throw new Error('Article not found');
        setPost(loadedPost);
        document.title = `${loadedPost.title} | LMSGEN Blog`;
      })
      .catch(() => active && setError('This article is not available.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [slug]);

  return (
    <BlogLayout>
      <main className="lms-blog-article-page">
        {loading && <div className="lms-blog-article-status">Loading article…</div>}
        {!loading && error && (
          <div className="lms-blog-article-status">
            <h1>Article not found</h1>
            <p>{error}</p>
            <Link to="/blog"><ArrowLeft size={17} /> Back to the blog</Link>
          </div>
        )}
        {!loading && post && (
          <>
            <header className="lms-blog-article-hero">
              <div className="lms-blog-article-hero-inner">
                <Link className="lms-blog-back" to="/blog"><ArrowLeft size={17} /> All articles</Link>
                <div className="lms-blog-article-meta">
                  <span>{post.category}</span>
                  <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt)}</time>
                  <span>By {post.authorName || 'LMSGEN Team'}</span>
                </div>
                <h1>{post.title}</h1>
                <p>{post.excerpt}</p>
              </div>
            </header>
            <section className="lms-blog-article-shell">
              <article className="lms-blog-prose">
                {post.legacyHtml
                  ? <div dangerouslySetInnerHTML={{ __html: post.legacyHtml }} />
                  : <TextArticle body={post.body} />}
              </article>
              <aside className="lms-blog-article-aside">
                <span className="lms-blog-kicker">LMSGEN PLATFORM</span>
                <h2>Build learning people want to finish.</h2>
                <p>Turn a brief into engaging, trackable training and measure the result.</p>
                <Link to="/login">Explore LMSGEN <ArrowRight size={16} /></Link>
              </aside>
            </section>
          </>
        )}
      </main>
    </BlogLayout>
  );
}
