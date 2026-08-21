# THE WRESTLING GAME — reform, design round 2

Rewrites the design of `dynawalla/games/foundry` ("THE GRAPPLE FOUNDRY"), rank 4 in
[`catalog/ARCADE_CANON.md`](catalog/ARCADE_CANON.md), after *Pro Wrestling / WWF
Superstars* (1986).

Measured against `cad1edaa5` (`chore(dynawalla): 0.3.7`). No game code was changed
to produce this document.

---

## 0. The one-paragraph version

The founder asked why he is always pinned. **Measured: he is not losing.** A bot
that plays the shipped simulation perfectly wins 100% of falls at every rung of
the ladder, and a bot that plays it *naively* — biggest plate first, no thought
at all — wins 83–100%. The win rate is not the defect. Four other things are.
First, **you are only ever pinned**: the game simulates exactly one wrestling
event, from your back, forever, which is the literal reading of the founder's
question and the deepest note in the review. Second, **there is a hard clock on
every single question** — the referee's three slaps give a child between 3.15 and
9.60 seconds to think, always, with no way to turn it off, and the win rate falls
from 100% to 0% across a one-second band of thinking time. That is a flat
violation of *speed is rewarded, never enforced*. Third, **the maths that decides
the fall is not the maths the pack declares**: `pack.json` covers column addition
and subtraction, but what actually gates an escape is solving `93x + 4040y =
8359` — a two-coin Frobenius decomposition of a five-digit target, invisible,
untaught, never reported, and at the top of the ladder it has exactly one
solution 83% of the time. Fourth, and worst: **the maths is optional.** A bot that
never reads the board at all, does no arithmetic whatsoever, and only watches the
analogue bar fill escapes **95–100% of falls at rungs 2 through 7**. The
recommendation is **THE BRASS ROPES**: keep the plates, throw away the clock,
give the referee a hand that *waits*, take the target off the gauge, replace the
coin problem with place-value discs so the mechanic teaches the thing it claims
to, and build a vocabulary of six wrestling moves over one input so the maths
causes approach, ropes, hoist, reversal, top rope and kick out instead of one
repeated exchange.

---

## 1. The brief

Verbatim, and every clause of it is answered somewhere below:

> "Grapple factory .. the animation is kinda' meh. The premise is kinda meh .. the
> soundscape is kinda meh... more varied crowd sound, better animation, cooler
> soundscape .. like it could be rock-n-roll sounds .. the kickout animation is
> goofy and nonsensical. This game leaves a lot to be desired .. I don't
> necessarily think we should abandon it because I think pro wrestling is
> freaking popular and worth doing .. but why am I always pinned .. what if we
> try to simulate a bunch of different things with math to make them happen ..
> approach, grapple .. jump off the top rope. 'The grapple foundry' isn't a good
> name either. I think we should look at this one with a critical eye and see if
> we can reform it a lot. It is not very close to compelling IMO."

And earlier, on the same game:

> "'the grapple foundry' seems completely broken now. I do something that I think
> is correct 0+3=3 so I tap 1 and 2 and the screen basically goes blank but there
> are still sounds .. not completely blank but the wrestlers go away. The
> instructions need to define the terms sometimes. I don't know what 'the fall'
> is."

---

## 2. What the game does today

### 2.1 The loop

`src/game/bout.ts` runs four phases per **fall**: `lockup` (0.82 s, skippable) →
`pin` → `kickout` | `pinfall`. You begin every fall flat on your back with an
iron bar across your chest. A board above the ring shows a column sum. Two
pedals hang off the frame with whole numbers stamped on them; each tap adds that
plate's value to the bar. Reach the sum's answer **exactly** and you kick out.

Four ways a fall ends, three of them losses:

| outcome | trigger | cost |
|---|---|---|
| `escaped` | `load === target` | a plate on the belt |
| `overshot` | `load > target` | **the fall, instantly** |
| `stuck` | `!reachable(target − load, a, b)` | **the fall, instantly** |
| `counted-out` | three referee slaps land | the fall |

Three lost falls and a fresh challenger walks out. Four to eight escapes beat a
challenger (`fallsToBeat`).

### 2.2 The one thing it asks, and the one thing it actually asks

`pack.json` declares seven skills, all of them `dw.add.column.*` /
`dw.add.regroup.*` — whole-number column addition and subtraction. That is what
the board shows.

But the board's answer is only the *target*. To escape you must then decompose
that target across two arbitrary plate denominations inside the count. From the
shipped simulation, verbatim:

```
ladder level 7
  board "8403 − 44"   -> target 8359   plates 93 / 4040   escape = 3×93 + 2×4040   ways out: 1
  board "6200 + 77"   -> target 6277   plates 99 / 2990   escape = 3×99 + 2×2990   ways out: 1
  board "1303 − 79"   -> target 1224   plates 87 / 350    escape = 2×87 + 3×350    ways out: 1
```

Solving `93x + 4040y = 8359` is not column subtraction. It is the two-coin
problem, it is genuinely interesting mathematics, and it is nowhere in the
curriculum, nowhere in `covers.skills`, never reported to the host, and — by the
README's own decision — deliberately never shown: *"Nothing about the
decomposition is reported: it is arithmetic the child performs with their
thumbs."*

### 2.3 Where a question maps to a wrestling action

It does not. There is exactly one action — dropping a plate on the bar — and one
posture, on your back. `lockup` is 0.82 seconds of animation that a tap skips.
The challenger has a name and a lean angle and nothing else. Nobody approaches,
grapples, runs the ropes, reverses, or climbs anything.

### 2.4 The kickout animation, and why it is nonsensical

`src/mount.ts:217` sets `riseTarget = 1`; `mount.ts:459` lerps `rise` toward it;
`src/render/ring.ts:196–247` spends `rise` on exactly three things:

- the player's body is translated up the screen by `rise * u * 1.05`,
- the leverage bar is lifted by `u * (… + rise * 1.4)` and tilted by `−rise * 0.5`,
- **the challenger is translated up too**, by `rise * u * 1.2` (`ring.ts:247`).

That is the whole escape. Both bodies float upward together, still stacked, still
in the same pose, and the bar tilts. **The challenger is never displaced.** You
cannot kick out of a pin without the other person going somewhere, so the frame
reads as two men levitating. The founder's word for it is correct.

### 2.5 The soundscape

`src/audio.ts` is entirely pack-local and predates `game-soundscape`. The hall is
one band-passed white-noise source at a fixed 420 Hz (`audio.ts:107`) whose gain
tracks heat; there is no crowd *reaction* of any kind — no pop, no groan, no
hush, no count-along. The crowd is not people: `src/render/crowd.ts` draws
lanterns, deliberately (*"Not people: lanterns"*). Escape, false finish, pinfall
and title are four fixed oscillator figures at hard-coded frequencies.

It is not wired to the shared generative soundscape at all — of the 28 games in
`dynawalla/games/`, only `counterweight` is.

---

## 3. The measurements

**What was already known.** `PACING_AUDIT_2026-07.md` has this game at **"far too
rushed"**, comprehension window **5.3 s**, "enough time? **no**", and already
records both the two-coin problem (*"exactly ONE valid escape in 391–400 of
them"*) and the gauge (*"the bar quietly draws load/target as an analogue gauge,
so the rush's only survivable answer is to stop computing and watch the bar"*),
and already flags *"`slice` and `foundry` make the maths optional … in `foundry`,
greedy tapping escapes 100% of falls at levels 5–7"*. Every one of those replicates
below.

**What is new here.** The oracle result in §3.2 — which says plainly that the
founder is *not* losing and redirects the whole review; the 100%→0% cliff and the
hard `[3.15 s, 9.60 s]` domain bound in §3.3; the dead-end density in §3.5; the
gauge bot in §3.6, which shows the maths is optional even for a player who never
learns the target at all; and the mis-reported timeout in §3.9.

### 3.1 The rig

A bot drives the **shipped** `Bout` class and the shipped `createStubHost`,
headless, at a fixed `dt = 1/60`, with no renderer. Two policies:

- **ORACLE** — knows the fewest-tap decomposition the instant the pin begins.
  Spends only motor time. This is a ceiling no child can exceed.
- **GREEDY** — heaviest plate while it fits, then the light one. No thought at
  all. This is what a hand does when a head has not solved anything.

Both take a `think` parameter: seconds of stillness before the first tap, i.e.
how long the player is allowed to *think*. Reproduction instructions in §10.

### 3.2 A correct, fast player never loses

300 falls at each of the eight ladder rungs, oracle policy, think = 0:

```
tap=120ms think=0s  overall win 100.0%  | L0..L7 all 100.0%
tap=180ms think=0s  overall win 100.0%  | L0..L7 all 100.0%
tap=260ms think=0s  overall win 100.0%  | L0..L7 all 100.0%
```

**There is no win-rate defect.** A player who knows the answer and knows the
decomposition wins every fall at every rung at every tap speed tested. Even the
thoughtless greedy bot wins 83% at the bottom of the ladder and 100% at the top:

```
GREEDY, think=0, tap=180ms
L0 escaped 83.0%   stuck 17.0%
L1 escaped 85.3%   stuck 14.7%
L4 escaped 98.0%   stuck  2.0%
L7 escaped 100.0%  stuck  0.0%
```

So the honest answer to *"why am I always pinned"* is **not** "because the game
cheats". It is §4.

### 3.3 What IS a defect: the count is a hard clock, and it has a cliff

The same oracle, swept over thinking time:

```
ORACLE win rate vs. seconds of thinking allowed (tap=180ms, 200 falls per cell)
think:      2s    4s    5s    6s    7s    8s    9s   10s   12s   15s   20s
L0        100%  100%   94%   74%    0%    0%    0%    0%    0%    0%    0%
L1        100%  100%   88%    8%    0%    0%    0%    0%    0%    0%    0%
L2        100%  100%  100%  100%   89%    0%    0%    0%    0%    0%    0%
L3        100%  100%  100%  100%    6%    0%    0%    0%    0%    0%    0%
L4        100%  100%  100%   98%   10%    0%    0%    0%    0%    0%    0%
L5        100%  100%  100%  100%  100%    0%    0%    0%    0%    0%    0%
L6        100%  100%  100%  100%    1%    0%    0%    0%    0%    0%    0%
L7        100%  100%  100%   98%    0%    0%    0%    0%    0%    0%    0%
```

100% to 0% inside one second. The count window is
`slapPeriodFor(minTaps, promptDigits, difficulty) * 3`, clamped by
`Math.max(1.05, Math.min(3.2, …))` in `bout.ts:122`, so across the **entire
input domain** it can only ever be:

```
shortest count window possible: 3.15s   (minTaps=2 digits=1 diff=0.6)
longest  count window possible: 9.60s   (minTaps=5 digits=9 diff=0)
```

Typical windows measured on the live ladder: **6.3 s at L0, 8.4 s at L5, 7.0 s at
L7.** Of that, an oracle spends 0.63–0.73 s tapping, leaving a **median of
6.0–7.7 seconds to read a four-digit borrow, evaluate it, read two plate
denominations, and solve a linear Diophantine equation.**

There is no setting, no rung and no state of the world in which this game gives a
child unlimited time to think. It is a clock game with the clock drawn as three
brass bars and a man's hand. That is the binding-principle violation, it is the
whole of the difficulty at the low end, and it is why a child who is *right* can
still watch the hand come down.

`bout.ts` is careful to make the clock a function of the work and never of the
run — *"Time is a function of the work, never of the run"* — which is a
thoughtful defence against a *different* failure. It does not help here. A clock
that never tightens is still a clock.

### 3.4 What IS a defect: the declared maths is not the gating maths

§2.2. In addition, from 200 falls per rung:

```
only one escape exists at all:  L0 41%   L2 69%   L5 83%   L7 83%
```

At the top of the ladder, four falls in five have a **unique** solution. There is
no partial credit, no near-miss, and no second route. The child must find the one
pair `(x, y)` — and is told nothing about it before, during or after.

### 3.5 What IS a defect: exploration is punished with instant death

`load > target` loses the fall on the spot. So does stepping onto a residue no
combination can clear. Measured over the states reachable within three taps of an
empty bar:

```
falls containing at least one instant-loss state within 3 taps:
L0 25%   L2 44%   L4 39%   L7 49%
```

Half the falls at the top of the ladder contain a tap that ends them immediately.
A child cannot try a thing to see what it does. The manual's own advice is
*"Do not tap fast. Work it out first."* — which is the game asking a child to
finish all of its mathematics before touching it, under a seven-second clock.

### 3.6 What IS a defect, and it is the worst one: the maths is optional

The bar draws `load / target` as a continuous analogue fill — `hud.ts:119`
(`fraction >= 1 ? KICKOUT : mix(CHALK, heatColor(…), …)`) and `ring.ts:228`,
where the leverage bar's hot section is `halfBar * 2 * Math.min(1, loadFraction)`.
`bout.ts` also emits `fraction` on every `load` event.

That gauge **leaks the target**. After one tap of the heavy plate the fill reads
`b / T`, and `b` is stamped on the pedal in front of you.

So: a third bot, which **never reads the board**, does no arithmetic on the sum
at all, and can see only the two numbers on the pedals and the bar's fill
quantised to 2% — a generous under-estimate of what a bar half a screen wide
tells you. 300 falls per rung.

```
rung   gauge-coarse (pure bar-watching)        gauge-infer (guess the number off the bar)
L0     escaped  75%  over  3%  stuck 22%       escaped  74%  over  5%  stuck 20%
L1     escaped  79%  over  2%  stuck 19%       escaped  75%  over  7%  stuck 18%
L2     escaped  95%  over  0%  stuck  5%       escaped  59%  over  1%  stuck 40%
L3     escaped  97%  over  0%  stuck  3%       escaped  55%  over  0%  stuck 44%
L4     escaped  97%  over  1%  stuck  3%       escaped  49%  over  1%  stuck 50%
L5     escaped 100%  over  0%  stuck  0%       escaped  50%  over  0%  stuck 49%
L6     escaped 100%  over  0%  stuck  0%       escaped  48%  over  0%  stuck 51%
L7     escaped 100%  over  0%  stuck  0%       escaped  48%  over  0%  stuck 51%
```

`gauge-coarse` never forms a number at all. It keeps dropping the heavy plate
while the fill says another one fits, then the light plate, and it wins **95–100%
of falls from rung 2 upward.**

This is the guard failing: *it must be REAL maths, not button-mashing.* At the
top of this ladder the arithmetic is decorative, and the rational play — the one
the seven-second clock actively pushes a child toward — is to stop computing and
watch the bar. A child who does that will learn to watch bars.

(`gauge-infer`, which tries to *recover* the target from the fill and then finish
exactly, does much worse, because a 2% read of a five-digit target is worth
±160 and the plates are unforgiving. That asymmetry is itself the finding: the
game rewards not thinking about the number more than it rewards thinking about
it imprecisely.)

### 3.7 The blank-screen bug: fixed, and verified fixed

The founder's earlier report (`0 + 3`, plates 1 and 2, wrestlers vanish, audio
continues) was `withAlpha(heatColor(h), a)` producing `rgba(NaN,11,37,0.3)` into
`CanvasGradient.addColorStop`, which throws inside `drawMat` — before the bodies,
the referee and the HUD, while `frame()` had already re-armed its rAF.

**It is fixed on `origin/main`** and I confirmed the fix rather than assuming it.
`src/render/palette.ts` now parses `rgb()` as well as hex through a shared
`channels()`, `mix()` returns `#rrggbb` so it composes, an unparseable colour
falls back to grey *and logs loudly*, and every channel goes through `clamp8`.
Landed in `606d03667` (#711) and `48a252e73`, with `src/test/escape.test.ts`
asserting the founder's exact input across a correct answer and the twelve
seconds a scorch takes to cool, and asserting the *player is still being drawn*
by counting cast-iron marks inside the ring rather than counting draw calls.

Note for anyone reproducing: **the primary checkout was 145 commits behind and
still contained the bug.** Verify against `origin/main`.

### 3.8 The reveal never completes the sum, and it is drawn in oxide

House standard: a miss completes the sum in front of the child, held, in the
accent colour; never red, never "WRONG"; and the hold shortens as intensity
rises because skipping it is the reward for mastery.

What this game does on a lost fall (`mount.ts:260–293`):

- banner text is `"TOO MUCH"`, `"NO WAY OUT"`, `"THREE"`, or `"WAVED OFF"`,
- subtitle is `` `${f.load} — it needed ${f.target}` `` — the *target*, never the
  sum completed,
- colour is `OXIDE`, `#8c3a24`, which the palette calls *"a refused total. Oxide,
  not a red alert light"* and which is nonetheless a dark red,
- held for a fixed **1.25 s**, at every intensity.

So the child who loses `8403 − 44` is shown `"THREE"` and `"1224 — it needed
8359"` for a second and a quarter in rust. They are never shown `8403 − 44 =
8359`.

The reference implementation, `games/stack`, does five things this does not, and
all five are load-bearing:

1. **It completes the equation itself.** `47 + □ = 68` re-renders as
   `47 + 20 = 68`. No word is added; the whole translatable surface of that HUD
   is four words.
2. **It is drawn in `var(--ac)` — the same accent a correct answer celebrates
   in** — and `patience.test.ts` asserts that by name: *"the completed sum is
   drawn in … it must be the accent a correct answer celebrates in"*.
3. **The world stops while it is up.** Nothing descends, no guard runs, and
   `questionAt` is not stamped, so *the reading seconds are billed to nobody*.
4. **It is a cap on a screen nobody is touching, not a wait.** One tap takes it
   down and play resumes in the same frame.
5. **It is adaptive on the success streak, not on tenure or the clock**:
   `revealDwell(streak)` → `revealMs(SECOND_GRADE_FLOW, streak/8)` →
   `4200 ms × (1 − i)²`, floored at `REVEAL_MIN = 0.9 s`. **4.20 s from a
   standing start, 2.36 s on a run of two, 0.90 s from five up.** The streak is
   used precisely so that patience is never withdrawn from the child who needs
   it — *"eleven wrong drops in a row took the reveal from 4.20 s to 2.21 s,
   which is patience being withdrawn from exactly the child who needed it."*

`foundry` has none of the five. Its reveal is 1.25 s flat, for every child, in
every state, and it is a receipt rather than a lesson.

### 3.9 A timeout is reported as a wrong answer

`bout.ts:402` — `loseFall("counted-out")` calls
`this.report(false, f.load > 0 ? String(f.load) : "")`. The count running out is
filed with the host as an **incorrect attempt**.

The shared adapter is explicit that this is wrong: a timeout must go through
`skip(questionId)`, because *"a timeout reported as `{ correct: false, answered:
"" }` … is filed as a MISS: the empty string does not parse, the learner model
takes a wrong attempt, and the ladder steps down."* `skip` produces no outcome,
does not move difficulty, and does not return the question to the pool.

So today a child who *knew* `8403 − 44` and simply did not finish decomposing
8359 inside seven seconds is recorded as having got column subtraction wrong, and
the ladder steps down under them. That corrupts the learner model in the
direction of under-serving the fastest thinkers, which is the systematic failure
the latency contract warns about.

`foundry`'s own `contract.ts` has no `skip` on its `Host` type, so the fix is a
contract change as well as a call-site change.

### 3.10 It is outside the shared adaptation and reveal system

`dynawalla/packs/shared/game-pacing` exists and exports the one-axis flow
controller (`observe`, `demandFor`, `settle`, `quickness`) plus the adaptive
reveal (`revealMs`, `revealShown`, calm→full, `revealShown` false below 250 ms).
`arena`, `slice`, `gavel` and `stack` are on it.

`foundry` is not. It rolls its own `normalizeDifficulty(q.difficulty)` and reads
the host's per-item level. It therefore has no intensity of its own, no adaptive
reveal, and no way to express "one axis, not modes".

---

## 4. The real answer to "why am I always pinned"

Read it literally. **The game only ever puts you on your back.** Every fall
begins with `phase = "lockup"`, 0.82 seconds of takedown, and then you are pinned
— win or lose, escape or get counted, next fall, pinned again. There is no
offence. You never take a man down, never hold one, never climb anything. The
canon entry promised *Pro Wrestling (1986)*; what shipped is the bottom half of
one hold, repeated.

Everything else in the review follows from that. The animation is "meh" because
there is only one animation to make. The premise is "meh" because the premise is
a single frame. The soundscape is flat because there is only one thing for a
crowd to react to. And the founder's own prescription — *"simulate a bunch of
different things with math ... approach, grapple .. jump off the top rope"* — is
exactly the right fix.

---

## 5. The name

"THE GRAPPLE FOUNDRY" is rejected. It is also confusing inside the catalogue:
there is already a **FOUNDRY STREET** (rank 13), a **GLACIER FOUNDRY** (60), a
**GRAPPLEWRIGHT** (105) and a **GRAPPLE VAULT** (172). Five games sharing two
words.

The frame is the **Dynawalla Bazaar** — an endless minaret-punk marketplace at
the blue hour, sodium lanterns, sagging wires, brass. Carnival wrestling belongs
in a marketplace historically as well as thematically: the wrestling tent
travelled with the fair.

| candidate | for | against |
|---|---|---|
| **THE BRASS ROPES** | the single most iconic object in wrestling, and a bazaar material. Both words are concrete nouns a six-year-old owns. The ropes are also the *spine of the move vocabulary* — you run them, you get whipped into them, you climb them. Sits correctly beside THE LATTICE, THE COUNTERWEIGHT, COLOSSUS. | "ropes" alone is a little quiet |
| CARAVAN OF CHAMPIONS | true to the travelling-tent history; "champion" is the child's own word for what they want to be | long; "caravan" is ambiguous across locales |
| THE TENTH BELL | the ten-bell salute is real wrestling ritual, and a bell is a market sound | needs explaining, which is the exact sin this game was pulled up for |
| DUST & THUNDER | best-sounding of the five; carries the crowd | says nothing about wrestling or about maths |
| THE LAMPLIGHT TITLE | keeps the lanterns, which are the best art in the current build | "title" is jargon |

**Recommended: THE BRASS ROPES.**

---

## 6. Option A — **THE BRASS ROPES** (recommended)

A best-of-three-falls match against a challenger, on a raised ring in the middle
of the night market. Six wrestling moves over one input. No clock anywhere.

### 6.1 The keystone: **the referee's hand waits**

This is the change that everything else hangs off, and it is worth stating on its
own because it deletes the clock without deleting the count.

> **The count never advances with time. It advances with a mistake.**

When you are pinned, the referee's hand goes up **and stops**. It hangs there.
Nothing in the world moves on. The hall drops to a hush and starts a slow,
unhurried chant. A child may think for four seconds or four minutes and the frame
is identical.

The hand comes down — **ONE** — when the bar goes over the number. Not before.
Three overshoots and the fall is theirs.

This is not a compromise with the iconography; it is *better* iconography. The
frozen hand before the count is the most tense image in professional wrestling,
and the shipped game throws it away in favour of a metronome. And it converts the
game's failure vocabulary from four causes to **one**: you went over. `stuck`
disappears (§6.3), `counted-out` disappears, and `overshot` stops being fatal.

**Speed is rewarded, never enforced:**

- A clean escape — no overshoots — **flips the advantage**: your wrestler comes up
  first and takes the next move as offence. That is the reward, and it is
  positional, not punitive.
- A fast clean escape additionally **heats the hall**, and the top-rope move only
  unlocks while the hall is hot. Fast play unlocks the coolest thing in the game.
  Slow play never loses anything; it simply does not unlock it.
- An escape *after* a mistake is a **NEAR FALL** — the hand at two-and-nine-tenths
  — and that is **the loudest sound in the game**, louder than a clean escape.
  A child who struggles and gets out hears the biggest moment in the building.

That last point is deliberate and it is the design's answer to *never
characterise kids negatively*: the child who needed three tries does not get a
smaller celebration, they get the one the whole art form is built around. The
child who was clean gets the better *position*. Nobody is ever shown a lesser
version of the game for having found it hard.

### 6.2 The move vocabulary — six things, six arithmetic shapes

One input surface throughout, so there is one motor skill to learn: a row of
**plates** along the bottom, tapped to build a number, and a **hold** to climb.
What changes between moves is the question, the body, and the crowd.

| move | what the bodies do | the maths | why the maths *is* the move |
|---|---|---|---|
| **THE APPROACH** (collar-and-elbow tie-up) | the two circle, then lock hands and lean; feet skid on the canvas | a single fact — `8 + 6`. Build 14. | the number *is* the push. Whoever commits the right one first drives the other back and takes the advantage |
| **RUN THE ROPES** | whipped into the brass ropes, rebound, again, again | skip-count: four rebounds at 25 each. Build 100. | the ropes are a repeated-addition machine. A child *feels* a multiple as four impacts |
| **THE HOIST** (a lift and a slam) | you get underneath and press them overhead | column add/sub — the declared curriculum. Build the answer. | you are lifting a weight. The total is what you can lift. This is today's mechanic, kept |
| **THE REVERSAL** | their hold rotates and becomes yours | missing addend: they already have `K` on the bar and the ring shows `T`. Build `T − K`. | you use their number against them. The inverse operation, made physical |
| **OFF THE TOP ROPE** | climb the corner, the hall goes silent, dive | magnitude on a number line: they are lying at position `P`. Choose where to land. | the height *is* the number. Coarse plates at high intensity force estimate-then-refine |
| **THE KICK OUT** | the bridge (§6.4) | build the answer to get out from under | the finish, and the only place the count exists |

Six moves, four genuinely different arithmetic shapes (sum, product, complement,
magnitude), one pair of thumbs. **The maths causes the drama** — a bigger number
built cleanly *is* a bigger throw — rather than gating it.

Two verbs total: **tap builds, hold climbs.** The top-rope hold is the only
non-tap input in the game and it exists so that commitment is physical: you feel
yourself going up, and you feel yourself let go.

### 6.3 The plates become place value — and the coin problem dies

Replace the two arbitrary denominations with **place-value discs: 1, 10, 100,
1000.** Building 583 becomes `5×100 + 8×10 + 3×1`, which is not a coin problem at
all — it is *writing the number in base ten*, which is precisely the skill
`dw.add.column.*` is about.

What this fixes, all at once:

1. **The undeclared Frobenius problem is gone.** The gating maths becomes the
   declared maths.
2. **`stuck` becomes unreachable.** With a 1 on the board, every residue is
   clearable. One of the four failure modes deletes itself, and with it the
   worst moment in the current game — being told there is no way out of a
   position you walked into two taps ago.
3. **Greedy is always optimal and always safe**, so there is a strategy a child
   can *discover*, and discovering it is real mathematical insight (largest place
   first).
4. **It is the intensity axis, for free.** `{1}` → `{1,10}` → `{1,10,100}` →
   `{1,10,100,1000}`. At the bottom, one disc: tap it three times to make 3. At
   the top, four discs and a four-digit target.
5. A child who makes 58 by tapping the 1 fifty-eight times **has done something
   correct**, and the game must accept it. It is slower, and the hall stays cool,
   and that is the whole of the consequence.

Two invariants the generator must hold, and they are cheap:

> **The disc set always covers the target's largest place.** A four-digit target
> never appears without a 1000-disc. This is what stops "tap the 1 eight thousand
> times" from being a real state rather than a rhetorical one, and it is
> automatic because the disc set and the curriculum rung ride the same intensity.

> **The canonical escape is the base-ten expansion**, so its length is the digit
> sum: 8359 costs 25 taps. That is ~4.5 s of tapping and it is the *reward* beat,
> not the puzzle — the puzzle was the column subtraction on the board. It should
> be built to feel like a drum fill, and it is the one place the game gets to be
> percussive. If it plays as tedious, the fallback is a 5-disc alongside each
> power of ten (1, 5, 10, 50, 100, 500, 1000), which halves the worst case and is
> still money-like and still greedy-safe.

Retain from the old design: the **false finish**. Landing the bar on a real
mal-rule total (`packs/shared/curriculum/src/malrules/columnOp.ts`) still brings
the hall up and the referee still waves it off. It was the best idea in the
shipped game — a diagnosis delivered as a crowd reaction — and it survives
untouched.

### 6.3a The bar stops being a gauge

§3.6 is not fixed by changing the plates. A bar that fills toward the target
leaks the target, and any child who notices will stop doing arithmetic, correctly,
because the game told them not to bother.

> **The ring may draw the load. It may never draw `load / target`.**

The bar shows what you have built — as a **number**, and as **discrete stacked
discs**, one visible object per tap, so a child can count what is on it. It does
not fill toward anything, it has no end, and there is no second mark on it. The
only place the target appears is the board, as a sum, unevaluated.

This makes the discs' legibility do work the gauge used to do badly: five hundred
is *five hundred-discs*, and that is a place-value reading, not a percentage.

Concretely, in the current code, this deletes the `fraction` field from the `load`
event, the `loadFraction` parameter threaded through `drawGrapple`, and the
`fraction >= 1` branch in the HUD. A test should assert that no renderer receives
`fall.target` at all except the board.

### 6.4 The kick out that makes physical sense

The current escape floats both bodies upward without separating them (§2.4). The
replacement is **the bridge**, chosen because it reads in silhouette: a curve
appears where a flat body was.

~450 ms, and the load-bearing property is that **the challenger must go
somewhere**:

| t | what happens |
|---|---|
| 0–120 ms | heels dig, knees rise. Anticipation — the body *compresses* before it extends. Dust puffs at head and heels |
| 120–260 ms | the arch snaps: head and heels on the mat, hips to the sky. The challenger's mass is carried **up on the arch** and begins to slide |
| 260–380 ms | the challenger slides off the far side and lands. **They are now at a different x.** The referee's hand stops mid-air and opens |
| 380–450 ms | your wrestler rolls to a knee, then to their feet. Advantage flips |

Secondary motion that sells it: the ropes shake on the landing, the mat decal
scorches where the two contact points were, and the challenger's next pose is
*different from the one they were in* — the single thing the shipped animation
never does.

The same anticipate → extend → displace → recover skeleton drives every other
move, so the animation work is one system rather than six.

### 6.5 The match, and why you are not always pinned

**Advantage** is a two-headed bar between the wrestlers, and it decides who acts.

- Advantage yours → you pick from the moves that are unlocked and *do* one.
- Advantage theirs → you are defending: a reversal, or a kick out.
- Advantage flips on a clean move, on a reversal, and on a clean escape.

A **fall** is a pin held to three. A **match** is best of three falls. So losing a
fall is a story beat, not a defeat — and after a lost fall the child comes back
**with the advantage**, which is the oldest structure in the sport (the babyface
comeback) and exactly the right thing for a game about not giving up.

At intensity 0 the challenger is passive and the child is on offence almost
always. As intensity climbs the challenger takes the advantage more often. **You
are never pinned because you lost; you are pinned because the match went there,
and you always get out of it eventually.**

### 6.6 The reveal

Copy `games/stack` exactly — all five properties in §3.8, not three of them.

On an overshoot, before the referee's hand comes down:

- the board **completes its own sum in place**, held: `8403 − 44` becomes
  `8403 − 44 = 8359`. Not a banner, not a new surface — the same board, finished.
- the bar you built is completed beside it in the same voice:
  `8×1000 + 4×100 + … = 8402`, so the child sees *their* number and *the* number
  as two finished sentences and can see where they diverged,
- both in `KICKOUT` cyan `#7fe3ff` — the one cold colour in the building, and
  already the colour this game celebrates an escape in. `OXIDE` is retired from
  the reveal entirely; it stays for the mat's rust,
- **no word is added.** `TOO MUCH` and `THREE` go. The sum is the whole message,
- **the ring stops.** No animation advances, nothing is billed to the child's
  clock, and `questionAt` is not stamped,
- **one tap takes it down** and the wrestlers resume in the same frame. It is a
  cap on a screen nobody is touching, not a wait,
- the two wrestlers then **cover** (§7): they recover the moment together, the
  challenger resets the hold, and nothing has ended.

Duration is `stack`'s function, not a new one:
`revealDwell(streak) = max(0.9 s, revealMs(SECOND_GRADE_FLOW, streak/8))` —
**4.20 s from a standing start, 2.36 s on a run of two, 0.90 s from five up.**
Driven by the **success streak**, never by tenure or by the clock, so that
patience is never withdrawn from the child who needs it. Skipping it is the
reward for mastery; being given four seconds of it is not a punishment for
anything.

**The reveal fires no cue of its own.** No `failure` gesture, no sound, no flash —
`stack` asserts this by name, and the reason is that a cue is a verdict. The only
feedback is a single `heavy` haptic, which is the bar coming down, not a
judgement. The crowd's `OOOOH` belongs to the *overshoot*, a beat earlier, and it
is disappointment *for* the child, not at them.

Reporting, and it is a fix to a live defect (§3.9): an overshoot is
`report({ correct: false, answered: <what they built> })`. A fall the child
simply walked away from is `skip(questionId)` and is reported as nothing at all.
`Host` gains `skip`.

### 6.7 Full spectrum, one axis

Adopt `dynawalla/packs/shared/game-pacing`. One `intensity` in [0,1], driven by
`observe`/`settle` on `(correct, thinkingSeconds)`, spends itself on:

| intensity | curriculum rung | plates | moves live | challenger | hall | reveal |
|---|---|---|---|---|---|---|
| 0.0 | `0 + 1` | `{1}` | approach, hoist | passive | quiet, wide | long, calm |
| 0.3 | two-digit, no regroup | `{1,10}` | + run the ropes | occasional | warm | full |
| 0.6 | three-digit regroup | `{1,10,100}` | + reversal | trades | hot | brief |
| 1.0 | four-digit across a zero | `{1,10,100,1000}` | + off the top rope | aggressive | roaring | skipped |

One axis. No modes, no menu, no difficulty select. The floor is genuinely `0 + 1`
with unlimited time and it is not demeaning, because the dignity comes from the
celebration and from the visible climb.

**The latency contract matters here.** `seconds` passed to `observe` is *thinking*
time only. It must start when the board is readable and end at the commit — it
must not contain the takedown animation, the rope-run travel, or the top-rope
climb. The shipped game already reports `ms: Math.round(f.elapsed * 1000)`
measured from pin-begin, which is correct; keep that discipline through all six
moves, and keep the reveal beat out of it.

**The display ordinal must not be the pressure index.** `ADAPTATION_AUDIT`'s
standing warning is that most games fuse the two, so lowering difficulty counts
backwards on screen and *announces the adaptation* — the one thing the brief
forbids. The belt is the right shape for this game because it is monotone by
construction: plates go on and never come off, whatever the intensity does.
Nothing else in the chrome may be a level number.

The same audit's note on this game — *"`foundry` needs its additive floors moved
(a 3.2 s clamp and a five-tap minimum are not a calm end)"* — is answered by the
clock going away entirely and by `{1}` being a legal plate set.

### 6.8 The audio, designed against what actually exists

The shared module is `dynawalla/packs/shared/game-soundscape` (note the
`dynawalla/` prefix). It is genuinely constrained and the design must be honest
about that:

- **eight gestures only**: `step`, `success`, `failure`, `levelComplete`,
  `refuse`, `arrive`, `moreTension`, `lessTension`. A game may never name a
  pitch; `Gesture` is a closed union with no frequency member and `Melody.emit`
  is the only way out.
- **there is no tempo anywhere.** No BPM, no bar, no grid, no scheduler in the
  module, the host, or any pack.
- **there is no percussion, no distortion, and no crowd bed.** `Timbre` is
  `bell | pluck | bloom | rubble`. The always-on ambient bed is stage 3 and
  unwritten.
- everything routes through `game-audio`'s `createSafetyBus`; melodic peak is
  `MELODY_PEAK = 0.14`, and a bed must sit ~10 dB under it.
- of 28 games, only `counterweight` is wired. Its `speak(gesture): boolean`
  pattern — return false and fall through to the pack's own fixed cue — is the
  one to copy.

Three layers:

**(1) Melodic — delegate entirely, name nothing.**

| wrestling beat | gesture |
|---|---|
| a plate lands | `step`, `direction:+1`, `weight` = the disc's place (1000 → 1.0, 1 → 0.0) |
| a move lands, a kick out | `success` |
| an overshoot | `failure` — *"soft, low, short — never a buzzer"*, which is already the rule |
| a tap during an animation | `refuse` |
| a challenger walks out, the ring is set | `arrive` |
| a challenger beaten | `levelComplete` — the only gesture allowed to be big |
| the hall heats / a fall is lost | `moreTension` / `lessTension` |

The `weight`-by-place mapping is exactly `counterweight`'s `PLACE_WEIGHT` and is
already proven. Every beat in the game has a home; nothing needs a new gesture.

**(2) The crowd — pack-owned, and legal because a crowd has no pitch.**

A crowd is noise. It names nothing, so it does not belong to `game-soundscape` at
all. Build it in the pack's own `audio.ts` through `createSafetyBus`, budgeted
≤ 0.04 peak. Six reactions, each tied to a specific event — this is the "more
varied crowd sound":

| cue | shape | fired by |
|---|---|---|
| **BED** | band-passed noise floor; band and level track the hall's heat. *(exists today — a re-tune, not a rebuild)* | always |
| **POP** | fast swell, bandpass sweeping up, ~400 ms | a move lands; a place closed exactly |
| **OOOOH** | slower swell, band sweeping *down*, warm, ~700 ms | an overshoot; a top-rope miss. The crowd is disappointed **for** you. This is the most important sound in the game and it must never read as a buzzer |
| **HUSH** | bed ducks to near-silence over 250 ms and holds | climbing the top rope; the referee's hand going up |
| **THE COUNT** | a rhythmic dip-and-swell of the bed synchronised to the hand, bigger each time | each count, i.e. each overshoot |
| **THE ROAR** | bed wide open, 1.4 s, `success` riding on top | the near-fall |

The `rubble` recipe (16 grains, `size = 1/(1+i)`, lowpass 1400 Hz, budgeted as
**one** voice) is the existing granular impact engine and is the right starting
point for body-on-canvas.

**(3) Rock and roll — the entrance themes.**

Every challenger walks out to their own riff. This is *the* pro-wrestling audio
idea and it is eight pieces of free variety.

A riff needs pulse and pitch, and the pack may have neither by fiat. The
resolution: **a riff is a rhythm, not a tune.** The pack owns the onset
pattern — which is the recognisable part of a wrestling theme anyway — and hands
each onset to `Melody.emit({ kind: "step", … })`, so every note is a degree of
the app's live mode. The same riff in `maqam.hijaz` and in `western.blues` is the
same theme in a different key, which is exactly right for a bazaar that rotates
its mode every eight minutes. The bite is the pack's own timbre layered on top —
counterweight's `edge()` pattern, where *the module chooses the note and the game
chooses the distortion*.

**Flagged as the design's biggest audio risk.** A game-owned pulse has no home in
the shared architecture and the soundscape doc says so. It should be built as a
throwaway prototype and judged by ear before anything commits to it. If it does
not work, the fallback is entrance *impacts* rather than entrance *riffs* —
pyrotechnic hits on a fixed pattern with no melodic content — which is less
exciting and entirely safe.

**And the chant.** When the referee's hand has been waiting a while, the hall
starts a slow, unhurried chant. It never speeds up and it never gets more urgent.
It is the sound of unlimited time, and it turns thinking from an absence into an
experience. It is the one periodic thing in the game and the pack owns its clock.

### 6.9 Every invented word, defined where the child meets it

The existing `src/manual.ts` is genuinely good, and it is worth being explicit
that **this game already owns the house's only executable jargon rule.**
`EXPERIENCE_DESIGN.md` has no such rule; `src/test/manual.test.ts` — written in
direct response to *"I don't know what 'the fall' is"* — enforces four:

1. every entry in `INVENTED_TERMS` appears in the manual;
2. each is *defined* where first used, matched against a literal introducing
   phrase (`/that one try is called a fall/i`, `/those three slaps are called the
   count/i`, …);
3. **the definition comes before the use** — *"'It costs you count' three sections
   above 'Those three slaps are called the count' is the same bug with the fix
   filed in the wrong place, and a child does not scroll back"*;
4. every entry in `BANNER_WORDS` — every word the game shouts in capitals — is
   explained, so a new banner in `mount.ts` cannot ship without a manual line.

Keep the module, the doctrine and the test, and surface it through the shared
`packs/shared/game-chrome/instructions.ts` sheet, which is reachable *during*
play — *"a child who needs the rules needs them at the moment they are stuck,
which is never the title screen."* This rule should be promoted out of this pack
and applied to the fleet.

Extend `INVENTED_TERMS` and `BANNER_WORDS` to the new vocabulary:

`ring` · `ropes` · `the apron` · `pin` · `fall` · `match` · `kick out` · `bridge`
· `advantage` · `count` · `near fall` · `approach` · `run the ropes` · `hoist` ·
`reversal` · `off the top rope` · `waved off` · `belt` · `disc`

Two additions to the doctrine:

1. **A word is defined the first time it appears anywhere, including on a
   banner.** The first time `NEAR FALL` is printed, the ring also says *"that is
   a kick out at the last moment — the crowd's favourite thing"*, once, and never
   again.
2. **No banner may be a judgement.** `TOO MUCH` and `THREE` go. What replaces
   them is the completed sum and the crowd's reaction. The only capitals left
   describe what *happened in the ring*: `KICK OUT`, `NEAR FALL`, `WAVED OFF`,
   `REVERSAL`, `OFF THE TOP ROPE`.

---

## 7. Option B — **THE WORK**

Genuinely different, and worth stating properly because its central idea is
true.

**Professional wrestling is cooperative theatre.** Two performers build a match
together for a crowd. Nobody is pinned against their will; the pin is a spot they
both agreed to. So: delete the opponent as an adversary. The child and their
partner are **working** a match, and the score is the hall, not the other
wrestler.

The match is a sequence of **spots** the child calls. Each spot is a small
arithmetic figure; executing it moves the crowd. A blown spot is **covered for** —
the partner improvises, the crowd does not notice, and the meter dips rather than
resets. **There is no losing.** The outcome is a match rating, which is
wrestling's own metric.

**For.**

1. It deletes *"why am I always pinned"* structurally rather than by adding
   moves. There is no pin you did not choose.
2. It is the truest thing anybody could say about the subject, and children who
   love wrestling already know it — the design would be *respecting* what they
   know rather than pretending otherwise.
3. It is the most aligned option with *fun IS the pedagogy* and *never
   characterise kids negatively*: a miss is a cover, not a defeat, and the
   metric — voluntary time-on-task — is literally the thing being simulated.
4. It makes the crowd the score, which is exactly the varied crowd sound the
   founder asked for, with the crowd promoted from decoration to mechanic.

**Against, and it is decisive.**

1. **A nine-year-old wants to win.** Removing the adversary removes the only
   jeopardy children reliably respond to. The canon's own note on this game says
   *"the escape explosion is the biggest reward in the family"* — and an escape
   requires something to escape from.
2. **"It's fake" is the first note it will draw**, from children and parents
   alike, and it undercuts the fantasy instead of deepening it. Wrestling is
   cooperative *and* it is watched as a contest; a product that says the quiet
   part out loud loses the contest without gaining anything a child asked for.
3. **A star rating is a report card.** `game-pacing`'s flow controller is
   deliberately silent — *"a child must never be able to read the controller's
   opinion of them"* — and a visible three-star match is precisely that opinion,
   rendered large.
4. It is the largest rewrite. Nothing about the bout, the plates, the count or
   the belt survives.

**Keep one piece of it, and it is a big one: THE COVER.** When the child
overshoots, the two wrestlers *cover* — a beat where they recover the moment
together, the hold resets, the crowd goes *ooooh* — instead of the fall ending.
That single borrowed idea is what makes Option A's non-fatal overshoot read as
wrestling rather than as a forgiving game, and it is already in §6.6.

---

## 8. Option C — minimal: keep the shape, remove the violations

The cheapest honest response, listed because it is the right *first commit*
whichever direction wins, and because it should be judged on its own:

- The referee's hand waits (§6.1). Delete `slapPeriodFor`, `SLAP_COUNT`-by-time,
  and `counted-out`.
- Plates become place-value discs (§6.3). `stuck` deletes itself.
- **The bar stops being a gauge** (§6.3a). This is the one that closes the
  maths-optional hole, and nothing else does.
- Overshoot costs a count, not the fall.
- The reveal completes the sum in `KICKOUT`, on the board, world stopped,
  tap-to-dismiss, sized by `revealDwell(streak)` (§6.6).
- `Host` gains `skip`; a walked-away fall is reported as nothing (§3.9).
- Adopt `game-pacing` (§6.7).
- The kick-out becomes the bridge, and the challenger is displaced (§6.4).

**For:** roughly 5,600 lines survive; the tests survive; it can ship in one PR;
and it removes every measured binding-principle violation in §3.

**Against:** it answers none of the founder's actual review. The premise is still
one repeated exchange, you are still always on your back, the animation is still
one animation, the crowd is still one bed, and there is still no rock and roll. It
would be a *correct* game that is still *"not very close to compelling"*.

---

## 9. Recommendation

**Option A, THE BRASS ROPES, delivered as C-then-A.**

Land Option C first, on its own, as one PR: it is the entire compliance fix, it is
independently correct, and every measurement in §3 that says the shipped game
breaks a binding principle is closed by it. Then build the move vocabulary,
the animation system and the audio on top of a game that is already honest.

Take from B the cover, and nothing else.

**Sequence.**

1. **The clock, the discs, the gauge, the reveal, `skip`, the pacing module.**
   (Option C.) Closes §3.3, §3.4, §3.5, §3.6, §3.8, §3.9, §3.10. The renamed
   pack ships here.
2. **The bridge**, and the anticipate→extend→displace→recover skeleton the other
   five moves will reuse. Closes §2.4.
3. **The crowd's six reactions**, and `Melody` wiring with `speak()` fallback.
   Closes half of the soundscape note; makes the existing game feel different
   immediately.
4. **The vocabulary**: approach and run-the-ropes first (they are the two that
   get the child off their back), then reversal, then the top rope.
5. **Advantage and best-of-three falls.** This is the beat that finally answers
   *"why am I always pinned"*.
6. **Entrance themes**, last, and only if the prototype in §6.8 sounds good.

Nothing after step 1 is required for the game to be *correct*; everything after
step 1 is required for it to be *compelling*. The founder asked for both and was
explicit that the second is what is missing.

### 9.1 Keep / kill

**Keep, and most of the 5,600 lines are in here.**

- `src/manual.ts` and `src/test/manual.test.ts` — the best jargon discipline in
  the fleet, and it should be promoted out of this pack (§6.9).
- `src/game/plates.ts`'s exactness doctrine — no float ever reaches a plate
  value, a target or a comparison, asserted over the whole reachable range. The
  denominations change; the doctrine does not.
- The **false finish**: a mal-rule total delivered as a crowd reaction rather
  than as a correction. The single best idea in the game.
- `stubHost.ts`'s mal-rules, ported column-for-column from
  `packs/shared/curriculum/src/malrules/columnOp.ts` **with their `applies()`
  guards**, so a rule that would coincide with the correct answer emits nothing.
- `src/render/palette.ts` after `48a252e73` — `channels()`, `clamp8`, the loud
  fallback for an unreadable colour. This is now a small hardened colour library
  and other packs should take it.
- The `game/` ⟂ `render/` split. It is why §3 could be measured at all.
- The crowd-as-lanterns art, the night market, the brass and cast-iron palette,
  the belt that never loses a plate.
- `reaction.ts`'s `REACTION_INPUT_KEYS` and the test that asserts nothing
  resembling a run length was ever added to it.

**Kill.**

- `slapPeriodFor`, the `[1.05, 3.20]` clamp, `SLAP_COUNT`-by-time,
  `counted-out`. The whole clock.
- `loadFraction` and every path that draws `load / target` (§6.3a).
- `stuck` as an outcome, and `reachable()` as a *rule* — it stays as a test
  helper.
- `overshot` as a fall-ending outcome.
- `OXIDE` in the failure banner, and the words `TOO MUCH` / `THREE`.
- `normalizeDifficulty` and the game's private difficulty handling, replaced by
  `game-pacing`.
- `report(false, …)` on a timeout (§3.9).
- The name.

**Demote.** `rise` and the two-body float in `ring.ts` — the skeleton is sound,
it is the *poses* that are missing (§6.4).

---

## 10. Reproducing §3

The bot rig is not in the repo — it drives the shipped classes from outside and
was written to answer one question. To rebuild it:

```ts
import { Bout } from "dynawalla/games/foundry/src/game/bout.ts"
import { createStubHost } from "dynawalla/games/foundry/src/stubHost.ts"
```

Construct a `Bout` over `createStubHost({ seed, level, reducedMotion: true })`,
step it at a fixed `dt = 1/60`, and on entry to `phase === "pin"` compute the
fewest-tap plan for `fall.target` over `fall.plates.{a,b}`, wait `think` seconds,
then deliver taps every `tapMs`. Read the result off `bout.lastOutcome` when the
phase leaves `pin`. 200–300 falls per cell; `level` pins the stub's ladder rung.

Run with `node --experimental-strip-types` on Node 24.

The window bounds in §3.3 come from sweeping `slapPeriodFor(minTaps, digits,
difficulty)` over its whole input domain — `minTaps` 2..9 (`MIN_TAPS`/`MAX_TAPS`),
`digits` 1..9, `difficulty` 0..1 — and multiplying by `SLAP_COUNT`.

The gauge bot in §3.6 is the same loop with the target hidden from the policy. It
may read `fall.plates.a`, `fall.plates.b`, and
`round(min(1, load/target) * 50) / 50` — and nothing else. `gauge-coarse` learns
each plate's step in gauge units from its first use and then drops the heavy plate
while `gauge + stepB <= 1`. It never forms an integer.

**Verify against `origin/main`, not a local checkout.** The primary checkout when
this was written was 145 commits behind and still contained the §3.7 crash.

---

## 11. Open questions

1. **Does a game-owned pulse belong in a pack at all?** §6.8's entrance themes
   need one and the shared architecture has none. Either the pack owns a clock
   nobody else has, or wrestling gets impacts instead of riffs. Wants ears, not
   argument.
2. **Should the crowd bed survive a doorway?** It is pack-owned in this design,
   so it stops when the pack does. The host-owned ambient bed (stage 3) would fix
   that and is unwritten.
3. **Is the near-fall reward perverse?** The loudest moment in the game follows a
   mistake. The guard is that *advantage* only flips on a clean escape, so the
   best drama and the best position are different prizes. Worth watching a child
   play before trusting it.
4. **Six moves or four?** Reversal and top-rope are the two that could be cut
   without the game feeling thin. They are also the two that carry the
   non-addition mathematics.
5. **What happens to `covers.skills`?** Place-value discs make the mechanic a
   base-ten decomposition, which likely wants `dw.ns.place-value.*` added
   alongside the seven `dw.add.*` rows the board still serves. `covers.skills` is
   the router's only handle on which domains to serve, so this is a live
   starvation risk and not paperwork.
6. **Is 25 taps for 8359 a drum fill or a chore?** §6.3's two-invariant box has
   the fallback (a 5-disc at each power of ten). Decide with thumbs, not
   argument.
7. **`minAge` should be re-judged after the rewrite.** It ships at 6. The
   fleet rule is to judge on motor and attention demand and never on the
   arithmetic — a hold-to-climb input and a six-move vocabulary may move it, and
   the field is fleet-mandatory even though the schema calls it optional.
8. **The pack keeps `items.reveal`.** It is already declared and it stays
   necessary: the reveal in §6.6 completes the sum, and the board's answer must
   come from the host rather than from anything the pack computed.
