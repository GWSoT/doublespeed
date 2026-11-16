/**
 * Applies the speed rules (SPEC §3.2) to each video the finder reports. The decisions live in
 * `src/lib/speed-rules.ts`; this file only reads videos and carries the decisions out.
 */
import {
  onDefaultChange,
  onDisable,
  onMedia,
  onRateChange,
  type Step,
  type VideoAction,
  type VideoSnapshot,
  type VideoState,
} from '../lib/speed-rules';

/** Media events after which rule 1's answer for a video can change. */
const MEDIA_EVENTS = ['loadstart', 'loadedmetadata', 'durationchange', 'play'] as const;

/** What the engine needs from the settings. */
export interface EngineSettings {
  defaultSpeed: number;
  /** False on a disabled page site: the rules don't run (SPEC §3.2 rule 1). */
  enabled: boolean;
}

export interface SpeedEngine {
  track(video: HTMLVideoElement): void;
  /** Rule 6: applies a settings change to every tracked video, without a reload. */
  applySettings(settings: EngineSettings): void;
}

export interface SpeedEngineOptions extends EngineSettings {
  /** The latest trusted input in this frame, on the `performance.now()` clock. */
  lastInputAt: () => number | null;
  signal: AbortSignal;
}

export function createSpeedEngine(options: SpeedEngineOptions): SpeedEngine {
  let { defaultSpeed, enabled } = options;
  const states = new WeakMap<HTMLVideoElement, VideoState>();
  /** Every tracked video, for rule 6. Weak, so videos the page drops can still be collected. */
  const tracked = new Set<WeakRef<HTMLVideoElement>>();
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
    act(video, step.action);
  }

  function onMediaEvent(video: HTMLVideoElement): void {
    if (!enabled) return;
    carryOut(video, onMedia(states.get(video), snapshot(video), performance.now(), defaultSpeed));
  }

  function onRateChangeEvent(video: HTMLVideoElement): void {
    const state = states.get(video);
    if (!enabled || !state) return;
    const now = performance.now();
    carryOut(video, onRateChange(state, snapshot(video), now, options.lastInputAt(), defaultSpeed));
  }

  function forEachTracked(fn: (video: HTMLVideoElement) => void): void {
    for (const ref of tracked) {
      const video = ref.deref();
      if (video) fn(video);
      else tracked.delete(ref);
    }
  }

  return {
    track(video) {
      tracked.add(new WeakRef(video));
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

    applySettings(next) {
      const wasEnabled = enabled;
      const previousDefault = defaultSpeed;
      ({ defaultSpeed, enabled } = next);

      if (wasEnabled && !enabled) {
        // Put back each video's own speed and forget its state: the rules stop here.
        forEachTracked((video) => {
          const state = states.get(video);
          if (state) act(video, onDisable(state, snapshot(video)));
          states.delete(video);
        });
      } else if (!wasEnabled && enabled) {
        // Start every video over, as if seen for the first time.
        forEachTracked(onMediaEvent);
      } else if (enabled && defaultSpeed !== previousDefault) {
        forEachTracked((video) => {
          const state = states.get(video);
          if (state) carryOut(video, onDefaultChange(state, snapshot(video), previousDefault, defaultSpeed));
        });
      }
    },
  };
}

function act(video: HTMLVideoElement, action: VideoAction): void {
  if (action.kind !== 'set-rate') return;
  try {
    video.playbackRate = action.rate;
  } catch {
    // Out of the browser's supported range; leave the video as it is.
  }
}
