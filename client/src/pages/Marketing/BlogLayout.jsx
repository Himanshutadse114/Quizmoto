import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import SiteMascot from '../../components/mascot/SiteMascot';
import './blog.css';

const NAV_ITEMS = [
  ['/', 'Home'],
  ['/solutions', 'Solutions'],
  ['/about', 'About'],
  ['/blog', 'Blog'],
  ['/contact', 'Contact'],
];

export function BlogHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const close = () => setMenuOpen(false);
    window.addEventListener('resize', close);
    return () => window.removeEventListener('resize', close);
  }, []);

  return (
    <header className="lms-blog-header">
      <div className="lms-blog-header-inner">
        <Link className="lms-blog-brand" to="/" aria-label="LMSGEN home">
          <img src="/branding/lmsgen-logo-light.png" alt="LMSGEN" />
        </Link>
        <button
          className="lms-blog-menu-button"
          type="button"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav className={`lms-blog-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
          {NAV_ITEMS.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setMenuOpen(false)}>{label}</NavLink>
          ))}
          <Link className="lms-blog-nav-cta" to="/login" onClick={() => setMenuOpen(false)}>Explore platform <ArrowRight size={15} /></Link>
        </nav>
      </div>
    </header>
  );
}

export function BlogFooter() {
  return (
    <footer className="lms-blog-footer">
      <div className="lms-blog-footer-callout">
        <span>CREATE.</span><span>ENGAGE.</span><span>MEASURE.</span>
      </div>
      <div className="lms-blog-footer-inner">
        <div>
          <img src="/branding/lmsgen-logo-dark.png" alt="LMSGEN" />
          <p>Create better learning, deliver it anywhere and understand what works.</p>
        </div>
        <nav aria-label="Footer navigation">
          {NAV_ITEMS.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}
          <Link to="/login">Sign in</Link>
        </nav>
      </div>
      <div className="lms-blog-footer-bottom">© 2026 LMSGEN. All rights reserved.</div>
    </footer>
  );
}

export default function BlogLayout({ children }) {
  return (
    <div className="lms-blog">
      <BlogHeader />
      {children}
      <BlogFooter />
      <SiteMascot pageSrc="/blog" />
    </div>
  );
}
