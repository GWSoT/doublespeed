/**
 * Issue #2: the user's speed change wins for that video, a site's reset is undone, and a site
 * that keeps resetting is eventually left alone (SPEC §3.2 rules 2–4).
 */
import type { Page } from '@playwright/test';
import { expect, test } from './extension';

const DEFAULT = 2;

const rate = (page: Page) => page.evaluate(() => document.querySelector<HTMLVideoElement>('#v')!.playbackRate);
/** A counter the fixture page keeps on `window`; 0 until the page sets it. */
const global = (page: Page, name: string) =>
  page.evaluate((key) => (window as unknown as Record<string, number | undefined>)[key] ?? 0, name);

test.describe('a YouTube-style player that resets every new source to 1×', () => {
  test('the first video, an ad and the next video all play at the default speed', async ({ page }) => {
    await page.goto('/youtube.html');
    await expect.poll(() => global(page, 'resets')).toBe(1);
    await expect.poll(() => rate(page)).toBe(DEFAULT);

    // An ad, loaded by the player itself with no input.
    await page.evaluate(() => (window as unknown as { player: { playAd(): void } }).player.playAd());
    await expect.poll(() => global(page, 'resets')).toBe(2);
    await expect.poll(() => rate(page)).toBe(DEFAULT);
  });

  test('clicking "next" is not mistaken for choosing 1× (ROADMAP risk 1)', async ({ page }) => {
    await page.goto('/youtube.html');
    await expect.poll(() => global(page, 'resets')).toBe(1);
    await expect.poll(() => rate(page)).toBe(DEFAULT);

    // The click lands, the next source loads, and the player resets it to 1× within the
    // input window. The click came before the new source, so it isn't a speed choice.
    await page.locator('#next').click();
    await expect.poll(() => global(page, 'resets')).toBe(2);
    await expect.poll(() => rate(page)).toBe(DEFAULT);
    await page.waitForTimeout(1200);
    expect(await rate(page)).toBe(DEFAULT);
  });
});

test.describe("a player with its own speed menu", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/speed-menu.html');
    await expect.poll(() => rate(page)).toBe(DEFAULT);
  });

  test('a speed picked in the menu sticks for that video, and the next video is back at the default', async ({
    page,
  }) => {
    await page.locator('[data-rate="1.5"]').click();
    await expect.poll(() => rate(page)).toBe(1.5);
    await page.waitForTimeout(1500);
    expect(await rate(page)).toBe(1.5);

    await page.locator('#next').click();
    await expect.poll(() => rate(page)).toBe(DEFAULT);
  });

  test('a speed picked with the keyboard sticks too', async ({ page }) => {
    await page.locator('[data-rate="0.5"]').focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => rate(page)).toBe(0.5);
    await page.waitForTimeout(1500);
    expect(await rate(page)).toBe(0.5);
  });

  test("the player can't silently undo the user's choice", async ({ page }) => {
    await page.locator('[data-rate="1.5"]').click();
    await expect.poll(() => rate(page)).toBe(1.5);
    await page.waitForTimeout(1200); // past the input window

    await page.evaluate(() => (window as unknown as { player: { resetSpeed(): void } }).player.resetSpeed());
    await expect.poll(() => rate(page)).toBe(1.5);
  });
});

test('a player that fights back is left alone after a few rounds, without looping', async ({ page }) => {
  await page.goto('/fighting.html');
  await expect.poll(() => global(page, 'rateChanges')).toBeGreaterThan(0);

  // Wait for the exchange to settle: no new ratechange for a second.
  let previous = -1;
  await expect
    .poll(async () => {
      const now = await global(page, 'rateChanges');
      const settled = now === previous;
      previous = now;
      return settled;
    }, { intervals: [1000] })
    .toBe(true);

  // One change from us, then at most 5 rounds of reset-and-undo before we stop, plus the
  // site's last reset: 12 events.
  expect(previous).toBeLessThanOrEqual(12);
  expect(await rate(page)).toBe(1);
});
