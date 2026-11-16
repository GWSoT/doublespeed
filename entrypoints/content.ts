import { watchFrameSettings } from '../src/content/frame-settings';
import { createSpeedEngine, type EngineSettings } from '../src/content/speed-engine';
import { trackUserInput } from '../src/content/user-input';
import { watchForVideos } from '../src/content/video-finder';

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

    const engine = createSpeedEngine({ ...settings, lastInputAt, signal: ctx.signal });
    let finding = false;
    const findVideos = () => {
      if (finding) return;
      finding = true;
      watchForVideos(document, (video) => engine.track(video), ctx.signal);
    };

    // Rule 6, live. A site turned on after load starts the finder, which picks up every video.
    onSettings = (next) => {
      engine.applySettings(next);
      if (next.enabled) findVideos();
    };
    // On a disabled page site nothing runs until the site is turned back on (rule 1).
    if (settings.enabled) findVideos();
  },
});
