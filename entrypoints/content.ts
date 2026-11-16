import { createSpeedEngine } from '../src/content/speed-engine';
import { trackUserInput } from '../src/content/user-input';
import { watchForVideos } from '../src/content/video-finder';
import { INSTALL_DEFAULT_SPEED } from '../src/lib/speed';

// Every frame of every page, before page scripts run (SPEC §5, ADR-0003).
export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  matchAboutBlank: true,
  runAt: 'document_start',
  main(ctx) {
    const lastInputAt = trackUserInput(window, ctx.signal);
    const engine = createSpeedEngine({ defaultSpeed: () => INSTALL_DEFAULT_SPEED, lastInputAt, signal: ctx.signal });
    watchForVideos(document, (video) => engine.track(video), ctx.signal);
  },
});
