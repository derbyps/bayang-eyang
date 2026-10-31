// Records a demo video of one real play: a story typed into the card, the puppet chest, the whole performance.
// Start the app first (npm run build, then the server with a real DALANG_PROVIDER), then:
//   npx tsx scripts/record-demo.ts [--url http://localhost:8787] [--out demo] [--sound [--headed]]
// Writes <out>.webm. Playwright's own recording is silent, so --sound has Chrome capture its own tab instead,
// picture and gamelan together, from the "light the lamp" click (the click that also starts the audio).
import { renameSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const url = arg('url', 'http://localhost:8787');
const out = arg('out', 'demo');
const size = { width: 1280, height: 720 };
const sound = process.argv.includes('--sound');

// A made-up grandmother, the same one the tests use.
const story = {
  who: 'Nenek Sari, my grandmother',
  loved: 'her rice tin and kroncong on the radio',
  hardship: 'the 1981 flood took her rice fields in one night',
  habit: 'she hid money in the rice tin and called it her bank',
};

const browser = await chromium.launch(
  sound
    ? { channel: 'chromium', headless: !process.argv.includes('--headed'), args: ['--auto-accept-this-tab-capture', '--autoplay-policy=no-user-gesture-required'] }
    : {},
);
const context = await browser.newContext({ viewport: size, ...(sound ? {} : { recordVideo: { dir: 'test-results/demo-video', size } }) });
if (sound) {
  // Plain JavaScript text: tsx would wrap a function's inner names in a __name() helper the page does not have.
  await context.addInitScript(`
    window.__chunks = [];
    addEventListener('click', () => {
      navigator.mediaDevices
        .getDisplayMedia({ video: { frameRate: 30 }, audio: true, preferCurrentTab: true, selfBrowserSurface: 'include' })
        .then((stream) => {
          const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 6000000 });
          rec.ondataavailable = (e) => e.data.size && window.__chunks.push(e.data);
          rec.start(1000);
          window.__rec = rec;
          window.__audio = stream.getAudioTracks().length;
        })
        .catch((e) => (window.__error = String(e)));
    }, { capture: true, once: true });
  `);
}
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

if (sound) {
  const { b64, audio, error } = await page.evaluate(async () => {
    const w = window as unknown as { __chunks: Blob[]; __rec?: MediaRecorder; __audio?: number; __error?: string };
    if (!w.__rec) return { b64: '', audio: 0, error: w.__error ?? 'capture never started' };
    await new Promise((r) => ((w.__rec!.onstop = r), w.__rec!.stop()));
    const bytes = new Uint8Array(await new Blob(w.__chunks, { type: 'video/webm' }).arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { b64: btoa(bin), audio: w.__audio ?? 0, error: '' };
  });
  await browser.close();
  if (error) throw new Error(`tab capture failed: ${error}`);
  writeFileSync(`${out}.webm`, Buffer.from(b64, 'base64'));
  console.log(`saved ${out}.webm (${audio} audio track${audio === 1 ? '' : 's'})`);
} else {
  const video = page.video();
  await context.close();
  await browser.close();
  renameSync(await video!.path(), `${out}.webm`);
  console.log(`saved ${out}.webm`);
}
