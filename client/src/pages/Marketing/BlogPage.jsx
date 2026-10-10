import { useEffect, useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { apiUrl } from '../../config';
import { LEGACY_BLOG_POSTS } from '../../data/legacyBlogPosts';
import BlogLayout from './BlogLayout';
import { formatBlogDate } from './blogUtils';

const PAGE_SIZE = 6;

function mergePosts(dynamicPosts) {
  const posts = new Map(LEGACY_BLOG_POSTS.map((post) => [post.slug, post]));
  for (const post of dynamicPosts || []) posts.set(post.slug, post);
  return [...posts.values()].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

function ArticleRow({ post, index }) {
  return (
    <article className={`lms-blog-row ${index === 0 ? 'is-leading' : ''}`}>
      <div className="lms-blog-row-meta">
        <span>{post.category}</span>
        <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt)}</time>
        <span>By {post.authorName || 'LMSGEN Team'}</span>
      </div>
      <div className="lms-blog-row-copy">
        <h2><Link to={`/blog/${post.slug}`}>{post.title}</Link></h2>
        <p>{post.excerpt}</p>
        <Link className="lms-blog-read-link" to={`/blog/${post.slug}`}>Read article <ArrowRight size={17} /></Link>
      </div>
    </article>
  );
}

export default function BlogPage() {
  const [remotePosts, setRemotePosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const selectedTopic = searchParams.get('topic') || 'All articles';
  const currentPage = Math.max(1, Number.parseInt(searchParams.get('page'), 10) || 1);
  const posts = mergePosts(remotePosts);
  const topics = [...new Set(posts.map((post) => post.category).filter(Boolean))].sort();
  const filtered = posts.filter((post) => {
    const topicMatch = selectedTopic === 'All articles' || post.category === selectedTopic;
    const needle = query.trim().toLowerCase();
    const searchMatch = !needle || `${post.title} ${post.excerpt} ${post.category}`.toLowerCase().includes(needle);
    return topicMatch && searchMatch;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, pageCount);
  const pagePosts = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    document.title = 'LMSGEN Blog | Learning, Security Awareness and AI Course Authoring';
    axios.get(apiUrl('/api/blog/posts?limit=100'))
      .then((response) => setRemotePosts(response.data?.posts || []))
      .catch(() => setRemotePosts([]))
      .finally(() => setLoading(false));
  }, []);

  const chooseTopic = (topic) => {
    const next = new URLSearchParams(searchParams);
    if (topic === 'All articles') next.delete('topic');
    else next.set('topic', topic);
    next.delete('page');
    setSearchParams(next);
  };

  const choosePage = (page) => {
    const next = new URLSearchParams(searchParams);
    if (page <= 1) next.delete('page');
    else next.set('page', String(page));
    setSearchParams(next);
    document.querySelector('.lms-blog-content')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <BlogLayout>
      <main>
        <section className="lms-blog-hero">
          <div className="lms-blog-hero-inner">
            <div>
              <span className="lms-blog-kicker">LMSGEN INSIGHTS</span>
              <h1>Ideas for learning that people actually remember.</h1>
            </div>
            <p>Practical thinking on AI course authoring, security awareness, live learning and measurable outcomes—from the team building LMSGEN.</p>
          </div>
        </section>

        <section className="lms-blog-topic-strip" aria-label="Blog topics">
          <div className="lms-blog-topic-inner">
            <span>View topics</span>
            <div className="lms-blog-topic-scroll">
              {['All articles', ...topics].map((topic) => (
                <button key={topic} type="button" className={selectedTopic === topic ? 'is-active' : ''} onClick={() => chooseTopic(topic)}>{topic}</button>
              ))}
            </div>
          </div>
        </section>

        <section className="lms-blog-content">
          <div className="lms-blog-feed">
            <div className="lms-blog-section-heading">
              <div>
                <span className="lms-blog-kicker">LATEST THINKING</span>
                <h2>{selectedTopic}</h2>
              </div>
              <span>{filtered.length} {filtered.length === 1 ? 'article' : 'articles'}</span>
            </div>
            {loading && <div className="lms-blog-status">Checking for the latest LMSGEN articles…</div>}
            {!loading && pagePosts.map((post, index) => <ArticleRow key={post.slug} post={post} index={index} />)}
            {!loading && !pagePosts.length && <div className="lms-blog-empty"><h3>No articles found</h3><p>Try another topic or clear your search.</p></div>}
            {pageCount > 1 && (
              <nav className="lms-blog-pagination" aria-label="Blog pages">
                <button type="button" disabled={safePage === 1} onClick={() => choosePage(safePage - 1)}>Previous</button>
                <span>Page {safePage} of {pageCount}</span>
                <button type="button" disabled={safePage === pageCount} onClick={() => choosePage(safePage + 1)}>Next</button>
              </nav>
            )}
          </div>

          <aside className="lms-blog-sidebar">
            <label className="lms-blog-search">
              <span>Search articles</span>
              <div><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Search the LMSGEN blog" /></div>
            </label>
            <div className="lms-blog-directory">
              <h3>Posts by topic</h3>
              <button type="button" onClick={() => chooseTopic('All articles')}><span>All articles</span><strong>{posts.length}</strong></button>
              {topics.map((topic) => (
                <button key={topic} type="button" onClick={() => chooseTopic(topic)}><span>{topic}</span><strong>{posts.filter((post) => post.category === topic).length}</strong></button>
              ))}
            </div>
            <div className="lms-blog-sidebar-cta">
              <span className="lms-blog-kicker">BUILD WITH LMSGEN</span>
              <h3>Turn your next idea into trackable learning.</h3>
              <p>Create courses, engage teams and measure progress in one platform.</p>
              <Link to="/login">Explore the platform <ArrowRight size={16} /></Link>
            </div>
          </aside>
        </section>
      </main>
    </BlogLayout>
  );
}
