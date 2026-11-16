/**
 * Issue #1: every `<video>` gets the default speed wherever the page puts it; live videos and
 * `<audio>` are left alone. Each page lives in tests/e2e/pages/.
 */
import type { Frame, Page } from '@playwright/test';
import { expect, frameByUrl, test } from './extension';

const DEFAULT = 2;

/**
 * Polls a speed read inside the page (or frame) until it equals `rate`. `read` runs in the
 * browser, so it can't close over test variables; pass them as `id`.
 */
async function expectRate(
  target: Page | Frame,
  read: (id: string) => number,
  rate: number,
  id = 'v',
): Promise<void> {
  await expect.poll(() => target.evaluate(read, id)).toBe(rate);
}

const plainVideo = (id: string) => document.querySelector<HTMLVideoElement>(`#${id}`)!.playbackRate;

test('a video in the page plays at the default speed', async ({ page }) => {
  await page.goto('/plain.html');
  await expectRate(page, plainVideo, DEFAULT);
});

test('a video added after load plays at the default speed', async ({ page }) => {
  await page.goto('/late.html');
  await page.waitForSelector('#v', { state: 'attached' });
  await expectRate(page, plainVideo, DEFAULT);
});

test.describe('iframes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/iframes.html');
    await expectRate(page, plainVideo, DEFAULT);
  });

  for (const name of ['same', 'cross', 'sandboxed', 'srcdoc', 'blank']) {
    test(`a video in the ${name} iframe plays at the default speed`, async ({ page }) => {
      const frame = page.frame({ name });
      expect(frame, `iframe ${name}`).not.toBeNull();
      await expectRate(frame!, plainVideo, DEFAULT);
    });
  }

  test('the cross-origin iframe really is cross-origin', async ({ page }) => {
    const frame = await frameByUrl(page, (url) => url.startsWith('http://127.0.0.1:3211/'));
    expect(new URL(frame.url()).origin).not.toBe(new URL(page.url()).origin);
  });
});

test.describe('shadow DOM', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/shadow.html');
  });

  const openVideo = (id: string) => document.getElementById(id)!.shadowRoot!.querySelector('video')!.playbackRate;
  const closedVideo = (id: string) =>
    (window as unknown as { closedVideos: Record<string, HTMLVideoElement> }).closedVideos[id]!.playbackRate;

  test('a video in an open shadow root', async ({ page }) => {
    await expectRate(page, openVideo, DEFAULT, 'open');
  });

  test('a video in a closed shadow root', async ({ page }) => {
    await expectRate(page, closedVideo, DEFAULT, 'closed');
  });

  test('a video added later to an existing shadow root', async ({ page }) => {
    await page.waitForFunction(() => !!document.getElementById('appended')!.shadowRoot!.querySelector('video'));
    await expectRate(page, openVideo, DEFAULT, 'appended');
  });

  test('a video in a declarative shadow root', async ({ page }) => {
    await expectRate(page, openVideo, DEFAULT, 'declarative');
  });

  test('a player that gets its closed root after insertion, during page load', async ({ page }) => {
    await expectRate(page, closedVideo, DEFAULT, 'late');
  });

  test('a player defined after load is found when the user clicks it', async ({ page }) => {
    await page.waitForFunction(() => (window as unknown as { lazyDefined?: boolean }).lazyDefined === true);
    await page.locator('#lazy').click();
    await expectRate(page, closedVideo, DEFAULT, 'lazy');
  });
});

test.describe('players defined late, like Reddit’s', () => {
  const playerVideo = (id: string) => document.getElementById(id)!.shadowRoot!.querySelector('video')!.playbackRate;
  const flag = (name: string) => (window as unknown as Record<string, unknown>)[name] === true;

  test('a player defined after DOMContentLoaded gets the default speed before load', async ({ page }) => {
    // Hold the page's image back, so `load` can't fire while the player is checked.
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/held.png', async (route) => {
      await held;
      await route.abort();
    });
    try {
      await page.goto('/defined-late.html', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(flag, 'earlyDefined');
      await expectRate(page, playerVideo, DEFAULT, 'early');
      expect(await page.evaluate(() => document.readyState)).not.toBe('complete');
    } finally {
      release();
    }
  });

  test('a player defined after load is found on the page’s next DOM change, without a click', async ({ page }) => {
    await page.goto('/defined-late.html');
    await page.waitForFunction(flag, 'afterDefined');
    await expectRate(page, playerVideo, DEFAULT, 'after');
  });
});

test('live streams are left alone, even one that turns live after being sped up', async ({ page }) => {
  await page.goto('/live.html');
  await expectRate(page, plainVideo, DEFAULT, 'control');
  await page.waitForFunction(() => {
    const live = document.querySelector<HTMLVideoElement>('#live')!;
    return live.readyState >= HTMLMediaElement.HAVE_METADATA && live.duration === Infinity;
  });
  await page.waitForFunction(() => (window as unknown as { turnsLiveWasSpedUp?: boolean }).turnsLiveWasSpedUp === true);

  await expectRate(page, plainVideo, 1, 'live');
  await expectRate(page, plainVideo, 1, 'turns-live');
});

test('<audio> is never touched', async ({ page }) => {
  await page.goto('/audio.html');
  await expectRate(page, plainVideo, DEFAULT);
  await page.waitForFunction(() => document.querySelector('audio')!.readyState >= HTMLMediaElement.HAVE_METADATA);
  expect(await page.evaluate(() => document.querySelector('audio')!.playbackRate)).toBe(1);
});
