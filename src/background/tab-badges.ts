/**
 * The toolbar badge (SPEC §1, ADR-0005): each tab's frame reports, kept in `storage.session`,
 * and the badge they add up to. `storage.session` outlives the service worker, so a worker
 * that wakes for one frame's report still knows the others. The popup reads the same items to
 * show the tab's speed.
 *
 * A frame withdraws its report on `pagehide`, but that message can go missing: it does when the
 * tab moves to a browser page, where nothing runs to replace the report (issue #26). So the
 * background asks each frame with a report whether it still holds the document that sent it,
 * and applies the missing withdrawal when it doesn't. It asks when a report comes from a
 * document the tab doesn't hold yet, and when the popup opens.
 */
import {
  applyReport,
  badgeText,
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
 * How long the popup waits for the frames' answers before it shows the tab's speed. A frame
 * with nothing to answer fails at once, so only a live frame that's busy takes longer, and its
 * answer still counts when it comes.
 */
export const CHECK_WAIT_MS = 500;

export interface TabBadges {
  report(tabId: number, frameId: number, doc: string, state: FrameState | null): void;
  /**
   * Asks every frame with a report in the tab whether it still holds that report's document,
   * and drops the reports whose frame doesn't. Resolves once all have answered, or after
   * `CHECK_WAIT_MS`; a later answer still drops its report.
   */
  check(tabId: number): Promise<void>;
  forget(tabId: number): void;
}

export function createTabBadges(): TabBadges {
  /** This worker's copy of each tab's frames, so reports in a burst don't each read storage. */
  const cache = new Map<number, TabFrames>();
  /** Work per tab runs in order, so two quick reports can't both build on the same old state. */
  const queues = new Map<number, Promise<void>>();
  /** Questions out to frames, by tab, frame and document, so none is asked twice at once. */
  const asking = new Map<string, Promise<void>>();

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

  /** Applies one frame's report, or its withdrawal (`null`), and shows the result. */
  function apply(tabId: number, frameId: number, doc: string, state: FrameState | null): Promise<TabFrames | null> {
    let before: TabFrames | null = null;
    return enqueue(tabId, async () => {
      const frames = await load(tabId);
      const next = applyReport(frames, frameId, doc, state);
      if (next === frames) return;
      before = frames;
      cache.set(tabId, next);
      const key = tabKey(tabId);
      if (Object.keys(next).length) await browser.storage.session.set({ [key]: next });
      else await browser.storage.session.remove(key);
      await show(tabId, next);
    }).then(() => before);
  }

  async function show(tabId: number, frames: TabFrames): Promise<void> {
    const tab = tabSpeed(frames);
    const text = badgeText(tab, browser.i18n.getMessage('badgeOff'), (speed) =>
      browser.i18n.getMessage('speedValue', [speed]),
    );
    if (text) await browser.action.setBadgeBackgroundColor({ tabId, color: tab.kind === 'off' ? OFF_COLOR : SPEED_COLOR });
    await browser.action.setBadgeText({ tabId, text });
  }

  /** Asks one frame whether it still holds `doc`; if not, applies the withdrawal it never sent. */
  function verify(tabId: number, frameId: number, doc: string): Promise<void> {
    const key = `${tabId}:${frameId}:${doc}`;
    const pending = asking.get(key);
    if (pending) return pending;
    const query: FrameDocQuery = { type: 'frameDoc' };
    const asked = Promise.resolve()
      .then(() => browser.tabs.sendMessage(tabId, query, { frameId }))
      .then(
        (held: unknown) => held === doc,
        // Nothing there answers: no frame by that id, a page the content script can't run on,
        // or a new document whose content script hasn't started answering yet.
        () => false,
      )
      .then(async (holds) => {
        if (!holds) await apply(tabId, frameId, doc, null);
      })
      .finally(() => asking.delete(key));
    asking.set(key, asked);
    return asked;
  }

  /** `verify` for every report in the tab, once the reports already queued are in. */
  async function verifyAll(tabId: number): Promise<void> {
    let frames: TabFrames = {};
    await enqueue(tabId, async () => {
      frames = await load(tabId);
    });
    await Promise.all(Object.entries(frames).map(([frameId, frame]) => verify(tabId, Number(frameId), frame.doc)));
  }

  return {
    report(tabId, frameId, doc, state) {
      void apply(tabId, frameId, doc, state).then((before) => {
        // A report the tab didn't hold for this document: a new page, or a frame reporting
        // again. Its page may have replaced documents whose withdrawals never arrived, and it
        // may itself be gone already, so every frame is asked, this one too.
        if (state && before && before[frameId]?.doc !== doc) void verifyAll(tabId);
      });
    },

    check(tabId) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const waited = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, CHECK_WAIT_MS);
      });
      return Promise.race([verifyAll(tabId), waited])
        .catch(() => {})
        .finally(() => clearTimeout(timer));
    },

    forget(tabId) {
      void enqueue(tabId, async () => {
        cache.delete(tabId);
        await browser.storage.session.remove(tabKey(tabId));
      });
    },
  };
}
