/**
 * The tab's speed (SPEC §1, Badge and Popup): the speed of the video playing in the tab, or the
 * one played last, from whichever frame it's in. `off` on a disabled site; nothing on a tab
 * without a video.
 *
 * Each frame reports its own video to the background (`FrameStateMessage`), which keeps every
 * frame's report for the tab in `storage.session` (`tabKey`) and picks across them. Pure
 * functions here, so the picking is unit tested without a browser.
 */

/** A frame's video, the one `pickVideo` chose among the frame's own. */
export interface FrameVideo {
  /** Its current `playbackRate`. */
  speed: number;
  playing: boolean;
  /** When it last started playing, in ms since the epoch; 0 if it never has. */
  playedAt: number;
}

export interface FrameState {
  /** The page site is disabled. Only the top frame reports it, so ad frames don't wake the background. */
  off: boolean;
  video: FrameVideo | null;
}

/**
 * A frame's report. `doc` is a random id per document, and new after a restore from the
 * back/forward cache, so a late `null` from the page the tab just left can't erase what the new
 * page in the same frame has reported.
 */
export interface FrameStateMessage {
  type: 'frameState';
  doc: string;
  /** `null`: nothing to show from this frame (no video, or the document is going away). */
  state: FrameState | null;
}

/**
 * Asks one frame, through `tabs.sendMessage` with its `frameId`, which document it holds. The
 * frame's content script answers with that document's report as it last sent it, a
 * `FrameStateMessage` (`state` is `null` when it has sent none), or `null` once that document is
 * going away.
 */
export interface FrameDocQuery {
  type: 'frameDoc';
}

/**
 * From the popup, before it reads a tab's reports: drop the stale ones. Answered once every
 * frame has answered, or half a second after they're asked.
 */
export interface CheckTabMessage {
  type: 'checkTab';
  tabId: number;
}

/** What the background keeps per frame. */
export interface StoredFrame extends FrameState {
  doc: string;
}

/** A tab's frames by `frameId`; 0 is the top frame. */
export type TabFrames = Readonly<Record<string, StoredFrame>>;

export type TabSpeed = { kind: 'none' } | { kind: 'off' } | { kind: 'speed'; speed: number };

/** The `storage.session` key holding a tab's frames. */
export function tabKey(tabId: number): string {
  return `tab:${tabId}`;
}

/**
 * The video a frame, or a tab, shows: the playing one that started last, else the one played
 * last, else the first, which for a tab is the top frame's.
 */
export function pickVideo<T extends FrameVideo>(videos: Iterable<T>): T | null {
  let best: T | null = null;
  for (const video of videos) {
    if (!best || (video.playing === best.playing ? video.playedAt > best.playedAt : video.playing)) best = video;
  }
  return best;
}

/** `frames` after one frame's report. */
export function applyReport(frames: TabFrames, frameId: number, doc: string, state: FrameState | null): TabFrames {
  const key = String(frameId);
  if (state) return { ...frames, [key]: { doc, off: state.off, video: state.video } };
  if (frames[key]?.doc !== doc) return frames;
  const { [key]: _gone, ...rest } = frames;
  return rest;
}

/**
 * `frames` after a frame, asked about its report from `doc`, answers with the document it holds
 * (`FrameDocQuery`). When that's another document, or none, the withdrawal for `doc` never
 * arrived, so its report goes; and the report of the document the frame does hold takes its
 * place, since `doc`'s may have arrived after it and replaced it. A report that came in since
 * the question, from any document, stays.
 */
export function applyAnswer(
  frames: TabFrames,
  frameId: number,
  doc: string,
  answer: FrameStateMessage | null,
): TabFrames {
  if (answer?.doc === doc) return frames;
  const without = applyReport(frames, frameId, doc, null);
  if (without === frames || !answer?.state) return without;
  return applyReport(without, frameId, answer.doc, answer.state);
}

export function tabSpeed(frames: TabFrames): TabSpeed {
  const ordered = Object.keys(frames)
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => frames[key]!);
  if (ordered.some((frame) => frame.off)) return { kind: 'off' };
  const video = pickVideo(ordered.flatMap((frame) => (frame.video ? [frame.video] : [])));
  return video ? { kind: 'speed', speed: roundSpeed(video.speed) } : { kind: 'none' };
}

/** A speed as people read it: at most two decimals, so a site's 1.1000000001 reads 1.1. */
export function roundSpeed(speed: number): number {
  return Math.round(speed * 100) / 100;
}

/**
 * The badge's text. A whole speed keeps its × (`2×`); any other drops it to fit (`2.25`, `1.5`).
 * `wholeSpeed` and `off` come from the i18n messages.
 */
export function badgeText(tab: TabSpeed, off: string, wholeSpeed: (speed: string) => string): string {
  switch (tab.kind) {
    case 'none':
      return '';
    case 'off':
      return off;
    case 'speed':
      return Number.isInteger(tab.speed) ? wholeSpeed(String(tab.speed)) : String(tab.speed);
  }
}

export function isFrameStateMessage(message: unknown): message is FrameStateMessage {
  if (!isRecord(message) || message.type !== 'frameState' || typeof message.doc !== 'string') return false;
  return message.state === null || isFrameState(message.state);
}

export function isFrameDocQuery(message: unknown): message is FrameDocQuery {
  return isRecord(message) && message.type === 'frameDoc';
}

export function isCheckTabMessage(message: unknown): message is CheckTabMessage {
  return isRecord(message) && message.type === 'checkTab' && Number.isInteger(message.tabId);
}

/** Reads a tab's frames from `storage.session`, dropping anything malformed. */
export function parseTabFrames(raw: unknown): TabFrames {
  if (!isRecord(raw)) return {};
  const frames: Record<string, StoredFrame> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (/^\d+$/.test(key) && isFrameState(value) && typeof (value as { doc?: unknown }).doc === 'string') {
      frames[key] = value as StoredFrame;
    }
  }
  return frames;
}

function isFrameState(value: unknown): value is FrameState {
  if (!isRecord(value) || typeof value.off !== 'boolean') return false;
  const video = value.video;
  return (
    video === null ||
    (isRecord(video) &&
      typeof video.speed === 'number' &&
      Number.isFinite(video.speed) &&
      typeof video.playing === 'boolean' &&
      typeof video.playedAt === 'number')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
