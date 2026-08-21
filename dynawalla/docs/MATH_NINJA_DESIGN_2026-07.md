# MATH NINJA — THE SPLIT, design round 2

**Status:** design proposal, 2026-07-30. No game code changed by this document.
**Subject:** `dynawalla/games/slice` (ships as **THE SPLIT**).
**Author's brief:** the founder's verbatim note is quoted in full in §1.

---

## 0. The one-paragraph version

THE SPLIT is a well-built arcade game with the arithmetic bolted on beside it
rather than welded into it. Driving the real `Director` for three minutes, a child
who swipes continuously faces a **median of 7 and a p90 of 25 simultaneously
cuttable objects** and gets **27 free, unpriced cuts for every single arithmetic
decision the game asks of them**. Slicing is unconditionally rewarded, the factor
cascade means every cut manufactures two more things to cut, and the two phases
that score highest — MARKET RUSH and the post-answer favour wave — are the two
phases where bombs cannot spawn at all. The recommendation is not to tune those
numbers. It is to change what slicing is *for*: replace the interruptive
sigil-question with a **standing order** — `10 + 15 + __ = 33` pinned at the top of
the screen for as long as the child wants — so that the arithmetic becomes the
*selection criterion for the arcade verb* rather than a cutscene inside it. The
unrushed-arithmetic layer and the arcade-timing layer then coexist without any
clock on the answer at all, because unlimited thinking time is delivered by
**re-offering** a needed numeral rather than by a long timer.

---

## 1. The brief

> "the split - it starts too chaotically with way too much stuff to slice... we
> should do almost a direct copy of fruit ninja... I like the math aspect."

> "Math ninja. We should try to make it feel like Fruit Ninja almost exactly. The
> big difference with what we have right now and fruit ninja is that fruit ninja
> might have 2 or 3 things pop up to start and you slice them but our current
> implementation has like NNNNNNNNNNNNNN things come out at the same time so the
> best strategy right now is to mindlessly swipe randomly without stopping so our
> current implementation doesn't even require arcade/physical/reaction skill, much
> less math."

> "maybe it can be easy. 13 = 3 + 3 + 3 + 4 — You slice the 'fruit' that says 3,
> 3, 3, 4 but the fairly obvious one that says pi or -infinity symbol .. or '77'
> you need to miss ... so maybe you are still slicing and reacting mostly but it's
> all math .. or maybe you have a watermelon and don't know what's in it. 5? meh,
> no penalty but it doesn't help you .. maybe this is a nice middle ground. The
> fruit has a number inside and maybe it helps you and maybe it doesn't. So, we
> have 33 and we know the helpful fruit are 10, 15, 8 ... there can be decoys that
> don't hurt or penalize you ... maybe they have nothing sometimes and you just
> have to keep slicing until you find the numbers you need ... as you get them they
> are added to a prominent equation at the top `__ + __ + ___ = 33`"

> "another option is that every time you slice a bomb or something that you
> obviously shouldn't we show a problem then to continue... that's always an
> option in a game."

> "We don't want to strangle off the fun but right now it's just a billion things
> to just button mash and it's not even fun as a pure fruit ninja clone."

Every mechanic proposed below traces to one of those five paragraphs. The
founder's diagnosis is correct in every particular; §2 supplies the numbers.

---

## 2. What the density actually is

Measured by driving the shipped `src/sim/director.ts`, `src/sim/factor.ts` and
`src/core/rng.ts` from a harness for 180 simulated seconds at 60 Hz, with a
"masher" model that swipes continuously at 6 cuts/second, never reads a numeral,
and cuts cascade children as they appear. Gourds retire after 2.0 s of arc
(1.6 s for cascade children); the question hush is modelled at 6 s, the repo's own
p50 for the skills `pack.json` declares.

### 2.1 The curves, straight off the director

`heat = min(1, (1−e^(−t/15))·0.5 + (1−e^(−t/400))·0.62)`, and every knob rides it:

| t (s) | heat | `floorCount()` | floor during post-answer surge | `ceilingCount()` | wave gap (s) | `omegaCap` | `valueCap` | bomb P/object |
|---|---|---|---|---|---|---|---|---|
| 0 | 0.000 | **4** | 8 | 10 | 1.18 | 2 | 48 | 0 |
| 5 | 0.149 | 5 | 9 | 12 | 1.08 | 3 | 89 | 0 |
| 10 | 0.259 | **6** | 10 | 13 | 1.00 | 3 | 119 | 0 |
| 20 | 0.398 | 6 | 10 | 14 | 0.91 | 4 | 158 | 0.004 |
| 30 | 0.477 | 7 | 11 | 15 | 0.86 | 4 | 180 | 0.010 |
| 60 | 0.577 | 7 | 11 | 16 | 0.79 | 4 | 207 | 0.029 |
| 120 | 0.661 | 8 | 12 | 17 | 0.73 | 5 | 230 | 0.066 |
| 300 | 0.827 | 9 | 13 | 19 | 0.62 | 5 | 276 | 0.075 |
| 600 | 0.982 | 10 | 14 | 21 | 0.51 | 6 | 319 | 0.075 |

…and during a MARKET RUSH, `floorCount()` is a flat **11**, `ceilingCount()` is
**26**, the wave gap is **0.32 s**, and `bombChance()` is hard **0**.

### 2.2 What a child actually faces

| model | live cuttable objects (median / p90 / p99 / max) | cuts | bombs cut | reported questions | **free cuts per arithmetic decision** |
|---|---|---|---|---|---|
| masher, 6 cuts/s, 6 s per question | **7 / 25 / 30 / 34** | 463 | 15 | 17 (5.7/min) | **27.4** |
| deliberate child, 3 cuts/s, 14 s per question | 0 / 20 / 30 / 33 | 128 | 2 | 10 (3.3/min) | 12.9 |
| slices nothing (floor only) | 6 / 21 / 28 / 30 | 0 | 0 | 17 | 0 |

Second-by-second for the first fifteen seconds of the masher run — the founder's
"starts too chaotically", which is exactly right:

```
t(s)  live  floor  ceiling
 1      5      4      10
 2      4      4      11
 9     10      9      13
10     15     10      13
12     13      6      13
13     16      6      13
14     15      6      14
```

**Sixteen simultaneous cuttable objects at thirteen seconds.** The founder's
"NNNNNNNNNNNNNN" is bounded above only by the body pool: `new World(bodyCap = 110)`.

### 2.3 Why the ceiling does not hold

`ceilingCount()` returns 10–21 and the measured p90 is 25 with a max of 34. The
ceiling is overshot by 50–100% for two structural reasons, both in
`Director.step()`:

1. **It gates whole waves, not objects.** `if (inFlight < ceiling) this.pushWave(this.waveSize())` admits a wave of up to 7 the moment the field is one under the cap.
2. **Cascade children are created by the child's own cuts, between checks.**
   `cutBody` → `chooseSplit` → two `spawnFactor` calls. A gourd with Ω = 4 becomes
   a 4-leaf binary tree: seven bodies from one throw. The director's `live` argument
   counts them (`mount.ts:1363`), so they *suppress* future waves — but they arrive
   after the check, so the instantaneous count blows straight past the cap.

The second one is the important one, and it is worth stating plainly: **in THE
SPLIT, cutting things is how you get more things to cut.** The reward for clearing
the screen is an instantly refilled screen — `floorCount()` tops up "the instant
the field drops below it", by the file's own comment. That is an anti-skill
mechanic. Restraint is never rewarded and clearing is never achieved.

### 2.4 Where mashing is not merely viable but optimal

- **The first 14 seconds.** `bombChance()` returns 0 below `elapsed < 14`, and the floor guarantees 4–6 targets. Blind swiping is *strictly free*, and it is the first thing the game teaches.
- **Every MARKET RUSH.** `bombChance()` returns 0 for the whole rush, the floor is 11, the ceiling is 26, and waves of 4–7 arrive every 0.32 s. The highest-scoring phase in the game is the one in which indiscriminate swiping cannot be punished. The banner literally reads "cut everything".
- **Every post-answer favour wave.** `startWave()` cuts everything already airborne at ×2 and *defuses* bombs rather than detonating them. Correct.  Also: another zero-risk mass-cut, and the biggest single score event.
- **The cascade.** The child never chooses the factor pair — `chooseSplit` picks it. Cutting 48 yields a 6 and an 8 whether or not the child could have told you that. The only arithmetic on screen is `pop("48 = 6×8", …, 0.4)`: an 18px label for four-tenths of a second, during a stroke.

### 2.5 The curricular consequence

`pack.json` declares seven skills, all of them `dw.add.*` column addition and
subtraction. **The factor cascade does not touch a single one of them, and reports
nothing.** Every gram of curricular value in THE SPLIT flows through the sigil
tablet: one item every 6.2 s falling to 3.6 s, refused while another is live, at a
measured 3.3–5.7 reported items per minute. Everything else — 90%+ of the child's
actions — is unpriced motion.

### 2.6 What has already been fixed, and is not the problem

`PACING_AUDIT_2026-07.md` lists `slice` as "far too rushed, 3.78 s usable window,
6–8 cuttable objects guaranteed during a live question". **Both halves have since
landed** and this design must not re-fix them:

- `economy.ts` now derives the window from `EXPERIENCE_DESIGN.md`'s **p90 for the item's own class** — 6 s / 14 s / 40 s — monotone non-decreasing in difficulty, plus the 420 ms read-lock. The audit's 3.78 s is stale.
- `Director.quiet` now genuinely stops the market: no waves, no floor top-up, no bombs, no rush across a live question.
- `lampCost()` returns 0 for all three verdicts, and the timeout ordering (`correct < wrong < timeout`, priced in market-hush seconds) is enforced by bots in `economy.test.ts`.

That work is good and most of it survives verbatim. The residual problem is
**density and what slicing is for**, which is a different problem.

---

## 3. The central design problem

Fruit Ninja's pleasure is *continuous* reaction under *escalating* density.
Arithmetic requires stillness. THE SPLIT currently resolves this by **alternating**:
total hush for the question, total market otherwise. It works, and it is why the
game is safe for a slow child — but it makes the arithmetic a cutscene, and it
leaves the arcade layer teaching nothing, which is the 27:1 ratio in §2.2.

The founder's `__ + __ + __ = 33` proposal resolves it a different way, and the
difference is the whole design:

> **Make the arithmetic the selection criterion for the arcade verb.**

Once the standing order is the thing on screen, there is nothing to put a clock on.
The child is not being asked a question that expires; they are holding an order and
watching a market. The reaction skill is *reaching* the numeral you have decided
you want, in the second it is at its apex. The arithmetic skill is *deciding*,
which happens between waves, for as long as the child likes.

**The key structural move: replace the answer clock with answer re-offering.**
Unlimited thinking time is not delivered by a generous timer — timers are the root
cause the pacing audit found seventeen times over. It is delivered by a generator
invariant: *a numeral that advances the current order is airborne, or about to be.*
A child who needs forty seconds to see that 33 − 10 − 15 = 8 watches eight waves go
past and the eight is in every one of them. Nothing expires. Nothing is lost.
Missing a fruit costs exactly what it costs in Fruit Ninja Zen: nothing.

---

## 4. Option A — **THE ORDER** (recommended)

A market customer places an order. It sits at the top of the screen until it is
filled. The market throws fruit. You cut what fills the order.

### 4.1 The HUD

One line, the most prominent thing on the canvas, in the register THE SPLIT already
owns (`SIGIL_PLATE`, `PAPER`, the heavy geometric sans from `atlas.ts`):

```
                    10  +  15  +  __  =  33
                              needs 8
```

- Filled addends are set in `PAPER` on the plate; the open blank is a pulsing slot.
- The `needs 8` residual line is **adaptive** (§4.7): written at low intensity, faded and finally absent as the child gets faster. That is the one place this design makes the subtraction free, and it is the single most important knob for the bottom of the spectrum.
- Reuses `hudLayout`'s `banner` rect verbatim, including the safe-rect and host-chrome overlap solving in `render/hud.ts` and the five-viewport assertions in `layout.test.ts`. No new layout risk.

### 4.2 Object taxonomy

| class | silhouette / motion | slicing it does | costs |
|---|---|---|---|
| **helpful numeral** | gourd, heavy, full-gravity arc | its value drops into the open blank; the order advances; score | — |
| **decoy numeral** | *identical gourd* | bursts pale, a soft "no" thunk, **no blank consumed, nothing lost** | nothing but the stroke |
| **overshoot numeral** | *identical gourd* | see §4.5 — the reveal, and the order rotates | nothing but the order |
| **absurd** | gourd, but the glyph is `π`, `−∞`, `½`, `√2`, `0.5` | bursts, breaks the combo | the combo only |
| **melon (opaque)** | large, seamed, no glyph, slower arc | splits to reveal the value inside, which then behaves as one of the three numeral classes | nothing |
| **bomb** | small, spiked, iron, live fuse | freezes the market and opens the gate (§4.6) | a lamp, unless the gate is answered |

Critically, **helpful and decoy gourds are visually identical.** That is the game.
Telling them apart is arithmetic and nothing else — no colour tell, no size tell.
(`radiusFor()` already scales with digit count, which is a *magnitude* tell and is
fine and desirable; it must not become a *helpfulness* tell.)

The melon is the founder's "maybe it helps you and maybe it doesn't" and it is
load-bearing for generosity: it is the class that makes slicing feel free again
without making it free of *consequence*, because a melon can contain an overshoot.

### 4.3 Satisfiability — the rigorous part

This is where the design either works or is a bug factory. Definitions:

- **T** — the order's target, an integer.
- **A** — the addends already taken, in order.
- **R = T − ΣA** — the residual. Always ≥ 0 by §4.5.
- **P** — the *addend pool* for this order: the finite set of integers the generator may print on a gourd, chosen from T's difficulty band (see §4.7).
- **F(R)** — the **frontier**: `{ v ∈ P : v = R } ∪ { v ∈ P : v < R and R − v is reachable as a sum of members of P }`.

Reachability over P is a bounded coin-problem: a single `Uint8Array(T+1)` DP,
computed once per order (T ≤ ~4 digits, |P| ≤ ~40), then O(1) lookups. Recomputed
only when the pool changes, which is once per order. This is cheap and exact — no
floating point, no search at runtime.

Three rules, and together they make a dead end **impossible by construction**:

> **R1 — Classification.** A gourd's value `v` is *helpful* iff `v ∈ F(R)`,
> *overshoot* iff `v > R`, and *decoy* otherwise. Classification is recomputed on
> every slice, against the live residual.
>
> **R2 — Only a helpful slice consumes a blank.** A decoy changes no state at all.
> Therefore every state the child can reach has a non-empty frontier, and every
> order remains completable. There is no losable resource and nothing to
> back out of.
>
> **R3 — The offer invariant.** At every instant, at least one gourd whose value is
> in `F(R)` is airborne, **or** one is in the director's launch queue to arrive
> within `OFFER_GAP`. Target `OFFER_GAP` = 2.0 s; hard maximum 4.0 s at the highest
> intensity, and 1.2 s at the lowest.

R3 is a *mechanism*, not a hope. The wave builder becomes solution-aware:
`pushWave(size)` first counts airborne frontier members; if the count is zero, slot
0 of the wave is reserved for `rng.pick(F(R))`, biased toward `R` itself as the
number of blanks drops. Remaining slots are filled from decoys, absurds and melons.
A test asserts R3 over 10,000 seconds of simulated play across the whole intensity
range and every target band — the same shape as `economy.test.ts`'s bot suite.

**The three ways a needed numeral can be "lost", and what happens:**

1. **It falls off the bottom uncut.** Nothing happens. R3 re-offers within 2 s. This is the ordinary case and it must be completely free — it is Fruit Ninja Zen's contract and it is what makes the arithmetic layer unrushed.
2. **The child slices a decoy instead.** By R2, no state changes. The order is exactly where it was. The feedback is that the plate did not advance — information, not punishment.
3. **The child slices something that would strand them.** Impossible by R1: any value that cannot be part of a completion is classified decoy, and a decoy consumes nothing. Worked example: T = 33, A = [], R = 33, P contains 30. With a *fixed* three-blank structure, taking 30 would strand the child at R = 3 across two blanks with min addend 2 — so under a fixed structure 30 must be a decoy at that moment and helpful only when R = 30. See §4.4 for why this design uses the elastic structure instead and makes that case go away.

### 4.4 Fixed three blanks vs. an elastic tail

The founder's mock shows exactly three: `__ + __ + ___ = 33`.

**Fixed k** is the more interesting mathematics — partitioning a number into a
*stated* number of parts is a real skill (`dw.idea.number.ten-is-a-landmark`,
`dw.idea.multiplication.equal-groups`) — but the frontier becomes k-dependent, the
DP becomes a 2-D table over (residual, blanks remaining), and the "helpful now,
decoy later" flip on the same printed value is genuinely confusing: a child sees
30 burst pale, then sees 30 fill a blank forty seconds later, and there is no way
to show them why without a lecture.

**Elastic tail** — the plate shows the addends taken plus exactly one open blank,
and grows: `__ = 33` → `10 + __ = 33` → `10 + 15 + __ = 33` → `10 + 15 + 8 = 33`
**FILLED**. The frontier is then simply `F(R)` with no k, the DP is 1-D, and a
printed value's classification depends only on the residual — which is exactly the
thing the child is computing. It is monotone and explainable: *a number is helpful
if it does not overshoot and leaves something you can still make.*

**Recommendation: elastic.** It presents nearly identically to the founder's mock
(the plate reads `10 + 15 + __ = 33` for most of its life), it is strictly kinder,
and it makes R1–R3 provable in one dimension. The cost is that the child is not
forced into a three-part decomposition; the *reward* schedule buys that back —
§4.8 pays a bonus for filling an order in exactly three cuts, which is an
incentive rather than a constraint, which is the house style.

### 4.5 Overshoot, and the reveal

An **overshoot** — slicing 40 when R = 23 — is the only "miss" in the game.
Per the doctrine established in `dynawalla/games/stack`:

- **Never red. Never "WRONG".** No `WRONG` palette entry, no cross, no vignette.
- The gourd bursts pale and the plate **completes itself in the accent colour**, in place: `10 + 15 + `**`8`**` = 33`, the filled value in `SIGIL_HOT`, exactly as `stack`'s `hud.setPrompt(prompt, reveal)` replaces the `?` in `<span class="fill">`.
- **The action is HELD for at least as long as the reveal is on screen.** `stack/src/game/sim.ts:234` is the reference: `holdLeft = Math.max(holdMs(floor)/1000, revealLeft)` — *never aim at one thing while reading another*. Here that is `Director.quiet`, which already exists and already does exactly this, verbatim.
- Then the order rotates to a fresh target with a surge, reusing `settleQuestion()`.

**The reveal is adaptive**, which is the mastery reward:

| intensity | reveal | held for |
|---|---|---|
| ≤ 0.25 | the full sentence: `33 − 10 − 15 = 8`, then the completed plate | 2.4 s |
| 0.5 | the completed plate only | 1.1 s |
| 0.75 | the missing addend flashes into the blank | 0.45 s |
| ≥ 0.9 | **skipped**; the order rotates on the next wave without a hold | 0 |

Skipping the reveal is the reward for mastery, and it is also the thing that makes
the top of the spectrum feel like world-championship Fruit Ninja.

### 4.6 The bomb, and "one problem to continue"

The founder's own idea, and it is the best-shaped beat in the proposal, because it
is where a free-to-play game would show a video advertisement and this asks for
arithmetic instead.

Slicing a bomb:
1. The market **freezes** — a real freeze, the same code path as `setPaused(true)`, not a throttle. Everything airborne holds. The screen dims and desaturates.
2. One host item is presented at full size, centred, with four answer lanterns in the row `candidateRow()` already solves. **There is no timer of any kind.** Not a long one — none. The child has already stopped moving; there is nothing to protect them from.
3. **Correct** → the lamp is returned, `audio.riser()`, the freeze lifts with a surge. Net cost of the bomb: zero, plus a real arithmetic decision.
4. **Wrong** → the reveal completes the sum, held (§4.5), and the lamp is spent. `lampCost` finally has a non-zero case, and it is the right one: the child chose to touch the bomb.
5. This is the only modal question in the game, and the only place the declared `dw.add.*` column-arithmetic curriculum is served. It is also where `pack.json`'s mandatory `items.reveal` capability earns its keep.

It supersedes the current `READ_PER_LAMP` bookkeeping (two correct sigils bank a
lamp back later) with the same beat at a better moment: the lamp is at risk *now*
and arithmetic saves it *now*. Delete `readCredit`, the tick row in `hud.ts`, and
its draw path.

**Anti-farm:** the gate returns the lamp you just spent and never grants a new one;
a wrong answer spends it. The gate is lamp-neutral at best, so seeking bombs is
never profitable.

### 4.7 Full spectrum, one axis

A single intensity scalar `i ∈ [0, 1]`, driven by **evidence, not the wall clock** —
orders filled per minute and overshoot rate, in the shape `arena` and `colossus`
already use (this closes pacing-audit root cause 3, which `slice`'s `heat` currently
exhibits: `heat` is a pure function of `elapsed`).

| `i` | live target | **hard cap** | wave size | wave gap | empty screen tolerated | `OFFER_GAP` | bombs | absurds | residual line | reveal |
|---|---|---|---|---|---|---|---|---|---|---|
| 0.00 | 2 | 3 | 1–2 | 1.9 s | up to 1.5 s | 1.2 s | none | none | written | 2.4 s |
| 0.25 | 3 | 5 | 2–3 | 1.5 s | up to 1.0 s | 1.5 s | ~1/45 s | rare | written | 2.4 s |
| 0.50 | 5 | 8 | 2–4 | 1.1 s | up to 0.6 s | 2.0 s | ~1/30 s | some | faded | 1.1 s |
| 0.75 | 7 | 11 | 3–5 | 0.8 s | up to 0.3 s | 2.8 s | ~1/22 s | common | absent | 0.45 s |
| 1.00 | 9 | **13** | 4–6 | 0.6 s | none | 4.0 s | ~1/16 s | common | absent | skipped |

Two things to notice against §2:

- The **hard cap of 13** replaces a measured p90 of 25 and a max of 34. It must be an *object* cap enforced at launch time, not a wave cap — §2.3's first failure — and the melon split must be counted against it before the melon is allowed to split.
- **Empty screen is tolerated and desirable at low intensity.** This deliberately reverses `director.ts`'s stated "density contract", which was written to prevent an empty screen and is the direct cause of the complaint. Emptiness between waves is anticipation. It is also thinking time. Fruit Ninja Classic's opening is one or two fruit at a time with clear air between waves; that air is not a defect in it.

The same `i` also drives the *arithmetic*, which is what makes this one axis rather
than a difficulty menu:

| `i` | target T | addend pool P | decoys are… |
|---|---|---|---|
| 0.00 | 2–5 | `{1, 2, 3}` | absurd and obvious: `π`, `100` |
| 0.25 | 10–20 | `{1…9}` | far off: overshoot by a lot |
| 0.50 | 25–60 | friendly two-digit: multiples of 5, then `{2…19}` | plausible: overshoot by 2–5 |
| 0.75 | 100–400 | two- and three-digit, regrouping required | near-misses that need a real column sum to reject |
| 1.00 | 1,000–5,000 | four-digit, subtraction across zero | off-by-one on the hundreds column |

At `i = 0` this is `__ = 1` with two fruit in the air and unlimited time. At `i = 1`
it is `2,431 − 1,890 = __` -class residual arithmetic at Arcade-mode density.
One axis. `dynawalla-full-spectrum-adaptation`'s "trivial foundations are not
demeaning" holds: `__ = 1` with two slow fruit is a genuine, satisfying game.

### 4.8 Scoring, and closing every mashing hole

Score comes from **one source only: advancing or filling an order.** Not from
cutting. This single rule does most of the anti-mash work, because it converts
mashing from "punished" (forbidden by the product's principles) into "worthless"
(the only sanction this product is allowed to apply — opportunity cost).

| hole | close |
|---|---|
| Mash everything, collect score for volume | A cut that does not advance the order pays **nothing**. Score is `orderValue(T) × combo × favour`, paid on fill. |
| Mash melons for free reveals | A melon reveal pays nothing. Only the *use* of the value pays. |
| Mash and complete orders by luck | **An overshoot rotates the order.** A masher's next indiscriminate slice destroys the order they were accumulating, every time. This is the airtight lock, and it costs the child nothing — no lamp, no score loss, just no progress. |
| Farm combo on absurds | An absurd breaks the combo. |
| Farm the bomb gate for lamps | The gate is lamp-neutral at best (§4.6). |
| Cascade manufactures free targets | The automatic factor cascade is demoted (§6). A melon splits **once**, into two values, and both are then classified normally. |

The masher's outcome under Option A: they will fill an order occasionally by
accident, and destroy roughly every other one they start. Their orders-per-minute
sits near the floor while a child who reads gets several times the rate. **Mashing
becomes a *bad* strategy without ever becoming a *punished* one.** That distinction
is the whole product.

### 4.9 What arithmetic each mechanic actually exercises

Honest, mechanic by mechanic, because "it has numbers on it" is not a skill claim:

| mechanic | skill, named |
|---|---|
| choosing a helpful gourd | `dw.alg.equality.missing-addend` — the plate *is* `10 + 15 + ? = 33` |
| rejecting an overshoot | running subtraction / residual maintenance: `dw.add.facts.subtract-across-ten` at low `i`, `dw.add.regroup.subtract-multidigit` at high `i` |
| holding R across waves with no residual line | working-memory retention of a partial sum — the thing `EXPERIENCE_DESIGN.md`'s cadence table is measuring |
| rejecting `π`, `−∞`, `½` | number type: not every symbol is a whole number you can add. A real idea, cheaply delivered. |
| aiming for exactly three cuts (bonus) | decomposition into a stated number of parts: `dw.idea.number.ten-is-a-landmark` |
| the bomb gate | the declared `dw.add.column.*` / `dw.add.regroup.*` set, in a fully unrushed modal |

`covers.skills` in `pack.json` must be updated to add the `dw.alg.equality.*` and
`dw.add.facts.*` entries the order actually reports against. Reporting shape:
`host.report` fires on each **order fill** (correct) and each **overshoot**
(incorrect), with `ms` measured from order start; and on each gate answer. A
fruit that falls uncut is **never** reported — it is not evidence about the child,
by the same argument `reportsToCurriculum()` already makes for a timeout.

### 4.10 The Bazaar frame

The theme survives intact and gets *better*, because "an order at a market stall" is
a more honest fiction than "a sigil tablet detonates into lanterns". Keep: the blue
hour, the sodium lanterns, the sagging wires, minarets in silhouette, fruit glowing
from inside once cut, FAVOUR, THE MARKET CLOSES. The plate at the top is the
customer's chit. A filled order is a sale.

---

## 5. Option B — **THE SIEVE**

A standing *predicate* instead of a standing equation: `MULTIPLES OF 7`, `EVEN`,
`> 40`, `PRIME`. Slice what matches; let the rest fall.

**For:** the most Fruit-Ninja-like structure possible — zero accumulated state,
pure reaction plus classification, trivially satisfiable (no generator invariant at
all), and by far the highest *retrieval rate*: one arithmetic decision per fruit,
30–60 per minute, against Option A's ~4–8 order fills per minute. If voluntary
retrieval volume is the metric, this wins on paper. It is also the cheapest to
build — it needs no DP, no residual, no reveal-completion, and it can be tested
exhaustively.

**Against, and it is decisive:**

1. It is **classification, not computation**. The README already rejected exactly this ("the obvious 'slice only the multiples of 7' filter") and the reason stands: a child succeeds at 7s by memorising the visual set `{7, 14, 21, 28, 35, 42, 49}`, which is a lookup, not arithmetic. There is no residual to hold, nothing accumulates, and the hardest predicate is no harder to *execute* than the easiest.
2. It **cannot serve the declared curriculum at all** — no predicate over a printed integer is column addition with regrouping. The whole `dw.add.*` set would have to move to the bomb gate, which then becomes the game's only real content.
3. It needs a **real cost for a wrong slice** to be a game, because letting non-matching fruit fall is free and slicing it must therefore not be. That directly fights "decoys don't hurt or penalize you" and the no-punishment principle.

**But keep a piece of it.** The SIEVE is an excellent 10-second **interlude**, and it
slots into the one place today's build has no arithmetic whatsoever: MARKET RUSH.
Replace "no bombs, cut everything" with "no bombs — **cut only the evens**", and the
game's highest-scoring, currently mash-optimal phase acquires a real filter at zero
cost to the flow. Recommended as a phase-4 addition to Option A, not as the design.

---

## 6. Option C — minimal: keep the structure, fix the density

The cheapest possible response to the brief, listed because it is the right *first*
commit and because it should be evaluated on its own merits:

- `floorCount()`: `4 + heat·6` → `1 + heat·2`. Delete the "the market must never stop breathing" doctrine; tolerate an empty screen.
- `ceilingCount()`: 10–21 → a flat 6, enforced **per object at launch**, not per wave.
- Rush: floor 11 → 4, ceiling 26 → 8, wave gap 0.32 s → 0.7 s, and `bombChance()` no longer zero (or the rush becomes a SIEVE, §5).
- Make the cascade a **choice**: a cut composite shows two visible seams labelled `6×8` and `4×12`, and the child cuts along one. The gesture becomes a decision. (This is a genuinely good idea independent of which option ships, and it is the only way the factor tree becomes real math rather than free score.)

**For:** one file, one afternoon, no new systems, and it makes the game playable
immediately. It is a strict improvement and it should ship first regardless.
**Against:** it leaves the 27:1 free-cut ratio structurally intact (fewer cuts, but
the same ratio), and it does not answer *"it's not even fun as a pure fruit ninja
clone"* — because the reason it is not fun as a clone is that nothing is at stake in
any individual cut. Density is the symptom; purposeless slicing is the disease.

---

## 7. Recommendation

**Ship Option A, in three commits, starting with Option C's density fix.**

| phase | what | why in this order |
|---|---|---|
| 1 | Option C's density and rush retune, in `director.ts` only. Nothing else. | It is a one-file change that makes the game playable this week and independently verifies the §2 numbers on a device. Ship it before designing anything on top of it. |
| 2 | **THE ORDER**: standing plate, elastic tail, taxonomy, R1–R3 generator, adaptive reveal, score-on-fill-only. Retire the in-flight sigil. | The design. Everything else is downstream of the plate existing. |
| 3 | **The bomb gate.** | Independent of phase 2, needs `candidateRow` and `economy.ts` which both already exist, and it is where the declared curriculum lands. |
| 4 | The SIEVE interlude replacing MARKET RUSH; multiplicative and subtractive orders (`__ × __ = 72`, `__ − __ = 15`). | Pure additions on a proven spine. |

Rationale for A over B: the guard on "fun IS the pedagogy" is that it must be
**real math, not button-mashing**, and Option A is the only one of the three where a
child holding a partial sum in working memory is *the mechanic* rather than a
tax on it. B has a higher retrieval rate but the retrievals are lookups. C is
necessary and insufficient.

Rationale for A over today's design: it deletes the alternation between "arcade" and
"question" — the thing that made the arithmetic a cutscene and produced 27 unpriced
cuts per decision — and it does so **without putting a clock on any arithmetic
anywhere**, which is the constraint seventeen games in this fleet failed.

---

## 8. Keep / kill

### Keep — most of the 9,290 lines, and all of the best of them

- **`src/core/feel.ts`** and the whole Nijman feel layer: trauma shake, directional kick, punch zoom, hitstop, slow-motion, the 3/second 0.42-alpha flash limiter, `prefers-reduced-motion` collapse. Untouched. `feel.test.ts` untouched.
- **`src/render/blade.ts`** — the Catmull-Rom-resampled ribbon. Untouched.
- **The wound + half-glyph clip in `body.ts`.** The single best feel detail in the pack: a cut `48` falls apart into two halves of a `48`. This is why the cut reads wet instead of like a despawn, and it works for a wholly different reason under Option A (a decoy still visibly *cuts*).
- **`src/audio.ts`** — the rising minor-pentatonic ladder is, per the README, "the single most addictive thing in the audio", and the three-octave cap fix. Repoint the ladder from cut-chain to **order progress**: each addend a step higher, `ascend()` on the fill.
- **`src/render/hud.ts`** — `hudLayout`, `candidateRow`, `candidateHome`, `insetsOf`, and `layout.test.ts`'s five-viewport × three-inset-profile assertions. The `banner` rect becomes the order plate; `candidateRow` becomes the bomb gate's lantern row. This is the hard-won `viewport-fit=cover` / host-chrome work from `dynawalla-game-chrome-contract` and none of it is re-litigated.
- **`src/render/layers.ts`** — the half-res three-tap bloom and the splat layer at its post-audit alphas.
- **`src/core/tiers.ts` / `TierGovernor`** and all of the perf work: pooled particles as struct-of-arrays, 5–8 MB flat heap over a six-minute soak, demonstrated 6×-throttle auto-degradation.
- **`src/sim/economy.ts`** — the *discipline*, and most of the code. `CADENCE`, `comprehensionP50Ms` / `P90Ms`, the monotone-non-decreasing invariant, `reportsToCurriculum`, and the never-let-refusing-dominate argument. Repointed: the p90 windows stop being answer timers (there are none) and become the **reveal-hold and gate-pacing** budget, and the verdict ordering becomes `fill < overshoot < ignoring the order`. `economy.test.ts`'s bot suite is the right harness for the new ordering.
- **`Director.quiet`** and `settleQuestion()` — verbatim, as the reveal hold and the gate freeze. This is exactly the "inert pocket" the pacing audit found in all nine well-paced games.
- **The lamp-relight-for-arithmetic beat** — promoted, not deleted (§4.6). "Maths instead of an ad" is the best idea in the current build.
- **`src/sim/factor.ts`** — `isPrime`, `omega`, `factorPairs`, `chooseSplit`, exact integer arithmetic throughout, and `factor.test.ts`. Needed for the melon split, for `PRIME` as a SIEVE predicate, and for the phase-4 multiplicative orders (`__ × __ = 72` is `factorPairs(72)`).
- **`src/contract.ts`** — unchanged. `Question.answer` supplies the order target; see §9.
- The register: blue hour, sodium lanterns, silhouette-first class distinction, numerals never coloured information, one weight of near-white with a dark keyline.

### Kill or demote

- **`floorCount()`'s guarantee and the "density contract" doctrine** in `director.ts`'s header. It is a well-argued 25-line comment defending the exact behaviour the founder is complaining about. Replace with a *target* count, a hard per-object cap, and an explicit empty-screen tolerance.
- **The automatic factor cascade as primary content.** Ω is a lovely difficulty knob but the cascade manufactures objects the child never chose and computes nothing. Demote to the melon's single split, or (better, and independently valuable) make the split a *choice* between two labelled seams as in §6.
- **The in-flight sigil tablet exploding into four lanterns.** Move to the bomb gate. In flight it needed eight separate fixes to stay legible (README "What playing it changed" items 1, 2, 3, 6) and it still competes with the market for attention even under a full hush. A modal question belongs at a moment the child has already stopped, and the bomb is that moment.
- **`valueCap()` = `48 + heat·276`** — magnitude must be driven by the order's difficulty band, not by seconds elapsed.
- **`omegaCap()`** — moot once the cascade is demoted.
- **`heat` as a pure function of `elapsed`.** Pacing-audit root cause 3. Replace with the evidence-driven `i` of §4.7.
- **MARKET RUSH as written** — `bombChance() = 0`, floor 11, ceiling 26, wave gap 0.32 s. The game's highest-scoring phase is currently its most mash-optimal. Retune (§6) or convert to a SIEVE interlude (§5).
- **`READ_PER_LAMP` / `readCredit` and the relight tick row.** Superseded by the gate.
- **The `WRONG` palette entry and the `vignette` on a wrong answer.** Nothing in this design is ever red. `mount.ts` currently does `feel.requestFlash(0.16, WRONG)` and `vignette = 1` on a wrong lantern; both go.
- **The known weakness "the chain window does not decay with heat"** — moot, because the chain no longer prices raw cuts.

---

## 9. Open questions and tradeoffs

1. **Where does T come from?** Recommendation for v1: `host.next({difficulty})` and use `Number(q.answer)` as the target, keeping the contract frozen, keeping the host's difficulty selection and mal-rule distractors, and keeping `host.report` honest. **Risk:** a host may legitimately return a non-integer (`3/4`, `1.5`) or an answer far outside any sensible addend pool. The game must detect that and fall back to its own target generator for the order, using the host only for the bomb gate. Alternative: add `host.next({ shape: "decomposable" })` to the contract — cleaner, but the contract is declared "verbatim the shape the runtime will land underneath us and must not drift", so this needs a fleet-level decision, not a pack-level one.
2. **Is the residual written?** §4.1 proposes writing `needs 8` at low intensity and fading it out. Written is much kinder and the addend-selection skill survives; unwritten is where the real subtraction lives. This is the single highest-leverage knob at the bottom of the spectrum and it should be playtested first, not decided here.
3. **Fixed three blanks or elastic tail?** §4.4 recommends elastic and explains the cost. This is the one place the design departs from the founder's mock, and it is worth an explicit ruling.
4. **Does an order ever expire?** Recommendation: never. Nothing in this game expires. But that means a stuck child can hold an unfilled order indefinitely while the market runs — is that a pleasant place to be stuck, or a quiet failure state? Mitigation candidate: after ~45 s with no progress, the order *simplifies* (the residual line appears, the pool narrows, `i` drops) rather than rotating. Needs a playtest.
5. **Should overshoot really rotate the order?** It is the anti-mash lock (§4.8) and it is the only consequence in the design. But it means a single misjudged slice discards accumulated correct work, which reads as harsher than "no penalty" even though nothing is deducted. Softer alternative: the overshoot addend simply does not take, the reveal fires, and the order *continues*. That is kinder and removes the lock — a masher would then eventually complete every order by luck. Recommendation: rotate, but pay out the partial progress, so the child banks what they got right and the loss is only the unfinished remainder.
6. **How many simultaneous orders?** One is clean. Two concurrent plates (`= 33` and `= 50`) would make a single wave decidedly richer — a 15 helps one order and overshoots neither — and it is how a real market stall works. Adds real legibility risk in the HUD. Phase 5 at the earliest.
7. **Do melons need to be able to contain an overshoot?** If yes, a melon is a genuine gamble and the founder's "maybe it helps you and maybe it doesn't" is fully honoured — but a child can then destroy an order by cutting an opaque object, which is bad luck rather than bad arithmetic. If no, melons are strictly free and mashing melons is strictly safe. Proposal: a melon may contain a decoy or a helpful value, **never** an overshoot. Bad luck must never rotate an order.
8. **Is 13 the right hard cap?** It comes from calibrating against the *form* (Fruit Ninja Classic opens at one or two fruit with air between waves; Arcade peaks around eight or nine plus bananas) — **from recollection of the genre, not from measurement.** Someone should count frames of the actual reference before 13 is treated as a number rather than a hypothesis. The measured fact this must beat is unambiguous, though: a p90 of 25 and a max of 34.
9. **What happens to the 27:1 ratio target?** Under Option A the ratio becomes roughly 1 arithmetic decision per *cut* (every gourd is a helpful/decoy/overshoot judgement) — so the useful number to instrument is not the ratio but **orders filled per minute** and **overshoot rate**, and those two are also the inputs to `i`. Instrument them before tuning anything.
10. **Does `pack.json` still declare seven column-arithmetic skills?** Under Option A most reporting comes from orders. `covers.skills` must gain `dw.alg.equality.missing-addend` and the `dw.add.facts.*` band, and the column-arithmetic claims become gate-only — which is a smaller claim honestly made, and `dynawalla-pack-packaging-contract` says `items.reveal` stays mandatory either way.

---

## 10. Appendix — reproducing §2

The measurements come from a throwaway harness that imports the shipped
`Director`, `Rng` and `buildNumberPool`/`chooseSplit`/`isPrime` unmodified, steps
at 1/60 s for 180 simulated seconds, models a masher at N cuts/second, retires
gourds after 2.0 s (cascade children 1.6 s), models the question hush at 6 s, and
records the live body count every frame. It was run with
`node --experimental-strip-types`, seed 12345. No game file was modified to obtain
any number in this document; the harness lives outside the repo on purpose.
