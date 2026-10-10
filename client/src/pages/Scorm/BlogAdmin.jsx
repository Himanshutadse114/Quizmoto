import { useEffect, useState } from 'react';
import { ExternalLink, FileText, Pencil, Plus, Save, Search, Send, Trash2 } from 'lucide-react';
import axios from 'axios';
import { apiUrl } from '../../config';
import { useAuth } from '../../context/AuthContext';
import './blogAdmin.css';

const EMPTY_FORM = {
  title: '',
  slug: '',
  excerpt: '',
  body: '',
  category: 'Learning Design',
  authorName: 'LMSGEN Team',
  status: 'draft',
};

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

function readableDate(value) {
  if (!value) return 'Not published';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

export default function BlogAdmin() {
  const { token } = useAuth();
  const [posts, setPosts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const headers = { Authorization: `Bearer ${token}` };

  const loadPosts = () => {
    setLoading(true);
    return axios.get(apiUrl('/api/blog/admin/posts'), { headers })
      .then((response) => setPosts(response.data?.posts || []))
      .catch((error) => setMessage({ type: 'error', text: error.response?.data?.message || 'Unable to load blog posts.' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let active = true;
    axios.get(apiUrl('/api/blog/admin/posts'), { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => { if (active) setPosts(response.data?.posts || []); })
      .catch((error) => { if (active) setMessage({ type: 'error', text: error.response?.data?.message || 'Unable to load blog posts.' }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const filteredPosts = posts.filter((post) => `${post.title} ${post.category} ${post.status}`.toLowerCase().includes(query.toLowerCase()));

  const startNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSlugTouched(false);
    setMessage(null);
  };

  const editPost = (post) => {
    setEditingId(post.id);
    setForm({
      title: post.title || '',
      slug: post.slug || '',
      excerpt: post.excerpt || '',
      body: post.body || '',
      category: post.category || 'Learning Design',
      authorName: post.authorName || 'LMSGEN Team',
      status: post.status || 'draft',
    });
    setSlugTouched(true);
    setMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateField = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'title' && !slugTouched) next.slug = slugify(value);
      return next;
    });
  };

  const savePost = async (status) => {
    setSaving(true);
    setMessage(null);
    try {
      const payload = { ...form, status };
      const response = editingId
        ? await axios.patch(apiUrl(`/api/blog/admin/posts/${editingId}`), payload, { headers })
        : await axios.post(apiUrl('/api/blog/admin/posts'), payload, { headers });
      const saved = response.data?.post;
      setEditingId(saved.id);
      setForm({
        title: saved.title,
        slug: saved.slug,
        excerpt: saved.excerpt,
        body: saved.body,
        category: saved.category,
        authorName: saved.authorName,
        status: saved.status,
      });
      setSlugTouched(true);
      setMessage({ type: 'success', text: status === 'published' ? 'Article published on the LMSGEN blog.' : 'Draft saved.' });
      await loadPosts();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Unable to save the article.' });
    } finally {
      setSaving(false);
    }
  };

  const removePost = async (post) => {
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
    try {
      await axios.delete(apiUrl(`/api/blog/admin/posts/${post.id}`), { headers });
      if (editingId === post.id) startNew();
      setPosts((current) => current.filter((item) => item.id !== post.id));
      setMessage({ type: 'success', text: 'Article deleted.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Unable to delete the article.' });
    }
  };

  return (
    <div className="blog-admin-page">
      <header className="blog-admin-heading">
        <div>
          <span>SUPER ADMIN · EDITORIAL</span>
          <h1>Blog Management</h1>
          <p>Create and publish clean, text-first LMSGEN articles. Images and embedded media are intentionally disabled.</p>
        </div>
        <div className="blog-admin-heading-actions">
          <a href="/blog" target="_blank" rel="noreferrer">View public blog <ExternalLink size={14} /></a>
          <button type="button" onClick={startNew}><Plus size={15} /> New article</button>
        </div>
      </header>

      {message && <div className={`blog-admin-message is-${message.type}`} role="status">{message.text}</div>}

      <div className="blog-admin-workspace">
        <section className="blog-admin-editor">
          <div className="blog-admin-editor-title">
            <div><span>{editingId ? 'EDITING ARTICLE' : 'NEW ARTICLE'}</span><h2>{form.title || 'Untitled draft'}</h2></div>
            <span className={`blog-admin-status is-${form.status}`}>{form.status}</span>
          </div>

          <div className="blog-admin-fields">
            <label className="blog-admin-field blog-admin-field-wide">
              <span>Headline</span>
              <input value={form.title} onChange={(event) => updateField('title', event.target.value)} maxLength={220} placeholder="A clear, useful headline" />
            </label>
            <label className="blog-admin-field">
              <span>URL slug</span>
              <input value={form.slug} onChange={(event) => { setSlugTouched(true); updateField('slug', slugify(event.target.value)); }} maxLength={180} placeholder="article-url" />
            </label>
            <label className="blog-admin-field">
              <span>Topic</span>
              <input value={form.category} onChange={(event) => updateField('category', event.target.value)} maxLength={80} placeholder="Security Awareness" />
            </label>
            <label className="blog-admin-field">
              <span>Author</span>
              <input value={form.authorName} onChange={(event) => updateField('authorName', event.target.value)} maxLength={120} placeholder="LMSGEN Team" />
            </label>
            <label className="blog-admin-field blog-admin-field-wide">
              <span>Excerpt <small>{form.excerpt.length}/700</small></span>
              <textarea value={form.excerpt} onChange={(event) => updateField('excerpt', event.target.value)} rows={3} maxLength={700} placeholder="A concise summary shown in the article list." />
            </label>
            <label className="blog-admin-field blog-admin-field-wide">
              <span>Article body <small>plain text only</small></span>
              <textarea className="blog-admin-body" value={form.body} onChange={(event) => updateField('body', event.target.value)} rows={18} maxLength={100000} placeholder={'Write the article here.\n\nUse a blank line for a new paragraph.\nUse ## before a section heading.\nUse - before each bullet point.'} />
              <small className="blog-admin-help">Formatting: blank lines create paragraphs, <b>##</b> creates a heading, and <b>-</b> creates a bullet list. HTML, images and embeds are blocked.</small>
            </label>
          </div>

          <div className="blog-admin-savebar">
            <button type="button" className="blog-admin-secondary" disabled={saving} onClick={() => savePost('draft')}><Save size={15} /> {saving ? 'Saving…' : 'Save draft'}</button>
            <button type="button" className="blog-admin-primary" disabled={saving} onClick={() => savePost('published')}><Send size={15} /> {form.status === 'published' ? 'Update published article' : 'Publish article'}</button>
          </div>
        </section>

        <aside className="blog-admin-library">
          <div className="blog-admin-library-head">
            <div><span>CONTENT LIBRARY</span><h2>{posts.length} {posts.length === 1 ? 'article' : 'articles'}</h2></div>
            <label><Search size={15} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" /></label>
          </div>
          <div className="blog-admin-posts">
            {loading && <div className="blog-admin-empty">Loading articles…</div>}
            {!loading && !filteredPosts.length && <div className="blog-admin-empty"><FileText size={24} /><span>No articles found.</span></div>}
            {!loading && filteredPosts.map((post) => (
              <article key={post.id} className={editingId === post.id ? 'is-selected' : ''}>
                <div className="blog-admin-post-meta"><span className={`blog-admin-status is-${post.status}`}>{post.status}</span><span>{readableDate(post.publishedAt || post.updatedAt)}</span></div>
                <h3>{post.title}</h3>
                <p>{post.category} · {post.authorName}</p>
                <div className="blog-admin-post-actions">
                  <button type="button" onClick={() => editPost(post)}><Pencil size={13} /> Edit</button>
                  {post.status === 'published' && <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer"><ExternalLink size={13} /> View</a>}
                  <button type="button" className="is-delete" onClick={() => removePost(post)}><Trash2 size={13} /> Delete</button>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
