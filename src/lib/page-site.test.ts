import { describe, expect, it } from 'vitest';
import { hostOfUrl, isGetPageSite } from './page-site';

describe('hostOfUrl', () => {
  it('gives the hostname of a tab URL, without port or path', () => {
    expect(hostOfUrl('https://www.example.com:8443/watch?v=abc')).toBe('www.example.com');
  });

  it('is empty when there is no host', () => {
    expect(hostOfUrl(undefined)).toBe('');
    expect(hostOfUrl('about:blank')).toBe('');
    expect(hostOfUrl('not a url')).toBe('');
  });
});

describe('isGetPageSite', () => {
  it('recognises only the page site request', () => {
    expect(isGetPageSite({ type: 'getPageSite' })).toBe(true);
    expect(isGetPageSite({ type: 'other' })).toBe(false);
    expect(isGetPageSite('getPageSite')).toBe(false);
    expect(isGetPageSite(null)).toBe(false);
  });
});
