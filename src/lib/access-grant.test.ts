import { describe, expect, it } from 'vitest';
import { accessGrantRequest, tabToReload } from './access-grant';

const NOW = Date.parse('2026-11-17T12:00:00Z');

describe('the tab to reload after access is granted', () => {
  it('is the tab the popup asked from', () => {
    expect(tabToReload(accessGrantRequest(42, NOW), NOW + 5_000)).toBe(42);
  });

  it('is none once the request is two minutes old: it was refused or forgotten', () => {
    expect(tabToReload(accessGrantRequest(42, NOW), NOW + 2 * 60_000)).toBe(42);
    expect(tabToReload(accessGrantRequest(42, NOW), NOW + 2 * 60_000 + 1)).toBeNull();
  });

  it('is none for a request from the future', () => {
    expect(tabToReload(accessGrantRequest(42, NOW), NOW - 1)).toBeNull();
  });

  it('is none without a request, or with a malformed one', () => {
    for (const raw of [undefined, null, 42, {}, { tabId: '42', at: NOW }, { tabId: 42 }, { tabId: 1.5, at: NOW }]) {
      expect(tabToReload(raw, NOW), JSON.stringify(raw)).toBeNull();
    }
  });
});
