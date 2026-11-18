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
function fakeBrowser() {
  const session = new Map<string, unknown>();
  const badge = new Map<number, string>();
  const frames = new Map<number, string | Busy>();
  const asked: number[] = [];
  const messages: unknown[] = [];

  vi.stubGlobal('browser', {
    storage: {
      session: {
        get: async (key: string) => (session.has(key) ? { [key]: structuredClone(session.get(key)) } : {}),
        set: async (items: Record<string, unknown>) => {
          for (const [key, value] of Object.entries(items)) session.set(key, structuredClone(value));
        },
        remove: async (key: string) => void session.delete(key),
      },
    },
    action: {
      setBadgeText: async ({ tabId, text }: { tabId: number; text: string }) => void badge.set(tabId, text),
      setBadgeBackgroundColor: async () => {},
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

  it('isn’t asked again while its answer is pending, however many new documents report', async () => {
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
    expect(fake.asked.filter((frameId) => frameId === 0)).toHaveLength(2);

    top.answer('top');
    await settle();
    expect(Object.keys(fake.stored())).toHaveLength(4);
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

  it('answers at once for a tab with no reports', async () => {
    await badges.check(TAB);
    expect(fake.asked).toEqual([]);
  });
});
