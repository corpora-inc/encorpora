# Pacing audit — all 27 games, 2026-07-29

A read-only audit of every shipped game against one question the founder asked:

> "Is it relaxed enough or is it too fast, too hard, too rushed, too chaotic?"

Nine agents read the source of three games each; a tenth synthesised. Every number
below came from a constant in the source, not from playing — see **Honest limits**
at the foot, which matters more than any single finding here.

> **Three of the twenty-seven have since been retired from the fleet**, and this
> document is left at twenty-seven on purpose: it is a dated measurement, not a
> roster. Everything it says about those three was true when it was measured and
> is still readable at the commit before each removal.
>
> | pack | retired in | last commit that still contains it |
> |---|---|---|
> | `foundry` (THE GRAPPLE FOUNDRY) | #749 | `ccb79ece0dde16754de5d93d6fccf7f2ba4555c6^` |
> | `gavel` (THE GAVEL) | #749 | `ccb79ece0dde16754de5d93d6fccf7f2ba4555c6^` |
> | `street` (FOUNDRY STREET) | this PR | `c499f9043c2f7205c0e61c9d7832c13d22cbd9fb^` |
>
> `git checkout <sha>^ -- dynawalla/games/<pack>` restores any of them whole.
>
> **A rule does not stop being true because the pack that demonstrated it was
> shelved.** `street` is cited below as the reference implementation for the one
> finding this audit cared about most, and that citation stands: the shape it
> shows is the shape to copy, and the file it lives in is one command away.

## Why pace is not a comfort preference

Mental arithmetic runs in working memory. So does precise motor control under time
pressure. Past a threshold a child stops *computing* and starts pattern-matching at
plausible-looking numbers. The rush does not reduce learning at the margin — it
removes the retrieval entirely, which is the whole mechanism of the product.

A game that is too fast is not a hard maths game. It is not a maths game.

## The verdict

**17 of 27 games are rushed** — 4 far too rushed, 13 too rushed. 9 are about right.
1 (`lattice`) is too slow.

**The split is architectural, not a matter of degree.** Every one of the nine
well-paced games either puts *no clock on the answer at all*, or protects the
answering moment inside an inert pocket. Every rushed game derives the child's
comprehension window from a motion constant that is *also* its escalation knob.

This is one design error replicated seventeen times, not seventeen games needing
bespoke tuning.

And the product already forbade it. `EXPERIENCE_DESIGN.md`:

> **T=0→C COMPREHENSION — not budgeted. The child's time. Measured, never limited.**

with a cadence table of **6 s / 14 s** (p50/p90) for two-digit regrouping and
**16 s / 40 s** for the `5,001 − 2,798` class. Against that table, `truedraw` serves
the hardest class in 3.6 s — 30% of p50, in a window that is *capped* so the hardest
items get the least time.

## The four root causes

**1. The comprehension window is derived from a motion constant.**
`beam` (window = `descentSeconds × 1.6`), `pulse` (lookahead = an accident of how far
ahead notes must scroll), `runner`, `guilty`, `rhythm`, `mosaic`, `merge`. Because the
motion constant is also the escalation knob, every one of these *shrinks the child's
thinking time as a side effect of making the game more exciting.*

**2. Difficulty and time pressure ride the same counter, so the hardest maths gets the
least time.** `foundry`'s `tempo = 1.06 − 0.16·difficulty` is inverted by construction:
its measured window at four-digit subtraction is *shorter* than at three-digit.

> **Invariant to enforce: `window(d)` must be MONOTONE NON-DECREASING in item difficulty.**

**3. Escalation runs on the wall clock, ignoring whether the child is getting anything
right.** `horde`: `difficulty = 1 + floor(runT / 88)` — a child who has missed *every*
question meets three-digit addition at minute 11 purely for surviving. Its
`correct`/`asked` counters already exist and are already on the game-over screen.

The well-paced games are precisely the ones indexed on achievement instead: `stack` on
floor, `siege` on wave *clear*, `serpent` per 9 correct eats, `street` on blocks
completed. **This single correlation explains most of the fleet split.**

**4. A timeout is reported as a wrong answer.** `beam`, `rhythm`, `horde`, `pulse`,
`truedraw`, `trebuchet`. A child who was still computing is written into the learner
model as a child who does not know the skill — in the direction that makes the ladder
serve them *worse*. It also makes guessing free. `rhythm` is the sharpest case: motor
lateness is indistinguishable from an arithmetic error.

## Worse than pacing: defects that corrupt the learner model

These are not tuning. An adaptive controller that moves a child down the ladder on a
wrong answer will actively punish competence while these exist.

- **`polarity` cannot ask a question.** The label atlas covers −40..40 and the renderer
  *silently skips* any orb outside it, while every active curriculum node emits 2–4
  digit answers. ~83% of level-0 items and **100% of level-1+** put four blank glowing
  discs in front of the child. Separately, the Warden reports `answered = String(core)`
  after clamping, so perfect play is recorded as wrong.
- **`trebuchet` scores correct arithmetic as wrong.** `landing = R + wind` while the aim
  caret stands on the dial, and only `bestErr ≤ 1` counts. From wave 3 a child who
  computes `47 + 25 = 72` and dials 72 is scored wrong with probability `1 − 1/cap`,
  rising to **8/9 by wave 16** — and that verdict goes to the curriculum.
- **`beam` deletes the question.** The 3-digit sum renders at the 9px legibility floor
  for 1.3 s, then the core body is killed and the prompt is drawn nowhere else. The
  child computes from memory while sustaining ~1 kill/second.
- **`slice` and `foundry` make the maths optional.** In `slice` a wrong lantern costs a
  lamp and a timeout costs nothing, so the rational play is to never answer. In
  `foundry`, greedy tapping escapes 100% of falls at levels 5–7.
- **`runner`'s hazard guard is dead code.** Its comment promises "never put a hazard
  inside the reading window of a gate"; it compares a hazard's *spawn* z with a gate's
  *current* z, so the branch never fires. ~2 hazards arrive per reading window from 90 s.

## Per-game

| game | verdict | window | enough? | headline |
|---|---|---|---|---|
| `beam` | far too rushed | 6.9 s | **no** | The question — a 3-digit column addition — is printed at a hard-floored 9px near the vanishing point for 1.3 seconds and then deleted from the screen entirely, after which the child has ~6.9s to compute it from memory, find it among candidates that are also under 12px for 72% of their fall, factor it, and ride to a divisor beam, while simultaneously sustaining roughly one divisibility kill per second or the anchors go. |
| `foundry` | far too rushed | 5.3 s | **no** | Three referee slaps give a median 7.0-8.4s at the top of the ladder to evaluate a four-digit column subtraction AND solve a two-coin exact-change problem that, measured over 400 falls per rung, has exactly ONE valid escape in 391-400 of them — while the bar quietly draws load/target as an analogue gauge, so the rush's only survivable answer is to stop computing and watch the bar. |
| `slice` | far too rushed | 3.78 s | **no** | A live question gives a child 3.78 usable seconds to compute a column sum with regrouping — 37% below this codebase's own instrumented 6 s p50 for exactly that skill — while the director guarantees 6-8 other cuttable objects are in the air and bombs keep spawning. |
| `truedraw` | far too rushed | 3.5 s | **no** | A two-digit-with-regrouping claim gets a 2.59s draw window (statement.ts:67) against the product's own 6s p50 for that class, the hardest items are capped at 3.6s against a 16s p50, and running out of time on a TRUE slate costs one of only three shots — so the child who is still computing is the child who loses. |
| `claim` | too rushed | 2.5 s | **no** | The only arithmetic CLAIM ever reports is the 7-second revive gate, and up to 4.5 of those 7 seconds are spent driving across the arena to reach the plate — leaving roughly 2.5s to evaluate three four-digit candidates like 5400 / 4500 / 1800. |
| `counterweight` | too rushed | 7.6 s | **no** | The press window falls from 13.0s to a 7.6s floor while the curriculum climbs to four-digit column sums whose place-value decomposition costs a median 13 strikes (p90 20) — so most of the window is motor execution and the arithmetic gets whatever is left. |
| `guilty` | too rushed | 5.6 s | **no** | The descent clock and the arithmetic ladder are driven by the same counter and tighten together, so the window shrinks from 9.0s to 4.0s exactly as the questions go from `4 + 3` to `13 − 4 × 3`. |
| `horde` | too rushed | 8.5 s | **no** | The answer clock is a hardcoded 8.5 seconds that never moves while the question ladder climbs ten bands from `4 + 7` to three-digit sums, 73 × 11 and signed integers — the maths gets ~10× harder and the child gets exactly the same time. |
| `merge` | too rushed | 3.46 s | **no** | The auto-drop clock falls to 2.4s (levels.ts:34) exactly where the game starts printing three-term expression faces at a hard 7px floor, so the pack's claimed multi-digit-regrouping curriculum is served in the shortest, least legible window the game has. |
| `mosaic` | too rushed | 7 s | **no** | PRESSURE_AFTER = 7 seconds without breaking a target starts the wall descending at a floor of 11 units/s even on the two waves the tests certify as descent-free — so the reading clock is 7 seconds from the first frame, on walls where every single tile is an expression. |
| `polarity` | too rushed | 7.6 s | **no** | The answer orbs carry no numeral at all for essentially every question the real host serves, because the label atlas only covers −40..40 while the only ACTIVE curriculum skills are 2-to-4-digit column arithmetic — so the child cannot compute, only guess between four blank glowing circles. |
| `pulse` | too rushed | 3.5 s | **no** | The question is visible only for the scheduler's note-scroll lookahead — barSeconds×1.2+0.25 — so the child gets 4.3 s on the calmest stage and 2.3 s at the endless tempo cap to answer an item whose own curriculum fluency target is 10 s, and the answer must be delivered as a ±0.17 s timed strike where a timing slip is recorded as a maths error. |
| `rhythm` | too rushed | 4.9 s | **no** | The child gets a decent 8-beat window to think but must commit at ONE instant — all three answer tiles sit on the gate bar's downbeat with a ±0.205 s window, and being 250 ms late is scored, sounded and reported exactly like choosing the wrong lane. |
| `runner` | too rushed | 1.55 s | **no** | READ_WINDOW_FLOOR = 1.55 s (pacing.ts:83) is the entire window to read a prompt, read three candidate numbers and be in the right lane — and the difficulty hint climbs +1 every ~15 s of cruise (pacing.ts:107), so a child is at the top of the question ladder by three minutes no matter how they are doing. |
| `skyledger` | too rushed | 21 s | yes | The falling-star clock is the most generous in this batch and needs no change — but the chain, the game's entire escalation system, demands a 7 s bloom-to-bloom cadence against the 6 s p50 this very file cites, before the child has turned a single detent, so the spectacle is priced out of reach of the median player. |
| `stack` | too rushed | 9.3 s | yes | The arithmetic is genuinely unhurried — the prompt sits there and the value comes round again — but the tap that commits it is arcade-grade: a ±35 ms window for a perfect at floor 0, and the game's own instructions promise "waiting never costs you anything" while the dither quietly makes the sweep 90% faster after ~9 s of thinking. |
| `trebuchet` | too rushed | 6.1 s | **no** | From wave 3 the crosswind silently adds a second, ungraded subtraction to every question — `landing = R + wind` while the aim caret stands on the dial — so a child who computes 47+25=72 correctly and dials 72 is reported WRONG to the curriculum with probability 1 − 1/cap, rising to 8/9 by wave 16. |
| `lattice` | too slow | — | yes | There is no clock, no life and no fail state anywhere in the game — which is exactly right for the brief — but nothing in the arena ever escalates either, and one reported sum costs a minute of husk-cracking and mote-sweeping, so the retrieval rate is very low and the tenth resonator is identical to the first. |
| `arena` | about right | 8.6 s | yes | The maths beat is a protected, unhurried pocket — the field goes inert, the player is force-fed enough speed to reach any sphere, a timeout costs nothing and is never even reported, and a guess costs 24% of your mass — so the economics push a child toward computing rather than stabbing; the one watch-item is the RESONANCE window floor at src/sim/world.ts:1488, which decays 10.5s -> 6.5s while the question climbs to 3-digit column addition, and would be worth raising to ~8.0 if playtests at minute 12 show timeouts replacing answers. |
| `balance` | about right | — | yes | Nothing in COUNTERPOISE is on a clock — there is no timer, no lives, no descending entity and no score decay anywhere in the source — so the only pacing question is the opposite one (is it dull?), and the 10-movement ladder from 'one weight on the left' to two-step equations with unknowns on both sides plus fractions says no. |
| `coil` | about right | — | yes | COIL has no clock of any kind — aiming, cracking and hesitating are all free, and the only cost of a careless cut is lane space you can win back — so a child can take as long as regrouping actually takes. |
| `colossus` | about right | — | yes | COLOSSUS is untimed by construction and has a test that proves striking faster never helps — but the wrong-strike penalty compounds into a legibility spiral: at the 16-floor cap the tap bands shrink to ~27px, which is below the platform touch minimum in precisely the state a struggling child ends up in. |
| `forge` | about right | — | yes | There is genuinely no per-question clock — the billet waits — and a deliberate 12s-per-answer child still crosses 9 orders of magnitude in 10 minutes; the only rushed thing in the game is the 600ms during which a wrong answer's correction is on screen. |
| `merge-idle` | about right | — | yes | Nothing in ABYSSAL BLOOM ever takes a question away from a child — there is no deadline on a vent, on the tide gate, or on the shelf, and the only cost of being wrong is 3.2 seconds of a cold vent and a multiplier reset. |
| `serpent` | about right | — | yes | Nothing rushes the child — there is no per-question clock anywhere in the pack — but on a phone the numerals printed on the orbs render at roughly 4-7 CSS pixels, so the child guesses for a reason that has nothing to do with time. |
| `siege` | about right | — | yes | The anvil has no clock at all and a wrong answer costs 1.15 seconds of cold forge and nothing else — this is the pack that gets the brief right; the one thing to watch is the 7-second OVERCHARGE window, the only hard timer in the game, which lands on the hardest question band. |
| `street` | about right | — | yes | Nothing in FOUNDRY STREET is on a clock — the two input phases have duration 0 and `advance` returns early on them, so the only stake is an error budget of six, and it is spent by being wrong, never by being slow. |
## The reference implementations — copy these, do not reinvent

- **`street`** — *retired from the fleet (see the note at the top); still the reference.*
  The purest and cheapest to copy. `durationOf()` returns 0 for both
  input phases and `advance()` returns early on them, so elapsed time *literally cannot
  accumulate while the child is thinking*. Its comment says it: **"a child who is
  thinking must never be losing."** The pack was shelved for being unfun, which is a
  judgement about juice, sound and legibility and says nothing about this: read it at
  `git show c499f9043c2f7205c0e61c9d7832c13d22cbd9fb^:dynawalla/games/street/src/game/street.ts`.
  If a live example is wanted instead, `colossus` and `siege` below are both shipping.
- **`colossus`** — the reference for *proving* pacing rather than asserting it.
  `antimash.test.ts` plays one seed at 8000 ms/strike and at 200 ms/strike and requires
  byte-identical height, tally and reported answers. Also the best failure shape in the
  fleet: a wrong strike adds two floors of stone — more work, visible and countable, with
  no life lost, no buzzer, no score penalty.
- **`siege`** — the reference for escalation. The wave counter advances only on *clear*,
  never on a clock, and its stub host is the only place in the fleet where careful
  thinking is explicitly protected from promotion: slow-correct advances at 0.2× the rate
  of fast-correct.
- **`arena`** — the only well-paced *timed* game, so the reference for anything that must
  keep a clock. During a Resonance the field goes inert and untouchable, all spheres draw
  at the same size so size cannot leak the answer, a wrong sphere costs 24% of mass, and
  **a timeout costs nothing and is not reported at all.** Waiting is strictly cheaper
  than guessing.
- **`merge-idle`** — the best incentive shape. Nothing ever takes a question away; vents
  stop emitting when the shelf is full, so thinking time never converts into board
  pressure.

## The shared primitive this argues for

A small, opinionated `packs/shared/pacing` that makes the root cause *unrepresentable*:

1. `comprehensionMs(item)` — the ONLY source of an answering window, a pure function of
   the item. **No game constant, no elapsed time, no speed, no bpm, no descent rate may
   appear in it**, and it must be monotone non-decreasing in difficulty. That one
   signature makes the defects in `beam`, `pulse`, `runner`, `guilty`, `rhythm`, `mosaic`,
   `merge` and `truedraw` impossible to write.
2. `pressure(progress)` — escalation over an *achievement* counter the game supplies,
   never over wall-clock elapsed.
3. The `quiet` contract — while a question is live: no spawns that can damage, and
   density **floors** suspended, not merely timers. (Suspending only the timer is exactly
   `slice`'s bug.)
4. `report("correct" | "incorrect" | "expired")` — **three outcomes, not two.** `expired`
   never reaches the ladder as incorrect.

## Honest limits — read before acting on any number above

**Almost none of this has been in front of a child, and most has not been in front of a
device.** Only three packs (`counterweight`, `foundry`, `forge`) contain real instrumented
measurements. Everything else is arithmetic on source constants, and the crowding figures
are explicitly marked DERIVED in at least eight entries — `horde` says outright "I could
not run the sim."

So: **do not retune 27 games from this document.** The individual constant proposals were
each derived independently against the same doc table and will not agree with a measured
ratio. Expect most of them to be superseded.

Nine games returned a null thinking-time because they have no clock to measure. That is
correct, and it is *why* eight of them are well-paced — but it also means nobody measured
their **throughput**. `lattice` is the proof this matters: untimed, humane, and rated too
slow because one reported sum costs a minute of husk-cracking. "About right" for the
untimed games is currently a claim about the absence of pressure, not evidence of
pedagogical volume — and *voluntary time-on-task × retrieval rate* is the actual metric.

## Recommended order

- **Phase 0 — now, in parallel.** The defects above. They need no pacing decision because
  they are not tuning: `polarity`'s blank orbs, `trebuchet`'s wind, `beam`'s vanishing
  prompt, `runner`'s dead guard, and the fleet-wide timeout semantics.
- **Phase 0b — blocking prerequisite.** `game-host`'s `next()` does not take the
  difficulty/domain parameter it appears to accept, and **7 of 37 curriculum nodes are
  active, all of them column addition** — so three fraction games and an algebra game are
  shipping against content that is never served. No pacing work is meaningful until a game
  can ask for, and receive, the item it was designed around.
- **Phase 1 — one reference game, on a device, with real children.** Learn the single
  number this audit cannot supply: what multiple of the declared p90 a real 7–11 year old
  needs under mild arcade pressure. Run `arena` in the same session as a control.
- **Phase 2 —** write the primitive with *that* constant, plus a conformance kit promoting
  `colossus`'s anti-mash test.
- **Phase 3 —** fleet retune, mechanically, one PR per game, applying the primitive rather
  than the per-game numbers here.
- **Throughout —** the legibility sweep, which needs no pacing decision and is doing as
  much damage as the clocks. One flash ceiling (`stack` ships 0.24 and comments it as the
  children's-product limit; `slice`, `beam` and `foundry` ship 0.42) and one minimum
  numeral size.
- **Before Phase 3 — instrument.** Retrieval-rate telemetry in the shared host, so the
  retune has a real before/after and the next audit is measured rather than derived.
