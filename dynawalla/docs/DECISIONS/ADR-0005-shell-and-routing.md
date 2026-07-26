# ADR-0005 — Hash router, one window, parental gate in the shell

**Status:** Accepted

## Context

The app runs in a Tauri WebView under the `tauri://` origin on iOS and Android. Browser
history routing behaves inconsistently under custom protocols, and Android's hardware
back button must map to something predictable.

Separately, the first draft put the parental gate at M10, after nine milestones of UI
had been built around no gate.

## Decision

1. **One Tauri window, `createHashRouter` (react-router v7)**, with routes `/`,
   `/practice/:skillId?`, `/world`, `/progress`, `/settings`, `/profiles`. Hash routing
   works under `tauri://` and gives real Android back behaviour.
2. **Theme is applied synchronously at module load** via a store subscription toggling
   one `classList` entry — no flash, no effect-ordering bug.
3. **The `<ParentalGate>` component and its route guard ship in M1's shell**, before any
   link-out or purchase surface exists. Design constraints, amended 2026-07-25 by
   [ADR-0001](ADR-0001-kids-category-posture.md):
   - **The challenge is never arithmetic.** Apple's canonical illustrated gate is a maths
     problem, which is precisely why *this* app cannot use one — it spends every session
     training the skill the gate filters on. Reading load, not arithmetic, is the real
     barrier for a six-year-old. Viable: type the current four-digit year; type a
     spelled-out multi-syllable word; press-and-hold-and-drag for N seconds.
   - **Randomized** — a fixed challenge is memorised within a week.
   - **Non-persistent across sessions** — passing once never unlocks later launches.
   - Paired with a voiceover prompt if a 5-and-under band is ever elected.
   - **One component, both platforms.** Play mandates no general gate; do not fork the
     behaviour per store.
   - Guards: link-outs, any purchase/paywall/price display, Restore Purchases, the parent
     dashboard, anything that emails or shares a child's work, and — cheaply, because it
     is reviewer-discretion territory — microphone and push permission prompts. The
     privacy policy is rendered as an **in-app screen**, not an external URL, which
     removes that guard entirely.
4. **The Tauri capability surface is narrow from day one:** non-null CSP, per-command
   grants, never `<plugin>:default`.

## Consequences

- Every later link-out and purchase surface is built *behind* an existing gate rather
  than retrofitted under launch pressure. Retrofitting changes the navigation model on
  every such surface, which is how a gate becomes a checkbox.
- A live app cannot narrow its permissions after the fact without breaking installed
  clients, so point 4 must be right at creation time. Corpán's single
  `capabilities/default.json` — 11 of its 14 grants at `:default`, `csp: null` — is the
  precedent **not** being followed.
- Exactly one mechanical layer is inherited from Corpán's stylesheet: the
  `--safe-{top,right,bottom,left}` `env()` tokens, `--dialog-max-h`, and the `--z-*`
  ladder. Those are platform facts, not taste. The design system is otherwise built
  fresh.
