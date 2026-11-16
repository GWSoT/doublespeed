/**
 * The `storage.sync` schema (SPEC §4) and the reads built on it: what a frame needs to apply
 * the rules, live changes, and install seeding. Pure functions over plain storage items, so
 * they're unit tested without a browser; the entrypoints do the actual reads and writes.
 *
 * - `settings` holds `{ v: 1, defaultSpeed, shortcutHintDismissed }`.
 * - Each site rule is its own `site:<pattern>` item holding `{ disabled, added }`, so the list
 *   never hits the 8 KB per-item limit (ADR-0004).
 *
 * Anything missing or malformed falls back to the defaults, so a frame never fails to start
 * over a bad item.
 */
import { matchesSite, type SitePattern } from './site-patterns';
import { INSTALL_DEFAULT_SPEED, isValidSpeed } from './speed';

export interface Settings {
  v: 1;
  defaultSpeed: number;
  shortcutHintDismissed: boolean;
}

export interface SiteRule {
  disabled: boolean;
  /** When the rule was added, as an ISO 8601 string. */
  added: string;
}

/** The items as `storage.sync.get(null)` returns them. */
export type StorageItems = Record<string, unknown>;
/** A `storage.onChanged` batch; a missing `newValue` means the item was removed. */
export type StorageChanges = Record<string, { newValue?: unknown }>;

export const SETTINGS_KEY = 'settings';
const SITE_KEY_PREFIX = 'site:';

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  v: 1,
  defaultSpeed: INSTALL_DEFAULT_SPEED,
  shortcutHintDismissed: false,
};

/** Sites disabled on install (ADR-0004): YouTube Music plays music through a `<video>`. */
export const SEEDED_DISABLED_SITES: readonly SitePattern[] = ['music.youtube.com'];

export function siteKey(pattern: SitePattern): string {
  return `${SITE_KEY_PREFIX}${pattern}`;
}

/** The pattern a storage key holds a rule for, or `null` for any other key. */
export function patternOfKey(key: string): SitePattern | null {
  return key.startsWith(SITE_KEY_PREFIX) && key.length > SITE_KEY_PREFIX.length
    ? key.slice(SITE_KEY_PREFIX.length)
    : null;
}

/** Reads the `settings` item, field by field: each missing or invalid field gets its default. */
export function parseSettings(raw: unknown): Settings {
  const value = isRecord(raw) ? raw : {};
  return {
    v: 1,
    defaultSpeed: isValidSpeed(value.defaultSpeed) ? value.defaultSpeed : DEFAULT_SETTINGS.defaultSpeed,
    shortcutHintDismissed:
      typeof value.shortcutHintDismissed === 'boolean'
        ? value.shortcutHintDismissed
        : DEFAULT_SETTINGS.shortcutHintDismissed,
  };
}

/** Reads a `site:<pattern>` item; `null` when it isn't a rule at all. */
export function parseSiteRule(raw: unknown): SiteRule | null {
  if (!isRecord(raw)) return null;
  return {
    disabled: raw.disabled === true,
    added: typeof raw.added === 'string' ? raw.added : '',
  };
}

/** What a frame keeps from storage to apply the rules. */
export interface Stored {
  settings: Settings;
  rules: ReadonlyMap<SitePattern, SiteRule>;
}

export function parseStored(items: StorageItems): Stored {
  const rules = new Map<SitePattern, SiteRule>();
  for (const [key, value] of Object.entries(items)) {
    const pattern = patternOfKey(key);
    const rule = pattern === null ? null : parseSiteRule(value);
    if (pattern !== null && rule) rules.set(pattern, rule);
  }
  return { settings: parseSettings(items[SETTINGS_KEY]), rules };
}

/** `stored` after a `storage.onChanged` batch. Unrelated keys leave it as it was. */
export function applyChanges(stored: Stored, changes: StorageChanges): Stored {
  let { settings, rules } = stored;
  for (const [key, change] of Object.entries(changes)) {
    if (key === SETTINGS_KEY) {
      settings = parseSettings(change.newValue);
      continue;
    }
    const pattern = patternOfKey(key);
    if (pattern === null) continue;
    const next = new Map(rules);
    const rule = parseSiteRule(change.newValue);
    if (rule) next.set(pattern, rule);
    else next.delete(pattern);
    rules = next;
  }
  return settings === stored.settings && rules === stored.rules ? stored : { settings, rules };
}

/** Whether a rule disables the page site `host` (SPEC §3.1 "disabled site"). */
export function isSiteDisabled(rules: ReadonlyMap<SitePattern, SiteRule>, host: string): boolean {
  if (!host) return false;
  for (const [pattern, rule] of rules) {
    if (rule.disabled && matchesSite(pattern, host)) return true;
  }
  return false;
}

/**
 * The items to write on install: the default settings and the seeded disabled sites. Nothing
 * when `settings` already exists, which means the user installed on another synced browser
 * first; their settings and site list win over the seed.
 */
export function installSeed(existing: StorageItems, now: Date): StorageItems {
  if (existing[SETTINGS_KEY] !== undefined) return {};
  const added = now.toISOString();
  const items: StorageItems = { [SETTINGS_KEY]: { ...DEFAULT_SETTINGS } };
  for (const pattern of SEEDED_DISABLED_SITES) items[siteKey(pattern)] = { disabled: true, added } satisfies SiteRule;
  return items;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
