import { describe, expect, it } from 'vitest';
import { matchesSite, normalizeHost, parseSiteInput } from './site-patterns';

describe('normalizeHost', () => {
  it('lower-cases and drops www. and a trailing dot', () => {
    expect(normalizeHost('WWW.YouTube.com.')).toBe('youtube.com');
  });

  it('leaves other subdomains alone', () => {
    expect(normalizeHost('music.youtube.com')).toBe('music.youtube.com');
  });
});

describe('parseSiteInput', () => {
  it('reduces a pasted URL to its hostname', () => {
    expect(parseSiteInput('https://music.youtube.com/watch?v=abc&t=10')).toEqual({
      ok: true,
      pattern: 'music.youtube.com',
      wildcard: false,
      host: 'music.youtube.com',
    });
  });

  it('accepts a bare hostname with a path and port', () => {
    expect(parseSiteInput('www.example.com:8080/some/page')).toMatchObject({ ok: true, pattern: 'example.com' });
  });

  it('keeps the wildcard form for subdomains', () => {
    expect(parseSiteInput(' *.YouTube.com ')).toMatchObject({ ok: true, pattern: '*.youtube.com', wildcard: true });
  });

  it('rejects empty and malformed input', () => {
    expect(parseSiteInput('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(parseSiteInput('not a site')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseSiteInput('ftp://example.com')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseSiteInput('*.https://example.com')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseSiteInput('*.192.168.0.1')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects a hostname URL would take but no site can have', () => {
    // Chrome's `URL` takes `https://not a site` as `not%20a%20site`; Node's throws, so these
    // stand in for it: Node's `URL` accepts all three.
    expect(parseSiteInput('exa!mple.com')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseSiteInput('ex$ample.com')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseSiteInput('a..b.com')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('accepts international names, underscores and IP addresses', () => {
    expect(parseSiteInput('https://bücher.example/')).toMatchObject({ ok: true, pattern: 'xn--bcher-kva.example' });
    expect(parseSiteInput('my_host.example.com')).toMatchObject({ ok: true, pattern: 'my_host.example.com' });
    expect(parseSiteInput('http://192.168.0.1:8080/')).toMatchObject({ ok: true, pattern: '192.168.0.1' });
    expect(parseSiteInput('http://[::1]:3000/')).toMatchObject({ ok: true, pattern: '[::1]' });
  });
});

describe('matchesSite', () => {
  it('matches an exact hostname, ignoring www.', () => {
    expect(matchesSite('youtube.com', 'www.youtube.com')).toBe(true);
    expect(matchesSite('youtube.com', 'music.youtube.com')).toBe(false);
  });

  it('lets music.youtube.com be disabled on its own', () => {
    expect(matchesSite('music.youtube.com', 'music.youtube.com')).toBe(true);
    expect(matchesSite('music.youtube.com', 'www.youtube.com')).toBe(false);
  });

  it('matches the domain and every subdomain for a wildcard pattern', () => {
    expect(matchesSite('*.youtube.com', 'youtube.com')).toBe(true);
    expect(matchesSite('*.youtube.com', 'm.youtube.com')).toBe(true);
    expect(matchesSite('*.youtube.com', 'notyoutube.com')).toBe(false);
  });
});
