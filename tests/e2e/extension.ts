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

export type SpeedCommand = 'speed-up' | 'slow-down' | 'toggle-speed';

/**
 * Presses one of the shortcuts in `page`'s tab. Playwright's key presses go to the page, not the
 * browser, so they never reach `commands`; instead the service worker fires its own
 * `commands.onCommand` listeners with the tab, as Chrome does when the user presses the keys.
 */
export async function pressShortcut(context: BrowserContext, page: Page, command: SpeedCommand): Promise<void> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate(
    async ({ url, command }) => {
      const tab = (await chrome.tabs.query({})).find((t) => t.url === url);
      if (!tab) throw new Error(`no tab at ${url}`);
      const onCommand = chrome.commands.onCommand as unknown as { dispatch(command: string, tab: unknown): void };
      onCommand.dispatch(command, tab);
    },
    { url: page.url(), command },
  );
}

/** The toolbar badge's text for `page`'s tab. */
export async function badge(context: BrowserContext, page: Page): Promise<string> {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  return worker.evaluate(async (url) => {
    const tab = (await chrome.tabs.query({})).find((t) => t.url === url);
    if (!tab) throw new Error(`no tab at ${url}`);
    return chrome.action.getBadgeText({ tabId: tab.id });
  }, page.url());
}

export interface SpeedLabelState {
  /** Whether the label layer is showing. */
  open: boolean;
  /** The text of each label, in the order they were created. */
  texts: string[];
}

/**
 * The speed labels in `page`'s top frame. They live in a closed shadow root, which page scripts
 * can't reach, so this finds them through the DevTools protocol, which can.
 */
export async function speedLabels(page: Page): Promise<SpeedLabelState> {
  return (await onLabelLayer(page, LABEL_STATE)) ?? { open: false, texts: [] };
}

/** Where the first label is on the page, in CSS pixels; null when there's none. */
export async function labelBox(page: Page): Promise<{ x: number; y: number; width: number; height: number } | null> {
  return (await onLabelLayer(page, LABEL_BOX)) ?? null;
}

const LABEL_STATE = `function () {
  return { open: this.matches(':popover-open'), texts: [...this.children].map((label) => label.textContent) };
}`;

const LABEL_BOX = `function () {
  const label = this.firstElementChild;
  if (!label) return null;
  const { x, y, width, height } = label.getBoundingClientRect();
  return { x, y, width, height };
}`;

interface DomNode {
  backendNodeId: number;
  nodeName: string;
  attributes?: string[];
  children?: DomNode[];
  shadowRoots?: DomNode[];
}

/** Runs `fn` with `this` as the label layer, or returns null when there's no layer yet. */
async function onLabelLayer<T>(page: Page, fn: string): Promise<T | null> {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { root } = (await cdp.send('DOM.getDocument', { depth: -1, pierce: true })) as { root: DomNode };
    const host = findNode(root, (n) => n.nodeName === 'DOUBLESPEED-UI');
    const layer = host?.shadowRoots?.flatMap((r) => r.children ?? []).find((n) => n.attributes?.includes('popover'));
    if (!layer) return null;
    const { object } = await cdp.send('DOM.resolveNode', { backendNodeId: layer.backendNodeId });
    const { result } = await cdp.send('Runtime.callFunctionOn', {
      objectId: object.objectId!,
      functionDeclaration: fn,
      returnByValue: true,
    });
    return result.value as T;
  } finally {
    await cdp.detach();
  }
}

function findNode(node: DomNode, matches: (node: DomNode) => boolean): DomNode | undefined {
  if (matches(node)) return node;
  for (const child of [...(node.children ?? []), ...(node.shadowRoots ?? [])]) {
    const found = findNode(child, matches);
    if (found) return found;
  }
  return undefined;
}

/** The frame whose URL matches, waiting for it to exist. */
export async function frameByUrl(page: Page, matches: (url: string) => boolean): Promise<Frame> {
  await expect.poll(() => page.frames().some((f) => matches(f.url()))).toBe(true);
  return page.frames().find((f) => matches(f.url()))!;
}
