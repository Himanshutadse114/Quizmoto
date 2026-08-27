(() => {
  'use strict';

  const content = {
    meta: {
      title: 'Atelora | AI Learning, SCORM & Live Quiz Platform',
      description: 'Create, deliver and track engaging learning with Atelora. Build AI-assisted courses, manage SCORM content, run live Quizmoto sessions and monitor learner progress from one platform.'
    },
    nav: [
      ['HOME', '#top'],
      ['PLATFORM', '#platform'],
      ['FEATURES', '#features'],
      ['QUIZMOTO', '#use-cases'],
      ['INSIGHTS', '#insights'],
      ['LOGIN', '/login']
    ],
    hero: {
      eyebrow: 'AI-POWERED LEARNING, LIVE QUIZZES AND SCORM DELIVERY',
      title: 'Create Learning Your Teams Actually Want to Complete',
      body: 'Build courses, launch live Quizmoto sessions, manage SCORM content and track learner progress from one connected platform.'
    },
    platformTitles: ['AI-Assisted Course Creation', 'SCORM Content & Tracking', 'Live Quizmoto Engagement'],
    trustCards: [
      ['Faster Content Creation', 'Turn topics, documents and ideas into structured training without rebuilding everything from scratch.'],
      ['Scalable Delivery', 'Manage courses, quizzes and learners across teams from one central workspace.'],
      ['Interactive Engagement', 'Combine learning with Quizmoto live sessions and game-based knowledge checks.'],
      ['Consistent Learning', 'Standardise course structure and delivery while keeping content easy to update.']
    ],
    features: [
      ['AI Course Authoring', 'Generate and refine structured learning content, assessments and course flows with an AI-assisted workflow.'],
      ['SCORM Content Management', 'Upload, organise, launch and manage SCORM learning content from one place.'],
      ['Learner Tracking', 'Monitor progress, completion and engagement across assigned learning.'],
      ['QUIZMOTO, LIVE.', 'Run fast live quizzes and competitive knowledge checks that make training more interactive.'],
      ['Visual Content Studio', 'Build and refine learning experiences through a visual editing workflow.'],
      ['Reports & Insights', 'Review participation, outcomes and activity to understand what needs attention.']
    ],
    customerCards: [
      ['Build structured awareness courses, deliver them through SCORM-ready workflows and keep content easy to refresh.', 'Security Awareness Teams', 'Create & Deliver'],
      ['Create learning paths, organise course content and monitor learner progress from a single workspace.', 'Learning & Development', 'Build & Track'],
      ['Turn knowledge checks into live, competitive sessions that make training more participative.', 'Facilitators', 'Quizmoto Live'],
      ['Refine learning experiences visually while keeping course structure and delivery consistent.', 'Content Teams', 'Visual Studio'],
      ['Review participation and learning outcomes to identify where follow-up or reinforcement is needed.', 'Programme Owners', 'Reports & Insights'],
      ['Manage learners, assignments and access without splitting the workflow across separate tools.', 'Training Admins', 'Learner Roster'],
      ['Start with a topic or source material and move faster from idea to structured learning content.', 'Course Creators', 'AI Authoring'],
      ['Bring authoring, SCORM, quizzes, learner tracking and reporting together in Atelora.', 'Organisations', 'One Connected Platform']
    ],
    insights: [
      ['AI Course Authoring', 'Turn a topic, brief or source material into structured learning content and assessments.'],
      ['SCORM Content Management', 'Keep SCORM packages organised, launchable and connected to the wider learning workflow.'],
      ['Quizmoto Live Sessions', 'Run live knowledge checks that bring competition, energy and immediate feedback into training.'],
      ['Learner Tracking', 'Follow progress, completion and learner activity so programme owners know where attention is needed.'],
      ['Visual Content Studio', 'Refine the look and structure of learning experiences through a visual workflow.'],
      ['One Connected Learning Platform', 'Bring course authoring, delivery, live engagement, tracking and reporting into one platform.']
    ]
  };

  const one = (selector) => document.querySelector(selector);
  const all = (selector) => Array.from(document.querySelectorAll(selector));
  const text = (selector, value) => { const el = one(selector); if (el) el.textContent = value; };
  const texts = (selector, values) => all(selector).forEach((el, index) => { if (values[index] != null) el.textContent = values[index]; });

  function updateMeta() {
    document.title = content.meta.title;
    const descriptions = all('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]');
    descriptions.forEach((el) => el.setAttribute('content', content.meta.description));
    all('meta[property="og:title"], meta[name="twitter:title"]').forEach((el) => el.setAttribute('content', content.meta.title));
    const og = one('meta[property="og:image"]');
    if (og) og.setAttribute('content', '/atelora-marketing/hero.webp');
  }

  function updateBranding() {
    all('.global-header-logo-c img, .global-footer-logo-c img').forEach((img) => {
      img.src = '/atelora-landing-logo.svg';
      img.alt = 'Atelora';
    });
    const headerLogo = one('.global-header-logo-c');
    if (headerLogo) headerLogo.href = '#top';
  }

  function updateNavigation() {
    const links = all('.global-header-nav-w > .global-nav-link');
    content.nav.forEach(([label, href], index) => {
      const link = links[index];
      if (!link) return;
      link.textContent = label;
      link.href = href;
      if (href === '/login') link.target = '_top';
      else link.removeAttribute('target');
    });

    all('a.btn-primary').forEach((link) => {
      const current = (link.textContent || '').trim().toLowerCase();
      if (link.matches('.nav-bar, .hp-hero') || current.includes('demo') || current.includes('get started') || current.includes('start now') || current.includes('explore atelora')) {
        link.textContent = 'Explore Atelora';
        link.href = '/login';
        link.target = '_top';
        link.removeAttribute('cd');
        link.setAttribute('data-atelora-login', 'true');
      }
    });
  }

  function updateHero() {
    text('.hp-hero-s .caption', content.hero.eyebrow);
    text('.hp-hero-h1', content.hero.title);
    text('.hp-hero-p', content.hero.body);
    texts('.hp-ctr-h2', ['AI Course Authoring', 'Live Quizmoto']);
  }

  function updatePlatform() {
    text('#platform .caption', 'THE PLATFORM');
    texts('#platform .platform-h2', content.platformTitles);
    text('#platform .paragraph-l', 'Create, deliver and manage interactive learning across your organisation — in one connected system.');
  }

  function updateUseCases() {
    text('#use-cases .caption', 'WHY ATELORA');
    text('#use-cases h2.h1', 'Built for Real Learning Challenges');
    const cards = all('#use-cases .hp-trust-card');
    content.trustCards.forEach(([titleValue, bodyValue], index) => {
      const card = cards[index];
      if (!card) return;
      const heading = card.querySelector('.hp-trust-card-title');
      const body = card.querySelector('.paragraph-m');
      if (heading) heading.textContent = titleValue;
      if (body) body.textContent = bodyValue;
    });
    texts('#use-cases .hp-trust-metrics-tag', ['Course Authoring', 'Content Delivery', 'Quizmoto Sessions']);
  }

  function updateFeatures() {
    text('#features .caption', 'THE PLATFORM');
    text('#features h2.h1', 'Everything You Need to Build Better Learning');
    const intro = one('#features h2.h1');
    if (intro) {
      const wrapper = intro.parentElement;
      const paragraph = wrapper && wrapper.querySelector('.paragraph-m');
      if (paragraph) paragraph.textContent = 'Atelora brings course creation, SCORM delivery, live engagement and learning insights into one connected workspace.';
    }

    const headings = all('#features h3');
    const paragraphs = all('#features h3').map((heading) => {
      const parent = heading.parentElement;
      return parent ? parent.querySelector('p') : null;
    });
    content.features.forEach(([titleValue, bodyValue], index) => {
      if (headings[index]) headings[index].textContent = titleValue;
      if (paragraphs[index]) paragraphs[index].textContent = bodyValue;
    });
  }

  function updateCustomerCards() {
    text('.hp-customer-s h2.h1', 'How Teams Use Atelora');
    const quotes = all('.hp-customer-s .h3.testimonial');
    const names = all('.hp-customer-s .hp-cust-name');
    const labels = all('.hp-customer-s .paragraph-s');
    content.customerCards.forEach(([quote, name, label], index) => {
      if (quotes[index]) quotes[index].textContent = quote;
      if (names[index]) names[index].textContent = name;
      if (labels[index]) labels[index].textContent = label;
    });
  }

  function updateInsights() {
    text('#insights h2.h1', 'Explore What You Can Do');
    const headings = all('#insights h3.h5');
    const bodies = all('#insights p.paragraph-s');
    content.insights.forEach(([titleValue, bodyValue], index) => {
      if (headings[index]) headings[index].textContent = titleValue;
      if (bodies[index]) bodies[index].textContent = bodyValue;
    });
  }

  function updateFooter() {
    texts('.footer-s .hp-footer-h1', ['BUILD LEARNING THAT ENGAGES', 'BUILD LEARNING THAT ENGAGES', 'CREATE. DELIVER. TRACK.', 'CREATE. DELIVER. TRACK.']);
    text('.footer-s .global-footer-p', 'Create courses, run live Quizmoto sessions, deliver SCORM learning and track progress from one connected platform.');
  }

  function updateProductImages() {
    const replacements = [
      ['/atelora-marketing/hero.webp', 'Atelora platform'],
      ['/atelora-marketing/author.webp', 'Atelora course authoring'],
      ['/atelora-marketing/live.webp', 'Atelora Quizmoto Live'],
      ['/atelora-marketing/analytics.webp', 'Atelora analytics']
    ];
    const images = all('main img').filter((img) => !img.closest('.hp-hero-logos-c'));
    replacements.forEach(([src, alt], index) => {
      const img = images[index];
      if (!img) return;
      img.src = src;
      img.removeAttribute('srcset');
      img.alt = alt;
    });
  }

  function wireLogin() {
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a');
      if (!link) return;
      const href = link.getAttribute('href') || '';
      if (href === '/login') {
        event.preventDefault();
        window.top.location.href = '/login';
      }
    });
  }

  function apply() {
    updateMeta();
    updateBranding();
    updateNavigation();
    updateHero();
    updatePlatform();
    updateUseCases();
    updateFeatures();
    updateCustomerCards();
    updateInsights();
    updateFooter();
    updateProductImages();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  else apply();
  wireLogin();
})();
