import { describe, expect, it } from 'vitest';
import type { SiteRule } from './settings';
import { accessOrigins, runsOnFiles, siteSwitch as switchFor, type PageAccess } from './site-switch';

const off: SiteRule = { disabled: true, added: '2026-11-16T00:00:00.000Z' };
const rules = (...patterns: string[]) => new Map(patterns.map((p) => [p, off]));
const granted: PageAccess = { site: true, files: true };
const siteSwitch = (url: string | undefined, map: ReturnType<typeof rules>, access = granted) =>
  switchFor(url, map, access);

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

  it('names browser pages, which content scripts never run on', () => {
    for (const url of [
      'chrome://extensions/',
      'about:addons',
      'about:blank',
      'chrome-extension://abc/popup.html',
      'moz-extension://abc/popup.html',
      'view-source:https://example.com/',
    ]) {
      expect(siteSwitch(url, rules()), url).toEqual({ state: 'unavailable', reason: 'browserPage' });
    }
  });

  it('names the extension stores, whatever the access', () => {
    for (const url of [
      'https://chromewebstore.google.com/detail/abc',
      'https://chrome.google.com/webstore/detail/abc',
      'https://addons.mozilla.org/en-US/firefox/',
    ]) {
      expect(siteSwitch(url, rules()), url).toEqual({ state: 'unavailable', reason: 'store' });
      expect(siteSwitch(url, rules(), { site: false, files: false }), url).toEqual({
        state: 'unavailable',
        reason: 'store',
      });
    }
  });

  it('reports withheld access on a site whose URL it can see', () => {
    // Chrome's "on click" after the toolbar button was clicked, or "on specific sites".
    expect(siteSwitch('https://youtube.com/', rules(), { site: false, files: true })).toEqual({
      state: 'unavailable',
      reason: 'noAccess',
    });
  });

  describe('with the URL hidden', () => {
    for (const url of [undefined, '', 'not a url']) {
      it(`reports withheld access first (${JSON.stringify(url)})`, () => {
        expect(siteSwitch(url, rules(), { site: false, files: true })).toEqual({
          state: 'unavailable',
          reason: 'noAccess',
        });
      });

      it(`is a browser page when it has all-sites and file access (${JSON.stringify(url)})`, () => {
        expect(siteSwitch(url, rules(), { site: true, files: true })).toEqual({
          state: 'unavailable',
          reason: 'browserPage',
        });
      });

      it(`may be a local file when file access is off (${JSON.stringify(url)})`, () => {
        expect(siteSwitch(url, rules(), { site: true, files: false })).toEqual({
          state: 'unavailable',
          reason: 'browserPageOrFile',
        });
      });
    }
  });

  it('is available on the rest of chrome.google.com', () => {
    expect(siteSwitch('https://chrome.google.com/intl/en/chrome/', rules())).toMatchObject({ state: 'on' });
  });

  it('has no site to switch on a file: page', () => {
    expect(siteSwitch('file:///Users/me/movie.mp4', rules())).toEqual({ state: 'unavailable', reason: 'noSite' });
  });

  it('asks for file access on a file: page it can see but not run on', () => {
    // Firefox 153+ shows the URL with site access, and runs on it only with local-file access.
    expect(siteSwitch('file:///Users/me/movie.mp4', rules(), { site: true, files: false })).toEqual({
      state: 'unavailable',
      reason: 'noFileAccess',
    });
  });

  it('leaves file access alone on the web', () => {
    expect(siteSwitch('https://youtube.com/', rules(), { site: true, files: false })).toMatchObject({ state: 'on' });
  });
});

describe('runsOnFiles', () => {
  const file = 'file:///Users/me/movie.mp4';

  it('trusts the browser where it reports file access: Chrome, and Firefox 153+', () => {
    expect(runsOnFiles(file, true, undefined)).toBe(true);
    expect(runsOnFiles(file, false, undefined)).toBe(false);
    expect(runsOnFiles(file, true, '153.0')).toBe(true);
    expect(runsOnFiles(file, false, '153.0')).toBe(false);
    expect(runsOnFiles(file, false, '160.0.1')).toBe(false);
  });

  it('runs on files in Firefox before 153, which always reports no access', () => {
    expect(runsOnFiles(file, false, '128.14.0')).toBe(true);
    expect(runsOnFiles(file, false, '152.0b3')).toBe(true);
  });

  it('trusts the report when the Firefox version is unreadable', () => {
    expect(runsOnFiles(file, false, '')).toBe(false);
    expect(runsOnFiles(file, false, 'nightly')).toBe(false);
  });

  it('never takes a hidden URL for a file on Firefox, which shows file URLs either way', () => {
    // So a hidden URL is a browser page there, as it is in Chrome with file access on.
    for (const url of [undefined, 'about:robots', 'https://youtube.com/']) {
      expect(runsOnFiles(url, false, '160.0'), String(url)).toBe(true);
      expect(siteSwitch(undefined, rules(), { site: true, files: runsOnFiles(url, false, '160.0') })).toEqual({
        state: 'unavailable',
        reason: 'browserPage',
      });
    }
    // Chrome hides a file's URL with file access off, so there it may be either.
    expect(runsOnFiles(undefined, false, undefined)).toBe(false);
  });
});

describe('accessOrigins', () => {
  it('checks the tab’s own site, on any port', () => {
    expect(accessOrigins('https://www.youtube.com/watch?v=abc')).toEqual(['https://www.youtube.com/*']);
    expect(accessOrigins('http://localhost:3211/plain.html')).toEqual(['http://localhost/*']);
    expect(accessOrigins('http://[::1]:8000/')).toEqual(['http://[::1]/*']);
  });

  it('checks file access for a file: page', () => {
    expect(accessOrigins('file:///Users/me/movie.mp4')).toEqual(['file:///*']);
  });

  it('checks every site when the URL is hidden or isn’t a web page', () => {
    for (const url of [undefined, '', 'chrome://extensions/', 'about:blank']) {
      expect(accessOrigins(url), String(url)).toEqual(['<all_urls>']);
    }
  });
});
