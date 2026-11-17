import { describe, expect, it } from 'vitest';
import type { SiteRule } from './settings';
import { checkAddSite, isSyncFullError, siteList } from './site-list';

const off: SiteRule = { disabled: true, added: '2026-11-17T00:00:00.000Z' };
const rules = (...patterns: string[]) => new Map(patterns.map((p) => [p, off]));

describe('siteList', () => {
  it('sorts by hostname, the exact rule before the *. rule for the same host', () => {
    expect(siteList(rules('vimeo.com', '*.youtube.com', 'music.youtube.com', 'youtube.com'))).toEqual([
      { pattern: 'music.youtube.com', host: 'music.youtube.com', wildcard: false },
      { pattern: 'vimeo.com', host: 'vimeo.com', wildcard: false },
      { pattern: 'youtube.com', host: 'youtube.com', wildcard: false },
      { pattern: '*.youtube.com', host: 'youtube.com', wildcard: true },
    ]);
  });

  it('leaves out a rule that doesn’t disable', () => {
    const map = new Map([['youtube.com', { disabled: false, added: '' }]]);
    expect(siteList(map)).toEqual([]);
  });
});

describe('checkAddSite', () => {
  it('reduces a pasted URL to its hostname', () => {
    expect(checkAddSite('https://www.youtube.com/watch?v=abc', false, rules())).toEqual({
      ok: true,
      pattern: 'youtube.com',
      host: 'youtube.com',
      wildcard: false,
    });
  });

  it('makes the *. form when Include subdomains is ticked', () => {
    expect(checkAddSite('https://www.youtube.com/watch?v=abc', true, rules())).toEqual({
      ok: true,
      pattern: '*.youtube.com',
      host: 'youtube.com',
      wildcard: true,
    });
  });

  it('makes the *. form from a typed *., ticked or not', () => {
    expect(checkAddSite('*.youtube.com', false, rules())).toMatchObject({ ok: true, pattern: '*.youtube.com' });
    expect(checkAddSite('*.youtube.com', true, rules())).toMatchObject({ ok: true, pattern: '*.youtube.com' });
  });

  it('says what’s wrong with empty and malformed input', () => {
    expect(checkAddSite('  ', true, rules())).toEqual({ ok: false, reason: 'empty' });
    expect(checkAddSite('not a site', false, rules())).toEqual({ ok: false, reason: 'invalid' });
  });

  it('refuses subdomains for an IP address, which has none', () => {
    expect(checkAddSite('http://192.168.0.1/video', false, rules())).toMatchObject({ ok: true, pattern: '192.168.0.1' });
    expect(checkAddSite('http://192.168.0.1/video', true, rules())).toEqual({
      ok: false,
      reason: 'noSubdomains',
      host: '192.168.0.1',
    });
  });

  it('refuses a pattern already in the list', () => {
    expect(checkAddSite('https://music.youtube.com/', false, rules('music.youtube.com'))).toEqual({
      ok: false,
      reason: 'duplicate',
      pattern: 'music.youtube.com',
    });
    expect(checkAddSite('youtube.com', true, rules('*.youtube.com'))).toMatchObject({ reason: 'duplicate' });
  });

  it('refuses a site a *. rule already covers, subdomains and all', () => {
    expect(checkAddSite('music.youtube.com', false, rules('*.youtube.com'))).toEqual({
      ok: false,
      reason: 'covered',
      pattern: 'music.youtube.com',
      by: '*.youtube.com',
    });
    expect(checkAddSite('youtube.com', false, rules('*.youtube.com'))).toMatchObject({ reason: 'covered' });
    expect(checkAddSite('*.music.youtube.com', false, rules('*.youtube.com'))).toMatchObject({ reason: 'covered' });
  });

  it('adds a *. rule over an exact one, since it covers more', () => {
    expect(checkAddSite('youtube.com', true, rules('youtube.com', 'music.youtube.com'))).toMatchObject({
      ok: true,
      pattern: '*.youtube.com',
    });
  });

  it('isn’t fooled by a lookalike domain', () => {
    expect(checkAddSite('notyoutube.com', false, rules('*.youtube.com'))).toMatchObject({ ok: true });
  });

  it('writes over a rule that doesn’t disable', () => {
    const map = new Map([['youtube.com', { disabled: false, added: '' }]]);
    expect(checkAddSite('youtube.com', false, map)).toMatchObject({ ok: true, pattern: 'youtube.com' });
  });
});

describe('isSyncFullError', () => {
  it('recognises the item and size quotas, in both browsers’ words', () => {
    expect(isSyncFullError(new Error('MAX_ITEMS quota exceeded'))).toBe(true);
    expect(isSyncFullError(new Error('QUOTA_BYTES quota exceeded'))).toBe(true);
    expect(isSyncFullError(new Error('QuotaExceededError: storage.sync API call exceeded its quota limitations.'))).toBe(
      true,
    );
  });

  it('doesn’t mistake writing too often, or any other failure, for a full list', () => {
    expect(isSyncFullError(new Error('MAX_WRITE_OPERATIONS_PER_MINUTE quota exceeded'))).toBe(false);
    expect(isSyncFullError(new Error('Extension context invalidated.'))).toBe(false);
    expect(isSyncFullError(undefined)).toBe(false);
  });
});
