# ADR-0004 — Disabled sites: exact hostnames, `*.` for subdomains, the address bar decides

- **Status:** accepted
- **Date:** 2026-11-16
- **Deciders:** Nazar (grilling rounds 1 Q5, 2 Q5–Q7, 3 Q2–Q5)
- **Phase:** 0

## Context

The extension runs everywhere, so the per-site off switch is the escape hatch for every case the
rules get wrong. YouTube Music plays music through a `<video>`.

## Options considered

| Option | Consequence if chosen |
|---|---|
| Exact hostname only | Simple, but no way to cover a site's subdomains in one entry. |
| **Exact hostname, plus `*.example.com` for subdomains** | Disabling only `music.youtube.com` stays possible; two lines of matching code, no dependency. |
| Always the registrable domain | Needs a bundled public-suffix list, and disabling YouTube Music would disable all of YouTube. |

## Decision

- **Patterns:** `example.com` matches that hostname exactly, ignoring a leading `www.`. `*.example.com` matches the domain and every subdomain.
- **Where rules are made:** the popup switch always adds the exact hostname. The `*.` form is only entered on the options page, whose Add site field reduces a pasted URL to its hostname and says what will be disabled.
- **Which site counts:** the page site in the address bar decides for every frame in the tab. Disabling a blog disables its embeds, and disabling `youtube.com` doesn't affect YouTube embeds elsewhere.
- **Install default:** `music.youtube.com` is seeded as disabled and can be removed.
- **Storage:** each rule is its own `storage.sync` item (`site:<pattern>`), so the list syncs across devices and never hits the 8 KB per-item limit.

## Consequences

**Enables** — per-site speeds later, by adding a field to the rule.

**Costs** — about 500 rules at most (`storage.sync`'s 512-item limit). Iframes must ask the
background for the page site, because Firefox has no `location.ancestorOrigins`.

**Binds** — the `site:<pattern>` key format.

## Revisit when

Users ask for per-site speeds, or hit the item limit.
