import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import './marketingHeader.css';

const MARKETING_NAV_ITEMS = [
  ['/', 'Home'],
  ['/solutions', 'Solutions'],
  ['/about', 'About'],
  ['/blog', 'Blog'],
  ['/contact', 'Contact'],
];

export default function MarketingHeader({ fixed = false }) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const close = () => setMenuOpen(false);
    window.addEventListener('resize', close);
    return () => window.removeEventListener('resize', close);
  }, []);

  return (
    <header className={`lms-blog-header${fixed ? ' is-fixed' : ''}`}>
      <div className="lms-blog-header-inner">
        <Link className="lms-blog-brand" to="/" aria-label="LMSGEN home" onClick={() => setMenuOpen(false)}>
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
          {MARKETING_NAV_ITEMS.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setMenuOpen(false)}>{label}</NavLink>
          ))}
          <Link className="lms-blog-nav-cta" to="/login" onClick={() => setMenuOpen(false)}>
            Explore platform <ArrowRight size={15} />
          </Link>
        </nav>
      </div>
    </header>
  );
}
