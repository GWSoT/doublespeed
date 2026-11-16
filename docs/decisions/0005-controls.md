# ADR-0005 — Browser-level shortcuts, a badge and a brief speed label

- **Status:** accepted
- **Date:** 2026-11-16
- **Deciders:** Nazar (grilling rounds 2 Q3–Q5, 3 Q7, Q13, round 4 Q1)
- **Phase:** 0

## Context

Many players have no speed menu (X, most embeds), so without our own controls a user is stuck at
the default unless they disable the site.

## Options considered

| Option | Consequence if chosen |
|---|---|
| Single-key shortcuts in the page (S/D) | Fast, but clash with site shortcuts and typing. |
| **Browser `commands`** | Never clash; rebindable. Need a modifier, and only letters, digits, Comma, Period and navigation keys are allowed (`/` isn't). |
| A permanent on-video speed label | Clutter, and fragile in fullscreen. |
| **A brief speed label + a toolbar badge** | Visible when it matters, invisible otherwise. |
| A welcome tab on install | Many users find it annoying. |

## Decision

- **Shortcuts:** `Alt+.` faster and `Alt+,` slower in 0.25 steps. `Alt+R` sends a video at any speed other than 1× to 1×, and a video at 1× to the default. Each acts on every video in the tab, iframes included, and sets an override.
- **Badge:** shows the speed of the video playing or last played, only on tabs with a video, and always `off` on disabled sites.
- **Speed label:** a ~1 s on-video label after our controls change the speed.
- **Popup:** the site switch, this tab's −/+ and the default speed, plus a one-time shortcut hint.
- **Options page:** the site list, Add site, and a link to the browser's shortcut settings.
- **Install:** no welcome tab.

## Consequences

**Enables** — control on every player, with no conflicts.

**Costs** — on macOS, Option+. / Option+, / Option+R normally type ≥ ≤ ®; the shortcuts take those over
inside the browser. Users can rebind.

**Binds** — the command names users rebind (`speed-up`, `slow-down`, `toggle-speed`).

## Revisit when

Users ask for in-page single-key shortcuts.
