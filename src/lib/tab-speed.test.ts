import { describe, expect, it } from 'vitest';
import {
  applyReport,
  badgeText,
  isFrameStateMessage,
  parseTabFrames,
  pickVideo,
  roundSpeed,
  tabSpeed,
  type FrameState,
  type FrameVideo,
  type TabFrames,
} from './tab-speed';

const video = (speed: number, playing: boolean, playedAt: number): FrameVideo => ({ speed, playing, playedAt });
const withVideo = (v: FrameVideo): FrameState => ({ off: false, video: v });

describe('pickVideo', () => {
  it('prefers a playing video, the one that started last', () => {
    const picked = pickVideo([video(1, false, 900), video(2, true, 100), video(3, true, 200)]);
    expect(picked?.speed).toBe(3);
  });

  it('with none playing, the one played last', () => {
    expect(pickVideo([video(1, false, 100), video(2, false, 300), video(3, false, 0)])?.speed).toBe(2);
  });

  it('with none ever played, the first', () => {
    expect(pickVideo([video(1.5, false, 0), video(2, false, 0)])?.speed).toBe(1.5);
  });

  it('nothing from nothing', () => {
    expect(pickVideo([])).toBeNull();
  });
});

describe('applyReport', () => {
  it('adds and replaces a frame’s report', () => {
    let frames: TabFrames = {};
    frames = applyReport(frames, 0, 'a', withVideo(video(2, true, 1)));
    frames = applyReport(frames, 7, 'b', withVideo(video(1.5, false, 0)));
    frames = applyReport(frames, 0, 'a', withVideo(video(2.25, true, 1)));
    expect(frames).toEqual({
      0: { doc: 'a', off: false, video: video(2.25, true, 1) },
      7: { doc: 'b', off: false, video: video(1.5, false, 0) },
    });
  });

  it('a null from the frame’s document removes it', () => {
    const frames = applyReport({}, 0, 'a', withVideo(video(2, true, 1)));
    expect(applyReport(frames, 0, 'a', null)).toEqual({});
  });

  it('a late null from the page the frame left doesn’t erase the new page', () => {
    let frames = applyReport({}, 0, 'old', withVideo(video(2, true, 1)));
    frames = applyReport(frames, 0, 'new', withVideo(video(3, true, 2)));
    expect(applyReport(frames, 0, 'old', null)).toBe(frames);
  });
});

describe('tabSpeed', () => {
  it('nothing on a tab without a video', () => {
    expect(tabSpeed({})).toEqual({ kind: 'none' });
  });

  it('off on a disabled site, whatever the frames’ videos', () => {
    const frames: TabFrames = {
      0: { doc: 'a', off: true, video: null },
      5: { doc: 'b', off: false, video: video(2, true, 1) },
    };
    expect(tabSpeed(frames)).toEqual({ kind: 'off' });
  });

  it('picks across frames: the video playing beats the top frame’s paused one', () => {
    const frames: TabFrames = {
      0: { doc: 'a', off: false, video: video(2, false, 500) },
      5: { doc: 'b', off: false, video: video(1.5, true, 100) },
    };
    expect(tabSpeed(frames)).toEqual({ kind: 'speed', speed: 1.5 });
  });

  it('with no video ever played, the top frame’s', () => {
    const frames: TabFrames = {
      12: { doc: 'b', off: false, video: video(1.5, false, 0) },
      0: { doc: 'a', off: false, video: video(2, false, 0) },
    };
    expect(tabSpeed(frames)).toEqual({ kind: 'speed', speed: 2 });
  });

  it('rounds what a site set to two decimals', () => {
    expect(tabSpeed({ 0: { doc: 'a', off: false, video: video(1.1000000001, true, 1) } })).toEqual({
      kind: 'speed',
      speed: 1.1,
    });
    expect(roundSpeed(2.249999)).toBe(2.25);
  });
});

describe('badgeText', () => {
  const whole = (speed: string) => `${speed}×`;

  it('keeps the × on a whole speed and drops it otherwise, to fit', () => {
    expect(badgeText({ kind: 'speed', speed: 2 }, 'off', whole)).toBe('2×');
    expect(badgeText({ kind: 'speed', speed: 2.25 }, 'off', whole)).toBe('2.25');
    expect(badgeText({ kind: 'speed', speed: 1.5 }, 'off', whole)).toBe('1.5');
    expect(badgeText({ kind: 'speed', speed: 0.25 }, 'off', whole)).toBe('0.25');
  });

  it('off, or nothing', () => {
    expect(badgeText({ kind: 'off' }, 'off', whole)).toBe('off');
    expect(badgeText({ kind: 'none' }, 'off', whole)).toBe('');
  });
});

describe('messages and storage', () => {
  it('accepts a frame’s report, with or without a state', () => {
    expect(isFrameStateMessage({ type: 'frameState', doc: 'a', state: null })).toBe(true);
    expect(isFrameStateMessage({ type: 'frameState', doc: 'a', state: withVideo(video(2, true, 1)) })).toBe(true);
    expect(isFrameStateMessage({ type: 'frameState', doc: 'a', state: { off: true, video: null } })).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isFrameStateMessage({ type: 'frameState', state: null })).toBe(false);
    expect(isFrameStateMessage({ type: 'frameState', doc: 'a', state: { off: 'no', video: null } })).toBe(false);
    expect(isFrameStateMessage({ type: 'frameState', doc: 'a', state: { off: false, video: { speed: 'x' } } })).toBe(
      false,
    );
    expect(isFrameStateMessage({ type: 'speedCommand', command: 'speed-up' })).toBe(false);
  });

  it('reads stored frames, dropping malformed ones', () => {
    const good = { doc: 'a', off: false, video: video(2, true, 1) };
    expect(parseTabFrames({ 0: good, 3: { off: false }, x: good })).toEqual({ 0: good });
    expect(parseTabFrames(undefined)).toEqual({});
  });
});
