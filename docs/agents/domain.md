# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring
the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — not created yet. `/domain-modeling` creates it
  lazily, the first time a term actually needs resolving.
- **`docs/decisions/`**: read the ADRs that touch the area you're about to work in.
  `0000-template.md` is the scaffold. Derive the next number rather than trusting a value
  written down here:

  ```bash
  printf '%04d\n' $(( $(ls docs/decisions/ | grep -oE '^[0-9]{4}' | sort -n | tail -1) + 1 ))
  ```

> **Path note.** ADRs live in `docs/decisions/`, where the skills' default template says
> `docs/adr/`. README, ROADMAP and SPEC link them at this path.

If any of these files don't exist, **proceed silently**.

## File structure

Single-context: one extension, one vocabulary (SPEC §3).

```
/
├── SPEC.md                 ← system specification; §3 is the glossary
├── ROADMAP.md              ← phases, decisions and rejected alternatives
├── wxt.config.ts           ← WXT config; generates manifest.json for both browsers
├── entrypoints/            ← WXT entrypoints: popup/ (and content.ts, background.ts, options/ later)
├── src/lib/                ← browser-independent logic + its Vitest tests
├── public/_locales/        ← i18n messages; every UI string lives here
├── assets/                 ← icon source
├── docs/
│   ├── decisions/          ← ADRs (+ 0000-template.md)
│   └── agents/             ← this file
└── .output/                ← build output (gitignored)
```

## Use the glossary's vocabulary

Until `CONTEXT.md` exists, the vocabulary section of `SPEC.md` is the glossary. Use its
terms as written there.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently
overriding it.
