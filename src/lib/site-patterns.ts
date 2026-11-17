/**
 * Site patterns (SPEC §3.1, ADR-0004).
 *
 * `example.com` matches that hostname exactly; `*.example.com` matches `example.com` and every
 * subdomain. A leading `www.` is ignored on both sides of a match.
 */

export type SitePattern = string;

export type ParsedSiteInput =
  | { ok: true; pattern: SitePattern; wildcard: boolean; host: string }
  | { ok: false; reason: 'empty' | 'invalid' };

const WILDCARD = '*.';

/** Lower-cases a hostname and drops a trailing dot and one leading `www.`. */
export function normalizeHost(host: string): string {
  let h = host.trim().toLowerCase().replace(/\.$/, '');
  if (h.startsWith('www.') && h.length > 4) h = h.slice(4);
  return h;
}

/**
 * Turns what a user typed or pasted (a full URL, a bare hostname, or `*.host`) into a site
 * pattern. Paths, queries, ports and credentials are dropped.
 */
export function parseSiteInput(input: string): ParsedSiteInput {
  let text = input.trim();
  if (!text) return { ok: false, reason: 'empty' };

  const wildcard = text.startsWith(WILDCARD);
  if (wildcard) text = text.slice(WILDCARD.length);

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text);
  if (wildcard && hasScheme) return { ok: false, reason: 'invalid' };

  let hostname: string;
  try {
    const url = new URL(hasScheme ? text : `https://${text}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, reason: 'invalid' };
    hostname = url.hostname;
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  const host = normalizeHost(hostname);
  if (!isHostname(host)) return { ok: false, reason: 'invalid' };
  if (wildcard && isIpAddress(host)) return { ok: false, reason: 'invalid' };

  return { ok: true, pattern: wildcard ? `${WILDCARD}${host}` : host, wildcard, host };
}

/** Whether `pattern` covers the page site `host`. */
export function matchesSite(pattern: SitePattern, host: string): boolean {
  const h = normalizeHost(host);
  if (pattern.startsWith(WILDCARD)) {
    const base = pattern.slice(WILDCARD.length);
    return h === base || h.endsWith(`.${base}`);
  }
  return h === pattern;
}

/**
 * Whether `host` is a hostname a site can have: dot-separated labels of letters, digits, `-` and
 * `_` (an international name arrives from `URL` in its `xn--` form), or a bracketed IPv6
 * address. `URL` alone doesn't settle it: Chrome's parser takes `https://not a site` and
 * percent-encodes the spaces into the hostname, where Node's throws.
 */
function isHostname(host: string): boolean {
  return /^[a-z0-9_-]+(\.[a-z0-9_-]+)*$/.test(host) || /^\[[0-9a-f:.]+\]$/.test(host);
}

function isIpAddress(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[');
}
