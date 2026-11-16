import { describe, expect, it } from 'vitest';
import {
  applyChanges,
  DEFAULT_SETTINGS,
  installSeed,
  isSiteDisabled,
  parseSettings,
  parseSiteRule,
  parseStored,
  patternOfKey,
  siteKey,
} from './settings';

const ADDED = '2026-11-16T12:00:00.000Z';

describe('parseSettings', () => {
  it('gives the defaults when nothing is stored', () => {
    expect(parseSettings(undefined)).toEqual({ v: 1, defaultSpeed: 2, shortcutHintDismissed: false });
  });

  it('keeps valid stored values', () => {
    expect(parseSettings({ v: 1, defaultSpeed: 1.5, shortcutHintDismissed: true })).toEqual({
      v: 1,
      defaultSpeed: 1.5,
      shortcutHintDismissed: true,
    });
  });

  it('falls back field by field', () => {
    expect(parseSettings({ v: 1, defaultSpeed: 3 })).toEqual({ ...DEFAULT_SETTINGS, defaultSpeed: 3 });
    expect(parseSettings({ v: 1, shortcutHintDismissed: true })).toEqual({
      ...DEFAULT_SETTINGS,
      shortcutHintDismissed: true,
    });
  });

  it.each([0, 0.1, 4.5, -1, NaN, Infinity, '2', null])('rejects %s as a default speed', (defaultSpeed) => {
    expect(parseSettings({ v: 1, defaultSpeed }).defaultSpeed).toBe(2);
  });

  it('accepts both ends of the range', () => {
    expect(parseSettings({ defaultSpeed: 0.25 }).defaultSpeed).toBe(0.25);
    expect(parseSettings({ defaultSpeed: 4 }).defaultSpeed).toBe(4);
  });

  it('ignores a value that isn’t an object', () => {
    expect(parseSettings('2')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings([2])).toEqual(DEFAULT_SETTINGS);
  });
});

describe('site keys', () => {
  it('round-trips a pattern', () => {
    expect(siteKey('*.youtube.com')).toBe('site:*.youtube.com');
    expect(patternOfKey('site:*.youtube.com')).toBe('*.youtube.com');
  });

  it('ignores other keys', () => {
    expect(patternOfKey('settings')).toBeNull();
    expect(patternOfKey('site:')).toBeNull();
  });
});

describe('parseSiteRule', () => {
  it('reads a stored rule', () => {
    expect(parseSiteRule({ disabled: true, added: ADDED })).toEqual({ disabled: true, added: ADDED });
  });

  it('treats only `disabled: true` as disabled', () => {
    expect(parseSiteRule({ disabled: 'yes' })).toEqual({ disabled: false, added: '' });
  });

  it('is null for a value that isn’t a rule', () => {
    expect(parseSiteRule(undefined)).toBeNull();
    expect(parseSiteRule(true)).toBeNull();
  });
});

describe('parseStored', () => {
  it('collects the site rules and the settings, ignoring other keys', () => {
    const stored = parseStored({
      settings: { v: 1, defaultSpeed: 1.75, shortcutHintDismissed: false },
      'site:music.youtube.com': { disabled: true, added: ADDED },
      'site:*.example.com': { disabled: true, added: ADDED },
      'site:broken': 'nope',
      unrelated: 1,
    });
    expect(stored.settings.defaultSpeed).toBe(1.75);
    expect([...stored.rules.keys()]).toEqual(['music.youtube.com', '*.example.com']);
  });

  it('gives the defaults and no rules for empty storage', () => {
    const stored = parseStored({});
    expect(stored.settings).toEqual(DEFAULT_SETTINGS);
    expect(stored.rules.size).toBe(0);
  });
});

describe('isSiteDisabled', () => {
  const { rules } = parseStored({
    'site:music.youtube.com': { disabled: true, added: ADDED },
    'site:*.example.com': { disabled: true, added: ADDED },
    'site:kept.org': { disabled: false, added: ADDED },
  });

  it('matches an exact hostname, ignoring www.', () => {
    expect(isSiteDisabled(rules, 'music.youtube.com')).toBe(true);
    expect(isSiteDisabled(rules, 'www.music.youtube.com')).toBe(true);
  });

  it('doesn’t spread an exact rule to the parent or other subdomains', () => {
    expect(isSiteDisabled(rules, 'youtube.com')).toBe(false);
    expect(isSiteDisabled(rules, 'm.youtube.com')).toBe(false);
  });

  it('matches a wildcard rule’s domain and its subdomains', () => {
    expect(isSiteDisabled(rules, 'example.com')).toBe(true);
    expect(isSiteDisabled(rules, 'a.b.example.com')).toBe(true);
    expect(isSiteDisabled(rules, 'notexample.com')).toBe(false);
  });

  it('ignores a rule that isn’t disabled', () => {
    expect(isSiteDisabled(rules, 'kept.org')).toBe(false);
  });

  it('never matches an unknown page site', () => {
    expect(isSiteDisabled(rules, '')).toBe(false);
  });
});

describe('applyChanges', () => {
  const before = parseStored({ 'site:music.youtube.com': { disabled: true, added: ADDED } });

  it('takes a new default speed', () => {
    const after = applyChanges(before, { settings: { newValue: { v: 1, defaultSpeed: 3 } } });
    expect(after.settings.defaultSpeed).toBe(3);
    expect(after.rules).toBe(before.rules);
  });

  it('adds and removes site rules', () => {
    const added = applyChanges(before, { 'site:localhost': { newValue: { disabled: true, added: ADDED } } });
    expect(isSiteDisabled(added.rules, 'localhost')).toBe(true);

    const removed = applyChanges(added, { 'site:localhost': {} });
    expect(isSiteDisabled(removed.rules, 'localhost')).toBe(false);
    expect(isSiteDisabled(removed.rules, 'music.youtube.com')).toBe(true);
  });

  it('falls back to the defaults when the settings item is removed', () => {
    const changed = applyChanges(before, { settings: { newValue: { v: 1, defaultSpeed: 3 } } });
    expect(applyChanges(changed, { settings: {} }).settings).toEqual(DEFAULT_SETTINGS);
  });

  it('returns the same object when nothing it reads changed', () => {
    expect(applyChanges(before, { unrelated: { newValue: 1 } })).toBe(before);
  });

  it('doesn’t change the snapshot it was given', () => {
    applyChanges(before, { 'site:localhost': { newValue: { disabled: true, added: ADDED } } });
    expect(before.rules.has('localhost')).toBe(false);
  });
});

describe('installSeed', () => {
  const now = new Date(ADDED);

  it('seeds the default settings and music.youtube.com as disabled', () => {
    expect(installSeed({}, now)).toEqual({
      settings: { v: 1, defaultSpeed: 2, shortcutHintDismissed: false },
      'site:music.youtube.com': { disabled: true, added: ADDED },
    });
  });

  it('seeds nothing when sync already holds settings from another browser', () => {
    expect(installSeed({ settings: { v: 1, defaultSpeed: 1.5 } }, now)).toEqual({});
  });
});
