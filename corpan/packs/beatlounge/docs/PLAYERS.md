# Players — an infinitely-scalable modulation protocol

> Status: DESIGN (build is a later round). This doc supersedes the ad-hoc
> `Modulator` concept; `Modulator[]` becomes one *kind* of `Player`.

## 1. What a Player is

A **Player** is a small, declarative unit that **drives a TARGET** (any
addressable parameter) **from a SOURCE** — over time, or in **response to a
change of another value**. It is the generalization of today's global
`Modulator`: instead of "an LFO bound to a `ParamTarget`", a Player is a
*target-agnostic*, *source-agnostic* rule that resolves to `applyParam` writes
on the scheduler clock.

The founder's framing — "tweakers should be granular little things we could put
on ANY value or change of values … an infinitely scalable protocol that a 4B
LLM could generate more of" — is exactly this: a flat JSON schema with a small,
open set of **kinds**, each of which is a pure function
`(player, ctx) → number` evaluated every audio tick.

Players are a **live overlay**. As today, the document keeps the BASE value of
every param; the Players engine computes an offset/value each tick and pushes it
to the live audio node via `host.applyParam(target, value)` — **no document
write, no undo step**. Removing a Player restores the base value. This is the
same seam the FX knobs already use for live drags (`TrackFxChain`'s
`liveParam`), so Players need no new audio plumbing.

```
Player.source ──(evaluate at tick)──▶ value ──(map to param range)──▶ host.applyParam(target, value)
```

### Schema

```ts
interface Player {
  id: Id
  /** "Bass cutoff breathe", "Reverb swell" — optional, LLM/agent authored. */
  name?: string
  /** WHERE it writes — the addressable-value space (see §2). */
  target: PlayerTarget
  /** WHAT shape/logic drives it (see §3). */
  kind: PlayerKind
  /** Kind-specific params (depth, center, rate, steps, mapping…). */
  params: Record<string, number | string | boolean | number[]>
  enabled: boolean
}
```

`kind` + `params` is deliberately a flat bag (mirrors `EffectNode` and
`analogSynth`) so a new kind never churns the union — the same reason the
effects model scaled. A Player is fully described by JSON; nothing is implied by
code position.

## 2. Target addressing — "any value or change of values"

A Player writes to a **value source** and (optionally) *reads* one. Both reuse
and extend today's `applyParam` target union, so a Player can attach to
**anything the host can already drive live**.

```ts
type ValueRef =
  // every existing applyParam target (zero migration cost):
  | { scope: "track";      trackId: Id; param: "volume" | "pan" }
  | { scope: "insert";     trackId: Id; insertId: Id; param: string }
  | { scope: "send";       trackId: Id; sendId: Id; param: "level" }
  | { scope: "instrument"; trackId: Id; param: string }
  | { scope: "bus";        busId: Id; param: string }
  | { scope: "master";     param: "volume" }
  // NEW addressable sources the protocol adds:
  | { scope: "macro";      macroId: Id }              // a named user/LLM macro 0..1
  | { scope: "transport";  signal: "bar" | "beat" | "position" }

/** A Player's write destination is any writable ValueRef. */
type PlayerTarget = Extract<ValueRef, { scope: "track" | "insert" | "send" | "instrument" | "bus" | "master" | "macro" }>
```

**Change-of-value** is a first-class source. A Player whose `kind` reads
*another value's delta* (e.g. `value-mapper` / `envelope-follower`) takes a
`source: ValueRef` in its params. That is the literal "put it on a change of
values" requirement: the Player samples `source` each tick, computes its delta
or level, maps it through a curve, and writes its `target`. Example: *"when the
kick gets louder, open the bass filter"* → source = kick track volume, target =
bass instrument cutoff, kind = `envelope-follower`.

To keep the engine acyclic, **a Player may not read a value another Player
writes this tick** (the validator rejects cycles; reads see the *base* value of
a written param). This is the one non-obvious safety rule.

## 3. The catalog of Player KINDS

Each kind is a pure `evaluate(player, ctx): number` (in normalized 0..1 param
space; the engine remaps to the target's real range). Adding a kind = one
function + one schema entry; the protocol is open-ended *by construction* — a
4B LLM can be shown the kind table and asked to emit more.

| kind | what it does | key params |
|------|--------------|-----------|
| `lfo` | periodic shape (today's `Modulator`) | `shape` (sine/triangle/saw/square), `syncBeats` \| `rateHz`, `depth`, `center`, `phase` |
| `random` | stepped sample-&-hold at the rate | `syncBeats`, `depth`, `center`, `seed` |
| `drift` | smooth random walk (perlin-ish) | `rateHz`, `depth`, `center`, `seed` |
| `envelope` | one-shot AD/ADSR fired by a trigger | `attack`, `decay`, `sustain`, `release`, `trigger` |
| `envelope-follower` | tracks the *level* of a `source` ValueRef | `source`, `attack`, `release`, `gain`, `curve` |
| `value-mapper` | "when X changes, do Y" — maps `source` (or its delta) through a curve to the target | `source`, `mode` (`level`\|`delta`), `inMin`, `inMax`, `curve`, `outMin`, `outMax` |
| `step-sequence` | a per-step value lane locked to the grid | `steps` (number[]), `lengthBeats`, `glide` |
| `ramp` | one linear/expo sweep from A→B over a duration, then holds | `from`, `to`, `beats`, `curve` |
| `sample-hold` | latches the target to a value on a trigger | `value`, `trigger` |

`sample-&-hold` and `random` differ only in trigger source (explicit vs.
rate). `lfo` is a strict superset of today's `Modulator` (same `shape`,
`syncBeats`/`rateHz`, `depth`, `center`, `phase`, `seed`), which is why
migration is loss-free (§5).

### Resolution on the clock

The Players engine runs in the existing modulation evaluation pass:

1. For each enabled Player, compute the tick phase from `syncBeats`/`rateHz`
   against the transport clock (or read `source`/`trigger` for reactive kinds).
2. `value = clamp01(evaluate(player, ctx))` in normalized space.
3. Remap to the target param's real range (the same range table the Knobs use).
4. `host.applyParam(player.target, real)`.

Reactive kinds (`envelope-follower`, `value-mapper`) read their `source` via the
engine's value-read seam (base value + any non-Player live value), never another
Player's same-tick output.

## 4. LLM-authorability

The keyword/LLM tool emits a Player as **plain JSON** matching the schema above.
A single `addPlayer` action (and `addPlayers` for a bundle = today's "agents")
takes the JSON, runs it through the validator, and dispatches one command (one
undo step). The validator:

- resolves `target`/`source` against the live doc (rejects stale ids),
- checks `kind` is known and `params` carry the kind's required keys,
- **clamps every numeric param to the kind's safe bounds** (depth ≤ 1, rate
  within audible/musical limits, step counts ≤ a cap) so a hallucinated value
  can never blow up the audio,
- rejects read/write **cycles** (§2).

So *"add an LFO on the bass cutoff"*, *"make the reverb breathe"*, *"when the
kick hits, duck the pads"* all map to one valid Player object. Because the kind
table is small and flat, the model only needs the kind list + the target it
resolved from the corpus/track names.

### Example Player JSON

```jsonc
// 1. "Make the bass filter breathe" — slow sine on a synth cutoff.
{
  "id": "ply_a1",
  "name": "Bass breathe",
  "target": { "scope": "instrument", "trackId": "trk_bass", "param": "cutoff" },
  "kind": "lfo",
  "params": { "shape": "sine", "syncBeats": 8, "depth": 0.5, "center": 0.45 },
  "enabled": true
}
```
```jsonc
// 2. "Make the reverb swell" — slow drift on a send level.
{
  "id": "ply_a2",
  "name": "Reverb swell",
  "target": { "scope": "send", "trackId": "trk_pad", "sendId": "snd_rev", "param": "level" },
  "kind": "drift",
  "params": { "rateHz": 0.05, "depth": 0.6, "center": 0.4, "seed": 7 },
  "enabled": true
}
```
```jsonc
// 3. "When the kick gets louder, open the bass filter" — change-of-value.
{
  "id": "ply_a3",
  "name": "Kick → bass cutoff",
  "target": { "scope": "instrument", "trackId": "trk_bass", "param": "cutoff" },
  "kind": "envelope-follower",
  "params": {
    "source": { "scope": "track", "trackId": "trk_kick", "param": "volume" },
    "attack": 0.005, "release": 0.18, "gain": 1.2, "curve": "expo"
  },
  "enabled": true
}
```
```jsonc
// 4. "Throb the master volume with the beat" — tempo-synced step lane.
{
  "id": "ply_a4",
  "name": "Master pulse",
  "target": { "scope": "master", "param": "volume" },
  "kind": "step-sequence",
  "params": { "steps": [1, 0.7, 0.85, 0.7], "lengthBeats": 4, "glide": 0.1 },
  "enabled": true
}
```

## 5. Migration — additive, loss-free

`Modulator` is a strict subset of the `lfo`/`random`/`drift` Player kinds. The
rename path keeps **zero data loss**:

- `BeatloungeDoc.modulators: Modulator[]` stays on disk; add
  `players?: Player[]`.
- On load, `migrate()` folds each legacy `Modulator` into a Player:
  `kind = mod.shape ∈ {random} ? "random" : mod.shape === "drift" ? "drift"
  : "lfo"`; `params` = `{ shape, syncBeats, rateHz, depth, center, phase, seed }`;
  `target` = the same `ParamTarget`. The reverse view (`Player → Modulator`) is
  trivial for the three legacy kinds, so old runtimes that only read
  `modulators` keep working during the transition window (same playbook as the
  three-shape reader catalog).
- The engine reads `players` when present, else the migrated `modulators`. New
  authoring writes only `players`. Once every surface reads `players`, the
  `modulators` field can be dropped in a later, separate migration.

This is owned by the **model/scenes agent** — this doc only specifies the shape;
the model edits land next round.

## 6. Naming + UI surface

The name is **Players**. Three surfaces, smallest-footprint first:

**(a) The Players panel** (today's Tweakers immersive, renamed). The agent row
becomes "summon a bundle of players"; the list becomes a responsive grid of
Player cards (the layout shipped this round under the old names). Each card:
power · target label · kind picker · the kind's params · remove.

```
┌─ PLAYERS ──────────────────────────────── 3 live ─┐
│  [Breathe] [Drift] [Chaos] [Evolve] [Pulse]  [Clear]│
│  ┌───────────────────┐ ┌───────────────────┐        │
│  │ ● Bass · Cutoff  ✕│ │ ● Pad · Rev Send ✕│        │
│  │ lfo ▾  8 beats ▾  │ │ drift ▾  slow ▾   │        │
│  │ (depth) (center)  │ │ (depth) (center)  │        │
│  └───────────────────┘ └───────────────────┘        │
└─────────────────────────────────────────────────────┘
```

**(b) Per-value "attach a player" affordance.** Any Knob / XY pad gains a small
dot in its corner; tapping it opens "attach a player" seeded with that param as
the `target` — the literal "put it on any value". This is the granular entry
point the founder wants and reuses the panel's card editor inline.

**(c) Mixer presence** (founder: "I kinda like 'players' in the mixer part").
Each mixer strip shows a tiny live indicator when a Player is driving any of its
params (a breathing dot on the fader), and the strip's overflow menu offers
"attach a player" on volume/pan/sends. No new strings beyond "Players" and a
short per-kind label set.

```
mixer strip:   [ name ]
               [ ● fader ]   ← breathing dot = a player is driving this
               [ pan ]
```

## 7. Build plan (next round)

1. **Model** (scenes agent): add `Player`/`PlayerKind`/`PlayerTarget`/`ValueRef`
   + `players?` field; `migrate()` fold; commands `addPlayer`/`addPlayers`/
   `editPlayer`/`removePlayer`/`setPlayerEnabled`/`clearPlayers`. Loss-free
   superset of the modulator commands.
2. **Engine**: a pure `evaluate(player, ctx)` per kind in `players/kinds.ts`
   (port `modulation/shapes.ts`); a value-read seam for reactive kinds; the
   per-tick resolve loop writing via `applyParam`. Cycle guard.
3. **Validator + LLM tool**: `parsePlayer(json, doc)` with clamping + cycle
   rejection; wire `addPlayer`/`addPlayers` into the action registry so keywords
   and the LLM emit Players. Seed the agent bundles from the kind catalog.
4. **UI rename**: Tweakers → Players panel (card grid already responsive);
   per-Knob attach dot; mixer breathing dot. Minimal new strings.

### Test gate

- `players/kinds.test.ts` — each kind is pure + deterministic given seed;
  output stays in 0..1; `lfo` matches the legacy `shapeValue` byte-for-byte.
- `migration.test.ts` — every legacy `Modulator` round-trips to a Player and
  back with no field loss; a doc with only `modulators` plays identically.
- `parsePlayer.test.ts` — clamps out-of-range params; rejects stale
  target/source ids, unknown kinds, and read/write cycles.
- `npm run typecheck && npm run test:run && npm run build` green.
</content>
</invoke>
