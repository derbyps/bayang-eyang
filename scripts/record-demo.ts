// Records a demo video of one real play: a story typed into the card, the puppet chest, the whole performance.
// Start the app first (npm run build, then the server with a real DALANG_PROVIDER), then:
//   npx tsx scripts/record-demo.ts [--url http://localhost:8787] [--out demo]
// Writes <out>.webm (silent: browsers do not record audio).
import { renameSync } from 'node:fs';
import { chromium } from '@playwright/test';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const url = arg('url', 'http://localhost:8787');
const out = arg('out', 'demo');
const size = { width: 1280, height: 720 };

// A made-up grandmother, the same one the tests use.
const story = {
  who: 'Nenek Sari, my grandmother',
  loved: 'her rice tin and kroncong on the radio',
  hardship: 'the 1981 flood took her rice fields in one night',
  habit: 'she hid money in the rice tin and called it her bank',
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: size, recordVideo: { dir: 'test-results/demo-video', size } });
const page = await context.newPage();
await page.goto(url);
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /light the lamp/i }).click();
await page.waitForTimeout(1200);

const type = async (label: string | RegExp, text: string) => {
  await page.getByLabel(label).pressSequentially(text, { delay: 35 });
  await page.waitForTimeout(400);
};
await type('Who should the dalang perform tonight?', story.who);
await type(/What did they love/i, story.loved);
await type('What was the hardest thing they faced?', story.hardship);
await type(/habit/i, story.habit);
await page.getByRole('button', { name: 'Begin the play' }).click();

await page.getByRole('region', { name: 'The puppet chest' }).waitFor();
// The play runs to its end card (generation plus up to two minutes of performance).
await page.getByRole('dialog', { name: 'Bayang Eyang' }).waitFor({ timeout: 6 * 60_000 });
await page.waitForTimeout(3000);

const video = page.video();
await context.close();
await browser.close();
renameSync(await video!.path(), `${out}.webm`);
console.log(`saved ${out}.webm`);
