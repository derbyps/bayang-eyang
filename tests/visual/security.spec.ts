import { expect, test } from '@playwright/test';

const pwned = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned);

test('a hostile play name in the URL is shown as text, never run', async ({ page }) => {
  await page.goto(`/?lakon=${encodeURIComponent('<img src=x onerror="window.__pwned=1">')}`);
  await expect(page.getByText("The dalang can't find this play.")).toBeVisible();
  await page.waitForTimeout(300);
  expect(await pwned(page)).toBeUndefined();
  await expect(page.locator('.debug img')).toHaveCount(0);
});

test('hostile titles inside a script are shown as text, never run', async ({ page }) => {
  const evil = '<img src=x onerror="window.__pwned=2">';
  await page.route('**/lakon/demo-eyang-putri.json', async (route) => {
    const res = await route.fetch();
    const lakon = await res.json();
    lakon.title = evil;
    lakon.scenes[0].title = evil;
    await route.fulfill({ response: res, json: lakon });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /light the lamp/i }).click();
  await page.waitForTimeout(500);
  expect(await pwned(page)).toBeUndefined();
  await expect(page.locator('.controls img, .intro img')).toHaveCount(0);
});
