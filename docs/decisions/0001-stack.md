# ADR-0001 — WXT + TypeScript, Svelte 5 for the UI

- **Status:** accepted
- **Date:** 2026-11-16
- **Deciders:** Nazar (grilling session, round 2 Q8)
- **Phase:** 0

## Context

One codebase has to produce a Chrome and a Firefox package, both Manifest V3, with a popup
and an options page that will grow as more enhancers arrive.

## Options considered

| Option | Consequence if chosen |
|---|---|
| **WXT + TypeScript** | Builds both browsers from one source, reloads the extension live in dev, produces store zips, and has `wxt submit` for automated uploads later. |
| Plasmo | React-first, slower-moving, heavier output. |
| Plain Vite + hand-written manifests | Full control, but we'd rebuild what WXT already does for two browsers. |
| UI: vanilla TS | Fine for today's three controls; painful once volume and brightness controls arrive. |
| **UI: Svelte 5** | Compiles to a small bundle (~25 kB popup today); components scale with the UI. |

## Decision

WXT + TypeScript, Svelte 5 for the popup and options page, npm, Vitest for logic, Playwright
on Chromium for end-to-end tests, `web-ext lint` for Firefox.

## Consequences

**Enables** — one `npm run build` / `build:firefox` pair; typed browser APIs via WXT's `browser` global.

**Costs** — TypeScript is pinned to 6.x because `svelte-check` 4 doesn't support TypeScript 7 yet.
Svelte's runtime sets `innerHTML` from static templates, which `web-ext lint` reports as a warning
(not an error) on every build.

**Binds** — WXT's `entrypoints/` layout and its `.wxt/` generated types.

## Revisit when

`svelte-check` supports TypeScript 7, or WXT stops tracking new browser releases.
