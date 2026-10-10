import { Link } from 'react-router-dom';
import SiteMascot from '../../components/mascot/SiteMascot';
import MarketingHeader from './MarketingHeader';
import './blog.css';

const MARKETING_NAV_ITEMS = [
  ['/', 'Home'],
  ['/solutions', 'Solutions'],
  ['/about', 'About'],
  ['/blog', 'Blog'],
  ['/contact', 'Contact'],
];

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
          {MARKETING_NAV_ITEMS.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}
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
      <MarketingHeader />
      {children}
      <BlogFooter />
      <SiteMascot pageSrc="/blog" />
    </div>
  );
}
