/**
 * Rule 1 of SPEC §3.2 for a single video: apply the default speed once per source, after
 * metadata, and leave live videos alone. Pure, so it's unit tested without a browser; the
 * content script turns a `<video>` into a `VideoSnapshot` and carries out the `VideoAction`.
 */

/** `HTMLMediaElement.HAVE_METADATA`: duration and dimensions are known. */
export const HAVE_METADATA = 1;

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

export type VideoStatus = 'waiting' | 'applied' | 'live';

export interface VideoState {
  source: string;
  status: VideoStatus;
  /** The speed this source had before we changed it; `null` until we do. */
  rateBefore: number | null;
}

export type VideoAction = { kind: 'none' } | { kind: 'set-rate'; rate: number };

const NONE: VideoAction = { kind: 'none' };

/** A live video: one whose duration is unbounded (SPEC §3.1). */
export function isLive(snap: Pick<VideoSnapshot, 'duration'>): boolean {
  return snap.duration === Infinity;
}

/**
 * What to do with a video now, given what we last decided for it. Called on discovery and on
 * every media event that can change the answer (`loadstart`, `loadedmetadata`,
 * `durationchange`, `play`).
 */
export function decide(
  prev: VideoState | undefined,
  snap: VideoSnapshot,
  defaultSpeed: number,
): { state: VideoState; action: VideoAction } {
  const sameSource = prev !== undefined && prev.source === snap.source;

  if (sameSource && prev.status === 'live') return { state: prev, action: NONE };

  if (sameSource && prev.status === 'applied') {
    // A source can turn out to be live after we sped it up (an MSE stream whose duration
    // becomes Infinity). Put back the speed it had and leave it alone from then on.
    if (!isLive(snap)) return { state: prev, action: NONE };
    const action: VideoAction =
      prev.rateBefore !== null && snap.playbackRate !== prev.rateBefore
        ? { kind: 'set-rate', rate: prev.rateBefore }
        : NONE;
    return { state: { ...prev, status: 'live' }, action };
  }

  // A new source, or one still waiting for metadata.
  if (!snap.source || snap.readyState < HAVE_METADATA) {
    return { state: { source: snap.source, status: 'waiting', rateBefore: null }, action: NONE };
  }
  if (isLive(snap)) {
    return { state: { source: snap.source, status: 'live', rateBefore: null }, action: NONE };
  }
  const state: VideoState = { source: snap.source, status: 'applied', rateBefore: snap.playbackRate };
  const action: VideoAction =
    snap.playbackRate === defaultSpeed ? NONE : { kind: 'set-rate', rate: defaultSpeed };
  return { state, action };
}
