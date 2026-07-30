# MATH NINJA

**A night-market slicer with an order to fill. One verb: cut.**

```
                        10  +  15  +  □  =  33
```

A customer places an order. It sits at the top of the screen until it is filled.
The market throws fruit. You cut what fills the order.

```bash
npm install
npm run dev        # http://127.0.0.1:4317 — playable standalone, stub Host included
npm test
npm run tsc
npm run build:pack # what installs on a tablet: pack.html only, no stub Host
```

The pack id and this directory are still `slice`, deliberately: the catalog, the
build and everything downstream key off them. Nothing a child can read says
anything but MATH NINJA.

---

## What this replaced, and why

The previous build shipped as `THE_SPLIT`. The founder played 0.3.6:

> "This is still the same. It needs to be 'Math Ninja' .. and the first time you
> open it it still has 1 billion things to slice and it is still the same button
> mashing crap it was before. All you do is just slice randomly and not ever
> think or care about anything."

He was right, and `dynawalla/docs/MATH_NINJA_DESIGN_2026-07.md` measured how
right by driving the shipped director for three simulated minutes:

| | 0.3.6 | MATH NINJA |
|---|---|---|
| simultaneous cuttable objects, median / p90 / max | **7 / 25 / 34** | **0–8 / 2–10 / 13** |
| on screen at t = 13 s | **16** | **2** |
| free unpriced cuts per arithmetic decision | **27.4** | **0.05–0.69** |
| an empty screen | forbidden by the "density contract" | tolerated, and at the calm end desirable |

Those numbers are re-measured on every test run by `src/test/director.test.ts`,
against the same model, and printed as a table. A claim of "calmer" that is not a
number is not a claim.

## The loop

| you cut | it does |
|---|---|
| a **helpful** gourd | its value drops into the blank. The order advances. **This is the only thing in the game that scores.** |
| a **decoy** gourd | bursts pale. No blank consumed, no score, nothing lost, nothing said. |
| an **overshoot** gourd | the sum completes itself, held, in the accent — and the order rotates. |
| a **melon** | opens to reveal what was inside. Never an overshoot: bad luck may not cost an order. |
| an **absurd** — `π`, `−∞`, `½` | bursts. Not every symbol is a whole number you can add. |
| a **bomb** | the market freezes. One question, **no timer of any kind**, and a correct answer hands the lamp straight back. |

**A helpful gourd and a decoy gourd are the same object.** Same silhouette, same
flesh, same motion, same size for the same digit count. Telling them apart is
arithmetic and nothing else. That is the game.

**Order does not matter.** `3 + 3 + 3 + 4` and `4 + 3 + 3 + 3` fill `= 13`
equally, and a child who takes the 4 first has not made a mistake. That is not a
special case in the code — the only state a classification reads is the residual,
which is a sum, and a sum is commutative. `order.test.ts` asserts it over every
permutation of many decompositions anyway.

## The rules that make it work

Three, in `src/sim/order.ts`, and together the first two make a dead end
**impossible by construction**:

- **R1 — classification.** A printed value `v` against residual `R` is
  *overshoot* iff `v > R`, *helpful* iff `R − v` is reachable as a sum of the
  rung's addend pool, and *decoy* otherwise. Recomputed on every slice, against
  the live residual. Reachability is one `Uint8Array(T+1)` per rung, filled once.
- **R2 — only a helpful slice consumes a blank.** A decoy changes no state at
  all. So every state the child can reach has `R` reachable, and a reachable
  `R > 0` decomposes, so its first part is in the frontier and the frontier is
  never empty. There is no losable resource and nothing to back out of.
- **R3 — the offer invariant**, in `src/sim/director.ts`. At every instant a
  value that advances the order is airborne, or arriving, and never more than
  `offerGap()` away — 1.2 s at the calm end, 4.0 s at the top.

R3 is why **there is no clock on any arithmetic anywhere in this game.**
Unlimited thinking time is not delivered by a generous timer; timers are the root
cause `PACING_AUDIT_2026-07.md` found seventeen times over, and a generous timer
is still a timer. It is delivered by *re-offering*. A child who needs forty
seconds to see that `33 − 10 − 15 = 8` watches eight waves go past and the 8 is in
every one of them. Nothing expires. Missing a fruit costs exactly what it costs
in Fruit Ninja Zen, which is nothing.

## Why mashing does not work

Score comes from one source only: **advancing or filling an order.** Not from
cutting. That single rule converts mashing from *punished* — which this product's
principles forbid — into *worthless*, which is the only sanction it is allowed to
apply.

| hole | closed by |
|---|---|
| swipe for volume | a cut that does not advance the order pays nothing at all |
| mash melons for free reveals | a melon reveal pays nothing; only the *use* of the value pays |
| complete orders by luck | **an overshoot rotates the order.** A masher's next indiscriminate slice destroys the order they were accumulating |
| farm the combo on absurds | an absurd breaks the stream |
| farm the bomb gate for lamps | the gate is lamp-neutral at best: it returns the one you spent and never grants a new one |
| the old cascade manufacturing free targets | the automatic factor cascade is gone. A melon splits once, and both halves are classified normally |
| MARKET RUSH, where bombs used to be impossible | bombs spawn in a rush now, and even values pay double instead of "cut everything" |

Measured, at the same six cuts a second for both bots, in `director.test.ts` and
`economy.test.ts`: a masher wrecks more orders than they finish at every rung
above the floor, and a reader outscores them by 2–20×.

The floor is deliberately exempt. Rung 0 is `□ = 4` with a pool of `{1, 2, 3}`,
and a child at the bottom of the ladder should be able to blunder into a filled
order.

## One axis

`intensity ∈ [0,1]`, from the shared flow controller in
`packs/shared/game-pacing`, driven by **evidence** — orders filled and overshoots
made — and never by the wall clock. `Director.heat`, which was `1 − e^(−t/15)`
and friends, is gone. It drives everything at once:

| `i` | live target | hard cap | wave gap | offer gap | bombs | absurds | residual line | reveal |
|---|---|---|---|---|---|---|---|---|
| 0.00 | 2 | 3 | 1.90 s | 1.20 s | none | none | written | 4.2 s held |
| 0.25 | 4 | 5 | 1.57 s | 1.90 s | 0.012 | 0.04 | written | held |
| 0.50 | 6 | 8 | 1.25 s | 2.60 s | 0.034 | 0.07 | faded | 1.2 s held |
| 0.75 | 7 | 10 | 0.93 s | 3.30 s | 0.057 | 0.11 | absent | brief |
| 1.00 | 9 | **12** | 0.60 s | 4.00 s | 0.060 | 0.14 | absent | skipped |

The offer invariant may add exactly one object beyond the cap when it has to, so
**13 is the largest field this game can ever put in front of a child** — against
a measured maximum of 34 in the build the founder played.

…and the same `i` drives the arithmetic, which is what makes it one axis rather
than a difficulty menu:

| `i` | target | addend pool | what the judgement is |
|---|---|---|---|
| 0.00 | 2–6 | `{1, 2, 3}` | is it obviously too big |
| 0.25 | 12–24 | `{3…9}` | too big, or leaves you needing a 1 or a 2 that does not exist |
| 0.50 | 25–60 | `{5…25}` | leaves you needing 1–4, which cannot be made |
| 0.75 | 100–400 | two-digit, regrouping required | a real column subtraction to reject a near miss |
| 1.00 | 1,000–3,000 | round hundreds and quarters | residual arithmetic across a thousand |

At `i = 0` this is `□ = 4` with two fruit in the air and unlimited time, and that
is a genuine, satisfying game — trivial foundations are not demeaning. At `i = 1`
it is thousands-band residual arithmetic at arcade density.

## The bomb gate

The founder's own idea, and the best-shaped beat in the design:

> "another option is that every time you slice a bomb or something that you
> obviously shouldn't we show a problem then to continue"

1. The market **freezes** — a real freeze; everything airborne holds where it is.
2. A lamp goes out.
3. One host item, centred, at full size, with four answer lanterns. **No timer of
   any kind.** Not a long one — none. The child has already stopped moving.
4. **Correct** → the lamp is relit, and the freeze lifts with a surge.
5. **Wrong** → the sum completes itself, held, in the accent, and the lamp stays
   out. The child chose to touch the bomb.

This is where the declared `dw.add.*` column-arithmetic skills are served, and
where `pack.json`'s mandatory `items.reveal` capability earns its keep. Where a
free-to-play game would show a video advertisement, this asks for arithmetic.

## The miss

There is exactly one, and it is the overshoot. Per `games/stack`:

- **Never red. Never "WRONG".** There is no `WRONG` import in `mount.ts` at all,
  no damage vignette, and no `failure` haptic anywhere in the pack.
  `wiring.test.ts` holds all of that at the source.
- The plate **completes itself in place**, the missing addend in the accent.
- **The action is HELD for at least as long as the reveal is on screen** — never
  aim at one thing while reading another. The hold is `Director.quiet`, which
  stops the market outright. A stroke ends it, so a fast player is never held,
  and above `i ≈ 0.76` there is no hold at all: skipping it is the reward for
  mastery.
- Then the order rotates with a surge. It costs no lamp, no points already banked
  and no progress already made. The loss is the unfinished remainder and nothing
  else.

## What the arithmetic actually is

Honest, mechanic by mechanic, because "it has numbers on it" is not a skill claim.

| mechanic | skill |
|---|---|
| choosing a helpful gourd | `dw.alg.equality.missing-addend` — the plate *is* `10 + 15 + □ = 33` |
| rejecting an overshoot | running subtraction: `dw.add.facts.subtract-across-ten` low, `dw.add.regroup.subtract-multidigit` high |
| rejecting a decoy | "that leaves me needing something that cannot be made" — the first real piece of forward planning in the game |
| holding the residual with the line faded out | working-memory retention of a partial sum |
| rejecting `π`, `−∞`, `½` | number type: not every symbol is a whole number you can add |
| filling in exactly three cuts | decomposition into a stated number of parts, paid as a bonus rather than enforced |
| the bomb gate | the declared `dw.add.column.*` / `dw.add.regroup.*` set, fully unrushed |

`host.report` fires on each **order fill** (correct), each **overshoot**
(incorrect) and each **gate answer**. A fruit that falls uncut is **never**
reported: it is not evidence about the child. Nor is anything reported for an
order whose target the game generated itself rather than taking from
`host.next()` — inventing a question id the host never issued would put fiction
into the ladder.

## What survived

Most of the nine thousand lines, and all of the best of them: `core/feel.ts` and
the whole Nijman feel layer, `render/blade.ts`'s Catmull-Rom ribbon, the wound
and half-glyph clip in `body.ts` (a cut `48` still falls apart into two halves of
a `48`), `render/layers.ts`'s half-res bloom, `core/tiers.ts` and all of the perf
work, and `render/hud.ts`'s five-viewport × three-inset-profile layout — the
hard-won `viewport-fit=cover` and host-chrome work is not re-litigated, the order
plate simply takes the rect the question banner used to have.

Deleted: the density floor and the "density contract" doctrine it was written to
defend, the automatic factor cascade, the in-flight sigil tablet, `heat`,
`valueCap`, `omegaCap`, `READ_PER_LAMP` and the relight ticks, `moteSecondsFor` /
`usableAnswerSeconds` / `marketHushSeconds` — every answering window in the pack
— and the `WRONG` palette entry.

## Files

```
src/sim/order.ts      the plate, the reachability DP, R1 and R2. Pure.
src/sim/director.ts   what gets thrown, the hard cap, and R3. Pure.
src/sim/economy.ts    what an order pays and how long a sum is held. Pure.
src/mount.ts          the game.
src/test/order.test.ts     the no-dead-end theorem, and order-independence
src/test/director.test.ts  the density measurement, and R3 over many seeds
src/test/economy.test.ts   masher vs reader bots
src/test/gate.test.ts      the plate, the miss and the bomb gate, through the real game
src/test/wiring.test.ts    the seam, guarded at the source
```
