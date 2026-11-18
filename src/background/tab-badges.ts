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
 * document the tab doesn't hold yet for that frame, when a withdrawal removes a report, and when
 * the popup opens.
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
 * How long the popup waits for the frames' answers, once they're asked, before it shows the
 * tab's speed. A frame with nothing to answer fails at once, so only a live frame that's busy
 * takes longer, and its answer still counts when it comes.
 */
export const CHECK_WAIT_MS = 500;

export interface TabBadges {
  report(tabId: number, frameId: number, doc: string, state: FrameState | null): void;
  /**
   * Asks every frame with a report in the tab whether it still holds that report's document,
   * and drops the reports whose frame doesn't. It asks once the reports queued before it are in.
   * Resolves once all have answered, or `CHECK_WAIT_MS` after they're asked; a later answer still
   * drops its report.
   */
  check(tabId: number): Promise<void>;
  forget(tabId: number): void;
}

/** A check of a tab's reports (`checkTab`). */
interface Check {
  /** Resolves once the check has read the tab's reports, as it asks their frames. */
  asking: Promise<void>;
  /** Resolves once every frame asked has answered, or can't. */
  answered: Promise<void>;
}

export function createTabBadges(): TabBadges {
  /** This worker's copy of each tab's frames, so reports in a burst don't each read storage. */
  const cache = new Map<number, TabFrames>();
  /** Work per tab runs in order, so two quick reports can't both build on the same old state. */
  const queues = new Map<number, Promise<void>>();
  /** Each tab's next check, until it reads the tab's reports: what's asked for before then shares it. */
  const nextCheck = new Map<number, Check>();

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

  /**
   * Applies one frame's report, or its withdrawal (`null`), and shows the result. `changed` runs
   * in the same turn of the queue, with the reports as they were, when something changed.
   */
  function apply(
    tabId: number,
    frameId: number,
    doc: string,
    state: FrameState | null,
    changed?: (before: TabFrames) => void,
  ): Promise<void> {
    return enqueue(tabId, async () => {
      const frames = await load(tabId);
      const next = applyReport(frames, frameId, doc, state);
      if (next === frames) return;
      cache.set(tabId, next);
      const key = tabKey(tabId);
      if (Object.keys(next).length) await browser.storage.session.set({ [key]: next });
      else await browser.storage.session.remove(key);
      await show(tabId, next);
      changed?.(frames);
    });
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
  async function verify(tabId: number, frameId: number, doc: string): Promise<void> {
    const query: FrameDocQuery = { type: 'frameDoc' };
    const holds = await Promise.resolve()
      .then(() => browser.tabs.sendMessage(tabId, query, { frameId }))
      .then(
        (held: unknown) => held === doc,
        // Nothing there answers: no frame by that id, a page the content script can't run on,
        // or a new document whose content script hasn't started answering yet.
        () => false,
      );
    if (!holds) await apply(tabId, frameId, doc, null);
  }

  /**
   * `verify` for every report in the tab. It reads the tab's reports on the next task, once the
   * reports already queued are in, and requests made until then share it: so the reports of a
   * burst share a check or two. It asks every frame afresh once it has read them, so no answer
   * given before a request counts for it.
   */
  function checkTab(tabId: number): Check {
    const pending = nextCheck.get(tabId);
    if (pending) return pending;
    let frames: TabFrames = {};
    const asking = new Promise<void>((resolve) => setTimeout(resolve)).then(() =>
      enqueue(tabId, async () => {
        nextCheck.delete(tabId);
        frames = await load(tabId);
      }),
    );
    const answered = asking.then(async () => {
      await Promise.all(Object.entries(frames).map(([frameId, frame]) => verify(tabId, Number(frameId), frame.doc)));
    });
    const check = { asking, answered };
    nextCheck.set(tabId, check);
    return check;
  }

  return {
    report(tabId, frameId, doc, state) {
      void apply(tabId, frameId, doc, state, (before) => {
        // A report the tab didn't hold for this document (a new page, or a frame reporting
        // again), or a withdrawal. Either can come from a page that replaced, or is leaving,
        // documents whose withdrawals never arrive: the frames of a page that left for a browser
        // page withdraw after the move, while its top frame can't. So every frame is asked, the
        // reporter too, since it may be gone already. Asked for from inside the queue, so the
        // reports queued behind this one share the check.
        if (!state || before[frameId]?.doc !== doc) checkTab(tabId);
      });
    },

    check(tabId) {
      const { asking, answered } = checkTab(tabId);
      // The wait starts once the frames are asked, not when the popup asks: the reports queued
      // before the check can take longer than the wait (issue #30).
      return asking
        .then(() => {
          let timer: ReturnType<typeof setTimeout> | undefined;
          const waited = new Promise<void>((resolve) => {
            timer = setTimeout(resolve, CHECK_WAIT_MS);
          });
          return Promise.race([answered, waited]).finally(() => clearTimeout(timer));
        })
        .catch(() => {});
    },

    forget(tabId) {
      void enqueue(tabId, async () => {
        cache.delete(tabId);
        await browser.storage.session.remove(tabKey(tabId));
      });
    },
  };
}
