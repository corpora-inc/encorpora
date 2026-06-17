# beatlounge — State Philosophy

**Status:** CONVENTION. This is how we hold state. New code follows it; old code
that doesn't is a bug waiting to surface (it already has — see the case studies).

> "When is `useState` the answer in any of this? Everything is sticky and
> persisted and specific to each track, of course." — the founder
>
> "I hate passing the same parameter through to 1000 components when they could
> just read the global state themselves."

---

## The rule

**Almost any important value that more than one component could use belongs in
global state — a single source of truth that every surface reads directly, at
the moment of use.** Don't thread it through props. Don't mirror it into local
`useState`. Don't keep a second copy in a ref that an effect tries to keep in
sync. One value, one home, read live.

"Important" means: it describes the song, the session, or a user intent that
should be *sticky* — survive switching voices, leaving a page, and (where it
makes sense) a reload. If two surfaces can disagree about it, it must be global.

This is not "global state is always better." It is "shared, owned, sticky state
is global; everything else is local." The line is **ownership**, not scope (see
*The one exception* below).

---

## Why — the failure modes this prevents

Every state bug we've chased came from breaking the rule:

- **Record arm desync.** The record toggle was a `useState` on the Instruments
  page *plus* a second flag inside the ribbon, *plus* the live capture path read
  a third copy from a ref that an effect mirrored. The chip could say "off"
  while the engine kept recording, and arming one synth bled onto the next.
  Three copies, three chances to disagree. → Fixed by one persisted, per-track
  store (`store/recordArm.ts`) read **directly at the instant a note is
  written** (`isRecordArmed(trackId)`), not via prop or ref.

- **Prop-drilled tempo.** A first cut at the tempo-synced delay threaded `bpm`
  through `createEffect → buildChain → update → the scratch bus` — the same
  value copied down four layers. → Fixed by one ambient source
  (`effects/tempo.ts`) the engine binds to the live doc once; every tempo-aware
  node calls `getBpm()`.

A mirror you keep in sync by hand *will* drift. A value passed through five
components *will* be passed wrong by the sixth. Read the source.

---

## How — the seams

Two shapes, both module-scoped singletons, both read at point-of-use:

1. **Per-entity stores** (vanilla zustand + `localStorage`), keyed by id, for
   state that is *specific to a thing* and must persist:
   - `store/recordArm.ts` — which tracks are armed to record (per track).
   - `store/selectedInstrument.ts` — the bound voice (per doc).
   - `store/selectedGroove.ts` — the +/− dial's groove.
   - `store/autoMelody.ts` — per-track auto-jam arm.

   Shape: `useThing(id)` for React subscription, `isThing(id)` / `setThing(id)`
   for imperative reads/writes at event time, `clearAll()` for a whole-song
   replace. Default OFF/empty; persistence is best-effort (guard `localStorage`).

2. **Ambient sources** — a tiny `bind…()` + `get…()` the engine points at the
   live document once, for state the *audio layer* reads but shouldn't import the
   React store to get:
   - `effects/tempo.ts` — `bindTempoSource(() => current.bpm)` at engine init;
     `getBpm()` everywhere else.

When a value crosses the React boundary into the pure DSP/engine layer, prefer
an ambient source over importing the store down there — it keeps the engine
testable (`bindTempoSource(() => 120)`) and the dependency one-directional.

---

## The one exception — pure leaves still take parameters

A **pure function** that computes from inputs keeps taking its inputs as
arguments, so it unit-tests without booting a global. The *caller* reads the
global and passes it in, at one boundary:

```ts
// pure + tested in isolation — bpm is an argument
export const delaySeconds = (params, bpm) => …

// the engine reads the ONE global at the single call site
node.delayTime.value = delaySeconds(params, getBpm())
```

So: **global for the source of truth; a parameter only at the pure edge.** The
anti-pattern is threading the same global value through a chain of *stateful*
components that could each have read it themselves — not handing a value to a
leaf calculator.

`useState` is for genuinely ephemeral, single-component view chrome with no
sticky meaning: a drawer's peek/raised, an open popover, an in-progress text
field. If you find yourself syncing a `useState` to something, or wishing it
survived a voice switch, it was never local — promote it to a seam above.

---

## Persistence & migration

Sticky state persists (localStorage for UI seams; the doc for musical state).
When the *shape* of a persisted value changes, migrate **once on load**, never
in the hot path — e.g. `effects/delaySyncMigration.ts` infers a delay's note
length from its saved seconds at load so old delays stay locked to their
division, with zero per-frame cost. Read the live value at use; pay the
one-time cost at the door.

---

Related: [`MODULARIZATION.md`](./MODULARIZATION.md) (extract shared surfaces),
and the model spine in `model/` (the document is the source of truth for
everything musical; these seams hold what is *not* on the document).
