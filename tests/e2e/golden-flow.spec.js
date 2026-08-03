const { test, expect } = require('@playwright/test');

test.describe('Golden Flow', () => {
    let hostContext;
    let playerAContext;
    let playerBContext;
    let hostPage;
    let playerAPage;
    let playerBPage;
    let sessionPin;

    test.beforeAll(async ({ browser }) => {
        hostContext = await browser.newContext();
        playerAContext = await browser.newContext();
        playerBContext = await browser.newContext();
    });

    test.afterAll(async () => {
        await hostContext.close();
        await playerAContext.close();
        await playerBContext.close();
    });

    test('reproduce starting session defect', async ({ request }) => {
        test.setTimeout(90000);

        hostPage = await hostContext.newPage();
        playerAPage = await playerAContext.newPage();
        playerBPage = await playerBContext.newPage();

        const testRunId = process.env.TEST_RUN_ID || '';
        const testSecret = process.env.TEST_SECRET || 'fallback_secret';

        // Always re-seed so Mobile Chrome is not empty after Chromium cleanup
        const seedRes = await request.post('http://localhost:5002/api/test-only/seed', {
            headers: { 'x-test-secret': testSecret },
            data: { testRunId }
        });
        expect(seedRes.ok(), `seed failed: ${seedRes.status()}`).toBeTruthy();

        const loginRes = await request.post('http://localhost:5002/api/auth/test-login', {
            data: { testRunId }
        });
        expect(loginRes.ok()).toBeTruthy();
        const loginData = await loginRes.json();
        const token = loginData.token;
        expect(token).toBeTruthy();

        await hostPage.goto('/');
        await hostPage.evaluate((t) => localStorage.setItem('token', t), token);

        await hostPage.goto('/dashboard');
        await hostPage.getByText('Deterministic Test Quiz').waitFor({
            state: 'visible',
            timeout: 30000
        });
        await hostPage.getByRole('button', { name: 'START', exact: true }).first().click();

        await hostPage.waitForURL(/\/host\/lobby\/\w+/);
        sessionPin = hostPage.url().split('/').pop();
        expect(sessionPin).toBeTruthy();

        await playerAPage.goto(`/join?pin=${sessionPin}`);
        await playerAPage.getByPlaceholder('Nickname').fill('PlayerA');
        await playerAPage.getByRole('button', { name: /Join Battle/i }).click();

        await playerBPage.goto(`/join?pin=${sessionPin}`);
        await playerBPage.getByPlaceholder('Nickname').fill('PlayerB');
        await playerBPage.getByRole('button', { name: /Join Battle/i }).click();

        await expect(hostPage.getByText('PlayerA')).toBeVisible();
        await expect(hostPage.getByText('PlayerB')).toBeVisible();

        await hostPage.getByRole('button', { name: /START GAME/i }).click();

        await expect(hostPage.getByText('What is 2 + 2?')).toBeVisible({ timeout: 15000 });

        await expect(playerAPage.getByText('4', { exact: true })).toBeVisible({ timeout: 8000 });
        await expect(playerBPage.getByText('4', { exact: true })).toBeVisible({ timeout: 8000 });

        await playerAPage.getByText('4', { exact: true }).click();
        await expect(playerAPage.getByText('Answer Submitted!')).toBeVisible();

        await playerBPage.getByText('3', { exact: true }).click();
        await expect(playerBPage.getByText('Answer Submitted!')).toBeVisible();

        await expect(hostPage.getByRole('button', { name: /NEXT/i })).toBeVisible({ timeout: 25000 });

        await expect(playerAPage.getByText('Correct!')).toBeVisible();
        await expect(playerBPage.getByText('Incorrect')).toBeVisible();

        await expect(hostPage.getByText('Live Standings')).toBeVisible();

        await playerAPage.reload();
        await expect(playerAPage.getByText('Correct!')).toBeVisible();

        await hostPage.getByRole('button', { name: /NEXT/i }).click();
        await expect(hostPage.getByText('Which planet is known as the Red Planet?')).toBeVisible({
            timeout: 15000
        });
        await expect(playerAPage.getByText('Mars', { exact: true })).toBeVisible({ timeout: 8000 });
        await playerAPage.getByText('Mars', { exact: true }).click();
        await playerBPage.getByText('Earth', { exact: true }).click();
        await expect(hostPage.getByRole('button', { name: /NEXT/i })).toBeVisible({ timeout: 25000 });

        await hostPage.getByRole('button', { name: /NEXT/i }).click();
        await expect(hostPage.getByText('Is the sky blue?')).toBeVisible({ timeout: 15000 });
        await expect(playerAPage.getByText('Yes', { exact: true })).toBeVisible({ timeout: 8000 });
        await playerAPage.getByText('Yes', { exact: true }).click();
        await playerBPage.getByText('Yes', { exact: true }).click();
        await expect(hostPage.getByRole('button', { name: /NEXT/i })).toBeVisible({ timeout: 25000 });

        await hostPage.getByRole('button', { name: /NEXT/i }).click();
        await expect(hostPage.getByText('Final Results')).toBeVisible({ timeout: 15000 });
        await expect(playerAPage.getByText('GAME OVER!')).toBeVisible();

        await hostPage.getByRole('button', { name: /Dashboard/i }).click();
        await hostPage.waitForURL(/\/dashboard/);
        await hostPage.getByRole('button', { name: /Reports/i }).click();
        const quizHeading = hostPage.locator('h3').filter({ hasText: 'Deterministic Test Quiz' }).first();
        await quizHeading.waitFor({ state: 'attached', timeout: 20000 });
        await expect(quizHeading).toBeAttached();

        if (testRunId) {
            const cleanupRes = await request.post('http://localhost:5002/api/test-only/cleanup', {
                headers: { 'x-test-secret': testSecret },
                data: { testRunId }
            });
            expect(cleanupRes.ok()).toBeTruthy();
        }

        await hostPage.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });
        const tokenAfter = await hostPage.evaluate(() => localStorage.getItem('token'));
        expect(tokenAfter).toBeNull();
    });
});
