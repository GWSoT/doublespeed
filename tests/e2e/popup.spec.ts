/**
 * Issue #4: the popup's switch for the page site and its default speed (SPEC §1, ADR-0004,
 * ADR-0005). The popup writes `storage.sync`, and the fixture videos react without a reload.
 * `localhost` is the page site; cross-origin frames come from `127.0.0.1`.
 */
import type { Frame, Page } from '@playwright/test';
import { expect, frameByUrl, openPopup, test } from './extension';

const DEFAULT = 2;

const rateOf = (target: Page | Frame) =>
  target.evaluate(() => document.querySelector<HTMLVideoElement>('#v')!.playbackRate);

const siteSwitch = (popup: Page) => popup.getByRole('switch');
const slower = (popup: Page) => popup.getByRole('button', { name: 'Lower the default speed' });
const faster = (popup: Page) => popup.getByRole('button', { name: 'Raise the default speed' });
const defaultShown = (popup: Page) => popup.getByRole('group', { name: 'Default speed' }).locator('output');
const defaultSpeed = async (storage: { get(key: string): Promise<unknown> }) =>
  ((await storage.get('settings')) as { defaultSpeed: number }).defaultSpeed;

test.describe('the site switch', () => {
  test('turns the page site off and on, in every frame, without a reload', async ({ context, page, storage }) => {
    await page.goto('/iframes.html');
    const cross = await frameByUrl(page, (url) => url.startsWith('http://127.0.0.1:3211/'));
    await expect.poll(() => rateOf(page)).toBe(DEFAULT);
    await expect.poll(() => rateOf(cross)).toBe(DEFAULT);

    const popup = await openPopup(context, page);
    await expect(popup.getByRole('heading', { name: 'localhost' })).toBeVisible();
    await expect(siteSwitch(popup)).toHaveAccessibleName('Speed up videos on localhost');
    await expect(siteSwitch(popup)).toBeChecked();

    await siteSwitch(popup).click();
    await expect(siteSwitch(popup)).not.toBeChecked();
    await expect(popup.getByText("Off. The site sets the speed.")).toBeVisible();
    await expect.poll(() => storage.get('site:localhost')).toEqual({ disabled: true, added: expect.any(String) });
    await expect.poll(() => rateOf(page)).toBe(1);
    await expect.poll(() => rateOf(cross)).toBe(1);

    await siteSwitch(popup).click();
    await expect(siteSwitch(popup)).toBeChecked();
    await expect.poll(() => storage.get('site:localhost')).toBeUndefined();
    await expect.poll(() => rateOf(page)).toBe(DEFAULT);
    await expect.poll(() => rateOf(cross)).toBe(DEFAULT);
  });

  test('shows a site turned off before the popup opened as off', async ({ context, page, storage }) => {
    await storage.disableSite('localhost');
    await page.goto('/plain.html');
    const popup = await openPopup(context, page);
    await expect(siteSwitch(popup)).not.toBeChecked();
    await expect(siteSwitch(popup)).toBeEnabled();
  });

  test('follows a change made elsewhere while it is open', async ({ context, page, storage }) => {
    await page.goto('/plain.html');
    const popup = await openPopup(context, page);
    await expect(siteSwitch(popup)).toBeChecked();
    await storage.disableSite('localhost');
    await expect(siteSwitch(popup)).not.toBeChecked();
  });

  test('can’t turn on a site a *. rule turns off, and says which rule', async ({ context, page, storage }) => {
    await storage.disableSite('*.localhost');
    await page.goto('/plain.html');
    const popup = await openPopup(context, page);
    await expect(siteSwitch(popup)).toBeDisabled();
    await expect(siteSwitch(popup)).not.toBeChecked();
    await expect(popup.getByText('Off for all of *.localhost by a rule in your site list.')).toBeVisible();
  });

  test('is disabled on a page extensions can’t run on, and says why', async ({ context }) => {
    // The popup's own tab is the active one: an extension page, where content scripts never run.
    const popup = await openPopup(context, await context.newPage());
    await popup.bringToFront();
    await popup.reload();
    await expect(siteSwitch(popup)).toBeDisabled();
    await expect(popup.getByText("Browsers don't let extensions run on this page.")).toBeVisible();
  });
});

test.describe('the default speed', () => {
  test('steps by 0.25 and moves the videos without a reload', async ({ context, page, storage }) => {
    await page.goto('/plain.html');
    await expect.poll(() => rateOf(page)).toBe(DEFAULT);
    const popup = await openPopup(context, page);
    await expect(defaultShown(popup)).toHaveText('2×');

    await faster(popup).click();
    await expect(defaultShown(popup)).toHaveText('2.25×');
    await expect.poll(() => defaultSpeed(storage)).toBe(2.25);
    await expect.poll(() => rateOf(page)).toBe(2.25);

    await slower(popup).click();
    await slower(popup).click();
    await expect(defaultShown(popup)).toHaveText('1.75×');
    await expect.poll(() => defaultSpeed(storage)).toBe(1.75);
    await expect.poll(() => rateOf(page)).toBe(1.75);
  });

  test('quick clicks each count', async ({ context, page, storage }) => {
    await page.goto('/plain.html');
    const popup = await openPopup(context, page);
    await expect(defaultShown(popup)).toHaveText('2×');
    // Four clicks in one task, so no write has finished before the next click.
    await faster(popup).evaluate((button: HTMLButtonElement) => {
      for (let i = 0; i < 4; i++) button.click();
    });
    await expect(defaultShown(popup)).toHaveText('3×');
    await expect.poll(() => defaultSpeed(storage)).toBe(3);
    await expect.poll(() => rateOf(page)).toBe(3);
  });

  test('stops at the ends of the range', async ({ context, page, storage }) => {
    await storage.setDefaultSpeed(4);
    await page.goto('/plain.html');
    const popup = await openPopup(context, page);
    await expect(defaultShown(popup)).toHaveText('4×');
    await expect(faster(popup)).toBeDisabled();
    await expect(slower(popup)).toBeEnabled();

    await storage.setDefaultSpeed(0.25);
    await expect(defaultShown(popup)).toHaveText('0.25×');
    await expect(slower(popup)).toBeDisabled();
  });

  test('keeps the other settings', async ({ context, page, storage }) => {
    await storage.set({ settings: { v: 1, defaultSpeed: 2, shortcutHintDismissed: true } });
    await page.goto('/plain.html');
    const popup = await openPopup(context, page);
    await faster(popup).click();
    await expect
      .poll(() => storage.get('settings'))
      .toEqual({ v: 1, defaultSpeed: 2.25, shortcutHintDismissed: true });
  });
});
