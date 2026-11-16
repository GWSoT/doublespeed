/**
 * The speed label (SPEC §1, ADR-0005): after our controls change a video's speed, a small `N×`
 * label shows over it for about a second, then fades. It's never shown permanently.
 *
 * - **Isolated.** The label lives in a closed shadow root, so the page's styles and scripts can't
 *   reach it. The host carries its few layout styles inline, marked `!important`.
 * - **Above everything, fullscreen included.** The labels sit in a manual popover, which the
 *   browser renders in the top layer: above the page with no z-index to win, and above a
 *   fullscreen player. Each show re-opens it, which puts it back on top of anything that
 *   entered the top layer after it, such as a player that went fullscreen since.
 * - **Only where it can be seen.** Videos outside the viewport, or hidden, get no label.
 */

/** How long a label stays, then how long it takes to fade. */
export const LABEL_SHOW_MS = 1000;
const LABEL_FADE_MS = 200;
/** Distance from the video's top-left corner (or the viewport's, when the corner is off screen). */
const INSET_PX = 12;

const HOST_TAG = 'doublespeed-ui';

const HOST_STYLE = [
  'display: block !important',
  'position: absolute !important',
  'width: 0 !important',
  'height: 0 !important',
  'margin: 0 !important',
  'padding: 0 !important',
  'border: 0 !important',
  'overflow: visible !important',
].join(';');

const SHADOW_STYLE = `
  .layer {
    position: fixed;
    inset: 0;
    width: auto;
    height: auto;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    overflow: hidden;
    pointer-events: none;
    color-scheme: normal;
  }
  .label {
    position: absolute;
    padding: 4px 10px;
    border-radius: 6px;
    background: rgb(0 0 0 / 0.72);
    color: #fff;
    font: 600 16px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-variant-numeric: tabular-nums;
    letter-spacing: normal;
    white-space: nowrap;
    opacity: 1;
    transition: opacity ${LABEL_FADE_MS}ms ease-out;
  }
  .label.fading {
    opacity: 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .label {
      transition: none;
    }
  }
`;

export interface SpeedLabels {
  /** Shows `speed` over `video`, if the user can see it, restarting its timer. */
  show(video: HTMLVideoElement, speed: number): void;
}

interface Shown {
  label: HTMLElement;
  timer: ReturnType<typeof setTimeout>;
}

export function createSpeedLabels(
  doc: Document,
  format: (speed: number) => string,
  signal: AbortSignal,
): SpeedLabels {
  let host: HTMLElement | null = null;
  let layer: HTMLElement | null = null;
  const shown = new Map<HTMLVideoElement, Shown>();

  signal.addEventListener(
    'abort',
    () => {
      for (const { timer } of shown.values()) clearTimeout(timer);
      shown.clear();
      host?.remove();
    },
    { once: true },
  );

  /** The popover the labels go in, created on first use and put back if the page removed it. */
  function layerFor(): HTMLElement | null {
    const root = doc.documentElement;
    if (!root) return null;
    if (!host || !layer) {
      host = doc.createElement(HOST_TAG);
      host.setAttribute('style', HOST_STYLE);
      host.setAttribute('aria-hidden', 'true');
      const shadow = host.attachShadow({ mode: 'closed' });
      const style = doc.createElement('style');
      style.textContent = SHADOW_STYLE;
      layer = doc.createElement('div');
      layer.className = 'layer';
      layer.setAttribute('popover', 'manual');
      shadow.append(style, layer);
    }
    if (!host.isConnected) root.append(host);
    return layer;
  }

  /** Opens the layer, or re-opens it so it's above whatever reached the top layer since. */
  function raise(target: HTMLElement): void {
    try {
      if (target.matches(':popover-open')) target.hidePopover();
      target.showPopover();
    } catch {
      // No popover support, or the host was detached mid-way: the label just won't show.
    }
  }

  function remove(video: HTMLVideoElement): void {
    const entry = shown.get(video);
    if (!entry) return;
    entry.label.remove();
    shown.delete(video);
    if (shown.size === 0 && layer?.matches(':popover-open')) layer.hidePopover();
  }

  return {
    show(video, speed) {
      if (signal.aborted) return;
      const view = doc.defaultView;
      if (!view) return;
      const rect = video.getBoundingClientRect();
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        rect.right > 0 &&
        rect.bottom > 0 &&
        rect.left < view.innerWidth &&
        rect.top < view.innerHeight &&
        (typeof video.checkVisibility !== 'function' || video.checkVisibility());
      if (!visible) return;

      const target = layerFor();
      if (!target) return;
      const previous = shown.get(video);
      if (previous) clearTimeout(previous.timer);
      const label = previous?.label ?? target.appendChild(doc.createElement('div'));
      label.className = 'label';
      label.textContent = format(speed);
      label.style.left = `${Math.max(rect.left, 0) + INSET_PX}px`;
      label.style.top = `${Math.max(rect.top, 0) + INSET_PX}px`;
      const entry: Shown = {
        label,
        timer: setTimeout(() => {
          label.classList.add('fading');
          entry.timer = setTimeout(() => remove(video), LABEL_FADE_MS);
        }, LABEL_SHOW_MS),
      };
      shown.set(video, entry);
      raise(target);
    },
  };
}
