import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FrameState } from '../lib/tab-speed';
import { CHECK_WAIT_MS, createTabBadges, type TabBadges } from './tab-badges';

const TAB = 1;
const at = (speed: number): FrameState => ({ off: false, video: { speed, playing: false, playedAt: 0 } });
const OFF: FrameState = { off: true, video: null };

/** A frame that takes its time to answer; `answer` lets it. */
interface Busy {
  answer(doc: string | null): void;
}

/**
 * The extension API as the background uses it: `storage.session`, the badge, and the tab's
 * frames, each holding a document (or busy, or gone). A frame not in `frames` doesn't answer.
 */
function fakeBrowser({ storageMs = 0 } = {}) {
  const session = new Map<string, unknown>();
  /** Storage and the badge answer after a task or `storageMs`, as the browser's do; at once by default. */
  const later = <T>(value: T): Promise<T> =>
    storageMs ? new Promise((resolve) => setTimeout(() => resolve(value), storageMs)) : Promise.resolve(value);
  const badge = new Map<number, string>();
  const frames = new Map<number, string | Busy>();
  const asked: number[] = [];
  const messages: unknown[] = [];

  vi.stubGlobal('browser', {
    storage: {
      session: {
        get: (key: string) => later(session.has(key) ? { [key]: structuredClone(session.get(key)) } : {}),
        set: (items: Record<string, unknown>) => {
          for (const [key, value] of Object.entries(items)) session.set(key, structuredClone(value));
          return later(undefined);
        },
        remove: (key: string) => later(void session.delete(key)),
      },
    },
    action: {
      setBadgeText: ({ tabId, text }: { tabId: number; text: string }) => later(void badge.set(tabId, text)),
      setBadgeBackgroundColor: () => later(undefined),
    },
    i18n: { getMessage: (name: string, subs?: string[]) => (name === 'badgeOff' ? 'off' : `${subs?.[0]}×`) },
    tabs: {
      sendMessage: (_tabId: number, message: unknown, { frameId }: { frameId: number }) => {
        messages.push(message);
        asked.push(frameId);
        const frame = frames.get(frameId);
        if (frame === undefined) return Promise.reject(new Error('Could not establish connection. Receiving end does not exist.'));
        if (typeof frame === 'string') return Promise.resolve(frame);
        return new Promise((resolve) => (frame.answer = resolve));
      },
    },
  });

  return {
    badge: () => badge.get(TAB),
    /** The tab's stored reports, by frame id, as the `doc` of each report in the frame, the latest last. */
    stored: () => {
      const tab = (session.get(`tab:${TAB}`) ?? {}) as Record<string, { doc: string }[]>;
      return Object.fromEntries(Object.entries(tab).map(([frameId, reports]) => [frameId, reports.map((r) => r.doc)]));
    },
    frames,
    asked,
    messages,
    busy(frameId: number): Busy {
      const busy: Busy = { answer: () => {} };
      frames.set(frameId, busy);
      return busy;
    },
  };
}

let fake: ReturnType<typeof fakeBrowser>;
let badges: TabBadges;
/** Lets queued work, and every frame that has its answer, finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  fake = fakeBrowser();
  badges = createTabBadges();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('reports', () => {
  it('shows the tab’s speed and keeps each frame’s report', async () => {
    fake.frames.set(0, 'top').set(4, 'player');
    badges.report(TAB, 0, 'top', at(2));
    badges.report(TAB, 4, 'player', at(1.5));
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 0: ['top'], 4: ['player'] }));
    expect(fake.badge()).toBe('2×');
  });

  it('asks nothing when a document the tab holds reports again', async () => {
    fake.frames.set(0, 'top');
    badges.report(TAB, 0, 'top', at(2));
    await vi.waitFor(() => expect(fake.asked).toEqual([0]));
    badges.report(TAB, 0, 'top', at(2.25));
    await vi.waitFor(() => expect(fake.badge()).toBe('2.25'));
    await settle();
    expect(fake.asked).toEqual([0]);
  });
});

describe('a report whose withdrawal never arrived (issue #26)', () => {
  it('goes once its frame holds another document, when a new document reports', async () => {
    fake.frames.set(0, 'old-top');
    badges.report(TAB, 0, 'old-top', OFF);
    await vi.waitFor(() => expect(fake.badge()).toBe('off'));

    // The tab moved on through a browser page; the new page's video is in an iframe.
    fake.frames.set(0, 'new-top').set(7, 'player');
    badges.report(TAB, 7, 'player', at(2));
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 7: ['player'] }));
    expect(fake.badge()).toBe('2×');
    expect(new Set(fake.messages.map((m) => JSON.stringify(m)))).toEqual(new Set(['{"type":"frameDoc"}']));
  });

  it('goes once nothing in its frame answers', async () => {
    fake.frames.set(0, 'top').set(3, 'ad');
    badges.report(TAB, 0, 'top', at(2));
    badges.report(TAB, 3, 'ad', at(1));
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 0: ['top'], 3: ['ad'] }));

    fake.frames.delete(3);
    fake.frames.set(5, 'player');
    badges.report(TAB, 5, 'player', at(1.5));
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 0: ['top'], 5: ['player'] }));
  });

  it('goes even when its own document left before the report was stored', async () => {
    // The report was on its way when the tab moved to a browser page.
    badges.report(TAB, 0, 'top', at(2));
    await vi.waitFor(() => expect(fake.asked).toEqual([0]));
    await vi.waitFor(() => expect(fake.stored()).toEqual({}));
    expect(fake.badge()).toBe('');
  });
});

describe('a withdrawal', () => {
  it('has the other frames asked, so a top frame that left without one goes too', async () => {
    fake.frames.set(0, 'top').set(4, 'player');
    badges.report(TAB, 0, 'top', at(2));
    badges.report(TAB, 4, 'player', at(1.5));
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 0: ['top'], 4: ['player'] }));

    // The tab moved to a browser page: the iframe's withdrawal arrives, the top frame's doesn't.
    fake.frames.clear();
    badges.report(TAB, 4, 'player', null);
    await vi.waitFor(() => expect(fake.stored()).toEqual({}));
    expect(fake.badge()).toBe('');
  });

  it('asks nothing when it removes nothing', async () => {
    fake.frames.set(0, 'top');
    badges.report(TAB, 0, 'top', at(2));
    await vi.waitFor(() => expect(fake.asked).toEqual([0]));

    badges.report(TAB, 4, 'never-reported', null);
    await settle();
    await settle();
    expect(fake.asked).toEqual([0]);
  });

  it('keeps the reports of frames still there', async () => {
    fake.frames.set(0, 'top').set(4, 'player');
    badges.report(TAB, 0, 'top', at(2));
    badges.report(TAB, 4, 'player', at(1.5));
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 0: ['top'], 4: ['player'] }));

    fake.frames.delete(4);
    badges.report(TAB, 4, 'player', null);
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 0: ['top'] }));
    await settle();
    expect(fake.stored()).toEqual({ 0: ['top'] });
  });
});

describe('a late report from the page a frame left (issue #34)', () => {
  /** Frame 0 held `old`, whose report the background has and has checked; the frame now holds `new`. */
  async function leave(): Promise<void> {
    fake.frames.set(0, 'old');
    badges.report(TAB, 0, 'old', at(1.5));
    await vi.waitFor(() => expect(fake.asked).toEqual([0]));
    await settle();
    fake.frames.set(0, 'new');
  }

  /** Waits for `stored`, then lets the checks that still follow finish, and expects it again. */
  async function ends(stored: Record<string, string[]>, badge: string): Promise<void> {
    await vi.waitFor(() => expect(fake.stored()).toEqual(stored));
    await settle();
    await settle();
    expect(fake.stored()).toEqual(stored);
    expect(fake.badge()).toBe(badge);
  }

  it('can’t replace the new page’s report', async () => {
    await leave();
    badges.report(TAB, 0, 'new', at(2));
    badges.report(TAB, 0, 'old', at(1.5));
    await ends({ 0: ['new'] }, '2×');
  });

  it('nor can the old page’s withdrawal right behind it', async () => {
    await leave();
    badges.report(TAB, 0, 'new', at(2));
    badges.report(TAB, 0, 'old', at(1.5));
    badges.report(TAB, 0, 'old', null);
    await ends({ 0: ['new'] }, '2×');
  });

  it('is dropped, with nothing kept, when the new page withdraws before its answer is handled', async () => {
    await leave();
    const first = fake.busy(0);
    badges.report(TAB, 0, 'new', at(2));
    badges.report(TAB, 0, 'old', at(1.5));
    await vi.waitFor(() => expect(fake.asked).toEqual([0, 0]));

    // The new page answers, then leaves for a browser page. Its withdrawal is handled before the
    // answer, and the check that starts waits on the frame too.
    const second = fake.busy(0);
    badges.report(TAB, 0, 'new', null);
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 0: ['old'] }));
    await settle();
    fake.frames.delete(0);
    first.answer('new');
    await vi.waitFor(() => expect(fake.stored()).toEqual({}));
    second.answer(null);
    await ends({}, '');
  });

  it('is dropped though the old page reports again while the frame is asked', async () => {
    await leave();
    const asked = fake.busy(0);
    badges.report(TAB, 0, 'new', at(2));
    badges.report(TAB, 0, 'old', at(1.5));
    await vi.waitFor(() => expect(fake.asked).toEqual([0, 0]));

    badges.report(TAB, 0, 'old', at(1.25));
    await vi.waitFor(() => expect(fake.badge()).toBe('1.25'));
    fake.frames.set(0, 'new');
    asked.answer('new');
    await ends({ 0: ['new'] }, '2×');
  });

  it('is dropped again when the old page reports after its report was dropped', async () => {
    await leave();
    badges.report(TAB, 0, 'new', at(2));
    badges.report(TAB, 0, 'old', at(1.5));
    await ends({ 0: ['new'] }, '2×');

    const before = fake.asked.length;
    badges.report(TAB, 0, 'old', at(1.25));
    await vi.waitFor(() => expect(fake.asked.length).toBeGreaterThan(before));
    await ends({ 0: ['new'] }, '2×');
  });

  it('is dropped though the new page and then the old one report again while the frame is asked', async () => {
    await leave();
    const asked = fake.busy(0);
    badges.report(TAB, 0, 'new', at(2));
    badges.report(TAB, 0, 'old', at(1.5));
    await vi.waitFor(() => expect(fake.asked).toEqual([0, 0]));

    badges.report(TAB, 0, 'new', at(2.25));
    badges.report(TAB, 0, 'old', at(1.25));
    await vi.waitFor(() => expect(fake.badge()).toBe('1.25'));
    fake.frames.set(0, 'new');
    asked.answer('new');
    await ends({ 0: ['new'] }, '2.25');
  });

  it('is dropped by an answer that leaves alone a newer page’s report', async () => {
    // The check reads only `old`'s report, then asks the frame, which holds `new` by then.
    await leave();
    const first = fake.busy(0);
    void badges.check(TAB);
    await vi.waitFor(() => expect(fake.asked).toEqual([0, 0]));

    // Before the answer, `new`, comes back, the frame moves on to a third page, which reports.
    // Its own check's question is held up too.
    const second = fake.busy(0);
    badges.report(TAB, 0, 'third', at(2));
    await vi.waitFor(() => expect(fake.asked).toEqual([0, 0, 0]));
    fake.frames.set(0, 'third');
    first.answer('new');
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 0: ['third'] }));
    second.answer('third');
    await ends({ 0: ['third'] }, '2×');
  });

  it('has the frame asked again once dropped, since the answer may name a page the tab has left', async () => {
    await leave();
    const asked = fake.busy(0);
    badges.report(TAB, 0, 'new', at(2));
    badges.report(TAB, 0, 'old', at(1.5));
    await vi.waitFor(() => expect(fake.asked).toEqual([0, 0]));

    // The tab moves to a browser page while the answer, `new`, is on its way, and the new page's
    // withdrawal is lost. Dropping `old` leaves `new`'s report, until the next check drops it.
    fake.frames.delete(0);
    asked.answer('new');
    await ends({}, '');
    expect(fake.asked).toEqual([0, 0, 0]);
  });
});

describe('a page back from the back/forward cache', () => {
  it('can’t lose its report to an answer about its old document id', async () => {
    fake.frames.set(0, 'top');
    badges.report(TAB, 0, 'top', at(2));
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 0: ['top'] }));

    // The background asks while the page is going into the cache; the answer, null, is held up.
    const leaving = fake.busy(0);
    void badges.check(TAB);
    await vi.waitFor(() => expect(fake.asked).toEqual([0, 0]));

    // The page comes back under a new id and reports, before that answer lands.
    fake.frames.set(0, 'top-again');
    badges.report(TAB, 0, 'top-again', at(2));
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 0: ['top-again'] }));
    leaving.answer(null);
    await settle();
    expect(fake.stored()).toEqual({ 0: ['top-again'] });
    expect(fake.badge()).toBe('2×');
  });
});

describe('a busy frame', () => {
  it('holds up no report, and its late answer still counts', async () => {
    fake.frames.set(0, 'old-top');
    badges.report(TAB, 0, 'old-top', OFF);
    await vi.waitFor(() => expect(fake.badge()).toBe('off'));

    const top = fake.busy(0);
    fake.frames.set(7, 'player');
    badges.report(TAB, 7, 'player', at(2));
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 0: ['old-top'], 7: ['player'] }));

    top.answer('new-top');
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 7: ['player'] }));
    expect(fake.badge()).toBe('2×');
  });

  it('is asked once for a burst of reports, which share a check', async () => {
    fake.frames.set(0, 'top');
    badges.report(TAB, 0, 'top', at(2));
    await vi.waitFor(() => expect(fake.asked).toEqual([0]));

    const top = fake.busy(0);
    for (const frameId of [4, 5, 6]) {
      fake.frames.set(frameId, `player-${frameId}`);
      badges.report(TAB, frameId, `player-${frameId}`, at(2));
    }
    await vi.waitFor(() => expect(Object.keys(fake.stored())).toHaveLength(4));
    await settle();
    expect(fake.asked.slice(1).sort()).toEqual([0, 4, 5, 6]);

    top.answer('top');
    await settle();
    expect(Object.keys(fake.stored())).toHaveLength(4);
  });
});

describe('a check', () => {
  it('is shared by a burst of reports, even when storage takes a while', async () => {
    fake = fakeBrowser({ storageMs: 15 });
    badges = createTabBadges();
    const frameIds = [0, 4, 5, 6, 7, 8];
    for (const frameId of frameIds) {
      fake.frames.set(frameId, `doc-${frameId}`);
      badges.report(TAB, frameId, `doc-${frameId}`, at(2));
    }
    await vi.waitFor(() => expect(fake.asked).toHaveLength(frameIds.length));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect([...fake.asked].sort((a, b) => a - b)).toEqual(frameIds);
    expect(Object.keys(fake.stored())).toHaveLength(frameIds.length);
  });

  it('asks afresh, so an answer given before the tab moved on doesn’t count for it', async () => {
    fake.frames.set(0, 'top').set(4, 'player');
    badges.report(TAB, 0, 'top', at(2));
    badges.report(TAB, 4, 'player', at(1.5));
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 0: ['top'], 4: ['player'] }));
    await settle();

    // A check is out, and the top frame's answer, "top", is held up on its way.
    const topAsked = () => fake.asked.filter((frameId) => frameId === 0).length;
    const before = topAsked();
    const top = fake.busy(0);
    void badges.check(TAB);
    await vi.waitFor(() => expect(topAsked()).toBe(before + 1));

    // The tab moves to a browser page; the iframe's withdrawal brings a new check.
    fake.frames.clear();
    badges.report(TAB, 4, 'player', null);
    await vi.waitFor(() => expect(fake.stored()).toEqual({}));
    top.answer('top');
    await settle();
    expect(fake.stored()).toEqual({});
    expect(fake.badge()).toBe('');
  });
});

describe('the popup’s check', () => {
  it('drops the stale reports before it resolves', async () => {
    fake.frames.set(0, 'top');
    badges.report(TAB, 0, 'top', at(2));
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 0: ['top'] }));

    fake.frames.delete(0);
    await badges.check(TAB);
    expect(fake.stored()).toEqual({});
    expect(fake.badge()).toBe('');
  });

  it('waits for a busy frame no longer than CHECK_WAIT_MS, and still takes its answer after', async () => {
    fake.frames.set(0, 'top');
    badges.report(TAB, 0, 'top', at(2));
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 0: ['top'] }));

    vi.useFakeTimers();
    const top = fake.busy(0);
    let done = false;
    void badges.check(TAB).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(CHECK_WAIT_MS - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
    expect(fake.stored()).toEqual({ 0: ['top'] });

    top.answer('another-page');
    await vi.advanceTimersByTimeAsync(0);
    vi.useRealTimers();
    await vi.waitFor(() => expect(fake.stored()).toEqual({}));
  });

  it('starts its CHECK_WAIT_MS once it asks, however long the reports queued before it take (issue #30)', async () => {
    // 16 reports queued at 15 ms per storage and badge call take over 700 ms, longer than the wait.
    fake = fakeBrowser({ storageMs: 15 });
    badges = createTabBadges();
    fake.frames.set(0, 'old-top');
    badges.report(TAB, 0, 'old-top', OFF);
    await vi.waitFor(() => expect(fake.badge()).toBe('off'));
    await settle();

    // The tab moved on through a browser page; the new page's frames report, and the popup opens.
    fake.frames.set(0, 'new-top');
    for (let frameId = 1; frameId <= 16; frameId++) {
      fake.frames.set(frameId, `player-${frameId}`);
      badges.report(TAB, frameId, `player-${frameId}`, at(2));
    }
    await badges.check(TAB);
    expect(fake.stored()).not.toHaveProperty('0');
    expect(Object.keys(fake.stored())).toHaveLength(16);
    expect(fake.badge()).toBe('2×');

    // Dropping the old top frame's report started another check, which asks the sixteen again
    // and keeps them.
    const asked = fake.asked.length;
    await vi.waitFor(() => expect(fake.asked).toHaveLength(asked + 16));
    expect(Object.keys(fake.stored())).toHaveLength(16);
  });

  it('answers at once for a tab with no reports', async () => {
    await badges.check(TAB);
    expect(fake.asked).toEqual([]);
  });
});
