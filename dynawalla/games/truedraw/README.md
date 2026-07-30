# THE TRUE DRAW

_after Wild Gunman (1974)_

A statement is cut into a slate across the dust.

    47 + 25 = 62

**Swipe DOWN to keep it. Swipe UP to throw it away.**

Keep the sums that are right. Throw away the sums that are wrong. Every right call
puts coins in your bag; every wrong one, in either direction, takes more out than
any single call can put in.

## What changed, and why

The game had **one verb**. A tap meant "this sum is right", and meaning "this sum is
wrong" was expressed by *doing nothing* and letting the window close.

Two things followed from that, and both of them shipped.

**1. The fast player was made to wait.** `src/game/tempo.test.ts` measures it against
the code as it was: a child who is certain in 300 ms paid **14,000 ms** for every
"this sum is wrong" verdict, on the two-digit regrouping class — forty-six times the
thinking, spent on nothing, on half of every run. That is the complaint, verbatim:

> "I've gotten 10 correct in a row fast and I still get `2+0=1` and **have to wait
> until it times out**."

**2. One of the two verdicts had no timestamp.** A hold has no moment in it. So the
adaptive ladder could not tell a confident rejection from an abandoned one, and half
of every child's calls arrived either as silence or as a full-window number that meant
"the clock ran out". A ladder cannot be driven on half a signal — which is the other
half of the same complaint:

> "It stays on way too easy way too long... It should advance up and down in skill
> level more quickly, especially based on speed. **If we have a gesture for True and a
> gesture for False, we can measure both ways** and decide to go to harder problems."

So there are two gestures, both explicit, both timed, and **a timeout is neither of
them**.

## The mechanic

| | | |
|---|---|---|
| **bank** | swiped down at a true claim | correct. Stamped, seated, and down into the bag. Coins in. |
| **spot** | swiped up at a false claim | correct. The caller bows, the slate **rolls itself right**, and *then* it flies away. The longest and best beat in the game. |
| **dud** | swiped down at a false claim | wrong. You banked a counterfeit. It goes down, the coins drain back out, and **nothing else happens at all** — no sound, no buzz, no colour, no mark. |
| **burn** | swiped up at a true claim | wrong. You threw money away. It flies up, the coins drain, and it is just as silent. |
| **lapse** | the window closed untouched | **nothing.** No coins, no shot, no report. It goes to the host as `skip`. |

Being ignored is still the punishment for being wrong, and it is still enforced in
code: `game/energy.ts` asserts that both wrong verdicts have zero energy — no voice in
`VOICES`, no entry in `HAPTIC`, no light regained — in both the full and the
reduced-motion branch. What a wrong verdict does have is a *consequence*, which is not
the same thing: the bag has fewer coins in it.

## The gestures

`src/game/gesture.ts`, and every number in it is asserted in `gesture.test.ts`.

| | |
|---|---|
| commit distance | `clamp(0.075 × min(w, h), 34, 84)` px |
| direction | vertical travel must exceed horizontal × **1.4** |
| commit moment | the frame the threshold is **crossed**, not the release |
| a tap | starts a run. **Never** answers a question. |
| keyboard | `↓` keeps, `↑` tosses, space starts |

**Why 34 px is the floor.** `packs/shared/sdk/src/tapzoom.ts` calls travel past
`DRAG_SLOP_PX = 10` a drag and leaves it alone; anything at or under it is a candidate
*tap*, which the double-tap guard may cancel and re-dispatch as a `click` with no
travel in it. A commit threshold inside that slop would have its verdicts eaten by the
zoom guard on the second flick of any rapid pair. 34 is 3.4× clear of it, and
`gesture.test.ts` reads the real constant out of `tapzoom.ts` so the margin cannot
drift silently.

**Why 84 px is the ceiling.** The threshold scales with the viewport so an iPad does
not feel like a phone, but it must stay inside one slate height on every shape the
fleet has — the flick is a motion across the thing being judged, never a drag across
the room.

**Why it collides with nothing.** The canvas sets `touch-action: none`, so a vertical
flick is never a page scroll. The manual sheet sets `touch-action: pan-y` on its own
body and is a DOM overlay *above* the canvas, so a finger-scroll in the manual never
reaches the game's listeners — and `guide.isOpen` is checked anyway.

**Why the commit fires mid-motion.** Feel, and honesty. `pointerdown` is unknowable
(the direction does not exist yet) *and* exploitable: rest a thumb on the slate the
instant it lights, think for six seconds, then flick, and a `pointerdown`-anchored
clock reports a reaction of zero and pays the full speed bonus. Anchoring at the
crossing costs ~80–150 ms of finger travel uniformly on both gestures — noise against
a p50 measured in thousands — and cannot be gamed by holding still.
`tempo.test.ts` asserts exactly that.

## The bag

`src/game/bag.ts`. Three numbers, and the relationships between them are the economy.

| | | |
|---|---|---|
| `COIN_BASE` | **6** | every correct verdict, at any speed |
| `COIN_QUICK` | **4** | the most speed can add on top |
| `COIN_WRONG` | **12** | what a wrong keep or a wrong toss takes |
| a lapse | **0** | not a verdict, so not priced |

**`COIN_WRONG > COIN_BASE + COIN_QUICK`.** A wrong verdict costs strictly more than
the very best call can earn. The truth bag deals true and false in exact halves, so a
child who swipes without reading is right exactly 50% of the time — and 12 > 10 makes
that strictly *losing* rather than break-even. A bag that grows on a coin flip is a bag
that rewards mashing.

**`COIN_BASE > COIN_QUICK`.** Being right is worth more than being fast. Fast and right
is worth the most there is; slow and right still banks the whole base, and there is no
branch anywhere that subtracts anything for slowness — `bag.test.ts` proves that by
sweeping every reaction from 0 to ten times p50.

**The two correct verdicts pay exactly the same.** Symmetry is not decoration: an
asymmetry would bias which gesture a child reaches for, and the ladder is now driven by
the latency on *both* of them.

**The bag floors at zero.** A child is never shown a debt. The run's three shots are
what stop somebody mashing from the floor.

### Proved with bots, not with arithmetic

`src/game/economy.test.ts` plays whole runs. The headline case gives the guesser every
advantage — they answer *instantly* on every slate and collect the maximum speed bonus
on every lucky call — and the reader none, taking the documented p50 every single time:

| strategy | final bag | rounds survived |
|---|---|---|
| careful reader, deliberately **slow** | **303** | 59 |
| random swiper, at **maximum speed** | **10** | 6 |
| keep everything | ~10 | ~6 |
| toss everything | ~10 | ~6 |
| wait every window out | **0** | never ends |

Thirty times the bag, ten times the run — the slow reader over the fast guesser. And
bags at accuracy 0.6 / 0.75 / 0.9 / 0.98: **7 / 27 / 131 / 748**.

Waiting is the one thing in the game that costs nothing, and it earns nothing, forever.
It dominates only guessing, which is the strategy it is supposed to beat. It is also
the most expensive thing in the game in wall-clock time, because a lapse spends the
whole window — `economy.test.ts` asserts that too, because a sibling pack shipped an
economy in which never answering strictly dominated answering.

## The ladder

`src/game/ladder.ts`. The reason the game "stays on way too easy way too long" was not
subtle: **`dealer.ts` called `host.next()` with no argument at all.** This pack never
asked for a difficulty in its life.

It now passes a position on every deal, and moves it on every settled outcome:

| | |
|---|---|
| a correct call at ≤ 35% of the item's p50 | **+0.075** |
| a correct call at or past its p50 | **+0.020** |
| any wrong verdict | **−0.110** |
| a lapse | **0** |

Ten fast correct calls is `0.2 + 0.75 = 0.95` — from near the bottom of the ladder to
near the top, which is what the founder asked for stated as the number it is. `DOWN >
UP_MAX` on purpose: one miss undoes about a call and a half of fast progress, and the
SDK's own `flush` lands a fall in two questions rather than thirty-three.

The ceiling is **0.995 and never 1.0**. `game-host`'s `toUnit` reads a value below 1 as
a fraction and 1-or-above as a 1..10 ladder *index*, and resolves the one ambiguous
value — `1` — as the ladder's **bottom**. A game speaking fractions that sent `1.0`
would ask for the easiest content in the product at the exact moment a child had earned
the hardest.

This pack does not model the child and does not pick questions. The host's own ladder is
being changed separately to serve a distribution rather than a single rung; two
controllers fighting over one child would be worse than one.

## What the latency measures

From the instant the statement became **answerable** to the instant the flick crossed
the threshold. Not from the slate being drawn, not from an animation ending, and not
from `pointerdown`.

Three contaminations are closed and each has a test in `tempo.test.ts`:

* **The lead-in is not charged.** The slate now rises **blank** and the statement is cut
  in when the window opens. It used to be legible, unlit, for up to 1.15 s of
  unanswerable lead-in — so a child could read it before the clock started and the
  ladder would read a deliberate child as a lightning-fast one. That beat is also now a
  flat ~320 ms instead of 620–1150 ms scaled *up* by how hard the sum is, which was up
  to a second of dead air per round on a game whose complaint was that it was boring.
* **A paused stretch is not charged.** A reaction time with a parent gate inside it is a
  fiction.
* **Holding still buys nothing.** Six seconds of thinking with a finger already on the
  glass reports six seconds and a quickness of zero.

## Why it cannot be mashed

Two independent devices, on purpose.

**The bag drifts down.** At 50% accuracy the drift is −1 coin per round at best, and
that is the arithmetic of `COIN_WRONG > COIN_MAX` rather than a tuning choice.

**The run is three calls long.** Misses are a budget rather than a subtraction:

    expected calls = shots × p / (1 − p)

| per-round accuracy | expected run |
|---|---|
| 0.50 — swipe at random | **3 calls** |
| 0.75 | 9 |
| 0.90 | 27 |
| 0.97 | 97 |
| 1.00 | no end |

There is no arrangement of three calls that looks like doing well, and no percentage
anywhere in the game to misread as a pass. `src/game/inhibition.test.ts` plays these
strategies out for thousands of runs and asserts every claim on this page.

## Why the falsehoods are worth rejecting

The slate never lies with `answer ± 1`, which a child rejects by feel. It lies with the
item's own **mal-rule distractors** — what a child running a specific broken procedure
actually writes. `47 + 25 = 62` is every carry dropped; `503 − 87 = 426` is the borrow
travelling through the zero and the zero being read as ten. Rejecting one means doing
the arithmetic.

That also makes the reporting fall out for free: a **dud** reports the mal-rule value,
so the host records the miss *and names the misconception the child just demonstrated.*
No extra wiring.

It is also why the window is what it is. `src/game/malRule.test.ts` proves that "the
ones column alone rejects most mal-rules" is **false**: a dropped carry reproduces the
true ones digit *by construction* — 62 and 72 both end in 2 — and so does a borrow left
at ten. A last-digit check accepts the falsehoods this game most prefers to tell, so
verifying costs what computing costs.

## The window is the child's time

`EXPERIENCE_DESIGN.md`: *"COMPREHENSION — not budgeted. The child's time. Measured,
never limited."* The window is that document's own **p90 for the item's class**,
monotone non-decreasing in operand width and clamped by nothing:

| item | p50 | p90 | window |
|---|---|---|---|
| `7 + 8 = 15` | 2.8 s | 6 s | **6.0 s** |
| `47 + 25 = 72` | 6 s | 14 s | **14.0 s** |
| `753 + 577 = 1330` | 11 s | 27 s | **27.0 s** |
| `5001 − 2798 = 2203` | 16 s | 40 s | **40.0 s** |

A long window costs the child nothing now that both verdicts stop the clock: it is spent
in full only by a lapse, which is free. And the **p50** is the other half of that table:
it is never shown and never a limit — it is what "quick" is measured against, by the bag
and by the ladder, and it rides on the statement so the two can never disagree about
which beat they mean.

`src/game/patience.test.ts` plays whole runs at the documented p50 and p90 at every rung
and asserts that a deliberate child is never timed out, never loses a shot, and is paid
the full base on every single call.

## Domains

The statement builder reads `prompt`, `answer` and `distractors` and nothing else, so it
is domain-blind. Only `add` is active in the curriculum today; the day `mul`, `frac`,
`ns`, `div` or `alg` are promoted out of draft, this pack covers them with no change. A
claim is a claim.

## Running it

```
npm install
npm run dev      # http://127.0.0.1:4331 — playable against the stub host
npm test         # the rules, not the rendering
npm run tsc
npm run build:pack
```

`?seed=123`, `?level=0..7` and `?reduced=1` are honoured by the dev harness. A `level`
**pins** the stub, because the game now asks for a difficulty on every deal and a stub
that followed the request could not be swept. The dev readout shows the reports, the
skips, and the difficulty the game last asked for — so a lapse reappearing as a report
with an empty answer is visible in one glance.

## Shape

    src/contract.ts     the host seam — must not drift. `skip` lives here.
    src/game/           the rules: statement, schedule, gesture, bag, ladder, round
    src/render/         the street: one slate, a chute above, a bag below
    src/audio/          asset-free Web Audio; no sound for a wrong verdict or a lapse
    src/stub/           a seeded local host — exact integers, mal-rule distractors
    src/test/harness.ts a headless player, so a run can be played thousands of times
