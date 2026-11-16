# ADR-0002 — Manifest V3 on Chrome 120+ and Firefox 128+; Safari later

- **Status:** accepted
- **Date:** 2026-11-16
- **Deciders:** Nazar (grilling rounds 1 Q3, 3 Q8)
- **Phase:** 0

## Context

"Every video by default" only works if the extension gets access to all sites at install.
WXT builds Firefox as MV2 by default.

## Options considered

| Option | Consequence if chosen |
|---|---|
| **MV3 everywhere, Chrome 120+, Firefox 128+** | One manifest shape. Firefox grants MV3 host permissions at install from 127 on, and 128 is an extended-support release. |
| MV2 on Firefox | Works on older Firefox, but a second code path, and MV2 is on its way out. |
| Firefox < 127 | MV3 host permissions weren't granted at install; users had to enable them by hand, which breaks "on by default". |
| Safari now | Needs an Xcode app wrapper and a $99/yr Apple developer account. |

## Decision

Manifest V3 for both browsers, `minimum_chrome_version: 120`, `strict_min_version: 128.0`.
Ship on the Chrome Web Store and addons.mozilla.org. Safari is deferred. Firefox for Android is out
of scope for v1 (it has no `commands`).

## Consequences

**Enables** — the same `host_permissions`, `commands` and `action` code on both browsers.

**Costs** — Firefox lets users revoke MV3 site access at any time, and Chrome lets users restrict it,
so the popup must detect missing access (`permissions.contains`) and offer to grant it.
The no-data declaration Mozilla now requires (`data_collection_permissions`) is only read by
Firefox 140+, so `web-ext lint` warns that 128 doesn't support the key. Older versions ignore it,
which is harmless because we collect nothing.

**Binds** — the Firefox add-on ID `doublespeed@gwsot.github.io`. It can't change after the first AMO upload.

## Revisit when

Safari becomes worth the developer account, or Firefox 140 becomes the oldest supported ESR, which
would let the minimum rise and clear the lint warning.
