/**
 * Renders the store images into store/images/ from the sources in store/src/:
 *
 * - `promo-tile-440x280.png`: store/src/promo-tile.html.
 * - `screenshot-1280x800.png`: the built extension really running on store/src/scene.html, a
 *   made-up video page served as `videos.example`. Its speed label is on the video, and its
 *   popup for that tab is captured too. store/src/screenshot.html frames both in a browser
 *   window.
 *
 * Needs a Chrome build in .output/chrome-mv3; `make store-images` builds first.
 */
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { basename, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const src = resolve(root, 'store/src');
const out = resolve(root, 'store/images');
const extension = resolve(root, '.output/chrome-mv3');
const SITE = 'videos.example';
const PAGE_PATH = '/watch/sunset-over-the-ridge';

if (!existsSync(resolve(extension, 'manifest.json'))) {
  throw new Error(`No build at ${extension}. Run \`npm run build\` (or \`make store-images\`).`);
}
await mkdir(out, { recursive: true });

// The video page, served from store/src. The browser maps videos.example to this server.
const TYPES = { '.html': 'text/html; charset=utf-8', '.webm': 'video/webm' };
const server = createServer(async (req, res) => {
  const path = new URL(req.url ?? '/', 'http://x').pathname;
  const file = resolve(src, path === PAGE_PATH ? 'scene.html' : basename(path));
  const body = await readFile(file).catch(() => null);
  if (!body) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
});
await new Promise((ready) => server.listen(0, '127.0.0.1', () => ready(undefined)));
const port = /** @type {import('node:net').AddressInfo} */ (server.address()).port;

/** Polls `check` until it's truthy, for up to 10 s. */
async function until(what, check) {
  for (const start = Date.now(); Date.now() - start < 10_000; await new Promise((r) => setTimeout(r, 100))) {
    if (await check()) return;
  }
  throw new Error(`Timed out waiting for ${what}`);
}

// 1. The extension on the video page, and its popup.
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  colorScheme: 'dark',
  viewport: { width: 1280, height: 716 },
  deviceScaleFactor: 1,
  args: [
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
    `--host-resolver-rules=MAP ${SITE} 127.0.0.1:${port}`,
  ],
});
const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
await until('the install seeding', () =>
  worker.evaluate(async () => (await chrome.storage.sync.get('settings')).settings !== undefined),
);

const page = context.pages()[0] ?? (await context.newPage());
await page.goto(`http://${SITE}${PAGE_PATH}`);
await until('the video playing at 2×', () =>
  page.evaluate(() => {
    const video = document.querySelector('video');
    return video !== null && !video.paused && video.currentTime > 0 && video.playbackRate === 2;
  }),
);

// The popup opens in a tab behind the page, so the page stays the active tab it shows, as in
// tests/e2e/extension.ts.
const popup = await context.newPage();
await page.bringToFront();
await popup.goto(new URL('/popup.html', worker.url()).href);
await popup.getByRole('heading', { name: SITE }).waitFor();
await popup.locator('output').filter({ hasText: '2×' }).first().waitFor();
const popupPng = await popup.locator('main').screenshot();
await popup.close();

// The label: Alt+R twice goes 2× → 1× → 2×, so the label reads 2×. The service worker fires
// its own `commands.onCommand`, as Chrome does on the key press.
await page.bringToFront();
for (let press = 0; press < 2; press++) {
  await worker.evaluate(async (url) => {
    const tab = (await chrome.tabs.query({})).find((t) => t.url === url);
    const onCommand = /** @type {any} */ (chrome.commands.onCommand);
    onCommand.dispatch('toggle-speed', tab);
  }, page.url());
}
await until('the speed back at 2×', () => page.evaluate(() => document.querySelector('video')?.playbackRate === 2));
await page.waitForTimeout(150);
const pagePng = await page.screenshot();
const badge = await worker.evaluate(async (url) => {
  const tab = (await chrome.tabs.query({})).find((t) => t.url === url);
  return chrome.action.getBadgeText({ tabId: tab?.id });
}, page.url());
await context.close();
server.close();

// 2. The framed screenshot and the promo tile, rendered as plain pages.
const browser = await chromium.launch();
const plain = await browser.newPage({ deviceScaleFactor: 1 });

await plain.setViewportSize({ width: 1280, height: 800 });
await plain.goto(pathToFileURL(resolve(src, 'screenshot.html')).href);
await plain.evaluate(
  async ({ pageUrl, popupUrl, badge }) => {
    const pageImg = /** @type {HTMLImageElement} */ (document.getElementById('page'));
    const popupImg = /** @type {HTMLImageElement} */ (document.getElementById('popup'));
    document.getElementById('badge').textContent = badge;
    pageImg.src = pageUrl;
    popupImg.src = popupUrl;
    await Promise.all([pageImg.decode(), popupImg.decode()]);
    // Chrome opens the popup below the toolbar, its right edge near the button's.
    const button = document.querySelector('.btn.ext').getBoundingClientRect();
    popupImg.style.right = `${innerWidth - button.right - 4}px`;
    popupImg.style.top = `${button.bottom + 8}px`;
  },
  {
    pageUrl: `data:image/png;base64,${pagePng.toString('base64')}`,
    popupUrl: `data:image/png;base64,${popupPng.toString('base64')}`,
    badge,
  },
);
await plain.screenshot({ path: resolve(out, 'screenshot-1280x800.png') });
console.log('store/images/screenshot-1280x800.png');

await plain.setViewportSize({ width: 440, height: 280 });
await plain.goto(pathToFileURL(resolve(src, 'promo-tile.html')).href);
await plain.screenshot({ path: resolve(out, 'promo-tile-440x280.png') });
console.log('store/images/promo-tile-440x280.png');

await browser.close();
