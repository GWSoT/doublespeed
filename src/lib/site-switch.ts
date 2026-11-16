/**
 * The popup's on/off switch for the page site (SPEC §1, ADR-0004): what it shows for the
 * active tab, and the rule it adds or removes. The switch only ever writes the exact-hostname
 * rule; `*.` rules are made and removed on the options page.
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
  /**
   * Nothing to switch. `restricted`: content scripts can't run on the page (browser pages, the
   * extension stores), or its URL is hidden from us. `noSite`: the page has no hostname
   * (`file:`), so no rule can match it.
   */
  | { state: 'unavailable'; reason: 'restricted' | 'noSite' };

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
export function siteSwitch(url: string | undefined, rules: ReadonlyMap<SitePattern, SiteRule>): SiteSwitch {
  const parsed = parseUrl(url);
  if (!parsed || isRestricted(parsed)) return { state: 'unavailable', reason: 'restricted' };

  const site = normalizeHost(parsed.hostname);
  if (!site) return { state: 'unavailable', reason: 'noSite' };

  for (const [pattern, rule] of rules) {
    if (rule.disabled && pattern.startsWith('*.') && matchesSite(pattern, site)) {
      return { state: 'locked', site, by: pattern };
    }
  }
  return { state: isSiteDisabled(rules, site) ? 'off' : 'on', site, pattern: site };
}

function parseUrl(url: string | undefined): URL | null {
  if (!url) return null;
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function isRestricted(url: URL): boolean {
  if (url.protocol === 'file:') return false;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return true;
  const host = url.hostname.toLowerCase();
  return STORE_PAGES.some((page) => page.host === host && (!page.path || url.pathname.startsWith(page.path)));
}
