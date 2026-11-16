# doublespeed

Doublespeed is a Chrome and Firefox extension that plays every web video at 2× by default, for people who watch most things faster than 1×. [README.md](README.md) covers what it does and how to run it;
[SPEC.md](SPEC.md) is the design and its vocabulary; [ROADMAP.md](ROADMAP.md) holds the phases.

## Working here

- **Layout:** `entrypoints/` holds the WXT entrypoints (`popup/` today; `content.ts`, `background.ts` and `options/` arrive in Phases 1–3). `src/lib/` holds browser-independent logic with its `*.test.ts` beside it. `public/_locales/en/messages.json` holds every UI string. `wxt.config.ts` generates the manifest.
- **Commands:** `make dev` opens Chrome with the extension live-reloading and `make dev-firefox` does the same in Firefox. `make test` runs Vitest. `make lint` runs svelte-check (TS and Svelte, warnings fail) and `web-ext lint` on a Firefox build. `make zip` produces the store zips.
- **Ports:** :3210 for WXT's dev server and :3211 for the Playwright fixture server (Phase 1). Both are off the ports other projects in `~/projects` claim (3000/3001, 3100, 5178, 7420s, 8080, 8100).
- **Vocabulary:** SPEC §3 is the glossary (default speed, override, site reset, page site, site pattern…). Use its terms in code and docs.
- **Hard requirements:**
  - **Permissions:** only `storage` and `<all_urls>`. Adding any permission needs an ADR, because both stores ask for a justification.
  - **No network:** no network requests and no analytics, ever (ADR-0006).
  - **Builds:** Manifest V3 on Chrome 120+ and Firefox 128+ (ADR-0002).
  - **Text:** every UI string goes through `browser.i18n`.
- **Pinned tooling:** TypeScript stays on 6.x until `svelte-check` supports 7. `web-ext lint` reports two known warnings: Svelte's `innerHTML` and `data_collection_permissions` on Firefox 128. Errors fail the lint; warnings don't.

## Agent skills

### Issue tracker

GitHub Issues on `GWSoT/doublespeed`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, using their default label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context. ADRs live in `docs/decisions/`, not `docs/adr/`. See `docs/agents/domain.md`.
