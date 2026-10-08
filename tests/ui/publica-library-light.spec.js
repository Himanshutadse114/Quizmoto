const { test, expect } = require('@playwright/test');

const shortUrl = 'https://www.lmsgen.in/publica-library/AbCdEf0123456789';
const books = Array.from({ length: 8 }, (_, index) => ({ id: `book-${index}`, title: index ? `Publication ${index + 1}` : 'The Authors Gallery', description: 'A short story about sharing publications with your readers.', pageCount: 4, viewCount: 1, shareUrl: `/publica/book-${index}`, coverPath: `/api/cover-${index}` }));

for (const colorScheme of ['dark', 'light']) for (const width of [320, 390, 768, 1440]) test(`public library stays light and compact at ${width}px with ${colorScheme} preference`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 844 });
  await page.emulateMedia({ colorScheme });
  await page.addInitScript(theme => { localStorage.setItem('lmsgen-platform-theme', theme); window.copied = []; Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); Object.defineProperty(navigator, 'clipboard', { value: { writeText: async value => window.copied.push(value) }, configurable: true }); }, colorScheme);
  await page.route('**/api/**', route => route.fulfill(route.request().url().includes('public-library')
    ? { json: { library: { title: 'My Library', bookCount: 8, books, shareUrl: shortUrl, shareIdentifier: 'AbCdEf0123456789' } } }
    : { contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1800"><rect width="1200" height="1800" fill="#164452"/></svg>' }));
  await page.goto(`/publica-library/${'a'.repeat(48)}`);
  await expect(page.locator('.public-flip-library-card')).toHaveCount(6);
  await expect(page).toHaveURL(/\/publica-library\/AbCdEf0123456789$/);
  const metrics = await page.locator('.public-flip-library').evaluate(el => {
    const card = el.querySelector('.public-flip-library-card');
    const cover = card.querySelector('.public-flip-library-cover');
    return { scheme: getComputedStyle(el).colorScheme, background: getComputedStyle(el).backgroundColor, title: getComputedStyle(card.querySelector('h2')).fontSize, height: card.getBoundingClientRect().height, coverWidth: cover.getBoundingClientRect().width, overflow: document.documentElement.scrollWidth > innerWidth };
  });
  expect(metrics.scheme).toBe('light');
  expect(metrics.background).toBe('rgb(241, 245, 249)');
  expect(metrics.overflow).toBe(false);
  if (width < 640) { expect(metrics.title).toBe('16px'); expect(metrics.coverWidth).toBe(88); expect(metrics.height).toBeLessThan(270); }
  await page.getByRole('button', { name: 'Share library' }).click();
  expect(await page.evaluate(() => window.copied)).toEqual([shortUrl]);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.public-flip-library-card')).toHaveCount(2);
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('library-light.png') });
});
