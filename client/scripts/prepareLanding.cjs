const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const clientDir = path.resolve(__dirname, '..');
const sourceDir = path.join(clientDir, 'landing-site');
const outputDir = path.join(clientDir, 'public', 'landing');
const EXPECTED_CHUNK_SIZE = 20000;
const EXPECTED_HTML_SHA256 = 'bd962e4e60eeec6c8c07f3deb0291e003d27fac0d11e49607786b41729bc9601';
const FALLBACK_SOURCE = 'https://www.localyzer.io/';

function listChunks() {
  return fs.existsSync(sourceDir)
    ? fs.readdirSync(sourceDir)
        .filter((name) => /^chunk\d+\.b64$/i.test(name))
        .sort((a, b) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0))
    : [];
}

function reconstructCommittedLanding() {
  const chunkFiles = listChunks();
  if (!chunkFiles.length) throw new Error(`Primary landing source chunks not found in ${sourceDir}`);

  const chunks = chunkFiles.map((name, index) => {
    const compact = fs.readFileSync(path.join(sourceDir, name), 'utf8').replace(/\s+/g, '');
    const isLast = index === chunkFiles.length - 1;
    if (!isLast && compact.length !== EXPECTED_CHUNK_SIZE) {
      throw new Error(`Landing source ${name} has invalid length ${compact.length}; expected ${EXPECTED_CHUNK_SIZE}.`);
    }
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) throw new Error(`Landing source ${name} contains non-base64 characters.`);
    return compact;
  });

  const encoded = chunks.join('');
  if (encoded.length % 4 !== 0) throw new Error(`Landing source base64 length ${encoded.length} is not divisible by 4.`);

  const html = zlib.gunzipSync(Buffer.from(encoded, 'base64'));
  const htmlText = html.toString('utf8');
  if (!/<html[\s>]/i.test(htmlText) || !/<\/html>/i.test(htmlText)) throw new Error('Reconstructed landing source is not a complete HTML document.');

  const hash = crypto.createHash('sha256').update(html).digest('hex');
  if (hash !== EXPECTED_HTML_SHA256) throw new Error(`Landing source checksum mismatch: ${hash}`);
  return { htmlText, source: `${chunkFiles.length} committed source chunks` };
}

function removeOriginalTracking(html) {
  return html
    .replace(/<script[^>]*>[^<]*googletagmanager[\s\S]*?<\/script>/gi, '')
    .replace(/<script[^>]+src=["'][^"']*googletagmanager[^"']*["'][^>]*><\/script>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?googletagmanager[\s\S]*?<\/noscript>/gi, '')
    .replace(/<base\b[^>]*>/gi, '');
}

function injectAteloraExperience(html) {
  const bridge = `
<script id="atelora-primary-site-bridge">
(function () {
  var LOGO = '/atelora-landing-logo.svg';
  var LOGIN_LABEL = /^(book a demo|get started|get started now|start now|request a demo|explore atelora|sign in|quizmoto)$/i;
  var SOURCE_LINK = /(^|\\.)localyzer\\.io/i;
  var PARTNER_ALTS = ['sparda-bank','subaru','zaunteam','lbs','jeansfritz','takko','mitsubishi','vodafone','gwm','electrolux','canon'];

  var COPY = {
    'request a demo': 'Explore Atelora',
    'get in touch and our team will get back to you immediately to arrange a free demo.': 'Sign in to explore Atelora and see how AI course creation, Quizmoto and learning analytics work together.',
    'thank you for requesting a demo!': 'Welcome to Atelora',
    'one of our team members will be in touch shortly to schedule your demo and answer any questions you might have. in the meantime, feel free to explore our website': 'Continue to Atelora to access the learning platform and explore its tools.',
    'for franchise networks, dealer groups and branch organisations': 'For modern L&D and security awareness teams',
    'local marketing that your locations actually use': 'AI-Powered Learning That Teams Actually Use',
    'campaigns, social and print across every location - with co-op budgets under control.': 'Create SCORM-ready courses, run Quizmoto experiences, manage learners and track results — all in one platform.',
    'get started': 'Explore Atelora',
    'trusted by leading brands to manage local marketing at scale.': 'One connected platform for course creation, learner engagement and measurable learning.',
    '70%+': 'AI',
    'adoption': 'Course Authoring',
    'co-op budget': 'SCORM',
    'activated': 'Ready',
    'the platform': 'THE PLATFORM',
    'created over 80,000 local campaigns': 'Create Training Faster with AI',
    '70%+ of locations actively marketing': 'Engage Learners with Quizmoto',
    'millions in co-op budget activated': 'Track Progress with Clear Analytics',
    'create, launch, and manage local marketing across all locations - in one connected system.': 'Create, deliver and measure learning across teams from one connected workspace.',
    'launch': 'CREATE',
    'stuttgart location': 'AI COURSE STUDIO',
    'campaign ready to launch': 'Course ready to publish',
    'location': 'LEARNER',
    'live location': 'Learner Workspace',
    '12,544 / berlin · munich · stuttgart': 'Learners · Teams · Cohorts',
    'brand': 'ENGAGE',
    'adoption 70%+': 'Quizmoto Ready',
    'brand compliant · ready to use': 'Interactive · Ready to play',
    'template': 'COURSE',
    'campaign template': 'SCORM Course',
    'summer promotion · budget: €1,200': 'Cybersecurity Awareness · 15 min',
    'budget': 'TRACK',
    'co-op budget': 'Learner Progress',
    '€1,600 used · €3,000 total': '1,600 completed · 3,000 assigned',
    'overview': 'REPORT',
    'overall campaign reporting': 'Learning Analytics',
    'active · pending approval': 'Completed · In progress',
    'why localyzer': 'WHY ATELORA',
    'built for real local marketing challenges': 'Built for Real Learning Challenges',
    'efficient budget usage': 'Faster Course Creation',
    'put co-op funds and your existing assets, tools and lists to work.': 'Turn a brief into structured, SCORM-ready learning content with AI-assisted authoring.',
    'scalable solutions': 'Scalable Learning',
    'manage hundreds or thousands of locations with one centralized system.': 'Manage learners, courses and access across teams from one central platform.',
    'automation & simplicity': 'Automation & Simplicity',
    'launch campaigns and publish content in minutes - no complexity or training required.': 'Build and publish training faster with simple workflows designed for day-to-day use.',
    'consistent branding': 'Consistent Learning Experiences',
    'ensure every campaign and social post aligns with your brand - across all locations.': 'Keep courses, games and learner experiences consistent across your organisation.',
    'campaigns / month': 'Course · Game · Analytics',
    'platform adoption': 'AI-Powered Learning',
    'co-op budget utilized': 'Learning Insights',
    'the advantage': 'THE ADVANTAGE',
    'everything you need to run local marketing': 'Everything You Need to Run Modern Learning',
    'experience the difference with localyzer’s powerful tools and features designed to optimize your local marketing efforts.': 'Build, manage and measure training with connected tools for content, engagement, learners and reporting.',
    'expand your reach': 'AI Course Studio',
    'run paid and organic campaigns across digital, social, search, print and local channels — from one platform.': 'Generate structured, SCORM-ready courses with AI and refine them before publishing.',
    'start now': 'Explore Atelora',
    'co-op budget management': 'SCORM-Ready Courses',
    'control funding, approvals, and reimbursements with full transparency and structured workflows.': 'Create and deliver standards-ready learning packages through a clear authoring workflow.',
    'steer by results': 'Learner Tracking',
    'full control over budgets and impact per location.': 'Track learner assignments, progress and completion from one place.',
    'paid ads, automated.': 'QUIZMOTO, BUILT IN.',
    'automate creation and management of paid search, display and social campaigns.': 'Create interactive quizzes and live game-based learning experiences inside the platform.',
    'social posting at scale': 'Central Learning Library',
    'create and distribute organic content across all locations - centrally or locally, with built-in templates and localization.': 'Organise courses and learning content in one library and make it available to the right learners.',
    'dedicated support': 'Admin & Access Controls',
    'access expert guidance whenever you need it.': 'Control platform access, approvals and administration with role-based workflows.',
    'what our customers say': 'How Atelora Supports Learning Teams',
    'latest insights and tips': 'Explore the Atelora Platform',
    'view all articles': 'EXPLORE ATELORA',
    'take control of your local marketing': 'Take Control of Your Learning',
    'level up your ads reach': 'CREATE. ENGAGE. MEASURE.',
    'unify campaigns, social content, and budgets in one platform.': 'Create courses, engage learners and track outcomes in one platform.',
    'about': 'Platform',
    'solutions': 'Features',
    'blog': 'Resources',
    'careers': 'Quizmoto',
    'contact': 'Sign In'
  };

  var TESTIMONIAL_COPY = [
    ['for over four years, we have been successfully working with localyzer and highly value the regular exchange, which not only helps optimize our campaigns but also fosters shared learning. from traditional measures such as sea, display advertising, and social media to new, innovative formats like local tv ads and special campaigns for store openings – our collaboration enables us to implement customized solutions tailored to the specific needs of regional marketing.', 'Create structured courses faster with AI-assisted authoring, while keeping control of the final learning experience.'],
    ['through our collaboration with localyzer and thanks to their dedicated team, we were able to significantly simplify and optimize the implementation of local online campaigns for our branches. in particular, social media ads with a local focus on the locations of jeans fritz stores in germany and blackout stores in switzerland achieved outstanding results within our core target audience.', 'Turn passive learning into active participation with Quizmoto quizzes and game-based experiences.'],
    ["without localyzer, local online marketing for our large sales force wouldn't even be possible at the consulting office level. the support and communication is excellent. the offering is called \"performance campaigns\" internally at our company, and for good reason.", 'Assign learners, manage access and keep training organised across teams from one central workspace.'],
    ['localyzer responds to our ideas and wishes and adapts them to suitable offers. flexible and spontaneous appointments allow us to implement change requests to a campaign even at quite short notice. the team ensures fast and customer-oriented implementation, which overall contributes to the pleasant cooperation.', 'Use clear reports and learning analytics to understand completion, activity and learner progress.'],
    ['we took off with localyzer in social media marketing. we have been able to target a better and more accurate audience and lead generation has increased greatly as a result!', 'Keep learning content together in a central library and make courses easy to find and reuse.'],
    ['"we have had exclusively positive experiences in the cooperation and joint implementation of our online strategy with localyzer. we are also very satisfied with the results as well as the communication and service. we can recommend localyzer as a partner without reservation!"', 'Use role-based administration and approval controls to manage platform access securely.'],
    ['thanks to localyzer, we were able to try out new ways of doing things in the digital world with our partners and, what\'s more, we were able to do it in a pleasant and straightforward way.', 'Bring AI authoring, SCORM delivery, Quizmoto and analytics together instead of managing separate learning tools.']
  ];

  var PEOPLE = {
    'dirk schwanekamp': 'AI Course Studio', 'sparda-bank west eg': 'Create courses faster',
    'falko schäfer': 'Quizmoto', 'jeans fritz handelsgesellschaft für mode mbh': 'Make learning interactive',
    'markus hüttner': 'Learner Management', 'lbs südwest': 'Manage learning centrally',
    'pauline kalteis': 'Analytics & Reporting', 'autohaus sternpark gmbh & co. kg': 'See learning progress clearly',
    'sebastian böck': 'Learning Library', 'autohaus renck-weindel kg': 'Organise reusable content',
    'stephanie krebs': 'Admin Controls', 'zimmer+rohde gmbh': 'Control access and approvals',
    'isabelle studer': 'Connected Platform', 'electrolux ag': 'Author · Engage · Measure'
  };

  var INSIGHTS = [
    ['AI Course Authoring', 'Turn a training brief into structured learning content and prepare it for SCORM delivery.'],
    ['Quizmoto Engagement', 'Use interactive quizzes and live game-based learning to make training more memorable.'],
    ['SCORM-Ready Delivery', 'Create standards-ready courses that can be delivered and tracked through modern learning workflows.'],
    ['Learner Management', 'Organise learners, assignments and access from one central learning workspace.'],
    ['Learning Analytics', 'Use reports and tracking data to understand participation, progress and completion.'],
    ['Central Learning Library', 'Keep courses and reusable learning content organised in a single platform.'],
    ['AI + Human Control', 'Move faster with AI while keeping people in control of content, review and publishing.'],
    ['Admin & Access', 'Manage approvals and role-based access for a structured, secure platform experience.']
  ];

  function norm(value) { return String(value || '').replace(/\\s+/g, ' ').trim().toLowerCase(); }
  function rewrite(value) {
    if (typeof value !== 'string') return value;
    var key = norm(value);
    var next = COPY[key];
    if (!next) next = PEOPLE[key];
    if (!next) {
      for (var i = 0; i < TESTIMONIAL_COPY.length; i++) if (key === TESTIMONIAL_COPY[i][0]) { next = TESTIMONIAL_COPY[i][1]; break; }
    }
    if (next) {
      var lead = (value.match(/^\\s*/) || [''])[0];
      var trail = (value.match(/\\s*$/) || [''])[0];
      return lead + next + trail;
    }
    return value.replace(/Localyzer/gi, 'Atelora');
  }

  function patchText() {
    if (!document.body) return;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var nodes = [], node;
    while ((node = walker.nextNode())) nodes.push(node);
    nodes.forEach(function (textNode) {
      var next = rewrite(textNode.nodeValue || '');
      if (next !== textNode.nodeValue) textNode.nodeValue = next;
    });
    document.querySelectorAll('*').forEach(function (el) {
      ['alt','title','aria-label','data-label'].forEach(function (name) {
        if (!el.hasAttribute || !el.hasAttribute(name)) return;
        var current = el.getAttribute(name) || '';
        var next = rewrite(current);
        if (next !== current) el.setAttribute(name, next);
      });
    });
  }

  function setLogo(img) {
    if (!img || img.tagName.toLowerCase() !== 'img') return;
    img.src = LOGO;
    img.removeAttribute('srcset');
    img.alt = 'Atelora';
    img.dataset.ateloraLogo = '1';
    img.style.objectFit = 'contain';
  }

  function patchLogos() {
    var width = window.innerWidth || 1440;
    var top = Array.from(document.querySelectorAll('img')).map(function (el) { return { el: el, r: el.getBoundingClientRect() }; }).filter(function (x) {
      return x.r.top >= 0 && x.r.top < 130 && x.r.left >= 0 && x.r.left < width * .48 && x.r.width >= 70 && x.r.width <= 300 && x.r.height >= 14 && x.r.height <= 100;
    });
    top.sort(function (a,b) {
      var am = ((a.el.alt || '') + ' ' + (a.el.src || '')).toLowerCase();
      var bm = ((b.el.alt || '') + ' ' + (b.el.src || '')).toLowerCase();
      return (/localyzer|logo/.test(am) ? -1000 : 0) - (/localyzer|logo/.test(bm) ? -1000 : 0) || a.r.left - b.r.left;
    });
    if (top[0]) setLogo(top[0].el);

    document.querySelectorAll('img').forEach(function (img) {
      var alt = norm(img.getAttribute('alt'));
      if (PARTNER_ALTS.some(function (name) { return alt.indexOf(name) !== -1; })) setLogo(img);
    });
  }

  function patchInsights() {
    var cards = Array.from(document.querySelectorAll('a')).filter(function (a) {
      var href = a.getAttribute('href') || '';
      return /\\/blog\\//i.test(href) || /^article\\b/i.test(norm(a.textContent));
    });
    cards.forEach(function (card, index) {
      var data = INSIGHTS[index % INSIGHTS.length];
      var leaves = Array.from(card.querySelectorAll('*')).filter(function (el) {
        return el.children.length === 0 && el.tagName !== 'IMG' && norm(el.textContent).length > 0;
      });
      var longLeaves = leaves.filter(function (el) { return norm(el.textContent).length > 24; });
      if (longLeaves[0]) longLeaves[0].textContent = data[0];
      if (longLeaves[1]) longLeaves[1].textContent = data[1];
      leaves.forEach(function (el) {
        var t = norm(el.textContent);
        if (t === 'article') el.textContent = 'Platform';
      });
    });
  }

  function patchLinks() {
    document.querySelectorAll('a').forEach(function (link) {
      var href = link.getAttribute('href') || '';
      var label = norm(link.textContent);
      var isSource = SOURCE_LINK.test(href) || /^\\/(about|solutions|blog|careers|contact|imprint|terms|privacy)/i.test(href);
      if (LOGIN_LABEL.test(label) || label === 'sign in' || label === 'quizmoto') {
        link.setAttribute('href', '/login');
        link.setAttribute('target', '_top');
        link.dataset.ateloraLogin = '1';
      } else if (isSource || /^https?:\\/\\//i.test(href) && SOURCE_LINK.test(new URL(href, location.href).hostname)) {
        link.setAttribute('href', '#');
        link.removeAttribute('target');
        link.dataset.ateloraBlockedSource = '1';
      }
    });
  }

  function patchMeta() {
    document.title = 'Atelora | AI-Powered Learning Platform';
    var description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute('content', 'Create SCORM-ready courses with AI, engage learners with Quizmoto, manage learning and track results in Atelora.');
  }

  function patchAll() { patchText(); patchLogos(); patchInsights(); patchLinks(); patchMeta(); }

  document.addEventListener('click', function (event) {
    var el = event.target && event.target.closest ? event.target.closest('a,button') : null;
    if (!el) return;
    var label = norm(el.textContent);
    var href = el.getAttribute && (el.getAttribute('href') || '');
    if (LOGIN_LABEL.test(label) || el.dataset && el.dataset.ateloraLogin === '1') {
      event.preventDefault(); event.stopImmediatePropagation(); window.top.location.href = '/login'; return;
    }
    if (SOURCE_LINK.test(href) || el.dataset && el.dataset.ateloraBlockedSource === '1') {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener('submit', function (event) {
    if (!event.target || event.target.tagName !== 'FORM') return;
    event.preventDefault(); event.stopImmediatePropagation(); window.top.location.href = '/login';
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', patchAll);
  else patchAll();

  var timer;
  new MutationObserver(function () {
    clearTimeout(timer); timer = setTimeout(patchAll, 60);
  }).observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(patchAll, 300);
  setTimeout(patchAll, 1000);
})();
</script>`;

  return /<\/body\s*>/i.test(html) ? html.replace(/<\/body\s*>/i, `${bridge}</body>`) : `${html}${bridge}`;
}

async function fetchFallbackLanding() {
  const response = await fetch(FALLBACK_SOURCE, {
    redirect: 'follow',
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; QuizmotoBuild/1.0)', 'accept': 'text/html,application/xhtml+xml' }
  });
  if (!response.ok) throw new Error(`Fallback landing fetch failed with HTTP ${response.status}`);
  const htmlText = await response.text();
  if (!/<html[\s>]/i.test(htmlText) || !/<\/html>/i.test(htmlText)) throw new Error('Fallback landing response is not a complete HTML document.');
  return { htmlText, source: FALLBACK_SOURCE };
}

async function main() {
  let prepared;
  try {
    prepared = reconstructCommittedLanding();
  } catch (error) {
    console.warn(`Committed landing payload is unavailable or invalid: ${error.message}`);
    console.warn(`Using visual-source fallback while applying Atelora-owned content and navigation.`);
    prepared = await fetchFallbackLanding();
  }

  let finalHtml = removeOriginalTracking(prepared.htmlText);
  finalHtml = injectAteloraExperience(finalHtml);

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'index.html'), finalHtml, 'utf8');
  console.log(`Prepared Atelora primary website in public/landing (${Buffer.byteLength(finalHtml)} bytes).`);
}

main().catch((error) => { console.error(error); process.exit(1); });
