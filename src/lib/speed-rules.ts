/**
 * The speed rules of SPEC §3.2 for a single video, as a pure state machine so they're unit
 * tested without a browser. The content script turns a `<video>` into a `VideoSnapshot`,
 * feeds it in on media events (`onMedia`) and on `ratechange` (`onRateChange`), and carries
 * out the returned `VideoAction`.
 */

/** `HTMLMediaElement.HAVE_METADATA`: duration and dimensions are known. */
export const HAVE_METADATA = 1;

/** A `ratechange` this soon after the user's own click or keypress is theirs (rule 3). */
export const USER_INPUT_WINDOW_MS = 1000;
/** More site resets than this within `RESET_WINDOW_MS` and we stop fighting (rule 4). */
export const RESET_LIMIT = 5;
export const RESET_WINDOW_MS = 10_000;

export interface VideoSnapshot {
  /**
   * Identifies the current source. The content script combines a per-video load counter
   * (bumped on every `loadstart`) with `currentSrc`, because reloading the same URL still
   * resets `playbackRate` to `defaultPlaybackRate`. Empty when nothing is loaded.
   */
  source: string;
  readyState: number;
  duration: number;
  playbackRate: number;
}

/**
 * - `waiting`: no source or no metadata yet.
 * - `applied`: the rules are in force for this source.
 * - `live`: a live video, left alone for good.
 * - `yielded`: the site kept resetting the speed, so we stopped fighting this source.
 */
export type VideoStatus = 'waiting' | 'applied' | 'live' | 'yielded';

export interface VideoState {
  source: string;
  status: VideoStatus;
  /** The speed this source had before we changed it; `null` until we do. */
  rateBefore: number | null;
  /** When the rules took over this source. Input before this can't be a speed choice. */
  appliedAt: number | null;
  /** The user's in-the-moment speed for this source (SPEC §3.1 "override"). */
  override: number | null;
  /** The speed we just set, until its `ratechange` arrives (rule 2). */
  expected: number | null;
  /** When we undid recent site resets, for the back-off. */
  resets: readonly number[];
}

export type VideoAction = { kind: 'none' } | { kind: 'set-rate'; rate: number };

export interface Step {
  state: VideoState;
  action: VideoAction;
}

const NONE: VideoAction = { kind: 'none' };

/** A live video: one whose duration is unbounded (SPEC §3.1). */
export function isLive(snap: Pick<VideoSnapshot, 'duration'>): boolean {
  return snap.duration === Infinity;
}

/** The speed a video under the rules should be playing at: its override, else the default. */
export function targetSpeed(state: VideoState, defaultSpeed: number): number {
  return state.override ?? defaultSpeed;
}

function fresh(source: string, status: VideoStatus): VideoState {
  return { source, status, rateBefore: null, appliedAt: null, override: null, expected: null, resets: [] };
}

function setRate(state: VideoState, rate: number): Step {
  return { state: { ...state, expected: rate }, action: { kind: 'set-rate', rate } };
}

/**
 * Rule 1. Called on discovery and on every media event that can change the answer
 * (`loadstart`, `loadedmetadata`, `durationchange`, `play`): applies the default speed once
 * per source, after metadata, and leaves live videos alone.
 */
export function onMedia(prev: VideoState | undefined, snap: VideoSnapshot, now: number, defaultSpeed: number): Step {
  const sameSource = prev !== undefined && prev.source === snap.source;

  if (sameSource && (prev.status === 'live' || prev.status === 'yielded')) return { state: prev, action: NONE };

  if (sameSource && prev.status === 'applied') {
    // A source can turn out to be live after we sped it up (an MSE stream whose duration
    // becomes Infinity). Put back the speed it had and leave it alone from then on.
    if (!isLive(snap)) return { state: prev, action: NONE };
    const live: VideoState = { ...prev, status: 'live' };
    return prev.rateBefore !== null && snap.playbackRate !== prev.rateBefore
      ? setRate(live, prev.rateBefore)
      : { state: live, action: NONE };
  }

  // A new source, or one still waiting for metadata.
  if (!snap.source || snap.readyState < HAVE_METADATA) return { state: fresh(snap.source, 'waiting'), action: NONE };
  if (isLive(snap)) return { state: fresh(snap.source, 'live'), action: NONE };

  const applied: VideoState = { ...fresh(snap.source, 'applied'), rateBefore: snap.playbackRate, appliedAt: now };
  return snap.playbackRate === defaultSpeed ? { state: applied, action: NONE } : setRate(applied, defaultSpeed);
}

/**
 * Rules 2–4, on `ratechange`. `lastInputAt` is the time of the latest trusted `pointerdown`
 * or `keydown` in the video's frame, on the same clock as `now`.
 */
export function onRateChange(
  prev: VideoState,
  snap: VideoSnapshot,
  now: number,
  lastInputAt: number | null,
  defaultSpeed: number,
): Step {
  if (prev.status !== 'applied' || prev.source !== snap.source) return { state: prev, action: NONE };
  const rate = snap.playbackRate;

  // Rule 2: the echo of our own change.
  if (prev.expected !== null && rate === prev.expected) return { state: { ...prev, expected: null }, action: NONE };
  const state: VideoState = { ...prev, expected: null };

  // Rule 3: the user's change. The input must come after the rules took over this source:
  // a click on "next video" lands before the new source loads, so the site's reset that
  // follows it isn't mistaken for a choice (ROADMAP risk 1).
  if (
    lastInputAt !== null &&
    prev.appliedAt !== null &&
    lastInputAt >= prev.appliedAt &&
    now - lastInputAt <= USER_INPUT_WINDOW_MS
  ) {
    return { state: { ...state, override: rate }, action: NONE };
  }

  // Rule 4: a site reset, undone unless the site keeps at it.
  const target = targetSpeed(state, defaultSpeed);
  if (rate === target) return { state, action: NONE };
  const resets = [...state.resets.filter((at) => now - at < RESET_WINDOW_MS), now];
  if (resets.length > RESET_LIMIT) return { state: { ...state, status: 'yielded', resets }, action: NONE };
  return setRate({ ...state, resets }, target);
}
