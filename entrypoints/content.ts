import { reportFrame } from '../src/content/frame-report';
import { watchFrameSettings } from '../src/content/frame-settings';
import { createSpeedEngine, type EngineSettings } from '../src/content/speed-engine';
import { createSpeedLabels } from '../src/content/speed-label';
import { trackUserInput } from '../src/content/user-input';
import { watchForVideos } from '../src/content/video-finder';
import { isSpeedCommandMessage } from '../src/lib/speed-commands';

// Every frame of every page, before page scripts run (SPEC §5, ADR-0003).
export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  matchAboutBlank: true,
  runAt: 'document_start',
  async main(ctx) {
    // Input is tracked from document_start, before any page script can hide it.
    const lastInputAt = trackUserInput(window, ctx.signal);

    let onSettings = (_next: EngineSettings) => {};
    const settings = await watchFrameSettings((next) => onSettings(next), ctx.signal);
    if (ctx.isInvalid) return;

    // The tab's speed, for the badge and the popup: this frame's video, or, from the top frame
    // only, that the page site is disabled.
    const isTop = window.top === window;
    let enabled = settings.enabled;
    const reporter = reportFrame(() => {
      if (isTop && !enabled) return { off: true, video: null };
      const video = engine.frameVideo();
      return video ? { off: false, video } : null;
    }, ctx.signal);

    const engine = createSpeedEngine({ ...settings, lastInputAt, onChange: reporter.changed, signal: ctx.signal });
    let finding = false;
    const findVideos = () => {
      if (finding) return;
      finding = true;
      watchForVideos(document, (video) => engine.track(video), ctx.signal);
    };

    // Rule 6, live. A site turned on after load starts the finder, which picks up every video.
    onSettings = (next) => {
      enabled = next.enabled;
      engine.applySettings(next);
      if (next.enabled) findVideos();
    };
    // On a disabled page site nothing runs until the site is turned back on (rule 1).
    if (settings.enabled) findVideos();
    reporter.changed();

    // Rule 5: a shortcut or the popup's −/+, sent to every frame in the tab. Each frame moves
    // its own videos and labels the ones the user can see.
    const labels = createSpeedLabels(
      document,
      (speed) => browser.i18n.getMessage('speedValue', [String(speed)]),
      ctx.signal,
    );
    const onMessage = (message: unknown) => {
      if (!isSpeedCommandMessage(message)) return;
      for (const { video, speed } of engine.control(message.command)) labels.show(video, speed);
    };
    browser.runtime.onMessage.addListener(onMessage);
    ctx.signal.addEventListener('abort', () => browser.runtime.onMessage.removeListener(onMessage), { once: true });
  },
});
