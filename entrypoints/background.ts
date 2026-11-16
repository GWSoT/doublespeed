import { createTabBadges } from '../src/background/tab-badges';
import { hostOfUrl, isGetPageSite } from '../src/lib/page-site';
import { installSeed, SETTINGS_KEY } from '../src/lib/settings';
import { isSpeedCommand, speedCommandMessage } from '../src/lib/speed-commands';
import { isFrameStateMessage } from '../src/lib/tab-speed';

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

  // The badge: every frame reports its video, and the badge shows the tab's (SPEC §1).
  const badges = createTabBadges();
  browser.runtime.onMessage.addListener((message, sender) => {
    const tabId = sender.tab?.id;
    if (!isFrameStateMessage(message) || tabId === undefined) return;
    badges.report(tabId, sender.frameId ?? 0, message.doc, message.state);
  });
  browser.tabs.onRemoved.addListener((tabId) => badges.forget(tabId));

  // The shortcuts (ADR-0005). With no `frameId`, the message reaches every frame in the tab.
  browser.commands.onCommand.addListener(async (command, tab) => {
    if (!isSpeedCommand(command)) return;
    const tabId = tab?.id ?? (await browser.tabs.query({ active: true, currentWindow: true }))[0]?.id;
    if (tabId === undefined) return;
    try {
      await browser.tabs.sendMessage(tabId, speedCommandMessage(command));
    } catch {
      // No content script in the tab: a browser page, a store, or a tab loaded before install.
    }
  });
});
