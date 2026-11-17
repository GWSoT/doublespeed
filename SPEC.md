# Doublespeed — System Specification

Doublespeed is a Chrome and Firefox extension that plays every web video at 2× by default.
v1 does playback speed only. The code is organised around **enhancers** so volume boost and
other video tweaks can be added later without a rewrite.

The decisions behind this document are in [docs/decisions/](docs/decisions/); the phases
that build it are in [ROADMAP.md](ROADMAP.md).

---

## 1. Product surface

| Surface | What it does |
|---|---|
| **Content script** | Runs on every site and in every frame. Finds every `<video>`, including ones in shadow DOM, in iframes and added after load, and applies the speed rules (§3.2). |
| **Shortcuts** | `Alt+.` faster, `Alt+,` slower (0.25 steps), `Alt+R` toggles: any speed other than 1× → 1×, 1× → default speed. Each press changes every video in the tab, iframes included. Rebindable in the browser's shortcut settings. |
| **Badge** | On tabs that have a video, the toolbar icon shows the speed of the video playing or last played, in whichever frame (`2×`, `2.25`, `1.5`); before any has played, the first one found. A whole speed keeps its ×; others drop it to fit. On disabled sites it always shows `off`. Tabs with no video show nothing. |
| **Speed label** | When our controls change the speed, a small `1.75×` label appears over the video for about a second, then fades. Isolated from site styles; works in fullscreen. Never shown permanently. |
| **Popup** | An on/off switch for the page site, a −/+ control showing this tab's speed, and the default speed setting. Shows a one-time shortcut hint, and a warning with a grant button when the browser has blocked the extension from the site. Links to the options page as "Site list". |
| **Options page** | The list of disabled sites with remove buttons, an **Add site** field, and the shortcuts with a link to the browser's settings for them. Pasting a URL into Add site reduces it to the hostname and says what it will disable; an **Include subdomains** checkbox makes the `*.` form. |

There is no welcome tab on install. All UI text goes through the browser's i18n messages
(`public/_locales/`), English only in v1.

## 2. Platform APIs

The extension has no server and makes no network requests. Everything comes from browser APIs.

### 2.1 What they give

| API | Gives us |
|---|---|
| `HTMLMediaElement.playbackRate`, `ratechange`, `loadstart`, `loadedmetadata`, `durationchange` | Setting and observing each video's speed and noticing a new source. |
| `MutationObserver`, `Element.shadowRoot`, closed shadow roots via `chrome.dom.openOrClosedShadowRoot(element)` (Chrome) and the read-only `element.openOrClosedShadowRoot` property (Firefox) | Finding videos wherever the page puts them. |
| `storage.sync` | Settings and the site list, synced across the user's signed-in browsers. |
| `commands` | Browser-level shortcuts that never clash with typing or site shortcuts. |
| `action.setBadgeText` per tab | The badge. |
| `runtime` messaging, `MessageSender.tab.url` | Content scripts in iframes learn the page site from the background. |
| `permissions.contains` | Detecting that the user or browser has withheld site access. |

### 2.2 What they don't give, and what we do instead

- **Who changed the speed.** `ratechange` doesn't say whether the user, the site or we caused
  it. We tag our own changes and treat a change shortly after a trusted click or keypress in
  that frame as the user's (§3.2). This is a heuristic, and the roadmap's top risk.
- **The page's address inside a cross-origin iframe.** Firefox has no `location.ancestorOrigins`,
  so iframes ask the background, which reads `sender.tab.url`.
- **Guaranteed site access.** In Firefox, MV3 site access can be revoked at any time in
  `about:addons`. In Chrome, users can set the extension to "on click" or specific sites. The
  popup checks with `permissions.contains` and offers to grant access.
- **Pages extensions can't touch.** Browser pages (`chrome://`, `about:`), the two extension
  stores, and the PDF viewer never run content scripts. The popup says so.
- **Audio outside 0.25×–4×.** Firefox mutes it, which is why the speed range stops there.
- **Unlimited sync storage.** `storage.sync` allows 512 items and 8 KB per item, so the site
  list can hold about 500 entries. The options page reports the quota error rather than failing silently.

## 3. Vocabulary and rules

### 3.1 Vocabulary

| Term | Meaning |
|---|---|
| **Video** | An `HTMLVideoElement`. `<audio>` is never touched. |
| **Default speed** | The global speed every video starts at. 2× on install, 0.25×–4× in 0.25 steps. |
| **Source** | What a video is playing, identified by `currentSrc` plus a `loadstart`. A new source starts the rules over. |
| **Override** | The user's in-the-moment speed for one video, made through our controls or the site's own. Lasts until that video's source changes. |
| **Site reset** | A speed change the site made with no user input nearby. Undone by re-applying the video's target speed. |
| **Target speed** | What a video should be playing at: its override if it has one, else the default speed. |
| **Live video** | A video whose `duration` is `Infinity`. Left alone entirely, even when rewound. |
| **Page site** | The hostname in the tab's address bar. Rules for embedded iframes follow the page site, not the iframe's own origin. |
| **Site rule** | A stored entry for a site pattern. In v1 its only field is `disabled`. |
| **Site pattern** | `example.com` matches that hostname exactly (a leading `www.` is ignored on both sides). `*.example.com` matches `example.com` and every subdomain. |
| **Disabled site** | A page site matched by a site rule with `disabled: true`. Its videos play at whatever speed the site chose. |
| **Enhancer** | A unit that adjusts a video. Speed is the only enhancer in v1. |
| **Speed label** | The brief on-video `N×` label shown after our controls change the speed. |

### 3.2 The speed rules

For each video, in each frame:

1. **New source.** On first sight or `loadstart`: if the page site is disabled, do nothing.
   Otherwise wait for metadata; if it's a live video, do nothing; else remember the speed the
   video had before we touched it and set the default speed.
2. **Our change.** Before setting a speed we record it as expected; the `ratechange` that
   matches is ignored.
3. **User change.** A `ratechange` within ~1 s of a trusted `pointerdown` or `keydown` in that
   frame becomes the video's override, if that input came after rule 1 applied the default to
   the current source. A click on "next video" happens before the new source loads, so the
   site's reset that follows it is rule 4, not a choice.
4. **Site reset.** Any other `ratechange` is re-set to the target speed. If a site resets more
   than ~5 times in ~10 s for one source, we stop fighting that source so we don't loop.
5. **Our controls.** Shortcuts and the popup's −/+ set an override on every video in the tab
   and show the speed label over the ones in view. Up and down step from each video's own
   speed; the toggle sends any speed other than 1× to 1×, and 1× to the default. A source the
   site wore us down on (rule 4) is taken back. Live videos, and every video on a disabled
   site, are left alone.
6. **Settings change, applied live.** A new default speed moves every video without an
   override. Disabling the page site restores every video to its remembered speed and drops
   its overrides. Enabling it applies the default speed, as if each video were seen for the
   first time.

## 4. Data model

`storage.sync`:

| Key | Value | Notes |
|---|---|---|
| `settings` | `{ v: 1, defaultSpeed: number, shortcutHintDismissed: boolean }` | `defaultSpeed` is 2 on install. |
| `site:<pattern>` | `{ disabled: true, added: string }` | One item per pattern, so the list never hits the 8 KB per-item limit. Seeded on install with `site:music.youtube.com`. Later: an optional `speed` for per-site speeds. |

Install seeding is skipped when `settings` already exists: sync brought the user's settings and
site list from another browser, and those win. A missing or invalid value falls back to its
default, so a bad item never stops the rules.

Per-video state lives in memory only, in a `WeakMap<HTMLVideoElement, VideoState>` in each
frame's content script: source key, speed before we touched it, override, reset counter.
Overrides never sync and never survive a reload.

`storage.session` (this browser session only, never synced):

| Key | Value | Notes |
|---|---|---|
| `tab:<tabId>` | `{ [frameId]: { doc, off, video: { speed, playing, playedAt } \| null } }` | Each frame's report for the badge, and for the popup's speed for this tab. A frame sends one only when it has something to show, and withdraws it on `pagehide`; `doc` is per document, so a late withdrawal from the page a tab just left can't erase the new one. Removed when the tab closes. |

## 5. Architecture

```
            ┌──────────────── tab ─────────────────┐
            │  top frame          iframe(s)        │
            │  content script     content script   │   one per frame, document_start,
            │   ├ video finder     (same)          │   all_frames, about:blank frames too
            │   ├ speed engine                     │
            │   ├ enhancers: [speed]               │
            │   └ speed label                      │
            └──────┬───────────────────┬───────────┘
   page site,      │ runtime messages  │ storage.onChanged
   badge reports   ▼                   ▼
        background (service worker /   storage.sync
        Firefox event page)             ▲
          ├ commands → tab (all frames) │
          ├ badge per tab               │
          └ install seeding ────────────┘
        popup (Svelte) ── messages to tab, reads/writes storage.sync
        options (Svelte) ── reads/writes storage.sync
```

- `entrypoints/` holds WXT entrypoints: `background.ts`, `content.ts`, `popup/`, `options/`.
- `src/lib/` holds browser-independent logic (site patterns, speed steps, the rules as a
  state machine), unit tested with Vitest. `src/content/` holds the content script's DOM
  side: the video finder and the speed engine that carries out the rules.
- The video finder observes the document and every reachable shadow root. It looks up closed
  roots only on custom elements, to keep the cost per element low. A custom element inserted
  before its definition gets its shadow root on upgrade, which no DOM mutation reports, so
  it's checked again after every mutation batch until it's defined: pages go on changing the
  DOM around a definition. A defined custom element without a shadow root is checked again
  at `DOMContentLoaded` and `load`, and a click inside any custom element checks it. The
  known gap is a player defined after load that autoplays with no DOM change after its
  definition and no click.
- `tests/e2e/` holds Playwright tests that load the built extension into Chromium and drive
  local fixture pages: a YouTube-style player that resets to 1× per video, iframes, open and
  closed shadow DOM, players defined late, a live stream, and videos added after load.

Stack: WXT + TypeScript, Svelte 5 for the popup and options page, Vitest, Playwright,
`web-ext lint` for Firefox ([ADR-0001](docs/decisions/0001-stack.md)).

## 6. Constraints

- **Manifest V3** everywhere. Chrome 120+, Firefox 128+ ([ADR-0002](docs/decisions/0002-browser-targets.md)).
- **Permissions:** `storage` and the `<all_urls>` host permission, nothing else. No `tabs`,
  no `scripting`, no `notifications`. Every extra permission has to be justified to both stores.
- **No network, no analytics.** `PRIVACY.md` says the extension collects nothing ([ADR-0006](docs/decisions/0006-distribution-and-privacy.md)).
- **Performance:** the content script runs on every page. It does nothing beyond observing
  until a video appears, and it never polls.
- **Store policy:** Chrome Web Store's single-purpose rule. The purpose is "control video
  playback", which future enhancers must also fit.

## 7. Out of scope for v1

- `<audio>` elements.
- Per-site speeds (the data model leaves room for them).
- Volume boost and other enhancers. Note for later: boosting volume through Web Audio silences
  cross-origin videos served without CORS headers.
- Safari (needs an Xcode wrapper and a paid Apple developer account).
- Firefox for Android (assumed out; it has no `commands`).
- Single-key shortcuts inside the page.
- Speeding up live streams, including their DVR buffer.
- Rules that skip "decorative" videos. The site list covers the annoying cases.
