/**
 * When this frame last saw the user's own click, tap or keypress (SPEC §3.2 rule 3). Only
 * trusted events count, so a page can't fake one. Listens on the window in the capture
 * phase, registered at document_start before any page script, so pages can't hide input
 * from it by stopping propagation.
 */
export function trackUserInput(win: Window, signal: AbortSignal): () => number | null {
  let lastAt: number | null = null;
  const record = (event: Event) => {
    if (event.isTrusted) lastAt = performance.now();
  };
  for (const type of ['pointerdown', 'keydown'] as const) {
    win.addEventListener(type, record, { capture: true, passive: true, signal });
  }
  return () => lastAt;
}
