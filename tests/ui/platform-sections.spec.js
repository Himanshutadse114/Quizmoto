const { test, expect } = require('@playwright/test');

const identity = { username: 'Audit workspace', email: 'audit@example.com', role: 'super_admin', isSuperAdmin: true, scormAccess: true, platformAccess: true };
const longTitle = 'POSH Act: Recognise, Respond and Prevent Workplace Harassment';
const packages = [{ id: 'package-1', title: 'DPDP Act (Demo Course)', source: 'upload', status: 'ready', fileCount: 13, entryHref: 'index.html' }];
const courses = [{ id: 'course-1', title: longTitle, status: 'draft', inviteCode: 'Wy5gFnqnVf' }, { id: 'course-2', title: 'DPDP Act (Demo Course)', status: 'published', inviteCode: 'UhIfAPdf63' }];
const templates = ['SIM Swap Fraud — Innvikta Security Awareness', 'AI Scams & Deepfakes', 'Data Privacy Newsletter'].map((title, index) => ({ id: `template-${index}`, title, category: index === 1 ? 'AI Security' : 'Data Privacy', isActive: index !== 2, description: 'Practical guidance to help employees recognise risks and protect their accounts.', thumbnailUrl: '/fixture-cover.svg' }));
const initialLibrary = { title: 'My Library', bookCount: 1, enabled: true, shareUrl: 'https://www.lmsgen.in/publica-library/8777677b90f0b983db0ce710162bcbd2d69f41bf86a2c937' };

for (const theme of ['dark', 'light']) for (const width of [320, 390, 1024, 1440]) {
  test(`${theme} populated administrative sections stay compact and aligned at ${width}px`, async ({ page }, testInfo) => {
    let library = { ...initialLibrary };
    let saves = 0;
    await page.setViewportSize({ width, height: 960 });
    await page.addInitScript(({ identity, theme }) => {
      localStorage.setItem('token', 'sections-fixture');
      localStorage.setItem('user', JSON.stringify(identity));
      localStorage.setItem('scormAccessGranted', '1');
      localStorage.setItem('scormPlatformAccess', '1');
      localStorage.setItem('quizmoto_scorm_platform_theme', theme);
    }, { identity, theme });
    await page.route('**/fixture-cover.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#0b5f59"/><text x="32" y="190" fill="white" font-size="36">Awareness preview</text></svg>' }));
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      let data = { courses: [], templates: [], users: [], roster: [], groups: [], jobs: [], overview: {}, features: {}, config: {}, summary: {} };
      if (path.endsWith('/auth/scorm/status')) data = { ...identity, token: 'sections-fixture' };
      if (path.endsWith('/packages')) data = packages;
      if (path.endsWith('/courses')) data = courses;
      if (path.endsWith('/tracking/summary')) data = { courses: [{ id: 'course-1', learners: 12, completed: 4, averageProgress: 33 }] };
      if (path.endsWith('/awareness-gallery/central')) data = { templates };
      if (path.endsWith('/flipbooks')) data = { flipbooks: [{ id: 'book-1', title: 'The Authors Gallery — A Practical Guide to Sharing Your Publications', description: 'How unread PDFs become beautiful, interactive flipbooks for every reader.', status: 'published', pageCount: 4, shareEnabled: true, isPlatformDefault: true, sharePath: '/publica/audit', thumbnailPath: '/fixture-cover.svg' }], quota: { max: null, used: 1 } };
      if (path.endsWith('/flipbooks/library')) {
        if (route.request().method() === 'PATCH') { saves++; library.title = route.request().postDataJSON().title; }
        data = { library };
      }
      if (path.endsWith('/learner-access')) data = { config: { staffJoiningMode: 'password_or_sso', joiningMode: 'email_code' }, staffLoginPath: '/login/workspace/audit', learnerPortalPath: '/learn/audit' };
      return route.fulfill({ json: data });
    });
    const bounds = [];
    for (const [path, heading] of [
      ['/scorm/awareness-templates', 'Curated awareness template library'],
      ['/scorm/learner-access', 'Authentication & SSO'],
      ['/scorm/courses', 'Courses'],
      ['/scorm/publica', 'LMSGEN Publica'],
      ['/scorm/library', 'Trackable Course Library'],
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      const root = page.locator('.platform-section-page');
      if (path.endsWith('/awareness-templates')) await expect(root.locator('.aw-template-card')).toHaveCount(3);
      if (path.endsWith('/courses')) await expect(root.locator('.scorm-course-entry')).toHaveCount(2);
      if (path.endsWith('/library')) await expect(root.locator('.scorm-package-entry')).toHaveCount(1);
      if (path.endsWith('/publica')) await expect(root.locator('.flip-library-share-panel')).toBeVisible();
      const box = await root.boundingBox();
      bounds.push({ path, x: box.x, width: box.width });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
      const sizes = await root.locator('h3.platform-item-title').evaluateAll(elements => elements.map(el => ({ size: getComputedStyle(el).fontSize, clipped: el.scrollWidth > el.clientWidth + 1 })));
      expect(sizes.filter(item => item.size !== '16px' || item.clipped), path).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(path.split('/').pop() + '.png'), fullPage: true });
      if (path.endsWith('/awareness-templates')) {
        const opacity = await root.locator('.is-inactive').evaluate(el => getComputedStyle(el).opacity);
        expect(opacity).toBe('1');
        expect((await root.locator('.aw-search').boundingBox()).height).toBe(42);
        await page.getByRole('searchbox', { name: 'Search templates or categories' }).fill('Deepfakes');
        await expect(root.locator('.aw-template-card')).toHaveCount(1);
      }
      if (path.endsWith('/learner-access')) {
        const controls = root.locator('.sso-link-controls');
        await expect(controls).toHaveCount(2);
        for (const control of await controls.all()) {
          const input = await control.locator('input').boundingBox();
          const button = await control.locator('button').boundingBox();
          expect(Math.abs(input.y - button.y)).toBeLessThan(1);
          expect(input.height).toBe(42);
        }
      }
      if (path.endsWith('/courses')) {
        await expect(page.getByRole('heading', { name: longTitle })).toBeVisible();
        await page.getByRole('button', { name: /^published$/i }).click();
        await expect(root.locator('.scorm-course-entry')).toHaveCount(1);
      }
      if (path.endsWith('/publica')) {
        const card = root.locator('.flip-card');
        const cardSurface = await card.evaluate(el => {
          const probe = document.createElement('div');
          probe.style.backgroundColor = getComputedStyle(el).getPropertyValue('--scorm-surface').trim();
          document.body.append(probe);
          const expected = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return { actual: getComputedStyle(el).backgroundColor, expected };
        });
        expect(cardSurface.actual).toBe(cardSurface.expected);
        const clippedActions = await card.locator('.flip-card-actions > *').evaluateAll(elements => elements.filter(el => {
          const cardBounds = el.closest('.flip-card').getBoundingClientRect();
          const bounds = el.getBoundingClientRect();
          return bounds.right > cardBounds.right || bounds.left < cardBounds.left;
        }).map(el => el.textContent));
        expect(clippedActions).toEqual([]);
        await expect(page.getByRole('link', { name: 'Library analytics', exact: true })).toHaveCount(1);
        const panel = root.locator('.flip-library-share-panel');
        expect((await panel.boundingBox()).height).toBeLessThan(width === 1440 ? 330 : 550);
        await expect(panel.getByRole('button', { name: 'Save settings', exact: true })).toBeDisabled();
        await panel.getByLabel('Library name').fill('Company publications');
        await panel.getByRole('button', { name: 'Save settings', exact: true }).click();
        await expect(panel.getByRole('heading', { name: 'Company publications' })).toBeVisible();
        expect(saves).toBe(1);
        await expect(root.locator('.flip-quota-track')).toHaveCount(0);
      }
    }
    expect(new Set(bounds.map(item => Math.round(item.x))).size, JSON.stringify(bounds)).toBe(1);
    expect(new Set(bounds.map(item => Math.round(item.width))).size, JSON.stringify(bounds)).toBe(1);
  });
}
