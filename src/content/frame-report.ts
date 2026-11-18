/**
 * Tells the background what this frame has to show for the tab's speed (SPEC §1, Badge): its
 * video, or that the page site is disabled. The background picks across the tab's frames.
 *
 * - Sends only when the report changes, and nothing from a frame that never had anything to
 *   show, so pages without videos never wake the background.
 * - Leaving the page (`pagehide`) withdraws the report. Coming back from the back/forward cache
 *   (`pageshow`) sends it again.
 * - Reports carry an id for this document, so the background can tell a late withdrawal from
 *   the page the tab just left apart from the new page in the same frame.
 * - Asked which document the frame holds (`FrameDocQuery`), it answers with that id, so the
 *   background can drop a report whose withdrawal never arrived.
 */
import { isFrameDocQuery, type FrameState, type FrameStateMessage } from '../lib/tab-speed';

export interface FrameReporter {
  /** Something changed that may change the report; sends it, at most once per task. */
  changed(): void;
}

export function reportFrame(read: () => FrameState | null, signal: AbortSignal): FrameReporter {
  // `crypto.randomUUID` needs a secure context, which plain-http pages aren't.
  const doc = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  let sent = 'null';
  let scheduled = false;
  let hidden = false;

  function send(state: FrameState | null): void {
    const message: FrameStateMessage = { type: 'frameState', doc, state };
    try {
      browser.runtime.sendMessage(message).catch(() => {});
    } catch {
      // The extension was reloaded or updated, and this content script is orphaned.
    }
  }

  function flush(): void {
    scheduled = false;
    if (hidden || signal.aborted) return;
    const state = read();
    const json = JSON.stringify(state);
    if (json === sent) return;
    sent = json;
    send(state);
  }

  const reporter: FrameReporter = {
    changed() {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(flush);
    },
  };

  // Before the first report goes out, so the background can always ask about one it has.
  const answer = (message: unknown, _sender: unknown, sendResponse: (doc: string | null) => void) => {
    if (isFrameDocQuery(message)) sendResponse(hidden ? null : doc);
  };
  browser.runtime.onMessage.addListener(answer);
  signal.addEventListener('abort', () => browser.runtime.onMessage.removeListener(answer), { once: true });

  const listen = { signal };
  window.addEventListener(
    'pagehide',
    () => {
      hidden = true;
      if (sent === 'null') return;
      sent = 'null';
      send(null);
    },
    listen,
  );
  window.addEventListener(
    'pageshow',
    (event) => {
      if (!event.persisted) return;
      hidden = false;
      reporter.changed();
    },
    listen,
  );
  return reporter;
}
