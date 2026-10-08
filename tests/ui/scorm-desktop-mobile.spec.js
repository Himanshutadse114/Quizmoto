const { test, expect } = require('@playwright/test');
const { openCourse } = require('./scorm-desktop-fixture.cjs');

for (const source of ['upload', 'ai_author', 'catalog', 'presentation_import']) for (const [width, height] of [[320, 640], [390, 844], [844, 390], [1024, 768], [1440, 900]]) test(`${source} keeps desktop course composition at ${width}x${height}`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  const { frame, saves } = await openCourse(page, source);
  await expect(frame.locator('#app')).toBeVisible();
  const expectedWidth = width < 1280 || height < 720 ? 1280 : width;
  const expectedHeight = width < 1280 || height < 720 ? 720 : height;
  expect(await frame.locator('html').evaluate(() => ({ width: innerWidth, height: innerHeight }))).toEqual({ width: expectedWidth, height: expectedHeight });
  const fit = await page.locator('#frame').evaluate(el => {
    const rect = el.getBoundingClientRect();
    return rect.left >= -1 && rect.top >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth;
  });
  expect(fit).toBe(true);
  if (source === 'presentation_import') {
    await expect(frame.locator('#tab-slides')).toBeVisible();
    await frame.locator('#next').click();
    await expect(frame.locator('.quiz-page.active .options')).toHaveCSS('grid-template-columns', /\d+.* \d+/);
    await frame.locator('.quiz-page.active .option').first().click();
    await expect(frame.locator('.feedback.show')).toBeVisible();
  } else {
    await expect(frame.locator('aside')).toBeVisible();
    await expect(frame.locator('#js-layout')).toHaveText('Desktop JavaScript');
    expect(await frame.locator('#layout').evaluate(el => getComputedStyle(el, ':after').content)).toBe('"Desktop CSS"');
    await frame.locator('#go').click();
    await expect(frame.locator('#position')).toHaveText('Slide 2');
    await expect.poll(() => saves.some(save => save.values?.['cmi.core.lesson_location'] === '1')).toBe(true);
  }
});

test('course remains fitted through mobile rotation, then returns to native desktop', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { frame } = await openCourse(page, 'presentation_import');
  await expect(frame.locator('#app')).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('html')).toHaveClass(/qmx-course-desktop-fit/);
  await expect.poll(() => page.locator('#frame').evaluate(el => el.getBoundingClientRect().height)).toBeCloseTo(390, 1);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('html')).not.toHaveClass(/qmx-course-desktop-fit/);
  await expect.poll(() => frame.locator('html').evaluate(() => innerWidth)).toBe(1440);
});
