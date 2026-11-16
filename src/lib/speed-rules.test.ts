import { describe, expect, it } from 'vitest';
import {
  onDefaultChange,
  onDisable,
  onMedia,
  onRateChange,
  RESET_LIMIT,
  RESET_WINDOW_MS,
  USER_INPUT_WINDOW_MS,
  type VideoSnapshot,
  type VideoState,
} from './speed-rules';

const DEFAULT = 2;
const SOURCE = '1|https://example.com/a.webm';

function snap(overrides: Partial<VideoSnapshot> = {}): VideoSnapshot {
  return { source: SOURCE, readyState: 4, duration: 30, playbackRate: 1, ...overrides };
}

/** Feeds snapshots through `onMedia` the way the content script does, returning every step. */
function media(...snaps: VideoSnapshot[]) {
  let state: VideoState | undefined;
  return snaps.map((s, i) => {
    const step = onMedia(state, s, i * 10, DEFAULT);
    state = step.state;
    return step;
  });
}

/** A video the rules have just sped up at t=0, with our own `ratechange` echo absorbed. */
function appliedAt2(): VideoState {
  const applied = onMedia(undefined, snap(), 0, DEFAULT).state;
  return onRateChange(applied, snap({ playbackRate: DEFAULT }), 5, null, DEFAULT).state;
}

describe('onMedia (rule 1: new source)', () => {
  it('waits while a video has no source', () => {
    const [step] = media(snap({ source: '', readyState: 0, duration: NaN }));
    expect(step!.action).toEqual({ kind: 'none' });
    expect(step!.state.status).toBe('waiting');
  });

  it('waits for metadata, then applies the default speed', () => {
    const [before, after] = media(snap({ readyState: 0, duration: NaN }), snap());
    expect(before!.action).toEqual({ kind: 'none' });
    expect(after!.action).toEqual({ kind: 'set-rate', rate: DEFAULT });
    expect(after!.state).toMatchObject({ status: 'applied', rateBefore: 1, appliedAt: 10, expected: [DEFAULT] });
  });

  it('remembers the speed the source had before we changed it', () => {
    const [step] = media(snap({ playbackRate: 1.25 }));
    expect(step!.state.rateBefore).toBe(1.25);
  });

  it('applies once per source', () => {
    const [, again] = media(snap(), snap({ playbackRate: DEFAULT }));
    expect(again!.action).toEqual({ kind: 'none' });
  });

  it('applies again when the source changes, or the same URL loads again', () => {
    const [, next] = media(snap(), snap({ source: '2|https://example.com/b.webm' }));
    const [, reload] = media(snap(), snap({ source: '2|https://example.com/a.webm' }));
    expect(next!.action).toEqual({ kind: 'set-rate', rate: DEFAULT });
    expect(reload!.action).toEqual({ kind: 'set-rate', rate: DEFAULT });
  });

  it('starts a new source without the previous one’s override or resets', () => {
    const overridden = onRateChange(appliedAt2(), snap({ playbackRate: 1.5 }), 100, 90, DEFAULT).state;
    const next = onMedia(overridden, snap({ source: '2|https://example.com/b.webm' }), 200, DEFAULT);
    expect(next.state).toMatchObject({ override: null, resets: [], appliedAt: 200 });
    expect(next.action).toEqual({ kind: 'set-rate', rate: DEFAULT });
  });

  it('does nothing when the video is already at the default speed', () => {
    const [step] = media(snap({ playbackRate: DEFAULT }));
    expect(step!.action).toEqual({ kind: 'none' });
    expect(step!.state).toMatchObject({ status: 'applied', expected: [] });
  });

  it('leaves a live video alone, whatever its speed does', () => {
    const [first, later] = media(snap({ duration: Infinity }), snap({ duration: Infinity, playbackRate: 1.5 }));
    expect(first!.state.status).toBe('live');
    expect(first!.action).toEqual({ kind: 'none' });
    expect(later!.action).toEqual({ kind: 'none' });
  });

  it('restores the earlier speed when a source turns out to be live', () => {
    const [, turnsLive] = media(snap(), snap({ duration: Infinity, playbackRate: DEFAULT }));
    expect(turnsLive!.action).toEqual({ kind: 'set-rate', rate: 1 });
    expect(turnsLive!.state.status).toBe('live');
  });
});

describe('onRateChange', () => {
  it('rule 2: ignores the echo of our own change', () => {
    const applied = onMedia(undefined, snap(), 0, DEFAULT).state;
    const step = onRateChange(applied, snap({ playbackRate: DEFAULT }), 5, null, DEFAULT);
    expect(step.action).toEqual({ kind: 'none' });
    expect(step.state).toMatchObject({ expected: [], override: null, resets: [] });
  });

  it('rule 3: a change right after the user’s input becomes the override', () => {
    const step = onRateChange(appliedAt2(), snap({ playbackRate: 1.5 }), 1000, 900, DEFAULT);
    expect(step.action).toEqual({ kind: 'none' });
    expect(step.state.override).toBe(1.5);
  });

  it('rule 3: input older than the window doesn’t count', () => {
    const step = onRateChange(appliedAt2(), snap({ playbackRate: 1 }), 5000, 5000 - USER_INPUT_WINDOW_MS - 1, DEFAULT);
    expect(step.state.override).toBeNull();
    expect(step.action).toEqual({ kind: 'set-rate', rate: DEFAULT });
  });

  it('rule 3: input from before the rules took over the source doesn’t count (the "next video" race)', () => {
    // Clicked "next" at t=-200; the new source was sped up at t=0; the site reset it at t=100.
    const step = onRateChange(appliedAt2(), snap({ playbackRate: 1 }), 100, -200, DEFAULT);
    expect(step.state.override).toBeNull();
    expect(step.action).toEqual({ kind: 'set-rate', rate: DEFAULT });
  });

  it('rule 4: undoes a site reset with no user input', () => {
    const step = onRateChange(appliedAt2(), snap({ playbackRate: 1 }), 100, null, DEFAULT);
    expect(step.action).toEqual({ kind: 'set-rate', rate: DEFAULT });
    expect(step.state).toMatchObject({ expected: [DEFAULT], resets: [100] });
  });

  it('rule 4: puts back the user’s override, not the default, after a site reset', () => {
    const overridden = onRateChange(appliedAt2(), snap({ playbackRate: 1.5 }), 1000, 900, DEFAULT).state;
    const step = onRateChange(overridden, snap({ playbackRate: 1 }), 5000, 900, DEFAULT);
    expect(step.action).toEqual({ kind: 'set-rate', rate: 1.5 });
  });

  it('rule 4: accepts a site change that lands on the target speed', () => {
    const applied = onMedia(undefined, snap(), 0, DEFAULT).state;
    const step = onRateChange({ ...applied, expected: [] }, snap({ playbackRate: DEFAULT }), 50, null, DEFAULT);
    expect(step.action).toEqual({ kind: 'none' });
    expect(step.state.resets).toEqual([]);
  });

  it(`rule 4: stops fighting after more than ${RESET_LIMIT} resets in ${RESET_WINDOW_MS / 1000} s`, () => {
    let state = appliedAt2();
    const actions = [];
    for (let i = 1; i <= RESET_LIMIT + 1; i++) {
      const reset = onRateChange(state, snap({ playbackRate: 1 }), i * 100, null, DEFAULT);
      actions.push(reset.action.kind);
      // Absorb our echo, as the next ratechange would.
      state = onRateChange(reset.state, snap({ playbackRate: DEFAULT }), i * 100 + 1, null, DEFAULT).state;
    }
    expect(actions).toEqual([...Array<string>(RESET_LIMIT).fill('set-rate'), 'none']);
    expect(state.status).toBe('yielded');
    expect(onMedia(state, snap({ playbackRate: 1 }), 2000, DEFAULT).action).toEqual({ kind: 'none' });
  });

  it('rule 4: resets spread wider than the window never trigger the back-off', () => {
    let state = appliedAt2();
    for (let i = 1; i <= RESET_LIMIT * 3; i++) {
      const reset = onRateChange(state, snap({ playbackRate: 1 }), i * RESET_WINDOW_MS, null, DEFAULT);
      expect(reset.action).toEqual({ kind: 'set-rate', rate: DEFAULT });
      state = onRateChange(reset.state, snap({ playbackRate: DEFAULT }), i * RESET_WINDOW_MS + 1, null, DEFAULT).state;
    }
    expect(state.status).toBe('applied');
  });

  it('ignores rate changes before the rules apply, on live videos and after yielding', () => {
    for (const status of ['waiting', 'live', 'yielded'] as const) {
      const state: VideoState = { ...appliedAt2(), status };
      expect(onRateChange(state, snap({ playbackRate: 1 }), 100, null, DEFAULT).action).toEqual({ kind: 'none' });
    }
  });
});

describe('rule 6: settings changed live', () => {
  it('a new default moves a video with no override', () => {
    const step = onDefaultChange(appliedAt2(), snap({ playbackRate: DEFAULT }), DEFAULT, 3);
    expect(step.action).toEqual({ kind: 'set-rate', rate: 3 });
    expect(step.state.expected).toEqual([3]);
  });

  it('two quick default changes: both echoes are ours, even right after the user’s input', () => {
    // 2 → 2.25 → 2.5 before either ratechange arrives. Both events read 2.5.
    const first = onDefaultChange(appliedAt2(), snap({ playbackRate: DEFAULT }), DEFAULT, 2.25);
    const second = onDefaultChange(first.state, snap({ playbackRate: 2.25 }), 2.25, 2.5);
    expect(second.action).toEqual({ kind: 'set-rate', rate: 2.5 });
    expect(second.state.expected).toEqual([2.25, 2.5]);

    // The user clicked in the page 100 ms ago, so an outside change would count as theirs.
    const echo1 = onRateChange(second.state, snap({ playbackRate: 2.5 }), 1000, 900, 2.5);
    const echo2 = onRateChange(echo1.state, snap({ playbackRate: 2.5 }), 1001, 900, 2.5);
    expect(echo2.state).toMatchObject({ expected: [], override: null });
    expect([echo1.action, echo2.action]).toEqual([{ kind: 'none' }, { kind: 'none' }]);

    // So the next default still moves it.
    expect(onDefaultChange(echo2.state, snap({ playbackRate: 2.5 }), 2.5, 3).action).toEqual({ kind: 'set-rate', rate: 3 });
  });

  it('a new default moves a video whose echo of our last change hasn’t arrived yet', () => {
    const applied = onMedia(undefined, snap(), 0, DEFAULT).state;
    expect(onDefaultChange(applied, snap({ playbackRate: DEFAULT }), DEFAULT, 3).action).toEqual({
      kind: 'set-rate',
      rate: 3,
    });
  });

  it('a new default leaves the user’s override alone', () => {
    const overridden = onRateChange(appliedAt2(), snap({ playbackRate: 1.5 }), 1000, 900, DEFAULT).state;
    expect(onDefaultChange(overridden, snap({ playbackRate: 1.5 }), DEFAULT, 3).action).toEqual({ kind: 'none' });
  });

  it('a new default leaves a video whose ratechange is still on its way to rules 3–4', () => {
    // The user picked 1.5× a moment ago; its ratechange hasn't been handled yet.
    const pending = onDefaultChange(appliedAt2(), snap({ playbackRate: 1.5 }), DEFAULT, 3);
    expect(pending.action).toEqual({ kind: 'none' });
    // When it arrives, rule 3 makes it the override, and rule 4 would undo a site reset to the new default.
    expect(onRateChange(pending.state, snap({ playbackRate: 1.5 }), 1000, 990, 3).state.override).toBe(1.5);
    expect(onRateChange(pending.state, snap({ playbackRate: 1 }), 1000, null, 3).action).toEqual({
      kind: 'set-rate',
      rate: 3,
    });
  });

  it('a new default leaves videos the rules aren’t applying to alone', () => {
    for (const status of ['waiting', 'live', 'yielded'] as const) {
      const state: VideoState = { ...appliedAt2(), status };
      expect(onDefaultChange(state, snap({ playbackRate: DEFAULT }), DEFAULT, 3).action).toEqual({ kind: 'none' });
    }
    const otherSource = onDefaultChange(appliedAt2(), snap({ source: '2|https://example.com/b.webm' }), DEFAULT, 3);
    expect(otherSource.action).toEqual({ kind: 'none' });
  });

  it('turning the site off puts back the speed the video had before', () => {
    expect(onDisable(appliedAt2(), snap({ playbackRate: DEFAULT }))).toEqual({ kind: 'set-rate', rate: 1 });
    const fromHalf = onMedia(undefined, snap({ playbackRate: 0.5 }), 0, DEFAULT).state;
    expect(onDisable(fromHalf, snap({ playbackRate: DEFAULT }))).toEqual({ kind: 'set-rate', rate: 0.5 });
  });

  it('turning the site off restores the earlier speed over the user’s override too', () => {
    const overridden = onRateChange(appliedAt2(), snap({ playbackRate: 1.5 }), 1000, 900, DEFAULT).state;
    expect(onDisable(overridden, snap({ playbackRate: 1.5 }))).toEqual({ kind: 'set-rate', rate: 1 });
  });

  it('turning the site off leaves alone what the rules weren’t applying to', () => {
    for (const status of ['waiting', 'live', 'yielded'] as const) {
      const state: VideoState = { ...appliedAt2(), status };
      expect(onDisable(state, snap({ playbackRate: 1.5 }))).toEqual({ kind: 'none' });
    }
    expect(onDisable(appliedAt2(), snap({ playbackRate: 1 }))).toEqual({ kind: 'none' });
  });
});
