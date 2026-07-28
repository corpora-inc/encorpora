# THE COUNTERWEIGHT

> His pan carries the sum and never its total. Yours carries a number you steer
> with place-value counterweights. Hold exactly one notch ahead.

An arm-wrestle across a steelyard beam. Rank 30, S tier, in
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
| Hits one plate slowly, under the resonance window | Never shears — and never gets anywhere either: the window is thirteen seconds, a pan only travels so far in ones, and nothing about walking it lands on the one notch |
| Hunts by watching which way the beam leans | Every probe needs the beam to stop ringing first, and the window runs out |
| Does the arithmetic | Ten deliberate blows, a quarter-second apart, peaks at about a third of the shear limit |

That last row is the one that makes the rest mean anything, so
`mash.test.ts` asserts it too: over twelve seeds a solver puts six or more Turks
over and shears the beam never, while every masher, every hammer on every one of
the eight faces, and the beam-watcher put over **zero**.

Two more pressures keep the round live without being mashable:

* **The clock.** The window closes and the beam is seated where it stands. The
  whistle does not wait, and the load you had on the bar is the claim you made.
* **The sag.** A pan nobody is tending settles — one unit, then another. You
  cannot find the notch early and sit on it. Any strike re-seats it, so this only
  ever bites a player who has stopped playing.

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
npm test           # 78 cases: the rules, the strain, the beam, the mashers
npm run tsc
npm run build:pack # the installable pack
```

In the dev harness: `Q/A` ±1000, `W/S` ±100, `E/D` ±10, `R/F` ±1, space seats the
beam, and `p` raises and lowers a sheet — the same call the host makes.
