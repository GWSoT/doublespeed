/**
 * A Playwright `test` whose browser has the built Chrome extension loaded. Extensions need
 * Playwright's Chromium (not branded Chrome) and a persistent context. Run `npm run build`
 * first; `make e2e` does both.
 */
import { chromium, test as base, type BrowserContext, type Frame, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const EXTENSION = resolve(import.meta.dirname, '../../.output/chrome-mv3');

export const test = base.extend<{ context: BrowserContext }>({
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
});

export const expect = test.expect;

/** The frame whose URL matches, waiting for it to exist. */
export async function frameByUrl(page: Page, matches: (url: string) => boolean): Promise<Frame> {
  await expect.poll(() => page.frames().some((f) => matches(f.url()))).toBe(true);
  return page.frames().find((f) => matches(f.url()))!;
}
