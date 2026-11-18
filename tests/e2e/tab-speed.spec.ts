/**
 * Issue #13: the tab's speed, on the toolbar badge and in the popup's −/+ (SPEC §1, ADR-0005).
 * Every frame reports its video; the badge shows the one playing or played last, `off` on a
 * disabled site, and nothing without a video. `localhost` is the page site; cross-origin
 * frames come from `127.0.0.1`.
 */
import type { BrowserContext, Frame, Page } from '@playwright/test';
import { badge, expect, frameByUrl, openPopup, pressShortcut, tabIdOf, tabReports, test } from './extension';

const DEFAULT = 2;

const reportCount = async (context: BrowserContext, target: Page | number) =>
  Object.keys(await tabReports(context, target)).length;
const thisTab = (popup: Page) => popup.getByRole('group', { name: 'This tab' }).locator('output');

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

  test('isn’t held by the last page’s report after a browser page', async ({ context, page, storage }) => {
    // Issue #26: a page withdraws its report on `pagehide`, and that withdrawal doesn't arrive
    // when the tab moves to a browser page. Here the next web page's video is in an iframe, so a
    // leftover `off` from the old top frame would outweigh it.
    await storage.disableSite('localhost');
    await page.goto('/plain.html');
    await expect.poll(() => badge(context, page)).toBe('off');

    await page.goto('chrome://version');
    await page.goto('http://127.0.0.1:3211/empty.html');
    await page.evaluate(() => {
      const frame = document.createElement('iframe');
      frame.src = '/plain.html';
      document.body.append(frame);
    });
    await expect.poll(() => badge(context, page)).toBe('2×');
  });

  test('clears on a browser page after a page whose iframes report', async ({ context, page }) => {
    // The iframes' withdrawals arrive after the move, but the top frame's doesn't, and each
    // withdrawal used to draw the badge again from the top frame's leftover report.
    await page.goto('/iframes.html');
    await expect.poll(() => reportCount(context, page)).toBe(6);
    const tabId = await tabIdOf(context, page);

    await page.goto('chrome://version');
    await expect.poll(() => tabReports(context, tabId)).toEqual({});
    expect(await badge(context, tabId)).toBe('');
  });

  test('keeps every live frame’s report when a new frame reports', async ({ context, page }) => {
    await page.goto('/iframes.html');
    await expect.poll(() => reportCount(context, page)).toBe(6);
    const before = Object.keys(await tabReports(context, page));

    // The new frame's first report makes the background ask every frame which document it
    // holds, and so does the popup, which waits for the answers: none of the seven goes.
    await page.evaluate(() => {
      const frame = document.createElement('iframe');
      frame.src = '/plain.html';
      document.body.append(frame);
    });
    await expect.poll(() => reportCount(context, page)).toBe(7);
    const popup = await openPopup(context, page);
    await expect(popup.getByRole('group', { name: 'This tab' }).locator('output')).toHaveText('2×');
    expect(Object.keys(await tabReports(context, page))).toEqual(expect.arrayContaining(before));
    expect(await reportCount(context, page)).toBe(7);
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

  test('forgets the last page’s video once the tab moves to a page it can’t run on', async ({ context, page }) => {
    // Issue #26: the withdrawal sent on `pagehide` doesn't arrive when the next page is a
    // browser page, and nothing runs there to replace it.
    await page.goto('/plain.html');
    await expect.poll(() => badge(context, page)).toBe('2×');

    await page.goto('chrome://version');
    const popup = await openPopup(context, page);
    await expect(popup.locator('#site-note')).toHaveText("Browsers don't let extensions run on their own pages.");
    await expect(shown(popup)).toHaveText('No video');
    await expect(faster(popup)).toBeDisabled();
    await expect(slower(popup)).toBeDisabled();
  });

  test('forgets the last page’s video on a page without one after a browser page', async ({ context, page }) => {
    // Issue #26, step 4: the web page sends no report of its own, so nothing replaces the
    // leftover one before the popup opens.
    await page.goto('/plain.html');
    await expect.poll(() => badge(context, page)).toBe('2×');

    await page.goto('chrome://version');
    await page.goto('/empty.html');
    const popup = await openPopup(context, page);
    await expect(popup.getByRole('heading', { name: 'localhost' })).toBeVisible();
    await expect(shown(popup)).toHaveText('No video');
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

test.describe('a frame too busy to answer', () => {
  test('keeps its report, and holds up neither the other frames nor the popup', async ({ context, page }) => {
    await page.goto('/plain.html');
    await expect.poll(() => badge(context, page)).toBe('2×');
    const tabId = await tabIdOf(context, page);

    // The top frame's main thread is blocked for 6 s. Meanwhile ten cross-origin frames, in a
    // process of their own, report, and each report has the background ask the top frame. Had
    // each report waited 500 ms for its answer, the ten would take 5 s.
    const busyUntil = await page.evaluate(() => {
      for (let i = 0; i < 10; i++) {
        const frame = document.createElement('iframe');
        frame.src = `http://127.0.0.1:3211/plain.html?${i}`;
        document.body.append(frame);
      }
      const until = Date.now() + 6000;
      setTimeout(() => {
        while (Date.now() < until);
      });
      return until;
    });
    await expect.poll(() => reportCount(context, tabId), { timeout: 3_500 }).toBe(11);
    let popup = await openPopup(context, page);
    // Nothing while the popup's check waits for the busy frame, rather than a speed it may not have.
    await expect(thisTab(popup)).toHaveText('');
    await expect(thisTab(popup)).toHaveText('2×', { timeout: 2_500 });
    expect(Date.now()).toBeLessThan(busyUntil);
    await popup.close();

    // Once the block is over the top frame answers. A new popup's check waits for that answer,
    // so by the time the popup shows the tab's speed, the answer has been handled.
    await page.evaluate(() => 0);
    popup = await openPopup(context, page);
    await expect(thisTab(popup)).toHaveText('2×');
    expect(await tabReports(context, tabId)).toHaveProperty('0');
    expect(await reportCount(context, tabId)).toBe(11);
  });
});

test.describe('with the back/forward cache', () => {
  test.use({ bfcache: true });
  const restored = (page: Page) => page.evaluate(() => (window as unknown as { kept?: boolean }).kept === true);
  const mark = (page: Page) => page.evaluate(() => ((window as unknown as { kept: boolean }).kept = true));

  test('a page back from the cache shows its speed again', async ({ context, page }) => {
    await page.goto('/plain.html?bfcache');
    await expect.poll(() => badge(context, page)).toBe('2×');
    await mark(page);

    await page.goto('chrome://version');
    // A page from the cache fires no `load`.
    await page.goBack({ waitUntil: 'commit' });
    expect(await restored(page)).toBe(true);
    await expect.poll(() => badge(context, page)).toBe('2×');
    const popup = await openPopup(context, page);
    await expect(popup.getByRole('group', { name: 'This tab' }).locator('output')).toHaveText('2×');
  });

  for (const stop of [['pageshow'], ['pagehide', 'pageshow']]) {
    test(`a page that stops ${stop.join(' and ')} still shows its speed back from the cache`, async ({ context, page }) => {
      await page.goto(`/stops-lifecycle.html?bfcache&${stop.map((type) => `stop=${type}`).join('&')}`);
      await expect.poll(() => badge(context, page)).toBe('2×');
      await mark(page);

      await page.goto('chrome://version');
      await page.goBack({ waitUntil: 'commit' });
      expect(await restored(page)).toBe(true);
      await expect.poll(() => badge(context, page)).toBe('2×');
      const popup = await openPopup(context, page);
      await expect(thisTab(popup)).toHaveText('2×');
    });
  }

  test('a page whose iframes report comes back from the cache with every report', async ({ context, page }) => {
    await page.goto('/iframes.html?bfcache');
    await expect.poll(() => reportCount(context, page)).toBe(6);
    await mark(page);

    await page.goto('/empty.html?bfcache');
    await page.goBack({ waitUntil: 'commit' });
    expect(await restored(page)).toBe(true);
    // Every frame reports again under a new id, and answers the popup's check with it.
    await expect.poll(() => reportCount(context, page)).toBe(6);
    const popup = await openPopup(context, page);
    await expect(thisTab(popup)).toHaveText('2×');
    expect(await reportCount(context, page)).toBe(6);
  });

  test('a page in the cache doesn’t answer for the page that replaced it', async ({ context, page }) => {
    await page.goto('/plain.html?bfcache');
    await expect.poll(() => badge(context, page)).toBe('2×');
    await mark(page);

    // The new page's frames report, and the popup asks frame 0, which the cached page also had.
    await page.goto('/iframes.html?bfcache');
    await expect.poll(() => reportCount(context, page)).toBe(6);
    const popup = await openPopup(context, page);
    await expect(popup.getByRole('group', { name: 'This tab' }).locator('output')).toHaveText('2×');
    expect(await tabReports(context, page)).toHaveProperty('0');
    expect(await reportCount(context, page)).toBe(6);
    await popup.close();

    // Back to the first page, which was in the cache all along, so no `load` fires.
    await page.goBack({ waitUntil: 'commit' });
    expect(await restored(page)).toBe(true);
  });
});
