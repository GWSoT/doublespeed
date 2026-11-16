import { describe, expect, it } from 'vitest';
import { decide, type VideoSnapshot, type VideoState } from './video-state';

const DEFAULT = 2;

function snap(overrides: Partial<VideoSnapshot> = {}): VideoSnapshot {
  return { source: '1|https://example.com/a.webm', readyState: 4, duration: 30, playbackRate: 1, ...overrides };
}

/** Feeds snapshots through `decide` the way the content script does, returning every step. */
function run(...snaps: VideoSnapshot[]) {
  let state: VideoState | undefined;
  return snaps.map((s) => {
    const result = decide(state, s, DEFAULT);
    state = result.state;
    return result;
  });
}

describe('decide', () => {
  it('waits while a video has no source', () => {
    expect(decide(undefined, snap({ source: '', readyState: 0, duration: NaN }), DEFAULT)).toEqual({
      state: { source: '', status: 'waiting', rateBefore: null },
      action: { kind: 'none' },
    });
  });

  it('waits for metadata before deciding, then applies the default speed', () => {
    const [before, after] = run(snap({ readyState: 0, duration: NaN }), snap());
    expect(before!.action).toEqual({ kind: 'none' });
    expect(after!.action).toEqual({ kind: 'set-rate', rate: DEFAULT });
    expect(after!.state).toEqual({ source: snap().source, status: 'applied', rateBefore: 1 });
  });

  it('remembers the speed the source had before we changed it', () => {
    const [step] = run(snap({ playbackRate: 1.25 }));
    expect(step!.state.rateBefore).toBe(1.25);
  });

  it('applies once per source', () => {
    const [, again] = run(snap(), snap({ playbackRate: DEFAULT }));
    expect(again!.action).toEqual({ kind: 'none' });
  });

  it('applies again when the source changes', () => {
    const [, next] = run(snap(), snap({ source: '2|https://example.com/b.webm' }));
    expect(next!.action).toEqual({ kind: 'set-rate', rate: DEFAULT });
  });

  it('applies again when the same URL is loaded a second time', () => {
    // The load counter in the key changes even though currentSrc doesn't.
    const [, reload] = run(snap(), snap({ source: '2|https://example.com/a.webm' }));
    expect(reload!.action).toEqual({ kind: 'set-rate', rate: DEFAULT });
  });

  it('does nothing when the video is already at the default speed', () => {
    const [step] = run(snap({ playbackRate: DEFAULT }));
    expect(step!.action).toEqual({ kind: 'none' });
    expect(step!.state.status).toBe('applied');
  });

  it('leaves a live video alone', () => {
    const [step] = run(snap({ duration: Infinity }));
    expect(step!.action).toEqual({ kind: 'none' });
    expect(step!.state.status).toBe('live');
  });

  it('keeps leaving a live video alone, whatever its speed does', () => {
    const [, later] = run(snap({ duration: Infinity }), snap({ duration: Infinity, playbackRate: 1.5 }));
    expect(later!.action).toEqual({ kind: 'none' });
  });

  it('restores the earlier speed when a source turns out to be live', () => {
    const [, turnsLive] = run(snap(), snap({ duration: Infinity, playbackRate: DEFAULT }));
    expect(turnsLive!.action).toEqual({ kind: 'set-rate', rate: 1 });
    expect(turnsLive!.state.status).toBe('live');
  });
});
