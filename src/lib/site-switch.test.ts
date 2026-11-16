import { describe, expect, it } from 'vitest';
import type { SiteRule } from './settings';
import { siteSwitch } from './site-switch';

const off: SiteRule = { disabled: true, added: '2026-11-16T00:00:00.000Z' };
const rules = (...patterns: string[]) => new Map(patterns.map((p) => [p, off]));

describe('siteSwitch', () => {
  it('is on for a site with no rule, and would add its exact hostname', () => {
    expect(siteSwitch('https://www.YouTube.com/watch?v=abc', rules())).toEqual({
      state: 'on',
      site: 'youtube.com',
      pattern: 'youtube.com',
    });
  });

  it('is off when the exact-hostname rule turns the site off, and would remove that rule', () => {
    expect(siteSwitch('https://music.youtube.com/', rules('music.youtube.com'))).toEqual({
      state: 'off',
      site: 'music.youtube.com',
      pattern: 'music.youtube.com',
    });
  });

  it('ignores rules for other sites, subdomains included', () => {
    expect(siteSwitch('https://youtube.com/', rules('music.youtube.com', 'vimeo.com'))).toMatchObject({
      state: 'on',
    });
  });

  it('ignores a rule that doesn’t disable', () => {
    const map = new Map([['youtube.com', { disabled: false, added: '' }]]);
    expect(siteSwitch('https://youtube.com/', map)).toMatchObject({ state: 'on' });
  });

  it('is locked when a *. rule turns the site off, even alongside an exact rule', () => {
    expect(siteSwitch('https://music.youtube.com/', rules('*.youtube.com'))).toEqual({
      state: 'locked',
      site: 'music.youtube.com',
      by: '*.youtube.com',
    });
    expect(siteSwitch('https://youtube.com/', rules('youtube.com', '*.youtube.com'))).toMatchObject({
      state: 'locked',
    });
  });

  it('works for local and IP sites', () => {
    expect(siteSwitch('http://localhost:3211/plain.html', rules())).toMatchObject({ state: 'on', site: 'localhost' });
    expect(siteSwitch('http://127.0.0.1:3211/', rules('127.0.0.1'))).toMatchObject({ state: 'off' });
  });

  it('is unavailable on pages content scripts can’t run on, or whose URL is hidden', () => {
    const restricted = { state: 'unavailable', reason: 'restricted' };
    for (const url of [
      undefined,
      '',
      'chrome://extensions/',
      'about:addons',
      'about:blank',
      'chrome-extension://abc/popup.html',
      'moz-extension://abc/popup.html',
      'view-source:https://example.com/',
      'https://chromewebstore.google.com/detail/abc',
      'https://chrome.google.com/webstore/detail/abc',
      'https://addons.mozilla.org/en-US/firefox/',
    ]) {
      expect(siteSwitch(url, rules()), String(url)).toEqual(restricted);
    }
  });

  it('is available on the rest of chrome.google.com', () => {
    expect(siteSwitch('https://chrome.google.com/intl/en/chrome/', rules())).toMatchObject({ state: 'on' });
  });

  it('has no site to switch on a file: page', () => {
    expect(siteSwitch('file:///Users/me/movie.mp4', rules())).toEqual({ state: 'unavailable', reason: 'noSite' });
  });
});
