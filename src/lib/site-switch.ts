/**
 * The popup's on/off switch for the page site (SPEC §1, ADR-0004): what it shows for the
 * active tab, and the rule it adds or removes. The switch only ever writes the exact-hostname
 * rule; `*.` rules are made and removed on the options page.
 *
 * When there's nothing to switch, it says why (SPEC §2.2): site access is withheld, or the page
 * is one extensions can't run on. Without the `tabs` permission the popup only sees a tab's URL
 * when it has access to the tab, so a hidden URL means one of three things: access is withheld,
 * the page is a browser page, or (with Chrome's file access off) it's a local file. Access comes
 * first: once it's granted, the URL shows and the rest follows.
 */
import { isSiteDisabled, type SiteRule } from './settings';
import { matchesSite, normalizeHost, type SitePattern } from './site-patterns';

export type SiteSwitch =
  /** Videos on the page site play at the default speed. Off adds `pattern`. */
  | { state: 'on'; site: string; pattern: SitePattern }
  /** The exact-hostname rule `pattern` turns the site off. On removes it. */
  | { state: 'off'; site: string; pattern: SitePattern }
  /** A `*.` rule turns the site off, which the switch can't undo. */
  | { state: 'locked'; site: string; by: SitePattern }
  /** Nothing to switch, for one of `UnavailableReason`. */
  | { state: 'unavailable'; reason: UnavailableReason };

export type UnavailableReason =
  /** The browser withholds site access (Chrome's "on click" or specific sites, `about:addons`). */
  | 'noAccess'
  /** A browser page: settings, new tab, `about:`, an extension's own pages. */
  | 'browserPage'
  /** The URL is hidden with access granted and file access off: a browser page or a local file. */
  | 'browserPageOrFile'
  /** The Chrome Web Store or addons.mozilla.org. */
  | 'store'
  /** A local file, which the browser shows but doesn't let the extension run on. */
  | 'noFileAccess'
  /** A page with no hostname (`file:`), so no rule can match it. */
  | 'noSite';

/** What the browser lets the extension run on, as far as the tab at hand goes. */
export interface PageAccess {
  /** `permissions.contains` for `accessOrigins(url)`. */
  site: boolean;
  /** Whether it runs on local files: `runsOnFiles()`. */
  files: boolean;
}

/** Firefox 153 made local-file access a switch of its own, off by default. */
const FIREFOX_FILE_SWITCH = 153;

/**
 * `PageAccess.files` for a tab at `url` (undefined when hidden): whether the extension runs on
 * local files, as far as that tab goes. It comes from `extension.isAllowedFileSchemeAccess()`
 * and, on Firefox, the version (`runtime.getBrowserInfo()`). The call reports Chrome's "Allow
 * access to file URLs" and Firefox 153+'s "Access local files on your computer". Older Firefox
 * has no switch: it runs on files with site access, yet the call always answers false.
 *
 * Chrome hides a file's URL when it can't run there, so a hidden URL may be a file. Firefox
 * shows file URLs either way, so on Firefox only a `file:` URL is a file.
 */
export function runsOnFiles(url: string | undefined, allowed: boolean, firefoxVersion: string | undefined): boolean {
  if (allowed || firefoxVersion === undefined) return allowed;
  if (parseUrl(url)?.protocol !== 'file:') return true;
  const major = Number.parseInt(firefoxVersion, 10);
  return Number.isFinite(major) && major < FIREFOX_FILE_SWITCH;
}

/**
 * Pages the browsers never run extensions on, beyond non-web schemes: the Chrome Web Store
 * (both addresses) and addons.mozilla.org.
 */
const STORE_PAGES: readonly { host: string; path?: string }[] = [
  { host: 'chromewebstore.google.com' },
  { host: 'chrome.google.com', path: '/webstore' },
  { host: 'addons.mozilla.org' },
];

/** The switch for a tab at `url` (undefined when the browser hides it from us). */
export function siteSwitch(
  url: string | undefined,
  rules: ReadonlyMap<SitePattern, SiteRule>,
  access: PageAccess,
): SiteSwitch {
  const parsed = parseUrl(url);
  if (!parsed) {
    if (!access.site) return unavailable('noAccess');
    return unavailable(access.files ? 'browserPage' : 'browserPageOrFile');
  }
  if (isStorePage(parsed)) return unavailable('store');
  if (!isWebOrFile(parsed)) return unavailable('browserPage');
  if (!access.site) return unavailable('noAccess');
  if (parsed.protocol === 'file:' && !access.files) return unavailable('noFileAccess');

  const site = normalizeHost(parsed.hostname);
  if (!site) return unavailable('noSite');

  for (const [pattern, rule] of rules) {
    if (rule.disabled && pattern.startsWith('*.') && matchesSite(pattern, site)) {
      return { state: 'locked', site, by: pattern };
    }
  }
  return { state: isSiteDisabled(rules, site) ? 'off' : 'on', site, pattern: site };
}

/**
 * The origins whose access decides the switch for a tab at `url`: its own site on any port,
 * file access for a `file:` page, and every site when the URL is hidden.
 */
export function accessOrigins(url: string | undefined): string[] {
  const parsed = parseUrl(url);
  if (parsed?.protocol === 'file:') return ['file:///*'];
  if (parsed && isWebOrFile(parsed)) return [`${parsed.protocol}//${parsed.hostname}/*`];
  return ['<all_urls>'];
}

function unavailable(reason: UnavailableReason): SiteSwitch {
  return { state: 'unavailable', reason };
}

function parseUrl(url: string | undefined): URL | null {
  if (!url) return null;
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** Pages content scripts can run on: the web and, given access, local files. */
function isWebOrFile(url: URL): boolean {
  return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'file:';
}

function isStorePage(url: URL): boolean {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  const host = url.hostname.toLowerCase();
  return STORE_PAGES.some((page) => page.host === host && (!page.path || url.pathname.startsWith(page.path)));
}
