# ADR-0003 — Every video starts at the default speed; the user's change wins for that video

- **Status:** accepted
- **Date:** 2026-11-16
- **Deciders:** Nazar (grilling rounds 1 Q4–Q8, 2 Q1–Q2, 3 Q6)
- **Phase:** 0

## Context

Sites change `playbackRate` themselves (YouTube resets to 1× on every video and around ads), and
users change it through site menus. `ratechange` doesn't say who did it.

## Options considered

| Option | Consequence if chosen |
|---|---|
| Enforce the default always | Fights the user's own choice. |
| **Apply per source; respect user changes, undo site resets** | The default holds across videos, the user's in-the-moment choice wins, sites can't silently reset it. Needs a heuristic to tell users from sites. |
| Sticky: the last chosen speed becomes the default | Surprising; one slow tutorial changes everything after it. |

## Decision

The rules in SPEC §3.2. In short:
- Only `<video>`, never `<audio>`.
- No rules for "decorative" videos.
- Live videos (`duration === Infinity`) are left alone, even when rewound.
- The default speed applies on every new source.
- A change within ~1 s of a trusted click or keypress becomes that video's override, but only if the input came after the default was applied to the current source.
- Any other change is a site reset and is undone, with a back-off so we never loop.
- The default speed is one global setting: 2× on install, 0.25×–4× in 0.25 steps.
- Settings changes apply to open tabs immediately.

## Consequences

**Enables** — a predictable rule users can learn: "new video, 2×; I changed it, it stays".

**Costs** — the input window is a heuristic. A site reset that follows an unrelated click on the
same source within a second is read as the user's choice. The worst case, clicking "next video",
is handled: input before the current source was sped up never counts (ROADMAP risk 1).

**Binds** — per-video state is in memory only; overrides never sync or survive a reload.

## Revisit when

Testing on real sites shows the input-window heuristic misreading resets often enough to annoy.
