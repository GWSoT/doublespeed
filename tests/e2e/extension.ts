/**
 * A Playwright `test` whose browser has the built Chrome extension loaded. Extensions need
 * Playwright's Chromium (not branded Chrome) and a persistent context. Run `npm run build`
 * first; `make e2e` does both.
 */
import { chromium, test as base, type BrowserContext, type Frame, type Page, type Worker } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const EXTENSION = resolve(import.meta.dirname, '../../.output/chrome-mv3');

export const test = base.extend<{ context: BrowserContext; storage: ExtensionStorage }>({
  context: async ({}, use) => {
    if (!existsSync(resolve(EXTENSION, 'manifest.json'))) {
      throw new Error(`No build at ${EXTENSION}. Run \`npm run build\` (or \`make e2e\`).`);
    }
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
    });
    await use(context);
    await context.close();
  },

  storage: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const storage = new ExtensionStorage(worker);
    // Each test is a fresh install. Wait for the install seeding, so a test's own writes
    // can't race it.
    await expect.poll(() => storage.get('settings')).toBeDefined();
    await use(storage);
  },
});

export const expect = test.expect;

/** The extension API as the service worker sees it; WXT's `browser` has the same shape. */
declare const chrome: typeof browser;

/** The extension's `storage.sync`, read and written from its service worker. */
export class ExtensionStorage {
  constructor(private readonly worker: Worker) {}

  get(key: string): Promise<unknown> {
    return this.worker.evaluate(async (k) => (await chrome.storage.sync.get(k))[k], key);
  }

  set(items: Record<string, unknown>): Promise<void> {
    return this.worker.evaluate((i) => chrome.storage.sync.set(i), items);
  }

  remove(key: string): Promise<void> {
    return this.worker.evaluate((k) => chrome.storage.sync.remove(k), key);
  }

  /** Turns a site off, as the popup's switch will. */
  disableSite(pattern: string): Promise<void> {
    return this.set({ [`site:${pattern}`]: { disabled: true, added: new Date().toISOString() } });
  }

  setDefaultSpeed(defaultSpeed: number): Promise<void> {
    return this.set({ settings: { v: 1, defaultSpeed, shortcutHintDismissed: false } });
  }
}

/**
 * The popup for `page`'s tab. It opens in a tab of its own, behind `page`, so `page` stays the
 * active tab the popup acts on, as when the toolbar button is clicked.
 */
export async function openPopup(context: BrowserContext, page: Page): Promise<Page> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const popup = await context.newPage();
  await page.bringToFront();
  await popup.goto(new URL('/popup.html', worker.url()).href);
  return popup;
}

/** The frame whose URL matches, waiting for it to exist. */
export async function frameByUrl(page: Page, matches: (url: string) => boolean): Promise<Frame> {
  await expect.poll(() => page.frames().some((f) => matches(f.url()))).toBe(true);
  return page.frames().find((f) => matches(f.url()))!;
}
