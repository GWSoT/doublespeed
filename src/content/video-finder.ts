/**
 * Finds every `<video>` in this frame (SPEC §5): in the document, in open and closed shadow
 * roots, and ones added later. Other frames run their own copy of the content script.
 *
 * It never polls. It reacts to DOM mutations, to the page's load milestones, and to the
 * user's clicks:
 * - Every reachable shadow root gets its own `MutationObserver`, because mutations inside a
 *   shadow tree don't reach an observer on the document.
 * - A custom element can get its shadow root after it's inserted, when it's defined later.
 *   Those are checked again at `DOMContentLoaded` and `load`, and on any click that lands
 *   inside them.
 * - Capture-phase `loadstart`/`play` listeners catch light-DOM videos however they appear.
 */

export type OnVideo = (video: HTMLVideoElement) => void;

const HTML_NS = 'http://www.w3.org/1999/xhtml';

/**
 * `onMoved` is called once per mutation batch that removed nodes or put back a video or shadow
 * root already seen, since either can take a video out of the page or bring it back without a
 * media event.
 */
export function watchForVideos(doc: Document, onVideo: OnVideo, signal: AbortSignal, onMoved?: () => void): void {
  const observedRoots = new WeakSet<Document | ShadowRoot>();
  const seenVideos = new WeakSet<HTMLVideoElement>();
  /** Set while scanning a batch when a video or shadow root already seen turns up again. */
  let sawKnown = false;
  /** Custom elements seen without a shadow root, re-checked until the page has loaded. */
  let rootless: Set<Element> | null = new Set();

  const observer = new MutationObserver((records) => {
    let moved = false;
    sawKnown = false;
    for (const record of records) {
      if (record.removedNodes.length) moved = true;
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) scan(node as Element);
      }
    }
    if ((moved || sawKnown) && onMoved) onMoved();
  });
  signal.addEventListener('abort', () => observer.disconnect(), { once: true });

  function observeRoot(root: Document | ShadowRoot): void {
    if (observedRoots.has(root)) {
      // A player put back into the page: the tree walk doesn't enter its shadow root.
      sawKnown = true;
      return;
    }
    observedRoots.add(root);
    observer.observe(root, { childList: true, subtree: true });
    scan(root);
  }

  function scan(node: Element | Document | ShadowRoot): void {
    if (node.nodeType === Node.ELEMENT_NODE) visit(node as Element);
    const walker = doc.createTreeWalker(node, NodeFilter.SHOW_ELEMENT);
    for (let el = walker.nextNode(); el; el = walker.nextNode()) visit(el as Element);
  }

  function visit(el: Element): void {
    if (isVideo(el)) {
      if (seenVideos.has(el)) {
        sawKnown = true;
      } else {
        seenVideos.add(el);
        onVideo(el);
      }
    }
    checkHost(el);
  }

  function checkHost(el: Element): void {
    const root = shadowRootOf(el);
    if (root) {
      rootless?.delete(el);
      observeRoot(root);
    } else if (rootless && isCustomElement(el)) {
      rootless.add(el);
    }
  }

  function recheckRootless(): void {
    if (rootless) for (const el of [...rootless]) checkHost(el);
  }

  const listen = { capture: true, passive: true, signal };

  if (doc.readyState === 'complete') {
    // Injected into a frame that has already loaded (an about:blank frame, an extension
    // update): load won't fire again, so clicks are the only re-check from the start.
    rootless = null;
  } else {
    doc.addEventListener('DOMContentLoaded', recheckRootless, { once: true, signal });
    doc.defaultView?.addEventListener(
      'load',
      () => {
        recheckRootless();
        rootless = null; // After load, clicks are the only re-check; nothing accumulates.
      },
      { once: true, signal },
    );
  }

  // A click inside a player whose shadow root we haven't seen: its host is in the path.
  doc.addEventListener(
    'pointerdown',
    (event) => {
      for (const target of event.composedPath()) {
        if (target instanceof Element) checkHost(target);
      }
    },
    listen,
  );

  // Light-DOM videos that start loading or playing before the observer gets to them.
  for (const type of ['loadstart', 'play'] as const) {
    doc.addEventListener(
      type,
      (event) => {
        const target = event.target;
        if (target instanceof Element) visit(target);
      },
      listen,
    );
  }

  observeRoot(doc);
}

function isVideo(el: Element): el is HTMLVideoElement {
  return el.localName === 'video' && el.namespaceURI === HTML_NS;
}

function isCustomElement(el: Element): boolean {
  return el.localName.includes('-');
}

interface DomApi {
  openOrClosedShadowRoot(element: HTMLElement): ShadowRoot | null | undefined;
}
/** Firefox exposes closed roots to content scripts as a read-only property, not a method. */
type FirefoxElement = Element & { readonly openOrClosedShadowRoot?: ShadowRoot | null };

/**
 * An element's shadow root, open or closed. Content scripts may read closed roots: Chrome
 * through `chrome.dom.openOrClosedShadowRoot(element)`, Firefox through the
 * `element.openOrClosedShadowRoot` property. The closed lookup only runs for custom elements,
 * where players keep their closed roots, to keep the per-element cost low.
 */
function shadowRootOf(el: Element): ShadowRoot | null {
  if (el.shadowRoot) return el.shadowRoot;
  if (!isCustomElement(el)) return null;
  try {
    const dom = (globalThis as { chrome?: { dom?: DomApi } }).chrome?.dom;
    if (dom?.openOrClosedShadowRoot && el instanceof HTMLElement) return dom.openOrClosedShadowRoot(el) ?? null;
    return (el as FirefoxElement).openOrClosedShadowRoot ?? null;
  } catch {
    // Not a valid shadow host.
  }
  return null;
}
