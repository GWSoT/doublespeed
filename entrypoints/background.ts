import { createTabBadges } from '../src/background/tab-badges';
import { ACCESS_GRANT_KEY, tabToReload } from '../src/lib/access-grant';
import { hostOfUrl, isGetPageSite } from '../src/lib/page-site';
import { installSeed, SETTINGS_KEY } from '../src/lib/settings';
import { isSpeedCommand, speedCommandMessage } from '../src/lib/speed-commands';
import { isCheckTabMessage, isFrameStateMessage } from '../src/lib/tab-speed';

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
  // The popup, before it shows a tab's speed: drop the reports of pages the tab has left.
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isCheckTabMessage(message)) return;
    void badges.check(message.tabId).then(() => sendResponse(true));
    return true;
  });

  // The popup's grant button (SPEC §2.2): once site access comes back, reload the tab the user
  // asked from, since its content scripts only arrive with the next load.
  browser.permissions.onAdded.addListener(async ({ origins }) => {
    if (!origins?.length) return;
    try {
      const request = (await browser.storage.session.get(ACCESS_GRANT_KEY))[ACCESS_GRANT_KEY];
      await browser.storage.session.remove(ACCESS_GRANT_KEY);
      const tabId = tabToReload(request, Date.now());
      if (tabId !== null) await browser.tabs.reload(tabId);
    } catch {
      // The tab closed meanwhile: nothing to reload.
    }
  });

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
