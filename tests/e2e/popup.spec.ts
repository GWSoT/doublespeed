/**
 * Issue #4: the popup's switch for the page site and its default speed (SPEC §1, ADR-0004,
 * ADR-0005). The popup writes `storage.sync`, and the fixture videos react without a reload.
 * `localhost` is the page site; cross-origin frames come from `127.0.0.1`.
 */
import type { Frame, Page } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, frameByUrl, openPopup, setSiteAccess, test } from './extension';
import { shortcutText } from '../../src/lib/speed-commands';

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
    await expect(popup.getByText("Browsers don't let extensions run on their own pages.")).toBeVisible();
  });
});

/** Issue #21: what the popup says where the extension can't run (SPEC §2.2). */
test.describe('where it can’t run', () => {
  const tabSpeedButtons = (popup: Page) => popup.getByRole('group', { name: 'This tab' }).getByRole('button');
  const grant = (popup: Page) => popup.getByRole('button', { name: 'Allow on all sites' });

  test('offers to allow withheld site access, and reloads the page once allowed', async ({ context, page }) => {
    await page.goto('/plain.html');
    await expect.poll(() => rateOf(page)).toBe(DEFAULT);

    // Chrome's "on click": a page loaded now gets no content script.
    await setSiteAccess(context, 'ON_CLICK');
    await page.bringToFront();
    await page.reload();
    await page.waitForFunction(() => document.querySelector('video')!.readyState >= 1);
    expect(await rateOf(page)).toBe(1);

    const popup = await openPopup(context, page);
    await expect(popup.getByText("Doublespeed doesn't have access to this page.")).toBeVisible();
    await expect(siteSwitch(popup)).toBeDisabled();
    await expect(tabSpeedButtons(popup)).toHaveCount(2);
    for (const button of await tabSpeedButtons(popup).all()) await expect(button).toBeDisabled();

    // The click asks the browser, whose prompt Playwright can't answer; the user's "Allow" is
    // the same grant made from chrome://extensions.
    const reloaded = page.waitForEvent('load');
    await grant(popup).click();
    await setSiteAccess(context, 'ON_ALL_SITES');
    await reloaded;

    await expect.poll(() => rateOf(page)).toBe(DEFAULT);
    await expect(siteSwitch(popup)).toBeChecked();
    await expect(popup.getByRole('heading', { name: 'localhost' })).toBeVisible();
    await expect(grant(popup)).toBeHidden();
  });

  test('leaves a page alone when access comes back without the button', async ({ context, page }) => {
    await page.goto('/plain.html');
    await setSiteAccess(context, 'ON_CLICK');
    await page.bringToFront();
    await page.reload();
    await page.waitForFunction(() => document.querySelector('video')!.readyState >= 1);
    const popup = await openPopup(context, page);
    await expect(grant(popup)).toBeVisible();

    // Granted from the browser's settings instead: no reload, and the popup follows.
    await page.evaluate(() => ((window as unknown as { marker: boolean }).marker = true));
    await setSiteAccess(context, 'ON_ALL_SITES');
    await expect(siteSwitch(popup)).toBeChecked();
    expect(await page.evaluate(() => (window as unknown as { marker?: boolean }).marker)).toBe(true);
  });

  test('names a browser page', async ({ context, page }) => {
    await page.goto('chrome://version');
    const popup = await openPopup(context, page);
    await expect(popup.getByText("Browsers don't let extensions run on their own pages.")).toBeVisible();
    await expect(siteSwitch(popup)).toBeDisabled();
    for (const button of await tabSpeedButtons(popup).all()) await expect(button).toBeDisabled();
  });

  test('names an extension store', async ({ context, page }) => {
    // Chromium closes a page Playwright points at the Chrome Web Store, so this is the other
    // store's address, which the popup treats the same way, served without the network.
    await context.route('https://addons.mozilla.org/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Add-ons</title>' }),
    );
    await page.goto('https://addons.mozilla.org/en-US/firefox/');
    const popup = await openPopup(context, page);
    await expect(popup.getByText("Browsers don't let extensions run on extension stores.")).toBeVisible();
    await expect(siteSwitch(popup)).toBeDisabled();
    for (const button of await tabSpeedButtons(popup).all()) await expect(button).toBeDisabled();
  });

  test('says a local file has no site to turn off', async ({ context, page }) => {
    // Playwright's Chromium loads the extension with file access on.
    await page.goto(pathToFileURL(resolve(import.meta.dirname, 'pages/empty.html')).href);
    const popup = await openPopup(context, page);
    await expect(popup.getByText("This page isn't on a website, so there's no site to turn off.")).toBeVisible();
    await expect(siteSwitch(popup)).toBeDisabled();
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

test.describe('the shortcut hint', () => {
  const hint = (popup: Page) => popup.getByRole('region', { name: 'Change the speed from the keyboard' });

  test('shows the shortcuts as the browser has them bound, until dismissed', async ({ context, page, storage }) => {
    const worker = context.serviceWorkers()[0]!;
    const bound = await worker.evaluate(async () =>
      (await chrome.commands.getAll()).filter((c) => c.name !== '_execute_action').map((c) => [c.name, c.shortcut]),
    );
    const keys = Object.fromEntries(bound.map(([name, shortcut]) => [name, shortcutText(shortcut!)]));

    await page.goto('/plain.html');
    const popup = await openPopup(context, page);
    await expect(hint(popup)).toBeVisible();
    await expect(hint(popup).locator('kbd')).toHaveText([keys['speed-up']!, keys['slow-down']!, keys['toggle-speed']!]);
    await expect(hint(popup).locator('dd')).toHaveText(['Faster', 'Slower', '1× and back']);

    await hint(popup).getByRole('button', { name: 'Got it' }).click();
    await expect(hint(popup)).toBeHidden();
    await expect
      .poll(() => storage.get('settings'))
      .toEqual({ v: 1, defaultSpeed: 2, shortcutHintDismissed: true });

    await popup.close();
    const again = await openPopup(context, page);
    await expect(defaultShown(again)).toHaveText('2×');
    await expect(hint(again)).toBeHidden();
  });
});

declare const chrome: typeof browser;
