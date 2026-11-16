/**
 * Issue #13: the tab's speed, on the toolbar badge and in the popup's −/+ (SPEC §1, ADR-0005).
 * Every frame reports its video; the badge shows the one playing or played last, `off` on a
 * disabled site, and nothing without a video. `localhost` is the page site; cross-origin
 * frames come from `127.0.0.1`.
 */
import type { Frame, Page } from '@playwright/test';
import { badge, expect, frameByUrl, openPopup, pressShortcut, test } from './extension';

const DEFAULT = 2;

const rateOf = (target: Page | Frame) =>
  target.evaluate(() => document.querySelector<HTMLVideoElement>('#v')!.playbackRate);

test.describe('the badge', () => {
  test('shows the speed on a tab with a video, and nothing once the tab leaves it', async ({ context, page }) => {
    await page.goto('/plain.html');
    await expect.poll(() => badge(context, page)).toBe('2×');

    await page.goto('/empty.html');
    await page.waitForTimeout(300);
    expect(await badge(context, page)).toBe('');
    // The browser clears a tab's badge when it loads a new page; the page's report has to go too,
    // or the popup, and the next report from this tab, would still see the old video.
    const popup = await openPopup(context, page);
    await expect(popup.getByRole('group', { name: 'This tab' }).locator('output')).toHaveText('No video');
  });

  test('clears when the page removes its only video, and comes back when it returns', async ({ context, page }) => {
    await page.goto('/plain.html');
    await expect.poll(() => badge(context, page)).toBe('2×');

    await page.evaluate(() => {
      const video = document.querySelector('video')!;
      (window as unknown as { removed: HTMLVideoElement }).removed = video;
      video.remove();
    });
    await expect.poll(() => badge(context, page)).toBe('');

    await page.evaluate(() => document.body.append((window as unknown as { removed: HTMLVideoElement }).removed));
    await expect.poll(() => badge(context, page)).toBe('2×');
  });

  test('follows a player whose shadow root holds the only video, removed and put back', async ({ context, page }) => {
    await page.goto('/empty.html');
    await page.evaluate(() => {
      const host = document.createElement('x-player');
      host.attachShadow({ mode: 'open' }).innerHTML = '<video src="/media/clip.webm" preload="auto" muted></video>';
      document.body.append(host);
      (window as unknown as { player: Element }).player = host;
    });
    await expect.poll(() => badge(context, page)).toBe('2×');

    await page.evaluate(() => (window as unknown as { player: Element }).player.remove());
    await expect.poll(() => badge(context, page)).toBe('');
    await page.evaluate(() => document.body.append((window as unknown as { player: Element }).player));
    await expect.poll(() => badge(context, page)).toBe('2×');
  });

  test('clears when the player empties its only video', async ({ context, page }) => {
    await page.goto('/plain.html');
    await expect.poll(() => badge(context, page)).toBe('2×');

    await page.evaluate(() => {
      const video = document.querySelector('video')!;
      video.removeAttribute('src');
      video.load();
    });
    await expect.poll(() => badge(context, page)).toBe('');
  });

  test('follows the shortcuts', async ({ context, page }) => {
    await page.goto('/plain.html');
    await expect.poll(() => badge(context, page)).toBe('2×');

    await pressShortcut(context, page, 'speed-up');
    await expect.poll(() => badge(context, page)).toBe('2.25');
    await pressShortcut(context, page, 'toggle-speed');
    await expect.poll(() => badge(context, page)).toBe('1×');
  });

  test('reads off on a disabled site, and comes back when the site is turned on', async ({ context, page, storage }) => {
    await page.goto('/plain.html');
    await expect.poll(() => badge(context, page)).toBe('2×');

    await storage.disableSite('localhost');
    await expect.poll(() => badge(context, page)).toBe('off');
    await storage.remove('site:localhost');
    await expect.poll(() => badge(context, page)).toBe('2×');
  });

  test('reads off on a disabled site even without a video', async ({ context, page, storage }) => {
    await storage.disableSite('localhost');
    await page.goto('/empty.html');
    await expect.poll(() => badge(context, page)).toBe('off');
  });

  test('follows the video playing, in whichever frame it is', async ({ context, page }) => {
    await page.goto('/iframes.html');
    const cross = await frameByUrl(page, (url) => url.startsWith('http://127.0.0.1:3211/'));
    await expect.poll(() => rateOf(cross)).toBe(DEFAULT);
    await expect.poll(() => badge(context, page)).toBe('2×');

    // In the cross-origin frame, the user picks 1.5× (a click, then the change) and plays it.
    await cross.locator('#v').click();
    await cross.evaluate(() => {
      const video = document.querySelector<HTMLVideoElement>('#v')!;
      video.playbackRate = 1.5;
      video.loop = true;
      return video.play();
    });
    await expect.poll(() => badge(context, page)).toBe('1.5');

    // Then the top frame's video plays instead.
    await cross.evaluate(() => document.querySelector<HTMLVideoElement>('#v')!.pause());
    await page.evaluate(() => {
      const video = document.querySelector<HTMLVideoElement>('#v')!;
      video.loop = true;
      return video.play();
    });
    await expect.poll(() => badge(context, page)).toBe('2×');
  });
});

test.describe("the popup's −/+ for this tab", () => {
  const shown = (popup: Page) => popup.getByRole('group', { name: 'This tab' }).locator('output');
  const slower = (popup: Page) => popup.getByRole('button', { name: 'Slow down the videos in this tab' });
  const faster = (popup: Page) => popup.getByRole('button', { name: 'Speed up the videos in this tab' });

  test('shows the tab’s speed and moves every video in the tab', async ({ context, page }) => {
    await page.goto('/iframes.html');
    const cross = await frameByUrl(page, (url) => url.startsWith('http://127.0.0.1:3211/'));
    await expect.poll(() => rateOf(cross)).toBe(DEFAULT);

    const popup = await openPopup(context, page);
    await expect(shown(popup)).toHaveText('2×');

    await faster(popup).click();
    await expect(shown(popup)).toHaveText('2.25×');
    await expect.poll(() => rateOf(page)).toBe(2.25);
    await expect.poll(() => rateOf(cross)).toBe(2.25);

    await slower(popup).click();
    await slower(popup).click();
    await expect(shown(popup)).toHaveText('1.75×');
    await expect.poll(() => rateOf(cross)).toBe(1.75);
  });

  test('follows a shortcut pressed while it is open', async ({ context, page }) => {
    await page.goto('/plain.html');
    await expect.poll(() => badge(context, page)).toBe('2×');
    const popup = await openPopup(context, page);
    await expect(shown(popup)).toHaveText('2×');

    await pressShortcut(context, page, 'toggle-speed');
    await expect(shown(popup)).toHaveText('1×');
  });

  test('is disabled without a video, and on a disabled site', async ({ context, page, storage }) => {
    await page.goto('/empty.html');
    let popup = await openPopup(context, page);
    await expect(shown(popup)).toHaveText('No video');
    await expect(faster(popup)).toBeDisabled();
    await expect(slower(popup)).toBeDisabled();
    await popup.close();

    await storage.disableSite('localhost');
    await page.goto('/plain.html');
    popup = await openPopup(context, page);
    await expect(shown(popup)).toHaveText('Off');
    await expect(faster(popup)).toBeDisabled();
  });
});
