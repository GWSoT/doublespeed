# ADR-0007 — Not in Firefox's private windows

- **Status:** accepted
- **Date:** 2026-11-19
- **Deciders:** Nazar ([#32](https://github.com/GWSoT/doublespeed/issues/32), option 1)
- **Phase:** 4

## Context

Mozilla's [Add-on Policies](https://extensionworkshop.com/documentation/publish/add-on-policies/),
6.3: "Data from private browsing sessions must not be stored." Firefox keeps an extension
the user installed out of private windows until the user allows it there ("Run in Private Windows" in `about:addons`). If a
user allowed Doublespeed, a private tab's data would be stored: the popup's site switch writes the
page site, with the date, to `storage.sync`, and the background keeps the tab's frame reports in
`storage.session` while the tab is open. This blocks the addons.mozilla.org submission
([#7](https://github.com/GWSoT/doublespeed/issues/7)).

## Options considered

| Option | Consequence if chosen |
|---|---|
| **`incognito: "not_allowed"` in Firefox's manifest** | Doublespeed never runs in a private window, and `about:addons` has no switch to allow it. One manifest key, no code. Videos in private windows play at the site's speed. |
| Run there, store nothing | Frame reports kept in the background's memory, and a site switch that refuses or lasts only the session. More code, and Firefox stops an idle background, which loses what is only in memory. |
| The same key on Chrome | Chrome has no such rule. It keeps extensions out of incognito until the user allows them, so that is its own decision. |

## Decision

Firefox's manifest sets `incognito: "not_allowed"`; Chrome's manifest sets nothing.

## Consequences

**Enables** — the addons.mozilla.org submission, with nothing from private browsing stored, and no
code that checks `tab.incognito`.

**Costs** — Firefox users can't have 2× in private windows. Nothing changes for a user who never
allowed Doublespeed there, which is Firefox's default. The browsers differ: on Chrome a user can
still allow it in incognito, where it stores what it stores everywhere else.

Checked on Firefox 128.14 ESR and 160.0: `about:addons` shows "Not Allowed in Private Windows" in
place of the switch; a private window gets no toolbar button and no shortcuts, its videos stay at
1×, and no frame report is stored for it. A private-window grant from before the key is dropped
when Firefox starts the add-on.

**Binds** — nothing hard to reverse. Removing the key brings Firefox's switch back.

## Revisit when

Users ask for Doublespeed in Firefox's private windows, or the Chrome Web Store adopts a rule like
Mozilla's.
