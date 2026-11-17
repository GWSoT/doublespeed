/**
 * The options page's site list (SPEC §1, ADR-0004): the disabled sites as it lists them, and
 * the check its Add site field runs before writing a rule. The `*.` form is only made here; the
 * popup's switch only ever writes exact hostnames.
 */
import type { SiteRule } from './settings';
import { matchesSite, parseSiteInput, type SitePattern } from './site-patterns';

export interface SiteListEntry {
  pattern: SitePattern;
  /** The hostname, without the `*.`. */
  host: string;
  /** Whether the rule also covers every subdomain. */
  wildcard: boolean;
}

/** The rules that turn a site off, sorted by hostname; the exact rule first on a tie. */
export function siteList(rules: ReadonlyMap<SitePattern, SiteRule>): SiteListEntry[] {
  const entries: SiteListEntry[] = [];
  for (const [pattern, rule] of rules) {
    if (!rule.disabled) continue;
    const wildcard = pattern.startsWith('*.');
    entries.push({ pattern, host: wildcard ? pattern.slice(2) : pattern, wildcard });
  }
  return entries.sort((a, b) => compare(a.host, b.host) || Number(a.wildcard) - Number(b.wildcard));
}

export type AddSiteCheck =
  /** `pattern` can be added. */
  | { ok: true; pattern: SitePattern; host: string; wildcard: boolean }
  /** Nothing typed yet. */
  | { ok: false; reason: 'empty' }
  /** Not a website address. */
  | { ok: false; reason: 'invalid' }
  /** An IP address with Include subdomains ticked: it has none. */
  | { ok: false; reason: 'noSubdomains'; host: string }
  /** `pattern` is already in the list. */
  | { ok: false; reason: 'duplicate'; pattern: SitePattern }
  /** The `*.` rule `by` already turns off everything `pattern` would. */
  | { ok: false; reason: 'covered'; pattern: SitePattern; by: SitePattern };

/**
 * What adding `input` would do. `includeSubdomains` is the checkbox; typing `*.example.com` gives
 * the subdomain form without it.
 */
export function checkAddSite(
  input: string,
  includeSubdomains: boolean,
  rules: ReadonlyMap<SitePattern, SiteRule>,
): AddSiteCheck {
  let parsed = parseSiteInput(input);
  if (!parsed.ok) return { ok: false, reason: parsed.reason };
  if (includeSubdomains && !parsed.wildcard) {
    const host = parsed.host;
    parsed = parseSiteInput(`*.${host}`);
    if (!parsed.ok) return { ok: false, reason: 'noSubdomains', host };
  }

  const { pattern, host, wildcard } = parsed;
  if (rules.get(pattern)?.disabled) return { ok: false, reason: 'duplicate', pattern };
  for (const [other, rule] of rules) {
    // Only a `*.` rule covers more than its own pattern. For a `*.` pattern, covering its
    // hostname means covering its subdomains too.
    if (rule.disabled && other.startsWith('*.') && matchesSite(other, host)) {
      return { ok: false, reason: 'covered', pattern, by: other };
    }
  }
  return { ok: true, pattern, host, wildcard };
}

/**
 * Whether a failed `storage.sync` write failed because the list is full: the item count or the
 * total size. Chrome names the quota (`MAX_ITEMS quota exceeded`); Firefox says the call
 * "exceeded its quota limitations". Writing too often is a different, passing problem.
 */
export function isSyncFullError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (/WRITE_OPERATIONS/i.test(message)) return false;
  return /MAX_ITEMS|QUOTA_BYTES|quota/i.test(message);
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
