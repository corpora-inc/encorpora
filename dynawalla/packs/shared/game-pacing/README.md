# game-pacing

One number, `intensity` in `[0,1]`, that drives a game's **maths difficulty**,
its **speed** and its **density** together, in both directions.

```ts
import {
  SECOND_GRADE_FLOW, observe, settle, seedSuccess,
  countAt, valueAt, rungAt, revealMs,
} from "../../packs/shared/game-pacing/index.ts"

// state the GAME owns
let intensity = SECOND_GRADE_FLOW.start
let success = seedSuccess(SECOND_GRADE_FLOW)
let rung = 0

// once per frame
intensity = settle(SECOND_GRADE_FLOW, intensity, success, dt)
rung = rungAt(intensity, DIFFICULTY_RUNGS, rung)

// once per answer — `seconds` is thinking time on YOUR clock, not the wall's
success = observe(SECOND_GRADE_FLOW, success, correct, seconds)

// spend it
const enemies = countAt(intensity, 4, 26)
const speed = valueAt(intensity, 300, 520)
const holdTheAnswerMs = revealMs(SECOND_GRADE_FLOW, intensity)
```

## The rules it encodes

* **Drops on a single failure, climbs on sustained success** — and the climb
  rate scales with the strength of the evidence, so a competent player is never
  trapped walking every rung from `0 + 1`.
* **Time is measured and rewarded, never imposed.** `quickness()` is a bonus
  signal. A countdown, if a game has one, is something a player earns.
* **Silent.** No strings. Nothing here can be rendered, so nothing here can tell
  a child what it thinks of them.
* **Bounded, with a trivial floor and a patient reveal at it.** At the bottom
  the game's job is exposure and confidence, not throughput.

## Rules for this module

Pure functions over plain numbers. No DOM, no rendering, no timers, no module
state — `tsconfig.json` omits `"DOM"` from `lib` so the compiler enforces it.
The game owns every piece of state; this only ever computes the next value.
