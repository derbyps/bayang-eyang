import { expect, test } from '@playwright/test';

test('plays offline after the first visit', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    await (window as unknown as { __offlineReady?: Promise<void> }).__offlineReady;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: /light the lamp/i })).toBeVisible();
  await page.getByRole('button', { name: /light the lamp/i }).click();
  await expect(page.getByRole('slider', { name: 'Play position' })).toBeAttached();
});
