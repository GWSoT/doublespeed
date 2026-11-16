/**
 * Applies the speed rules (SPEC §3.2) to each video the finder reports. The decisions live in
 * `src/lib/video-state.ts`; this file only reads videos and carries the decisions out.
 */
import { decide, type VideoSnapshot, type VideoState } from '../lib/video-state';

/** Media events after which the decision for a video can change. */
const REEVALUATE_ON = ['loadstart', 'loadedmetadata', 'durationchange', 'play'] as const;

export interface SpeedEngine {
  track(video: HTMLVideoElement): void;
}

export function createSpeedEngine(options: { defaultSpeed: () => number; signal: AbortSignal }): SpeedEngine {
  const states = new WeakMap<HTMLVideoElement, VideoState>();
  /** Bumped on every `loadstart`, so reloading the same URL still counts as a new source. */
  const loads = new WeakMap<HTMLVideoElement, number>();
  /** Stable ids for `srcObject` sources, which have no URL. */
  const objectIds = new WeakMap<object, number>();
  let nextObjectId = 1;

  function sourceKey(video: HTMLVideoElement): string {
    let src = video.currentSrc;
    const object = video.srcObject;
    if (!src && object) {
      let id = objectIds.get(object);
      if (id === undefined) objectIds.set(object, (id = nextObjectId++));
      src = `object:${id}`;
    }
    return src ? `${loads.get(video) ?? 0}|${src}` : '';
  }

  function evaluate(video: HTMLVideoElement): void {
    const snapshot: VideoSnapshot = {
      source: sourceKey(video),
      readyState: video.readyState,
      duration: video.duration,
      playbackRate: video.playbackRate,
    };
    const { state, action } = decide(states.get(video), snapshot, options.defaultSpeed());
    states.set(video, state);
    if (action.kind === 'set-rate') setRate(video, action.rate);
  }

  return {
    track(video) {
      for (const type of REEVALUATE_ON) {
        video.addEventListener(
          type,
          () => {
            if (type === 'loadstart') loads.set(video, (loads.get(video) ?? 0) + 1);
            evaluate(video);
          },
          { signal: options.signal },
        );
      }
      evaluate(video);
    },
  };
}

function setRate(video: HTMLVideoElement, rate: number): void {
  try {
    video.playbackRate = rate;
  } catch {
    // Out of the browser's supported range; leave the video as it is.
  }
}
