import { hostOfUrl, isGetPageSite } from '../src/lib/page-site';
import { installSeed, SETTINGS_KEY } from '../src/lib/settings';

// The service worker on Chrome, an event page on Firefox (SPEC §5). Listeners are registered
// synchronously, so the browser can wake it for each event.
export default defineBackground(() => {
  // Install seeding (SPEC §4): 2× and the seeded disabled sites, unless sync already brought
  // the user's settings from another browser.
  browser.runtime.onInstalled.addListener(async ({ reason }) => {
    if (reason !== 'install') return;
    const existing = await browser.storage.sync.get(SETTINGS_KEY);
    const seed = installSeed(existing, new Date());
    if (Object.keys(seed).length) await browser.storage.sync.set(seed);
  });

  // The page site for a frame: the hostname in its tab's address bar (ADR-0004).
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isGetPageSite(message)) return;
    // `sendResponse` rather than a returned promise: Chrome 120 doesn't take promises here.
    sendResponse(hostOfUrl(sender.tab?.url));
  });
});
