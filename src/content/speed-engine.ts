/**
 * Applies the speed rules (SPEC §3.2) to each video the finder reports. The decisions live in
 * `src/lib/speed-rules.ts`; this file only reads videos and carries the decisions out.
 */
import { onMedia, onRateChange, type Step, type VideoSnapshot, type VideoState } from '../lib/speed-rules';

/** Media events after which rule 1's answer for a video can change. */
const MEDIA_EVENTS = ['loadstart', 'loadedmetadata', 'durationchange', 'play'] as const;

export interface SpeedEngine {
  track(video: HTMLVideoElement): void;
}

export interface SpeedEngineOptions {
  defaultSpeed: () => number;
  /** The latest trusted input in this frame, on the `performance.now()` clock. */
  lastInputAt: () => number | null;
  signal: AbortSignal;
}

export function createSpeedEngine(options: SpeedEngineOptions): SpeedEngine {
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

  function snapshot(video: HTMLVideoElement): VideoSnapshot {
    return {
      source: sourceKey(video),
      readyState: video.readyState,
      duration: video.duration,
      playbackRate: video.playbackRate,
    };
  }

  function carryOut(video: HTMLVideoElement, step: Step): void {
    states.set(video, step.state);
    if (step.action.kind === 'set-rate') setRate(video, step.action.rate);
  }

  function onMediaEvent(video: HTMLVideoElement): void {
    carryOut(video, onMedia(states.get(video), snapshot(video), performance.now(), options.defaultSpeed()));
  }

  function onRateChangeEvent(video: HTMLVideoElement): void {
    const state = states.get(video);
    if (!state) return;
    const now = performance.now();
    carryOut(video, onRateChange(state, snapshot(video), now, options.lastInputAt(), options.defaultSpeed()));
  }

  return {
    track(video) {
      const listen = { signal: options.signal };
      for (const type of MEDIA_EVENTS) {
        video.addEventListener(
          type,
          () => {
            if (type === 'loadstart') loads.set(video, (loads.get(video) ?? 0) + 1);
            onMediaEvent(video);
          },
          listen,
        );
      }
      video.addEventListener('ratechange', () => onRateChangeEvent(video), listen);
      onMediaEvent(video);
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
