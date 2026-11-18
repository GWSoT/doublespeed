/**
 * The toolbar badge (SPEC §1, ADR-0005): each tab's frame reports, kept in `storage.session`,
 * and the badge they add up to. `storage.session` outlives the service worker, so a worker
 * that wakes for one frame's report still knows the others. The popup reads the same items to
 * show the tab's speed.
 *
 * A report stays only while its frame holds the document that sent it (`dropGone`). The
 * frames are asked when a new document reports in the tab, and when the popup opens.
 */
import {
  applyReport,
  badgeText,
  dropGone,
  parseTabFrames,
  tabKey,
  tabSpeed,
  type FrameDocQuery,
  type FrameState,
  type TabFrames,
} from '../lib/tab-speed';

/** The extension's purple for a speed; grey for `off`. */
const SPEED_COLOR = '#7c3aed';
const OFF_COLOR = '#6b6775';

/**
 * How long a frame gets to say which document it holds. A frame with nothing to answer fails at
 * once, so only a live frame that's busy takes longer, and it's kept.
 */
const ANSWER_MS = 500;

export interface TabBadges {
  report(tabId: number, frameId: number, doc: string, state: FrameState | null): void;
  /** Drops the tab's stale reports; resolves once that's done, or failed. */
  check(tabId: number): Promise<void>;
  forget(tabId: number): void;
}

export function createTabBadges(): TabBadges {
  /** This worker's copy of each tab's frames, so reports in a burst don't each read storage. */
  const cache = new Map<number, TabFrames>();
  /** Work per tab runs in order, so two quick reports can't both build on the same old state. */
  const queues = new Map<number, Promise<void>>();

  function enqueue(tabId: number, work: () => Promise<void>): Promise<void> {
    const run = (queues.get(tabId) ?? Promise.resolve()).then(work).catch(() => {
      // The tab closed mid-way, or storage refused: the next report starts over.
      cache.delete(tabId);
    });
    queues.set(tabId, run);
    void run.then(() => {
      if (queues.get(tabId) === run) queues.delete(tabId);
    });
    return run;
  }

  async function load(tabId: number): Promise<TabFrames> {
    const cached = cache.get(tabId);
    if (cached) return cached;
    const key = tabKey(tabId);
    return parseTabFrames((await browser.storage.session.get(key))[key]);
  }

  async function store(tabId: number, frames: TabFrames): Promise<void> {
    cache.set(tabId, frames);
    const key = tabKey(tabId);
    if (Object.keys(frames).length) await browser.storage.session.set({ [key]: frames });
    else await browser.storage.session.remove(key);
    await show(tabId, frames);
  }

  async function show(tabId: number, frames: TabFrames): Promise<void> {
    const tab = tabSpeed(frames);
    const text = badgeText(tab, browser.i18n.getMessage('badgeOff'), (speed) =>
      browser.i18n.getMessage('speedValue', [speed]),
    );
    if (text) await browser.action.setBadgeBackgroundColor({ tabId, color: tab.kind === 'off' ? OFF_COLOR : SPEED_COLOR });
    await browser.action.setBadgeText({ tabId, text });
  }

  /** Whether frame `frameId` of the tab still holds document `doc`; true if it's too busy to say. */
  async function holds(tabId: number, frameId: number, doc: string): Promise<boolean> {
    const query: FrameDocQuery = { type: 'frameDoc' };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const busy = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(true), ANSWER_MS);
    });
    const answer = browser.tabs.sendMessage(tabId, query, { frameId }).then(
      (held: unknown) => held === doc,
      // Nothing there answers: no frame by that id, a page the content script can't run on, or
      // a new document whose content script hasn't started answering yet.
      () => false,
    );
    try {
      return await Promise.race([answer, busy]);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    report(tabId, frameId, doc, state) {
      void enqueue(tabId, async () => {
        const loaded = await load(tabId);
        let frames = loaded;
        // A report the tab doesn't hold yet for this document: a new page, or a frame reporting
        // again. The page it belongs to may have replaced documents whose withdrawals never
        // arrived, so the other frames are asked first.
        if (state && frames[frameId]?.doc !== doc) {
          frames = await dropGone(frames, (id, held) => holds(tabId, id, held), frameId);
        }
        const next = applyReport(frames, frameId, doc, state);
        if (next !== loaded) await store(tabId, next);
      });
    },

    check(tabId) {
      return enqueue(tabId, async () => {
        const frames = await load(tabId);
        const next = await dropGone(frames, (id, doc) => holds(tabId, id, doc));
        if (next !== frames) await store(tabId, next);
      });
    },

    forget(tabId) {
      void enqueue(tabId, async () => {
        cache.delete(tabId);
        await browser.storage.session.remove(tabKey(tabId));
      });
    },
  };
}
