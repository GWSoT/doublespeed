/**
 * Issue #12: the shortcuts move every video in the tab and set an override (SPEC §3.2 rule 5,
 * ADR-0005), and the speed label shows the new speed over the video, fullscreen included.
 * `localhost` is the page site; cross-origin frames come from `127.0.0.1`.
 */
import type { Frame, Page } from '@playwright/test';
import { expect, frameByUrl, labelBox, pressShortcut, speedLabels, test } from './extension';
import { LABEL_SHOW_MS } from '../../src/content/speed-label';

const DEFAULT = 2;

const rateOf = (target: Page | Frame, selector = '#v') =>
  target.evaluate((s) => document.querySelector<HTMLVideoElement>(s)!.playbackRate, selector);

/**
 * The label is drawn where the user sees it, not hidden under the page or a fullscreen player:
 * its area of the screen looks different while it shows than after it has gone. The fixture
 * video is paused, so nothing else there changes.
 */
async function expectLabelDrawn(page: Page) {
  const box = await labelBox(page);
  expect(box).not.toBeNull();
  const shown = await page.screenshot({ clip: box! });
  await expect.poll(() => speedLabels(page), { timeout: LABEL_SHOW_MS + 2000 }).toEqual({ open: false, texts: [] });
  const gone = await page.screenshot({ clip: box! });
  expect(shown.equals(gone)).toBe(false);
}

test.describe('the shortcuts', () => {
  test('move every video in the tab, iframes included', async ({ context, page }) => {
    await page.goto('/iframes.html');
    const frames = [
      page,
      await frameByUrl(page, (url) => url.startsWith('http://127.0.0.1:3211/')),
      page.frame({ name: 'same' })!,
      page.frame({ name: 'srcdoc' })!,
      page.frame({ name: 'blank' })!,
    ];
    for (const frame of frames) await expect.poll(() => rateOf(frame)).toBe(DEFAULT);

    await pressShortcut(context, page, 'speed-up');
    for (const frame of frames) await expect.poll(() => rateOf(frame)).toBe(2.25);

    await pressShortcut(context, page, 'slow-down');
    await pressShortcut(context, page, 'slow-down');
    for (const frame of frames) await expect.poll(() => rateOf(frame)).toBe(1.75);
  });

  test('the new speed is an override: a site reset goes back to it, and the next video starts at the default', async ({
    context,
    page,
  }) => {
    await page.goto('/youtube.html');
    await expect.poll(() => page.evaluate(() => (window as unknown as { resets: number }).resets)).toBe(1);
    await expect.poll(() => rateOf(page)).toBe(DEFAULT);

    await pressShortcut(context, page, 'slow-down');
    await expect.poll(() => rateOf(page)).toBe(1.75);

    // The player puts its own speed back, with no input from the user.
    await page.evaluate(() => (document.querySelector<HTMLVideoElement>('#v')!.playbackRate = 1));
    await expect.poll(() => rateOf(page)).toBe(1.75);

    await page.evaluate(() => (window as unknown as { player: { next(): void } }).player.next());
    await expect.poll(() => page.evaluate(() => (window as unknown as { resets: number }).resets)).toBe(2);
    await expect.poll(() => rateOf(page)).toBe(DEFAULT);
  });

  test('toggle-speed goes to 1× and back to the default', async ({ context, page, storage }) => {
    await storage.setDefaultSpeed(3);
    await page.goto('/plain.html');
    await expect.poll(() => rateOf(page)).toBe(3);

    await pressShortcut(context, page, 'toggle-speed');
    await expect.poll(() => rateOf(page)).toBe(1);
    await pressShortcut(context, page, 'toggle-speed');
    await expect.poll(() => rateOf(page)).toBe(3);
  });

  test('stop at the ends of the range', async ({ context, page, storage }) => {
    await storage.setDefaultSpeed(4);
    await page.goto('/plain.html');
    await expect.poll(() => rateOf(page)).toBe(4);
    await pressShortcut(context, page, 'speed-up');
    await expect.poll(() => speedLabels(page)).toEqual({ open: true, texts: ['4×'] });
    expect(await rateOf(page)).toBe(4);
  });

  test('do nothing on a disabled site', async ({ context, page, storage }) => {
    await storage.disableSite('localhost');
    await page.goto('/plain.html');
    await page.waitForFunction(() => document.querySelector('video')!.readyState >= HTMLMediaElement.HAVE_METADATA);

    await pressShortcut(context, page, 'speed-up');
    await page.waitForTimeout(300);
    expect(await rateOf(page)).toBe(1);
    expect(await speedLabels(page)).toEqual({ open: false, texts: [] });
  });

  test('leave live videos alone', async ({ context, page }) => {
    await page.goto('/live.html');
    await expect.poll(() => rateOf(page, '#control')).toBe(DEFAULT);
    await page.waitForFunction(() => {
      const live = document.querySelector<HTMLVideoElement>('#live')!;
      return live.readyState >= HTMLMediaElement.HAVE_METADATA && live.duration === Infinity;
    });

    await pressShortcut(context, page, 'speed-up');
    await expect.poll(() => rateOf(page, '#control')).toBe(2.25);
    expect(await rateOf(page, '#live')).toBe(1);
  });
});

test.describe('the speed label', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/plain.html');
    await page.evaluate(() => Object.assign(document.querySelector('video')!.style, { width: '480px', height: '270px' }));
    await expect.poll(() => rateOf(page)).toBe(DEFAULT);
  });

  test('shows the new speed over the video, then goes away', async ({ context, page }) => {
    await pressShortcut(context, page, 'speed-up');
    await expect.poll(() => speedLabels(page)).toEqual({ open: true, texts: ['2.25×'] });

    // Another press within the second updates the same label.
    await pressShortcut(context, page, 'speed-up');
    await expect.poll(() => speedLabels(page)).toEqual({ open: true, texts: ['2.5×'] });
    await expectLabelDrawn(page);
  });

  test('is not shown for a video out of view', async ({ context, page }) => {
    await page.evaluate(() => (document.querySelector('video')!.style.marginTop = '3000px'));
    await pressShortcut(context, page, 'speed-up');
    await expect.poll(() => rateOf(page)).toBe(2.25);
    await page.waitForTimeout(200);
    expect(await speedLabels(page)).toEqual({ open: false, texts: [] });
  });

  for (const what of ['the video itself', 'a player around the video'] as const) {
    test(`shows on top when ${what} is fullscreen`, async ({ context, page }) => {
      // Labelled once before going fullscreen, so the label has to come back on top after.
      await pressShortcut(context, page, 'speed-up');
      await expect.poll(() => speedLabels(page)).toMatchObject({ open: true });

      await page.locator('video').click();
      await page.evaluate(async (wrap) => {
        const video = document.querySelector('video')!;
        let target: HTMLElement = video;
        if (wrap) {
          target = document.createElement('div');
          video.before(target);
          target.append(video);
        }
        await target.requestFullscreen();
      }, what === 'a player around the video');
      await expect.poll(() => page.evaluate(() => document.fullscreenElement?.localName)).toBeTruthy();

      await pressShortcut(context, page, 'speed-up');
      await expect.poll(() => speedLabels(page)).toEqual({ open: true, texts: ['2.5×'] });
      await expectLabelDrawn(page);
    });
  }
});
