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
        test.setTimeout(45000); // Give enough time
        
        hostPage = await hostContext.newPage();
        playerAPage = await playerAContext.newPage();
        playerBPage = await playerBContext.newPage();
        
        // 1 & 2: Test auth
        const loginRes = await request.post('http://localhost:5002/api/auth/test-login');
        const loginData = await loginRes.json();
        const token = loginData.token;

        // Set token in localStorage for Host
        await hostPage.goto('/');
        await hostPage.evaluate((t) => localStorage.setItem('token', t), token);

        // 4. Start a game session
        await hostPage.goto('/dashboard');
        
        await hostPage.getByText('Deterministic Test Quiz').waitFor();
        await hostPage.getByRole('button', { name: 'START', exact: true }).first().click();
        
        await hostPage.waitForURL(/\/host\/lobby\/\w+/);
        sessionPin = hostPage.url().split('/').pop();
        expect(sessionPin).toBeTruthy();

        // 7 & 8. Join Players
        await playerAPage.goto(`/join?pin=${sessionPin}`);
        await playerAPage.getByPlaceholder('Nickname').fill('PlayerA');
        await playerAPage.getByRole('button', { name: /Join Battle/i }).click();

        await playerBPage.goto(`/join?pin=${sessionPin}`);
        await playerBPage.getByPlaceholder('Nickname').fill('PlayerB');
        await playerBPage.getByRole('button', { name: /Join Battle/i }).click();

        // 9. Confirm that both appear in the host lobby
        await expect(hostPage.getByText('PlayerA')).toBeVisible();
        await expect(hostPage.getByText('PlayerB')).toBeVisible();

        // 10. Start the game (This will trigger the Defect!)
        await hostPage.getByRole('button', { name: /START GAME/i }).click();

        // Wait for the defect to manifest (timeout because it never reaches the question state on client)
        await expect(hostPage.getByText('What is 2 + 2?')).toBeVisible({ timeout: 10000 });
    });
});
