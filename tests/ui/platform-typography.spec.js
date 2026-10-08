const { test, expect } = require('@playwright/test');

// Cover page templates with isolated fixtures; never access production data.
const routes = [
  '/login', '/login/microsoft', '/learn', '/learn/audit', '/campaign/audit',
  '/scorm/learn/audit', '/scorm/player/audit', '/join', '/player/login', '/player/dashboard', '/publica-library/audit',
  '/auth/microsoft/callback', '/login/workspace/audit/microsoft/callback',
  '/learn/audit/microsoft/callback', '/campaign/audit/microsoft/callback',
  '/scorm', '/scorm/courses', '/scorm/courses/audit', '/scorm/library',
  '/scorm/author', '/scorm/visual-studio', '/scorm/presentation/edit/audit',
  '/scorm/awareness-templates', '/scorm/awareness-templates/campaigns/audit',
  '/scorm/roster', '/scorm/assignments', '/scorm/campaigns/new',
  '/scorm/campaigns/audit', '/scorm/campaigns/audit/learners', '/scorm/campaigns/audit/analytics',
  '/scorm/tracking', '/scorm/reports', '/scorm/quizmoto', '/scorm/quizmoto/create',
  '/scorm/quizmoto/edit/audit', '/scorm/quizmoto/reports', '/scorm/publica',
  '/scorm/publica/new', '/scorm/publica/audit/edit', '/scorm/publica/analytics',
  '/scorm/publica/audit/analytics', '/scorm/settings', '/scorm/team',
  '/scorm/learner-access', '/scorm/access', '/scorm/access/danger'
];
const identity = { username: 'Typography audit', email: 'audit@example.com', role: 'super_admin', isSuperAdmin: true, scormAccess: true, platformAccess: true };
const campaign = { id: 'audit', name: 'Security awareness', status: 'active', learners: [], courses: [], videos: [], publications: [], recipients: [], authMode: 'email_code', portalPath: '/campaign/audit' };
function fixture(path) {
  if (path.endsWith('/player/profile')) return { username: 'Learner profile', level: 1, xp: 10, avatar: 'default_avatar.png' };
  if (path.endsWith('/player/history')) return [];
  if (path.endsWith('/auth/scorm/status')) return { ...identity, token: 'fixture' };
  if (path.endsWith('/config')) return { config: { workspaceName: 'Audit workspace', campaignName: campaign.name, emailEnabled: true, authMode: 'email_code' } };
  if (path.endsWith('/courses/code/audit')) return { title: 'Security essentials', description: 'Learn to protect your account.' };
  if (path.endsWith('/courses/audit')) return { id: 'audit', title: 'Security essentials', inviteCode: 'audit', packageId: 'audit' };
  if (path.endsWith('/packages/audit/analysis')) return { source: 'presentation_import', analysis: { title: 'Security essentials', courseMode: 'presentation', quiz: { questions: [] } } };
  if (path.endsWith('/quizzes/audit')) return { id: 'audit', title: 'Security quiz', questions: [{ id: 1, questionText: 'Which action is safe?', options: ['Verify', 'Ignore', 'Share', 'Reuse'], correctIndex: 0, timer: 20 }] };
  if (/\/campaigns\/audit\/(summary|manage|analytics)$/.test(path) || path.endsWith('/email-campaigns/audit')) return { campaign, learners: [], courses: [], videos: [], publicationEntries: [] };
  if (path.includes('/flipbooks/library') || path.includes('/flipbook-library/')) return { library: { title: 'Audit publications', books: [], bookCount: 0, enabled: false } };
  if (path.endsWith('/flipbooks/audit')) return { flipbook: { id: 'audit', title: 'Audit publication', pageCount: 0, pages: [] } };
  if (path.endsWith('/flipbooks')) return { flipbooks: [], quota: { max: 2, used: 0 } };
  if (/\/(courses|packages|quizzes)$/.test(path) || path.endsWith('/courses/reports/all')) return [];
  return { users: [], members: [], tenants: [], roster: [], groups: [], courses: [], packages: [], templates: [], campaigns: [], learners: [], sessions: [], reports: [], jobs: [], activeSessions: [], summary: {}, overview: {}, config: {}, features: {}, settings: {}, data: [] };
}

for (const theme of ['dark', 'light']) for (const width of [390, 1440]) {
  test(`${theme} page typography stays consistent at ${width}px across all platform templates`, async ({ page }, testInfo) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(({ identity, theme }) => {
      localStorage.setItem('quizmoto_scorm_platform_theme', theme);
      if (location.pathname === '/player/dashboard') localStorage.setItem('playerToken', 'fixture');
      if (location.pathname.startsWith('/scorm') && !location.pathname.startsWith('/scorm/learn')) {
        localStorage.setItem('token', 'fixture');
        localStorage.setItem('user', JSON.stringify(identity));
        localStorage.setItem('scormAccessGranted', '1');
        localStorage.setItem('scormPlatformAccess', '1');
      }
    }, { identity, theme });
    // Font metrics below check CSS roles, independently of external font delivery.
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
    await page.route('**/api/**', route => route.fulfill({ json: fixture(new URL(route.request().url()).pathname) }));
    const findings = [];
    for (const path of routes) {
      await test.step(path, async () => {
        await page.goto(path);
        await page.waitForFunction(() => {
          const selector = '#workspace-content :is(h1,h2,.qe-heading,.qc-modal-title), .scorm-auth-workbench :is(h1,h2,.sa-form-title), .platform-learner-surface :is(h1,h2), .public-flip-library :is(h1,h2), .scorm-editorial > div h1';
          return [...document.querySelectorAll(selector)].some(el => el.getBoundingClientRect().height > 0);
        });
        const result = await page.evaluate(() => {
          const visible = el => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
          const scope = '.scorm-editorial, .scorm-auth-workbench, .platform-learner-surface, .public-flip-library';
          const title = 'h1,h2,h3,h4,h5,h6,[role="heading"],.scorm-display,.scorm-page-title,.demo-title,.reports-title,.reports-section-title,.sa-title,.sa-form-title,.qe-heading,.qe-question-name,.qe-loading-title,.qc-modal-title,.qh-title,.qh-section-title,.qh-empty-title';
          const elements = [...document.querySelectorAll(scope)].flatMap(root => [...root.querySelectorAll(title)]).filter(visible)
            .filter(el => !el.closest('[style*="--preview-primary"]'));
          const metric = el => ({ text: el.textContent.trim().slice(0, 80), size: getComputedStyle(el).fontSize, family: getComputedStyle(el).fontFamily.split(',')[0].replaceAll('"', '') });
          return {
            headings: elements.map(metric),
            headingWords: elements.flatMap(el => [...el.querySelectorAll('span,em,strong,b')].filter(visible).map(metric)),
            copy: [...document.querySelectorAll(scope)].flatMap(root => [...root.querySelectorAll('p')]).filter(visible).filter(el => !el.closest('[style*="--preview-primary"]')).map(metric),
            overflow: document.documentElement.scrollWidth > innerWidth
          };
        });
        findings.push({ path, ...result });
        expect(result.headings.length, `${path} must render its page headings`).toBeGreaterThan(0);
        expect(result.headings.filter(item => item.size !== '22px' || item.family !== 'Montserrat'), path).toEqual([]);
        expect(result.headingWords.filter(item => item.family !== 'Montserrat'), `${path} nested heading words`).toEqual([]);
        expect(result.copy.filter(item => item.size !== '14px' || item.family !== 'Open Sans'), `${path} body copy`).toEqual([]);
      });
    }
    await testInfo.attach('typography-audit', { body: JSON.stringify(findings, null, 2), contentType: 'application/json' });
  });
}

test('shared font roles preserve body emphasis, code and authored preview fonts', async ({ page }) => {
  await page.goto('/login');
  const metrics = await page.evaluate(() => {
    const fixture = document.createElement('section');
    fixture.className = 'scorm-editorial';
    fixture.innerHTML = '<h2>Consistent <span>heading</span></h2><p>Body <strong class="font-bold">emphasis</strong></p><button><span>Continue</span></button><code>PT0H0M19S</code><div style="--preview-primary:#123"><h2 style="font-family:Georgia">Authored title</h2></div>';
    document.getElementById('root').append(fixture);
    const family = selector => getComputedStyle(fixture.querySelector(selector)).fontFamily;
    const result = { heading: family('h2 span'), emphasis: family('strong'), action: family('button span'), code: family('code'), preview: family('[style*="--preview-primary"] h2') };
    fixture.remove();
    return result;
  });
  expect(metrics.heading).toContain('Montserrat');
  expect(metrics.emphasis).toContain('Open Sans');
  expect(metrics.action).toContain('Montserrat');
  expect(metrics.code).toContain('monospace');
  expect(metrics.preview).toContain('Georgia');
});
