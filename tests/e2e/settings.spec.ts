/**
 * Issue #3: settings in `storage.sync`, seeded on install and applied live (SPEC §3.2 rules 1
 * and 6, §4). The fixture pages are served from `localhost`, with cross-origin frames from
 * `127.0.0.1`, so `localhost` is the page site.
 */
import type { Frame, Page } from '@playwright/test';
import { expect, frameByUrl, test } from './extension';

const DEFAULT = 2;

const rateOf = (target: Page | Frame) =>
  target.evaluate(() => document.querySelector<HTMLVideoElement>('#v')!.playbackRate);

/** Waits until the `#v` video has metadata, the point where the rules would have applied. */
const loaded = (target: Page | Frame) =>
  target.waitForFunction(() => document.querySelector<HTMLVideoElement>('#v')!.readyState >= 1);

const crossFrame = (page: Page) => frameByUrl(page, (url) => url.startsWith('http://127.0.0.1:3211/'));

test('a fresh install has the default settings and music.youtube.com turned off', async ({ storage }) => {
  expect(await storage.get('settings')).toEqual({ v: 1, defaultSpeed: DEFAULT, shortcutHintDismissed: false });
  expect(await storage.get('site:music.youtube.com')).toEqual({ disabled: true, added: expect.any(String) });
});

test.describe('a new default speed', () => {
  test('moves every untouched video, in every frame, without a reload', async ({ page, storage }) => {
    await page.goto('/iframes.html');
    const cross = await crossFrame(page);
    await expect.poll(() => rateOf(page)).toBe(DEFAULT);
    await expect.poll(() => rateOf(cross)).toBe(DEFAULT);

    await storage.setDefaultSpeed(1.5);
    await expect.poll(() => rateOf(page)).toBe(1.5);
    await expect.poll(() => rateOf(cross)).toBe(1.5);
  });

  test('applies to pages loaded after it', async ({ page, storage }) => {
    await storage.setDefaultSpeed(3);
    await page.goto('/plain.html');
    await expect.poll(() => rateOf(page)).toBe(3);
  });

  test('leaves a speed the user picked alone', async ({ page, storage }) => {
    await page.goto('/speed-menu.html');
    await expect.poll(() => rateOf(page)).toBe(DEFAULT);
    await page.locator('[data-rate="1.5"]').click();
    await expect.poll(() => rateOf(page)).toBe(1.5);

    await storage.setDefaultSpeed(3);
    await page.waitForTimeout(500);
    expect(await rateOf(page)).toBe(1.5);

    // The next video has no override, so it starts at the new default.
    await page.locator('#next').click();
    await expect.poll(() => rateOf(page)).toBe(3);
  });
});

test.describe('turning a site off', () => {
  test('returns its videos to 1×, in every frame, without a reload, and turning it on brings back the default', async ({
    page,
    storage,
  }) => {
    await page.goto('/iframes.html');
    const cross = await crossFrame(page);
    await expect.poll(() => rateOf(page)).toBe(DEFAULT);
    await expect.poll(() => rateOf(cross)).toBe(DEFAULT);

    await storage.disableSite('localhost');
    await expect.poll(() => rateOf(page)).toBe(1);
    await expect.poll(() => rateOf(cross)).toBe(1);

    await storage.remove('site:localhost');
    await expect.poll(() => rateOf(page)).toBe(DEFAULT);
    await expect.poll(() => rateOf(cross)).toBe(DEFAULT);
  });

  test('also returns a speed the user picked to 1×', async ({ page, storage }) => {
    await page.goto('/speed-menu.html');
    await expect.poll(() => rateOf(page)).toBe(DEFAULT);
    await page.locator('[data-rate="1.5"]').click();
    await expect.poll(() => rateOf(page)).toBe(1.5);

    await storage.disableSite('localhost');
    await expect.poll(() => rateOf(page)).toBe(1);
  });

  test('stops undoing the site’s own speed changes', async ({ page, storage }) => {
    await page.goto('/speed-menu.html');
    await expect.poll(() => rateOf(page)).toBe(DEFAULT);
    await storage.disableSite('localhost');
    await expect.poll(() => rateOf(page)).toBe(1);

    await page.evaluate(() => {
      document.querySelector<HTMLVideoElement>('#v')!.playbackRate = 0.5;
    });
    await page.waitForTimeout(500);
    expect(await rateOf(page)).toBe(0.5);
  });
});

test.describe('a page loaded on a disabled site', () => {
  test.beforeEach(async ({ storage }) => {
    await storage.disableSite('localhost');
  });

  test('plays at 1×, cross-origin iframes included, until the site is turned on', async ({ page, storage }) => {
    await page.goto('/iframes.html');
    const cross = await crossFrame(page);
    await loaded(page);
    await loaded(cross);
    await page.waitForTimeout(500);
    expect(await rateOf(page)).toBe(1);
    expect(await rateOf(cross)).toBe(1);

    await storage.remove('site:localhost');
    await expect.poll(() => rateOf(page)).toBe(DEFAULT);
    await expect.poll(() => rateOf(cross)).toBe(DEFAULT);
  });

  test('a video added after the site is turned on is found too', async ({ page, storage }) => {
    await page.goto('/plain.html');
    await loaded(page);
    await storage.remove('site:localhost');
    await expect.poll(() => rateOf(page)).toBe(DEFAULT);

    await page.evaluate(() => {
      const video = document.createElement('video');
      video.id = 'added';
      video.src = '/media/clip.webm?added';
      video.muted = true;
      video.preload = 'auto';
      document.body.append(video);
    });
    await expect
      .poll(() => page.evaluate(() => document.querySelector<HTMLVideoElement>('#added')!.playbackRate))
      .toBe(DEFAULT);
  });
});

test('the page site decides for iframes: a rule for the iframe’s own host doesn’t apply', async ({
  page,
  storage,
}) => {
  await storage.disableSite('127.0.0.1');
  await page.goto('/iframes.html');
  const cross = await crossFrame(page);
  await expect.poll(() => rateOf(cross)).toBe(DEFAULT);
});
