/**
 * Issue #20: the options page's site list and Add site field, and the popup's link to it
 * (SPEC §1, ADR-0004). `localhost` is the page site; cross-origin frames come from `127.0.0.1`.
 */
import type { BrowserContext, Frame, Page } from '@playwright/test';
import { expect, frameByUrl, openOptions, openPopup, test } from './extension';
import { shortcutText } from '../../src/lib/speed-commands';

const DEFAULT = 2;

const rateOf = (target: Page | Frame) =>
  target.evaluate(() => document.querySelector<HTMLVideoElement>('#v')!.playbackRate);

const field = (options: Page) => options.getByRole('textbox', { name: 'Add site' });
const subdomains = (options: Page) => options.getByRole('checkbox', { name: 'Include subdomains' });
const addButton = (options: Page) => options.getByRole('button', { name: 'Add', exact: true });
const status = (options: Page) => options.locator('#add-status');
const list = (options: Page) => options.getByRole('list', { name: 'Sites where Doublespeed is off' });

/** Every key in the extension's `storage.sync`. */
async function storedKeys(context: BrowserContext): Promise<string[]> {
  const worker = context.serviceWorkers()[0]!;
  return worker.evaluate(async () => Object.keys(await chrome.storage.sync.get(null)).sort());
}

test('lists the seeded site, and the page’s title and headings are its own', async ({ context, storage }) => {
  void storage;
  const options = await openOptions(context);
  await expect(options).toHaveTitle('Doublespeed settings');
  await expect(list(options).getByRole('listitem')).toHaveText([/music\.youtube\.com/]);
});

test('turns a pasted link into a rule for the site and all its subdomains', async ({ context, storage }) => {
  const options = await openOptions(context);
  await field(options).fill('https://www.youtube.com/watch?v=abc');
  await expect(status(options)).toHaveText('Turns off youtube.com.');

  await subdomains(options).check();
  await expect(status(options)).toHaveText('Turns off youtube.com and all its subdomains.');
  await addButton(options).click();

  await expect.poll(() => storage.get('site:*.youtube.com')).toEqual({ disabled: true, added: expect.any(String) });
  await expect(field(options)).toHaveValue('');
  await expect(subdomains(options)).not.toBeChecked();
  await expect(list(options).getByRole('listitem')).toHaveText([/music\.youtube\.com/, /youtube\.com\s*and all its subdomains/]);
});

test('takes a typed *. as the subdomain form, with the checkbox ticked and locked', async ({ context, storage }) => {
  const options = await openOptions(context);
  await field(options).fill('*.vimeo.com');
  await expect(subdomains(options)).toBeChecked();
  await expect(subdomains(options)).toBeDisabled();
  await expect(status(options)).toHaveText('Turns off vimeo.com and all its subdomains.');
  await field(options).press('Enter');
  await expect.poll(() => storage.get('site:*.vimeo.com')).toBeDefined();
});

test('adding the page’s own link turns its videos off without a reload, and Remove brings them back', async ({
  context,
  page,
  storage,
}) => {
  await page.goto('/iframes.html');
  const cross = await frameByUrl(page, (url) => url.startsWith('http://127.0.0.1:3211/'));
  await expect.poll(() => rateOf(page)).toBe(DEFAULT);
  await expect.poll(() => rateOf(cross)).toBe(DEFAULT);

  const options = await openOptions(context);
  await field(options).fill(page.url());
  await expect(status(options)).toHaveText('Turns off localhost.');
  await addButton(options).click();
  await expect.poll(() => storage.get('site:localhost')).toBeDefined();
  await expect.poll(() => rateOf(page)).toBe(1);
  await expect.poll(() => rateOf(cross)).toBe(1);

  await options.getByRole('button', { name: 'Remove localhost' }).click();
  await expect(list(options).getByRole('listitem')).toHaveText([/music\.youtube\.com/]);
  await expect.poll(() => storage.get('site:localhost')).toBeUndefined();
  await expect.poll(() => rateOf(page)).toBe(DEFAULT);
  await expect.poll(() => rateOf(cross)).toBe(DEFAULT);
});

test('keeps keyboard focus in the list after a removal', async ({ context, storage }) => {
  await storage.disableSite('a.example');
  await storage.disableSite('b.example');
  const options = await openOptions(context);
  await options.getByRole('button', { name: 'Remove a.example' }).focus();
  await options.keyboard.press('Enter');
  await expect(options.getByRole('button', { name: 'Remove b.example' })).toBeFocused();
  await options.keyboard.press('Enter');
  await expect(options.getByRole('button', { name: 'Remove music.youtube.com' })).toBeFocused();
  await options.keyboard.press('Enter');
  await expect(options.getByText('No sites yet. Videos play at your default speed everywhere.')).toBeVisible();
  await expect(field(options)).toBeFocused();
});

test('refuses a duplicate, a site a *. rule covers, and input that isn’t a site, writing nothing', async ({
  context,
  storage,
}) => {
  await storage.disableSite('*.example.com');
  const options = await openOptions(context);
  await expect(list(options).getByRole('listitem')).toHaveCount(2);
  const before = await storedKeys(context);

  const refusals: [input: string, message: string][] = [
    ['https://music.youtube.com/watch?v=abc', 'music.youtube.com is already in the list.'],
    ['video.example.com', 'Already off: *.example.com covers it.'],
    ['not a site', "That isn't a website address."],
  ];
  for (const [input, message] of refusals) {
    await field(options).fill(input);
    await expect(status(options)).toHaveText(message);
    await expect(addButton(options)).toBeDisabled();
    await field(options).press('Enter');
  }

  await field(options).fill('http://192.168.0.1/');
  await subdomains(options).check();
  await expect(status(options)).toHaveText('192.168.0.1 is an IP address, so it has no subdomains.');
  await expect(addButton(options)).toBeDisabled();

  expect(await storedKeys(context)).toEqual(before);
});

test('says the list is full when sync storage has no room for another site', async ({ context, storage }) => {
  // Chrome's `storage.sync` holds 512 items: `settings`, the seeded site, and 510 more.
  const added = new Date().toISOString();
  await storage.set(
    Object.fromEntries(Array.from({ length: 510 }, (_, i) => [`site:site${i}.example`, { disabled: true, added }])),
  );
  const options = await openOptions(context);
  await expect(list(options).getByRole('listitem')).toHaveCount(511);

  await field(options).fill('vimeo.com');
  await addButton(options).click();
  await expect(options.getByRole('alert')).toHaveText('The list is full. Remove a site to add another.');
  expect(await storage.get('site:vimeo.com')).toBeUndefined();
  await expect(field(options)).toHaveValue('vimeo.com');

  // Typing again clears the message.
  await field(options).fill('vimeo.co');
  await expect(options.getByRole('alert')).toBeHidden();
});

test('follows a site turned off from the popup while it’s open', async ({ context, page, storage }) => {
  void storage;
  const options = await openOptions(context);
  await page.goto('/plain.html');
  const popup = await openPopup(context, page);
  await popup.getByRole('switch').click();
  await expect(list(options).getByRole('listitem')).toHaveText([/localhost/, /music\.youtube\.com/]);
});

test('the popup’s Site list link opens the options page', async ({ context, page, storage }) => {
  void storage;
  await page.goto('/plain.html');
  const popup = await openPopup(context, page);
  const opened = context.waitForEvent('page', (p) => p.url().endsWith('/options.html'));
  await popup.getByRole('button', { name: 'Site list' }).click();
  const options = await opened;
  await expect(list(options)).toBeVisible();
});

test('lists the shortcuts as bound, and opens the browser’s shortcut settings', async ({ context, storage }) => {
  void storage;
  const worker = context.serviceWorkers()[0]!;
  const bound = await worker.evaluate(async () =>
    (await chrome.commands.getAll()).filter((c) => c.name !== '_execute_action').map((c) => [c.name, c.shortcut]),
  );
  const keys = Object.fromEntries(bound.map(([name, shortcut]) => [name, shortcutText(shortcut!)]));

  const options = await openOptions(context);
  const shortcuts = options.getByRole('region', { name: 'Keyboard shortcuts' });
  await expect(shortcuts.locator('dt')).toHaveText([
    'Speed up the videos in this tab',
    'Slow down the videos in this tab',
    'Switch between 1× and your default speed',
  ]);
  await expect(shortcuts.locator('kbd')).toHaveText([keys['speed-up']!, keys['slow-down']!, keys['toggle-speed']!]);

  const opened = context.waitForEvent('page');
  await shortcuts.getByRole('button', { name: 'Change shortcuts' }).click();
  await expect.poll(async () => (await opened).url()).toBe('chrome://extensions/shortcuts');
});

declare const chrome: typeof browser;
