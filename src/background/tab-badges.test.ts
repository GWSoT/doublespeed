import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FrameState } from '../lib/tab-speed';
import { CHECK_WAIT_MS, createTabBadges, type TabBadges } from './tab-badges';

const TAB = 1;
const at = (speed: number): FrameState => ({ off: false, video: { speed, playing: false, playedAt: 0 } });
const OFF: FrameState = { off: true, video: null };

/** A frame that takes its time to answer; `answer` lets it. */
interface Busy {
  answer(doc: string | null, state?: FrameState | null): void;
}

/** A frame's document, with the report it has sent from it. */
interface Held {
  doc: string;
  state: FrameState | null;
}

/**
 * The extension API as the background uses it: `storage.session`, the badge, and the tab's
 * frames, each holding a document (or busy, or gone). A frame not in `frames` doesn't answer.
 * A frame given only its document answers that it has sent no report from it: the background
 * reads the report in an answer only when the document isn't the one it asked about.
 */
function fakeBrowser({ storageMs = 0 } = {}) {
  const session = new Map<string, unknown>();
  /** Storage and the badge answer after a task or `storageMs`, as the browser's do; at once by default. */
  const later = <T>(value: T): Promise<T> =>
    storageMs ? new Promise((resolve) => setTimeout(() => resolve(value), storageMs)) : Promise.resolve(value);
  const badge = new Map<number, string>();
  const frames = new Map<number, string | Held | Busy>();
  const asked: number[] = [];
  const messages: unknown[] = [];
  /** The frame's answer to `frameDoc`. */
  const held = (doc: string | null, state: FrameState | null = null) =>
    doc === null ? null : { type: 'frameState', doc, state };

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
        if (typeof frame === 'string') return Promise.resolve(held(frame));
        if ('doc' in frame) return Promise.resolve(held(frame.doc, frame.state));
        return new Promise((resolve) => (frame.answer = (doc, state) => resolve(held(doc, state))));
      },
    },
  });

  return {
    badge: () => badge.get(TAB),
    /** The tab's stored reports, by frame id, as each frame's `doc`. */
    stored: () => {
      const tab = (session.get(`tab:${TAB}`) ?? {}) as Record<string, { doc: string }>;
      return Object.fromEntries(Object.entries(tab).map(([frameId, frame]) => [frameId, frame.doc]));
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
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 0: 'top', 4: 'player' }));
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
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 7: 'player' }));
    expect(fake.badge()).toBe('2×');
    expect(new Set(fake.messages.map((m) => JSON.stringify(m)))).toEqual(new Set(['{"type":"frameDoc"}']));
  });

  it('goes once nothing in its frame answers', async () => {
    fake.frames.set(0, 'top').set(3, 'ad');
    badges.report(TAB, 0, 'top', at(2));
    badges.report(TAB, 3, 'ad', at(1));
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 0: 'top', 3: 'ad' }));

    fake.frames.delete(3);
    fake.frames.set(5, 'player');
    badges.report(TAB, 5, 'player', at(1.5));
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 0: 'top', 5: 'player' }));
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
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 0: 'top', 4: 'player' }));

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
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 0: 'top', 4: 'player' }));

    fake.frames.delete(4);
    badges.report(TAB, 4, 'player', null);
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 0: 'top' }));
    await settle();
    expect(fake.stored()).toEqual({ 0: 'top' });
  });
});

describe('a page back from the back/forward cache', () => {
  it('can’t lose its report to an answer about its old document id', async () => {
    fake.frames.set(0, 'top');
    badges.report(TAB, 0, 'top', at(2));
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 0: 'top' }));

    // The background asks while the page is going into the cache; the answer, null, is held up.
    const leaving = fake.busy(0);
    void badges.check(TAB);
    await vi.waitFor(() => expect(fake.asked).toEqual([0, 0]));

    // The page comes back under a new id and reports, before that answer lands.
    fake.frames.set(0, 'top-again');
    badges.report(TAB, 0, 'top-again', at(2));
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 0: 'top-again' }));
    leaving.answer(null);
    await settle();
    expect(fake.stored()).toEqual({ 0: 'top-again' });
    expect(fake.badge()).toBe('2×');
  });
});

describe('a departed page’s report arriving after its replacement’s (issue #30)', () => {
  it('doesn’t cost the live report', async () => {
    fake.frames.set(0, 'old-top');
    badges.report(TAB, 0, 'old-top', at(1));
    await vi.waitFor(() => expect(fake.asked).toEqual([0]));
    await settle();

    // The tab moved on. The new page reports first; the old page's last report, sent before it
    // left, comes after it.
    fake.frames.set(0, { doc: 'new-top', state: at(2) });
    badges.report(TAB, 0, 'new-top', at(2));
    badges.report(TAB, 0, 'old-top', at(1.5));
    await vi.waitFor(() => expect(fake.asked).toEqual([0, 0]));
    await settle();
    expect(fake.stored()).toEqual({ 0: 'new-top' });
    expect(fake.badge()).toBe('2×');
  });

  it('doesn’t put back a report its frame withdrew while the answer was on its way', async () => {
    fake.frames.set(0, 'old-top');
    badges.report(TAB, 0, 'old-top', at(1));
    await vi.waitFor(() => expect(fake.asked).toEqual([0]));
    await settle();

    const top = fake.busy(0);
    badges.report(TAB, 0, 'new-top', at(2));
    badges.report(TAB, 0, 'old-top', at(1.5));
    await vi.waitFor(() => expect(fake.asked).toEqual([0, 0]));

    // The new page answers with its report, then its video goes and it withdraws. The withdrawal
    // gets in first: it finds the old page's report in its place and removes nothing.
    badges.report(TAB, 0, 'new-top', null);
    await settle();
    top.answer('new-top', at(2));
    await settle();
    expect(fake.stored()).toEqual({});
    expect(fake.badge()).toBe('');
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
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 0: 'old-top', 7: 'player' }));

    top.answer('new-top');
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 7: 'player' }));
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
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 0: 'top', 4: 'player' }));
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
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 0: 'top' }));

    fake.frames.delete(0);
    await badges.check(TAB);
    expect(fake.stored()).toEqual({});
    expect(fake.badge()).toBe('');
  });

  it('waits for a busy frame no longer than CHECK_WAIT_MS, and still takes its answer after', async () => {
    fake.frames.set(0, 'top');
    badges.report(TAB, 0, 'top', at(2));
    await vi.waitFor(() => expect(fake.stored()).toEqual({ 0: 'top' }));

    vi.useFakeTimers();
    const top = fake.busy(0);
    let done = false;
    void badges.check(TAB).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(CHECK_WAIT_MS - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
    expect(fake.stored()).toEqual({ 0: 'top' });

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
  });

  it('answers at once for a tab with no reports', async () => {
    await badges.check(TAB);
    expect(fake.asked).toEqual([]);
  });
});
