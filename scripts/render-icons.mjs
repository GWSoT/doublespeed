/**
 * Renders the extension's icons from their SVG sources in assets/ into public/icon/, where WXT
 * picks them up for the manifest. `make icons` runs it; commit the PNGs it writes.
 *
 * Chrome's guidelines: the 128 px icon is 96 px of artwork with 16 px of transparent padding
 * (it's also the store icon); the toolbar sizes fill their square. 16 px has its own source,
 * drawn on the pixel grid.
 */
import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

const ICONS = [
  { src: 'assets/icon-16.svg', size: 16, out: 'public/icon/16.png' },
  { src: 'assets/icon.svg', size: 32, out: 'public/icon/32.png' },
  { src: 'assets/icon.svg', size: 48, out: 'public/icon/48.png' },
  { src: 'assets/icon.svg', size: 128, padding: 16, out: 'public/icon/128.png' },
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

for (const { src, size, padding = 0, out } of ICONS) {
  const svg = (await readFile(resolve(root, src))).toString('base64');
  const art = size - 2 * padding;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}</style>` +
      `<img src="data:image/svg+xml;base64,${svg}" width="${art}" height="${art}" ` +
      `style="position:absolute;left:${padding}px;top:${padding}px">`,
  );
  await page.locator('img').evaluate((img) => img.decode());
  await mkdir(dirname(resolve(root, out)), { recursive: true });
  await page.screenshot({ path: resolve(root, out), omitBackground: true });
  console.log(`${out}  ${size}×${size}`);
}

await browser.close();
