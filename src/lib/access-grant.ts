/**
 * The popup's grant button (SPEC §2.2). Content scripts only arrive with a page's next load, so
 * once the user allows site access, the background reloads the tab they asked from. The popup
 * records that tab in `storage.session` as it asks, because the browser's prompt can close the
 * popup before the answer comes back.
 */
export const ACCESS_GRANT_KEY = 'accessGrant';

/** How long a request stays answerable; past it, the request was refused or forgotten. */
const ANSWER_WINDOW_MS = 2 * 60_000;

export interface AccessGrantRequest {
  tabId: number;
  /** When the popup asked, in ms since the epoch. */
  at: number;
}

export function accessGrantRequest(tabId: number, now: number): AccessGrantRequest {
  return { tabId, at: now };
}

/** The tab to reload now that access was granted, from the stored request; null for none. */
export function tabToReload(raw: unknown, now: number): number | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { tabId, at } = raw as Partial<Record<keyof AccessGrantRequest, unknown>>;
  if (!Number.isInteger(tabId) || typeof at !== 'number') return null;
  const age = now - at;
  return age >= 0 && age <= ANSWER_WINDOW_MS ? (tabId as number) : null;
}
