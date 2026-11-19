import { describe, expect, it } from 'vitest';
import type { TargetBrowser, UserManifest } from 'wxt';
import config from './wxt.config';

/** The manifest `wxt.config.ts` gives WXT for `wxt build -b <browser>`. */
async function manifestFor(browser: TargetBrowser): Promise<UserManifest> {
  const { manifest } = config;
  if (typeof manifest !== 'function') throw new Error('wxt.config.ts no longer builds the manifest per browser');
  return manifest({ browser, manifestVersion: 3, mode: 'production', command: 'build' });
}

describe('the manifest', () => {
  // ADR-0007: Mozilla's policies forbid storing anything from a private window.
  it('keeps Firefox from running Doublespeed in private windows', async () => {
    expect((await manifestFor('firefox')).incognito).toBe('not_allowed');
  });

  it("leaves Chrome's incognito setting as it is", async () => {
    expect((await manifestFor('chrome')).incognito).toBeUndefined();
  });
});
