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
   link-out or purchase surface exists.
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
