import { expect, test, type Page } from '@playwright/test';

async function openCard(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /light the lamp/i }).click();
  return page.getByRole('form', { name: 'Tell the dalang a story' });
}

async function fillStory(page: Page) {
  await page.getByLabel('Who should the dalang perform tonight?').fill('Nenek Sari, my grandmother');
  await page.getByLabel('What was the hardest thing they faced?').fill('the flood took her rice fields');
}

test('a story becomes a play: card, puppet chest, then the stage', async ({ page }) => {
  await openCard(page);
  await fillStory(page);
  await page.getByRole('button', { name: 'Begin the play' }).click();
  const chest = page.getByRole('region', { name: 'The puppet chest' });
  await expect(chest).toBeVisible();
  for (const name of ['Nenek Sari', 'The Flood', 'Petruk']) await expect(chest.getByText(name, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Jump to The Flood' })).toBeAttached({ timeout: 10_000 });
});

test('begin sends one request even when clicked twice', async ({ page }) => {
  let posts = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/api/dalang') && r.method() === 'POST') posts++;
  });
  await openCard(page);
  await fillStory(page);
  const begin = page.getByRole('button', { name: 'Begin the play' });
  await begin.dblclick();
  await expect(page.getByRole('region', { name: 'The puppet chest' })).toBeVisible();
  await page.waitForTimeout(300);
  expect(posts).toBe(1);
});

test('a resting dalang offers the ready-made play', async ({ page }) => {
  await page.route('**/api/dalang', (route) =>
    route.fulfill({ contentType: 'application/x-ndjson', body: '{"type":"resting","retryAfterMin":12}\n' }),
  );
  await openCard(page);
  await fillStory(page);
  await page.getByRole('button', { name: 'Begin the play' }).click();
  await expect(page.getByText(/The dalang is resting/)).toBeVisible();
  await expect(page.getByText(/12 minutes/)).toBeVisible();
  await page.getByRole('button', { name: 'Watch Eyang Putri' }).click();
  await expect(page.getByRole('button', { name: 'Jump to Perang' })).toBeAttached();
});

test('the end card leads back to a new story', async ({ page }) => {
  await openCard(page);
  await fillStory(page);
  await page.getByRole('button', { name: 'Begin the play' }).click();
  await expect(page.getByRole('slider', { name: 'Play position' })).toBeAttached({ timeout: 10_000 });
  await page.keyboard.press('ArrowRight');
  await page.evaluate(() => {
    const s = document.querySelector('.scrub') as HTMLElement;
    const r = s.getBoundingClientRect();
    s.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.right - 1, clientY: r.top + 1, pointerId: 1, bubbles: true }));
    s.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
  });
  const card = page.getByRole('dialog', { name: 'Bayang Eyang' });
  await expect(card).toBeVisible({ timeout: 10_000 });
  await card.getByRole('button', { name: 'Tell another story' }).click();
  await expect(page.getByRole('form', { name: 'Tell the dalang a story' })).toBeVisible();
});
