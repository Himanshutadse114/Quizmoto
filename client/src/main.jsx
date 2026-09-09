import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

const root = createRoot(document.getElementById('root'))

const BLOG_POST_TITLES = {
  'why-scorm-courses-go-unfinished': 'Why Most SCORM Courses Go Unfinished (And How to Fix It)',
  'live-quizzes-vs-static-assessments': 'Live Quizzes vs. Static Assessments: What Actually Improves Retention',
  'scorm-1-2-vs-scorm-2004': 'SCORM 1.2 vs. SCORM 2004: What Actually Matters for Course Authors',
  'ai-assisted-authoring-course-timeline': 'How AI-Assisted Authoring Changes the Course Creation Timeline',
  'signs-security-awareness-training-needs-refresh': '5 Signs Your Security Awareness Training Needs a Refresh',
  'slide-deck-to-scorm-migration-guide': 'From Slide Deck to SCORM Package: A Practical Migration Guide',
  'quizmoto-as-a-full-learning-platform': 'What We Learned Building Quizmoto Into a Full Learning Platform',
  'designing-knowledge-checks-that-dont-feel-like-a-test': "Designing Knowledge Checks That Don't Feel Like a Test",
}

function normalisePath(pathname) {
  if (!pathname || pathname === '/') return '/'
  return pathname.replace(/\/+$/, '') || '/'
}

function getMarketingPage(pathname) {
  const path = normalisePath(pathname)
  const staticPages = {
    '/': {
      src: '/landing/index.html',
      title: 'LMSGEN',
      tabTitle: 'LMSGEN | AI-Powered Learning Platform',
    },
    '/solutions': {
      src: '/landing/solutions/index.html',
      title: 'LMSGEN solutions',
      tabTitle: 'AI Course Authoring, SCORM & Live Quizzes | LMSGEN',
    },
    '/about': {
      src: '/landing/about/index.html',
      title: 'About LMSGEN',
      tabTitle: 'About LMSGEN: Learning Platform for L&D and Security Awareness Teams',
    },
    '/blog': {
      src: '/landing/blog/index.html',
      title: 'LMSGEN blog',
      tabTitle: 'LMSGEN Blog: Insights on Learning, SCORM & Security Awareness',
    },
    '/contact': {
      src: '/landing/contact/index.html',
      title: 'Contact LMSGEN',
      tabTitle: 'Contact LMSGEN | Learning Platform',
    },
  }

  if (staticPages[path]) return staticPages[path]

  if (path.startsWith('/blog/')) {
    const slug = path.slice('/blog/'.length)
    const title = BLOG_POST_TITLES[slug]
    if (!title) return null
    return {
      src: `/landing/blog/${slug}.html`,
      title,
      tabTitle: `${title} | LMSGEN Blog`,
    }
  }

  return null
}

function setRobots(content) {
  let meta = document.querySelector('meta[name="robots"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'robots'
    document.head.appendChild(meta)
  }
  meta.content = content
}

function preloadStyle(href) {
  if (document.head.querySelector(`link[data-lmsgen-preload="${href}"]`)) return
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'style'
  link.href = href
  link.dataset.lmsgenPreload = href
  document.head.appendChild(link)
}

function addStylesheet(href, id) {
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}

function loadPlatformFonts() {
  if (document.getElementById('lmsgen-platform-fonts')) return
  const preconnectGoogle = document.createElement('link')
  preconnectGoogle.rel = 'preconnect'
  preconnectGoogle.href = 'https://fonts.googleapis.com'
  document.head.appendChild(preconnectGoogle)

  const preconnectStatic = document.createElement('link')
  preconnectStatic.rel = 'preconnect'
  preconnectStatic.href = 'https://fonts.gstatic.com'
  preconnectStatic.crossOrigin = 'anonymous'
  document.head.appendChild(preconnectStatic)

  const fonts = document.createElement('link')
  fonts.id = 'lmsgen-platform-fonts'
  fonts.rel = 'stylesheet'
  fonts.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap'
  document.head.appendChild(fonts)
}

const marketingPage = getMarketingPage(window.location.pathname)

if (marketingPage) {
  setRobots('index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1')

  // Start the iframe's render-blocking CSS requests before the iframe itself
  // is mounted. This keeps the existing visual design while shortening the
  // critical request chain reported by PageSpeed Insights.
  preloadStyle('/landing/css/normalize.css')
  if (marketingPage.src === '/landing/index.html') {
    preloadStyle('/landing/css/style.css')
    preloadStyle('/landing/css/atelora-ui-system.css?v=20260904-1')
    preloadStyle('/landing/css/atelora-home-section-scale.css?v=20260904-2')
  }

  Promise.all([
    import('react-router-dom'),
    import('./pages/Marketing/MarketingSite.jsx'),
  ]).then(([routerModule, marketingModule]) => {
    const { BrowserRouter } = routerModule
    const MarketingSite = marketingModule.default

    root.render(
      <StrictMode>
        <BrowserRouter>
          <MarketingSite {...marketingPage} />
        </BrowserRouter>
      </StrictMode>,
    )
  })
} else {
  setRobots('noindex,nofollow,noarchive')
  loadPlatformFonts()
  addStylesheet('/campaign-layout-fix.css', 'lmsgen-campaign-layout-fix')

  Promise.all([
    import('./index.css'),
    import('./services/scormApiCache.js'),
    import('./services/campaignAdminReadRedirect.js'),
    import('./App.jsx'),
    import('./components/PlatformDataBootstrap.jsx'),
    import('./lmsgenLightFinal.css'),
  ]).then(([, , , appModule, bootstrapModule]) => {
    const App = appModule.default
    const PlatformDataBootstrap = bootstrapModule.default

    root.render(
      <StrictMode>
        <App />
        <PlatformDataBootstrap />
      </StrictMode>,
    )
  })
}
