/**
 * The settings this frame applies the rules with (SPEC §3.2 rules 1 and 6): the default speed,
 * and whether the page site is disabled. Read once from `storage.sync`, then kept current from
 * `storage.onChanged`, so changes apply live without a reload.
 */
import { GET_PAGE_SITE } from '../lib/page-site';
import { applyChanges, isSiteDisabled, parseStored, type StorageChanges, type Stored } from '../lib/settings';
import type { EngineSettings } from './speed-engine';

/** Resolves with the current settings; `onChange` gets every later change. */
export async function watchFrameSettings(
  onChange: (settings: EngineSettings) => void,
  signal: AbortSignal,
): Promise<EngineSettings> {
  // Listen before reading, so a change made during the read isn't lost. Replaying a change the
  // read already includes is harmless: each one carries the item's new value.
  let stored: Stored | null = null;
  let pageSite = '';
  const pending: StorageChanges[] = [];
  const onStorageChange = (changes: StorageChanges) => {
    if (!stored) {
      pending.push(changes);
      return;
    }
    const next = applyChanges(stored, changes);
    if (next === stored) return;
    stored = next;
    onChange(engineSettings(stored, pageSite));
  };
  browser.storage.sync.onChanged.addListener(onStorageChange);
  signal.addEventListener('abort', () => browser.storage.sync.onChanged.removeListener(onStorageChange), {
    once: true,
  });

  const [items, site] = await Promise.all([readAll(), pageSiteOfFrame()]);
  pageSite = site;
  stored = pending.reduce(applyChanges, parseStored(items));
  return engineSettings(stored, pageSite);
}

function engineSettings(stored: Stored, pageSite: string): EngineSettings {
  return { defaultSpeed: stored.settings.defaultSpeed, enabled: !isSiteDisabled(stored.rules, pageSite) };
}

async function readAll(): Promise<Record<string, unknown>> {
  try {
    return await browser.storage.sync.get(null);
  } catch {
    return {}; // Storage unavailable: run with the defaults rather than not at all.
  }
}

/**
 * The page site for this frame. The top frame's own hostname is the address bar's; an iframe
 * asks the background, which reads it from the tab (ADR-0004). Empty when it can't be known,
 * which no rule matches.
 */
async function pageSiteOfFrame(): Promise<string> {
  if (window.top === window) return location.hostname;
  try {
    const host: unknown = await browser.runtime.sendMessage(GET_PAGE_SITE);
    return typeof host === 'string' ? host : '';
  } catch {
    return '';
  }
}
