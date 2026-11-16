# doublespeed — Roadmap

Companion to [SPEC.md](SPEC.md). Every phase ships something usable on its own, and each
answers a sharper version of the same question: *can someone install this and forget that
videos ever played at 1×?*

---

## Phase 0 — Decide before you write code — **COMPLETE**

| ADR | Decision |
|---|---|
| [0001](docs/decisions/0001-stack.md) | WXT + TypeScript, Svelte 5 for the popup and options page, Vitest, Playwright, `web-ext lint`. |
| [0002](docs/decisions/0002-browser-targets.md) | Manifest V3 on Chrome 120+ and Firefox 128+. Safari and Firefox for Android later. |
| [0003](docs/decisions/0003-speed-rules.md) | Every `<video>` starts at the default speed (2×). The user's change wins for that video, site resets are undone, live videos are left alone. |
| [0004](docs/decisions/0004-site-rules.md) | Disabled sites match exact hostnames, `*.` covers subdomains, the address bar decides for iframes, `music.youtube.com` is seeded off. |
| [0005](docs/decisions/0005-controls.md) | `Alt+.` / `Alt+,` / `Alt+R` browser shortcuts, a per-tab badge, a brief speed label, no welcome tab. |
| [0006](docs/decisions/0006-distribution-and-privacy.md) | Free, MIT, collects nothing. Listed as "Doublespeed"; repo public before the first submission. |

**Three findings shaped the plan.**
- **Site access isn't guaranteed.** Firefox lets users revoke an MV3 extension's site access at any time, and Chrome lets them restrict it. The popup has to notice, so Phase 3 has a slice for it.
- **Firefox's no-data declaration.** Mozilla now requires new add-ons to declare their data collection, a key only Firefox 140+ reads. We declare "none", and the lint warning it causes on 128 is harmless.
- **No `/` in shortcuts.** Neither browser allows `/` as a shortcut key, which is why the 1×/default toggle is `Alt+R`.

**Open items:**

1. **Store accounts are ready to publish.** Nazar's move, before Phase 4. On the Chrome Web Store: the fee is paid, the contact email is verified, 2-Step Verification is on, and trader status is set to "non-trader". The addons.mozilla.org account needs nothing more for manual uploads.
2. **Trademark search for "Doublespeed".** Before Phase 4's submission; an agent can do the search, Nazar makes the call.
3. ~~**Connect `GWSoT/doublespeed` to Codex code review** in Codex's settings.~~ Done: Codex reviewed [#9](https://github.com/GWSoT/doublespeed/pull/9).

---

## Phase 1 — Every video at 2× — **IN PROGRESS**

Load the extension unpacked in Chrome and every video on the web plays at the default speed:
the core rules, the site list and a minimal popup, tested end to end.

| Decision | Chosen | Rejected alternative | Reasoning |
|---|---|---|---|
| Finding videos | `MutationObserver` on the document and on every reachable shadow root (open, and closed via `openOrClosedShadowRoot`), plus capture-phase `play`/`loadstart` listeners as a safety net | Patching `attachShadow` from a main-world script | Stays in the isolated world on both browsers; patching page prototypes is fragile and visible to sites. |
| Who changed the speed | A ~1 s window after a trusted `pointerdown`/`keydown` in the frame, counting only input made after the default was applied to the current source | Ignoring all outside changes; counting any recent input | Without the window, every YouTube video would stay at 1× after its reset. Without the "after" condition, clicking "next" would read as choosing 1× (risk 1). |
| Page site in iframes | Ask the background, which reads `sender.tab.url` | `location.ancestorOrigins` | Firefox doesn't have it. |
| Test pages | Local fixtures served by Playwright on :3211 | Testing against live YouTube in CI | Real sites change, need logins, and rate-limit CI. Real sites stay a manual checklist. |

**Slices:**

1. **Video finder and default speed.** Every `<video>` is found, whether in the light DOM, open or closed shadow roots, iframes, or added later. It gets the default speed on each new source, and live videos are skipped. Comes with the Playwright harness and fixture pages. — [#1](https://github.com/GWSoT/doublespeed/issues/1), done in [#8](https://github.com/GWSoT/doublespeed/pull/8)
2. **The speed rules.** User override vs. site reset, the fight back-off, and a YouTube-style fixture that resets to 1× per video. — [#2](https://github.com/GWSoT/doublespeed/issues/2), done in [#9](https://github.com/GWSoT/doublespeed/pull/9)
3. **Settings and the site list.** The `storage.sync` schema, install seeding (2×, `music.youtube.com`), the page site for iframes, and settings changes applied live. — [#3](https://github.com/GWSoT/doublespeed/issues/3), done in [#10](https://github.com/GWSoT/doublespeed/pull/10)
4. **Popup, first version.** The on/off switch for the page site and the default speed control. — [#4](https://github.com/GWSoT/doublespeed/issues/4)

**Exit test:**
- **Fixtures:** the Playwright suite passes in CI against every fixture.
- **Real sites,** loaded unpacked in Chrome:
  - YouTube, Vimeo, X and a blog with a YouTube embed play at 2×.
  - YouTube's next video, by autoplay and in a playlist, and the video after an ad are still at 2× (risk 1).
  - Choosing 1.5× in YouTube's own menu sticks for that video, and the next video is back at 2×.
  - Turning the site off in the popup returns its videos to 1× without a reload.
  - `music.youtube.com` plays at 1×.
  - Netflix, a Twitch VOD and a news-site player reach 2× and stay there without a tug of war (risk 2).
- **Cost:** a long scroll through X and through Reddit, recorded in Chrome's Performance panel, shows no long tasks from the content script (risk 5).

---

## Phase 2 — Controls and feedback — **IN PROGRESS**

Change the speed of any player, including ones without a speed menu, and always see what speed you're on.

| Decision | Chosen | Rejected alternative | Reasoning |
|---|---|---|---|
| Speed label over fullscreen | A manual popover in a closed shadow root, re-opened on each show | Moving the label into the fullscreen element | The top layer puts it above any player, including a fullscreen `<video>`, which can't hold a child element. No z-index to win. |

**Slices:** ([#5](https://github.com/GWSoT/doublespeed/issues/5))

1. **Speed controls and the speed label.** The `commands` shortcuts (`Alt+.`, `Alt+,`, `Alt+R`) act on every frame in the tab, and the brief on-video label shows the new speed, fullscreen included. — [#12](https://github.com/GWSoT/doublespeed/issues/12)
2. **The tab's speed.** The toolbar badge shows it, or `off` on disabled sites, and the popup's −/+ changes it. Each frame reports its video to the background, which keeps the tab's reports in `storage.session`. — [#13](https://github.com/GWSoT/doublespeed/issues/13)
3. **First-run hint:** the one-time shortcut hint in the popup. — [#14](https://github.com/GWSoT/doublespeed/issues/14)

**Exit test:** on an X video:
- `Alt+.` shows a `2.25×` label on the video and `2.25` on the badge.
- `Alt+R` goes to 1×, and pressing it again goes back to 2×.
- On a disabled site the badge reads `off`.
- The shortcuts can be rebound at `chrome://extensions/shortcuts`.

---

## Phase 3 — Options page, Firefox and site access — **NOT STARTED**

Manage the site list properly, run the same build on Firefox, and never fail silently when the browser withholds access.

**Slices:**
- **Options page:** the site list with remove buttons, the Add site field (paste a URL, see what it disables, `*.` for subdomains, quota errors shown), and a link to the browser's shortcut settings.
- **Missing access:** the popup detects missing site access (`permissions.contains`) and offers a grant button.
- **Pages extensions can't touch:** the popup explains browser pages and the extension stores.
- **Firefox:** a manual check on Firefox 128 and the current release.

[#6](https://github.com/GWSoT/doublespeed/issues/6)

**Exit test:**
- **Firefox:** loaded as a temporary add-on in Firefox, every Phase 1 and Phase 2 exit check passes.
- **Add site:** pasting `https://www.youtube.com/watch?v=abc` as `*.youtube.com` says it disables YouTube and its subdomains, and does.
- **Missing access:** revoking site access in `about:addons` makes the popup show the grant button.

---

## Phase 4 — Store launch — **NOT STARTED**

Doublespeed is live on the Chrome Web Store and addons.mozilla.org.

**Slices:**
- **Icon:** the "2×" icon on the existing purple, in every size both stores need.
- **Listing materials:** `PRIVACY.md`, listing text, screenshots, the justification for all-sites access, and the single-purpose statement.
- **Trademark:** the search from open item 2.
- **Release:** the repo made public, version 1.0.0 zips from CI, and the first manual submission to each store, which only Nazar can do.

[#7](https://github.com/GWSoT/doublespeed/issues/7)

**Exit test:** both store pages are public and installing from them gives 2× on YouTube with no extra steps.

---

## After v1

- **More enhancers,** volume boost first. Web Audio silences cross-origin videos served without CORS headers, so it needs a fallback.
- **Per-site speeds:** the site rule gains a `speed` field.
- **Automated store uploads** with `wxt submit`.
- **Safari.**

---

## Where this plan is most likely to go wrong

1. **The click-then-reset race.** A user clicks "next video", and the site resets the new video to 1× within a second. A plain input window reads that as the user's choice, so the video stays at 1×. *Mitigated in slice 2:* input only counts when it comes after the default was applied to the current source, and the click on "next" always comes before. `youtube.html` reproduces the race: it fails without that condition and passes with it. *Still to check:* YouTube autoplay and playlists on the Phase 1 real-site checklist.
2. **Sites that fight back.** A player that re-sets the rate on every `ratechange` (some DRM players, ad SDKs) could loop with us. *Find out:* the back-off counter, plus Netflix, Twitch VODs and news-site players on the Phase 1 checklist.
3. **Videos we can't reach.** Closed shadow roots created before our script runs, sandboxed iframes, `srcdoc` and `about:blank` frames. *Find out:* one fixture per case in slice 1.
4. **Chrome Web Store's in-depth review of `<all_urls>`.** It can take weeks or reject a vague justification. *Find out early:* upload an unlisted build as soon as Phase 2 is done, to learn the review time before launch matters.
5. **The cost of running on every page.** A `MutationObserver` on heavy feeds (X, Reddit) could add jank. *Find out:* profile a long scroll on both, part of the Phase 1 exit test. Videos are found from mutation batches, never by polling.
