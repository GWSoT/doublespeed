/**
 * The page site (SPEC §3.1): the hostname in the tab's address bar, which decides the site
 * rules for every frame in the tab (ADR-0004). An iframe can't read it itself (Firefox has no
 * `location.ancestorOrigins`), so it asks the background, which reads `sender.tab.url`.
 */

export interface GetPageSiteMessage {
  type: 'getPageSite';
}

export const GET_PAGE_SITE: GetPageSiteMessage = { type: 'getPageSite' };

export function isGetPageSite(message: unknown): message is GetPageSiteMessage {
  return typeof message === 'object' && message !== null && (message as { type?: unknown }).type === 'getPageSite';
}

/** The hostname of a tab's URL; empty when there's none (no URL, `about:blank`, a bad URL). */
export function hostOfUrl(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}
