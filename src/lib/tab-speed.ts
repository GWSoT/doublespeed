/**
 * The tab's speed (SPEC §1, Badge and Popup): the speed of the video playing in the tab, or the
 * one played last, from whichever frame it's in. `off` on a disabled site; nothing on a tab
 * without a video.
 *
 * Each frame reports its own video to the background (`FrameStateMessage`), which keeps the tab's
 * reports in `storage.session` (`tabKey`) and picks across the frames. It keeps them per document,
 * not per frame: a late report from the page a frame just left would otherwise replace the new
 * page's (issue #34). Pure functions here, so the picking is unit tested without a browser.
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
 * back/forward cache, so a late report or `null` from the page the tab just left can't touch what
 * the new page in the same frame has reported.
 */
export interface FrameStateMessage {
  type: 'frameState';
  doc: string;
  /** `null`: nothing to show from this frame (no video, or the document is going away). */
  state: FrameState | null;
}

/**
 * Asks one frame, through `tabs.sendMessage` with its `frameId`, which document it holds. The
 * frame's content script answers with the `doc` of its reports, or `null` once that document is
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

/** One document's report, as the background keeps it. */
export interface StoredReport extends FrameState {
  doc: string;
}

/**
 * A tab's reports by `frameId`, 0 being the top frame: per frame, one per document, in the order
 * they arrived, the latest last. A frame counts by its latest; the others wait for a check to
 * drop them, since the background can't tell which document is the frame's until it asks.
 * Never an empty list.
 */
export type TabFrames = Readonly<Record<string, readonly StoredReport[]>>;

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

/**
 * `frames` after one document's report, which replaces that document's earlier one and becomes the
 * frame's latest, or its withdrawal (`null`). Either touches only `doc`'s own report, so nothing a
 * document says late can cost another its report. A withdrawal that removes nothing returns
 * `frames` itself.
 */
export function applyReport(frames: TabFrames, frameId: number, doc: string, state: FrameState | null): TabFrames {
  const key = String(frameId);
  const held = frames[key] ?? [];
  const others = held.filter((report) => report.doc !== doc);
  if (!state && others.length === held.length) return frames;
  const reports = state ? [...others, { doc, off: state.off, video: state.video }] : others;
  if (reports.length) return { ...frames, [key]: reports };
  const { [key]: _gone, ...rest } = frames;
  return rest;
}

/**
 * The tab's speed, each frame counting by its latest report. Until a check drops the reports of
 * the pages a frame has left, the latest can be one of theirs: the last to arrive, or the one
 * that's left when the new page withdraws its own first.
 */
export function tabSpeed(frames: TabFrames): TabSpeed {
  const latest = Object.keys(frames)
    .sort((a, b) => Number(a) - Number(b))
    .flatMap((key) => frames[key]!.slice(-1));
  if (latest.some((report) => report.off)) return { kind: 'off' };
  const video = pickVideo(latest.flatMap((report) => (report.video ? [report.video] : [])));
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

/**
 * Reads a tab's reports from `storage.session`, dropping anything malformed, and a frame left
 * with none. An earlier version's one report per frame reads as malformed: the browser empties
 * `storage.session` when the extension updates, so there's nothing to carry over.
 */
export function parseTabFrames(raw: unknown): TabFrames {
  if (!isRecord(raw)) return {};
  const frames: Record<string, StoredReport[]> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!/^\d+$/.test(key) || !Array.isArray(value)) continue;
    const reports = value.filter(isStoredReport);
    if (reports.length) frames[key] = reports;
  }
  return frames;
}

function isStoredReport(value: unknown): value is StoredReport {
  return isFrameState(value) && typeof (value as { doc?: unknown }).doc === 'string';
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
