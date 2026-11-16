/**
 * The toolbar badge (SPEC §1, ADR-0005): each tab's frame reports, kept in `storage.session`,
 * and the badge they add up to. `storage.session` outlives the service worker, so a worker
 * that wakes for one frame's report still knows the others. The popup reads the same items to
 * show the tab's speed.
 */
import {
  applyReport,
  badgeText,
  parseTabFrames,
  tabKey,
  tabSpeed,
  type FrameState,
  type TabFrames,
} from '../lib/tab-speed';

/** The extension's purple for a speed; grey for `off`. */
const SPEED_COLOR = '#7c3aed';
const OFF_COLOR = '#6b6775';

export interface TabBadges {
  report(tabId: number, frameId: number, doc: string, state: FrameState | null): void;
  forget(tabId: number): void;
}

export function createTabBadges(): TabBadges {
  /** This worker's copy of each tab's frames, so reports in a burst don't each read storage. */
  const cache = new Map<number, TabFrames>();
  /** Work per tab runs in order, so two quick reports can't both build on the same old state. */
  const queues = new Map<number, Promise<void>>();

  function enqueue(tabId: number, work: () => Promise<void>): void {
    const run = (queues.get(tabId) ?? Promise.resolve()).then(work).catch(() => {
      // The tab closed mid-way, or storage refused: the next report starts over.
      cache.delete(tabId);
    });
    queues.set(tabId, run);
    void run.then(() => {
      if (queues.get(tabId) === run) queues.delete(tabId);
    });
  }

  async function load(tabId: number): Promise<TabFrames> {
    const cached = cache.get(tabId);
    if (cached) return cached;
    const key = tabKey(tabId);
    return parseTabFrames((await browser.storage.session.get(key))[key]);
  }

  async function show(tabId: number, frames: TabFrames): Promise<void> {
    const tab = tabSpeed(frames);
    const text = badgeText(tab, browser.i18n.getMessage('badgeOff'), (speed) =>
      browser.i18n.getMessage('speedValue', [speed]),
    );
    if (text) await browser.action.setBadgeBackgroundColor({ tabId, color: tab.kind === 'off' ? OFF_COLOR : SPEED_COLOR });
    await browser.action.setBadgeText({ tabId, text });
  }

  return {
    report(tabId, frameId, doc, state) {
      enqueue(tabId, async () => {
        const frames = await load(tabId);
        const next = applyReport(frames, frameId, doc, state);
        if (next === frames) return;
        cache.set(tabId, next);
        const key = tabKey(tabId);
        if (Object.keys(next).length) await browser.storage.session.set({ [key]: next });
        else await browser.storage.session.remove(key);
        await show(tabId, next);
      });
    },

    forget(tabId) {
      enqueue(tabId, async () => {
        cache.delete(tabId);
        await browser.storage.session.remove(tabKey(tabId));
      });
    },
  };
}
