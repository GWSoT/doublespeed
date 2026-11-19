/**
 * Tells the background what this frame has to show for the tab's speed (SPEC §1, Badge): its
 * video, or that the page site is disabled. The background picks across the tab's frames.
 *
 * - Sends only when the report changes, and nothing from a frame that never had anything to
 *   show, so pages without videos never wake the background.
 * - Leaving the page (`pagehide`) withdraws the report. Coming back from the back/forward cache
 *   (`pageshow`) sends it again.
 * - A page the browser prerenders reports only once it's shown (`prerenderingchange`): until
 *   then it isn't the page in the tab, and Chrome gives its top frame another `frameId`.
 * - All three are listened to from document_start, before any page script registers its own,
 *   so a page's listener can't stop them reaching this frame's reporter. Being first is what
 *   counts; the capture phase, on the window, keeps it so against a page's capture listeners
 *   on the window.
 * - Reports carry an id for this document, so the background can tell a late report or
 *   withdrawal from the page the tab just left apart from the new page in the same frame. A page
 *   back from the cache takes a new id, so nothing said about it before it left can touch its new
 *   report.
 * - Asked which document the frame holds (`FrameDocQuery`), it answers with that id, or `null`
 *   once the page is hidden, so the background can drop a report whose withdrawal never arrived.
 */
import { isFrameDocQuery, type FrameState, type FrameStateMessage } from '../lib/tab-speed';

export interface FrameReporter {
  /** Something changed that may change the report; sends it, at most once per task. */
  changed(): void;
}

/** Chrome's `document.prerendering`; Firefox doesn't prerender, and TypeScript's DOM types lack it. */
type PrerenderingDocument = Document & { prerendering?: boolean };

/** A new document id. `crypto.randomUUID` needs a secure context, which plain-http pages aren't. */
function newDoc(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function reportFrame(read: () => FrameState | null, signal: AbortSignal, win: Window = window): FrameReporter {
  const document = win.document as PrerenderingDocument;
  let doc = newDoc();
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
    if (hidden || signal.aborted || document.prerendering === true) return;
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

  const listen = { capture: true, signal };
  win.addEventListener(
    'pagehide',
    () => {
      hidden = true;
      if (sent === 'null') return;
      sent = 'null';
      send(null);
    },
    listen,
  );
  if (document.prerendering === true) {
    // Fired at the document; its capture path runs through the window first.
    win.addEventListener('prerenderingchange', () => reporter.changed(), { ...listen, once: true });
  }
  win.addEventListener(
    'pageshow',
    (event) => {
      if (!event.persisted) return;
      // A new id needs a new report, even when this frame never saw its `pagehide` (a page
      // script can stop it) and so never withdrew the old one.
      doc = newDoc();
      sent = 'null';
      hidden = false;
      reporter.changed();
    },
    listen,
  );
  return reporter;
}
