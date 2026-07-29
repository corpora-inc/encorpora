# THE STEELYARD

> His pan carries the sum and never its total. Yours carries a number you steer
> with place-value counterweights. Hold exactly one notch ahead.

An arm-wrestle across a steelyard beam. The directory is still `counterweight`;
the game is **THE STEELYARD**, renamed away from `games/balance`'s COUNTERPOISE,
which it was being confused with. Rank 30, S tier, in
[`docs/catalog/ARCADE_CANON.md`](../../docs/catalog/ARCADE_CANON.md), after
*Arm Wrestling* (1985). The canon entry calls it **the most unmashable design in
the catalogue**, which is a claim about behaviour, so
[`src/test/mash.test.ts`](src/test/mash.test.ts) settles it by playing rather
than by arguing.

## The loop

The Iron Turk sits across the beam.

**His pan** carries a column operation — `473 + 168`, drawn as a column, ruled
underneath. Its total is never anywhere on the screen.

**Your pan** carries a load, a numeral, and it stays where you left it between
rounds.

**The rack** is four pillars — thousands, hundreds, tens, ones — each with a face
that hangs weight on and a face that takes it off. That is the entire input
vocabulary. There is no keypad.

**The rule is `load − his = 1`.** Not "somewhere above": one. That is what
winning an arm-wrestle looks like — never comfortable, a hair in front — and it
is what makes the answer exact instead of a range you could bracket by watching
the beam lean.

Strike **SEAT** and the beam is judged. One notch ahead and he gives ground; five
lengths of ground and the Turk goes over. Anything else and he takes a length
back.

## Where the mathematics is

Two column operations per round, both native, neither of them a question anybody
asks out loud.

1. **Evaluate his column.** `473 + 168` is 641, and nothing on the screen is
   going to tell you.
2. **Decompose the difference.** You are on 500 and you need 642, so the round is
   asking for 142 — one hundred, four tens, two ones.

And the thing a child works out for themselves, because the rack has a take-off
face: **eight is not eight ones, it is ten less two**. Going from 613 to 621 the
naive path is eight blows on the ones pillar; the short path is one on the tens
and two off the ones. That is balanced base-ten notation, and
[`game/places.ts`](src/game/places.ts) is simultaneously the optimal player and
the definition of what the game is asking for.

What crosses to the host is `load − 1`: the value the child's beam *asserted* his
column to be. Play it right and that is the canonical value. Drop a carry and it
is the mal-rule output — exactly — so the misconception routes itself with no
extra wiring. The game never compares anything to an answer; the host judges.

## Why mashing loses

A steelyard is a bar of steel. Hang a weight on it and it rings, and a bar struck
again while it is still ringing rings harder, because the second blow arrives in
phase with the first. Keep that up and the steel does not get loud — it shears.

So [`game/strain.ts`](src/game/strain.ts) charges every blow by **when it lands**.
A blow after the ring has died costs 2. A blow straight on top of the last one
costs 13. Strain bleeds out at 6 a second and the beam shears at 34.

| Player | What happens |
|---|---|
| Hits everything as fast as a thumb moves | Shears in about a fifth of a second, every round, forever |
| Hits one plate fast | Same |
| Hits one plate slowly, under the resonance window | Never shears — and never gets anywhere either: a pan only travels so far in ones, and nothing about walking it lands on the one notch |
| Hunts by watching which way the beam leans | Every probe needs the beam to stop ringing first, and the window runs out |
| Does the arithmetic | Ten deliberate blows, a quarter-second apart, peaks at about a third of the shear limit |

That last row is the one that makes the rest mean anything, so
`mash.test.ts` asserts it too: over twelve seeds a solver puts six or more Turks
over and shears the beam never, while every masher, every hammer on every one of
the eight faces, and the beam-watcher put over **zero**.

Two more pressures keep the round live without being mashable — and neither of
them charges a child for thinking:

* **The clock.** The window belongs to the weight, not to the Turk. See
  [The window](#the-window).
* **The sag.** A pan nobody is tending settles — one unit, then another. You
  cannot find the notch early and sit on it. Any strike re-seats it, and **it
  does not run at all before your first blow of the round**, so it only ever
  bites a player who has stopped playing rather than one who has not started.

## The window

The press window used to be `timingForBout()`: 13.0 s at the first Turk, 1.1 s
less at every one after, down to a 7.6 s floor. The bout counter is also what
escalates the arithmetic, so the child got less time exactly as the sums got
harder — the defect `docs/PACING_AUDIT_2026-07.md` names in seventeen games, and
this pack's own solver bot measured it: at the house cadence table's p90 for a
two-digit regrouping the bot held **0 of 78 rounds**.

[`game/window.ts`](src/game/window.ts) replaces it. The window is
`comprehension(item) + motor(item)`, both pure functions of the weight on his
pan, both monotone non-decreasing in its width, and **no bout number, elapsed
time or speed may appear in either**.

| item | comprehension | motor | window | was |
|---|---|---|---|---|
| `43 + 25` | 11.0 s | 3.5 s | **14.5 s** | 13.0 → 7.6 s |
| `47 + 25` | 14.0 s | 3.5 s | **17.5 s** | 13.0 → 7.6 s |
| `473 + 168` | 23.0 s | 5.25 s | **28.3 s** | 13.0 → 7.6 s |
| `5,001 − 2,798` | 40.0 s | 7.0 s | **47.0 s** | 13.0 → 7.6 s |

The comprehension term is the house cadence table's **p90**, not its p50: the
window is where the whistle takes the round away, so it is sized for the child
who is slow today. The motor term is the one the old window did not have at all
— the plates the answer decomposes into, priced at `BASE_STRAIN / BLEED_PER_SEC`,
the fastest cadence [`strain.ts`](src/game/strain.ts) lets a correct player
sustain without shearing. At the top of the old ladder a p90 plan was 7.0 s of
pure motor work inside a 7.6 s window.

**The whistle takes nothing.** Running out of time is not a wrong answer: no
ground moves, nothing is reported, and the item is closed with the host's `skip`
rather than with a `report` that would file a miss and walk the ladder down on a
child who was still carrying the hundreds column.

## Escalation

The Turk gets stronger by the arithmetic and by nothing else. There is no bout
counter in any duration in the game.

[`game/ladder.ts`](src/game/ladder.ts) names a rung on every single weight —
`next({ difficulty, maxDifficulty })`. The opening rung is the bottom of the
curriculum, which is what "it starts way too hard" was: the game used to ask for
nothing and take whatever the scheduler had stocked. It climbs one rung per Turk
put over — five net holds, achievement and never a clock — and comes back down
one on a pinning. `raiseFloor` is deliberately not called: a permanent floor is
exactly what would stop a struggling child getting easier work again.

## The beam

[`sim/beam.ts`](src/sim/beam.ts) is a real spring and damper, and its resting
angle is a *saturating* function of the margin: fine gradation within a few units
of level, hard against its stop past that. So it confirms an answer and refuses
to hand one over — there is no magnitude information out where a three-digit
number lives.

A bowed-metal drone tracks the tilt, so the beam is audible as well as visible
and a child can hold the notch with their eyes on the rack. The plates are
pitched by place: the ones plate is a bright tick, the thousands a low clang.
Place value is a thing you can hear here.

**Reduced motion is a branch, not a degradation.** The beam still moves, because
the beam moving *is* the information; it is critically damped instead, so it
travels to its reading and stops rather than ringing its way there. Same reading,
same reach, same clock — every duration in `TIMING_REDUCED` is identical.

Your load stays where you left it between rounds, which is what makes each round
only the *difference*. The one exception is when the ladder moves out from under
it: a pan sitting on 8,367 when the next weight is `43 + 25` is re-racked near
the new magnitude rather than costing a whole calm round of unwinding.

## The arithmetic it is served

The host serves from the curriculum's `add` domain — the only active one, seven
live rows, all whole-number column addition and subtraction — and reveals the
canonical value, which becomes the weight on his pan. `items.reveal` is
load-bearing: without it the adapter drops every item and the pack serves nothing
at all, silently.

[`stubHost.ts`](src/stubHost.ts) is that runtime, offline: the same ladder, exact
integer arithmetic throughout, and distractors that are real mal-rule outputs
ported from
[`malrules/columnOp.ts`](../../packs/shared/curriculum/src/malrules/columnOp.ts)
with their `applies()` guards intact.

## Being pinned

Nothing is taken. The arm goes back to level and the same Turk squares up again,
no harder than before — ADR-0009, stakes without loss. `transition` is called at
exactly one place in this game, when a Turk goes over, and never anywhere near a
defeat.

## Running it

```
npm install
npm run dev        # the standalone harness on :4327, stub host, no runtime needed
npm test           # 136 cases: the rules, the window, the ladder, the strain, the mashers
npm run tsc
npm run build:pack # the installable pack
```

In the dev harness: `Q/A` ±1000, `W/S` ±100, `E/D` ±10, `R/F` ±1, space seats the
beam, and `p` raises and lowers a sheet — the same call the host makes.
