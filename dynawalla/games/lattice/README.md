# THE LATTICE

A twin-stick arena strung on a mass-spring grid that tears and re-knits.

Composite **husks** drift on the sheet. A shot cracks one along a factor pair —
72 becomes 8 and 9, the 8 becomes 2 and 4, the 4 becomes 2 and 2 — and **a shot
at a prime is refused**, because a prime does not go. So the field grinds itself
down into primes, and primes are what the ship sweeps. What is swept shows in a
**factor tile bar**: `2·2·3` with a running 12 beside it, changing the instant a
mote is taken.

Hanging in the middle of it is a **resonator** with a problem on its face, and
it opens for exactly one thing.

*After* Geometry Wars: Retro Evolved 2 (2005) — rank 2, S tier, in
`docs/catalog/ARCADE_CANON.md`.

---

## The two layers, and which one is the learning

The canon is explicit about this pack, and it is worth repeating in full:

> Honest caveat: the passive layer is absorption, not reasoning; the
> target-product resonance is where the thinking is and it must ship on.

### The passive layer — absorption

Shooting husks apart and sweeping the primes up. A child sees `2·2·3` become 12
hundreds of times in a sitting, with a sound and a colour attached, and never
answers a question to do it. That is worth having. It is not reasoning: nothing
is chosen, and a child who does it perfectly has not decided anything.

It ships as the *default*. You can fly the arena, shoot everything and sweep,
and the game is a game.

### The target-product resonance — the thinking, and it shipped

The resonator carries a problem the curriculum drew — `47 + 25`. It opens for a
hold whose **primes multiply to the answer**, and nothing else. To open it a
child has to:

1. work out that `47 + 25` is 72;
2. decide *which* primes on the field multiply to 72 — 2·2·2·3·3;
3. crack the husks that are holding those primes, and no others;
4. sweep exactly them, and **nothing else**, because the hold is exact.

Sweeping a stray 5 on the way past is a real cost. It does not scold and it does
not end anything — but the hold now reads 360 and the resonator does not
resonate. The way out is to **tap your own tile bar**, which throws the hold back
onto the field as motes, and start the hold again. Nothing the child worked for
is ever destroyed.

Flying into the resonator asserts `product(hold)`. That value — an exact integer
the child assembled on purpose — is what goes to the host, and the host judges
it. The game never decides whether an answer was right.

**Primeness is a wall.** When the answer is prime, no amount of sweeping smaller
numbers reaches it: the only hold that opens a prime `p` is the single mote `p`,
which has to be found drifting on the field. It is the same property `foundry
street` relies on, and it is asserted exhaustively in `resonance.test.ts`.

---

---

## What the resonator needs from an item to be a game at all

This is the pack's own answer to "it stays way too easy way too long", and it is
not a pacing constant — it is a property of the item:

> **A target the resonator can be itself on is a whole number from 12 to 999
> whose prime factorisation has at least three factors, every one of them a prime
> the game draws as a readable mote — or, one resonator in five, a prime of 13 or
> more, which is the wall.**

Three, not two. At one factor there is nothing to decompose and the game's second
stage does not exist: `2 + 0 = 2` is a resonator with a single mote to find, which
is what ten minutes of the shipped build felt like. At two — `15 → 3·5` — there is
exactly one crack and no choice about which one, so "decide which primes multiply
to it" is a formality. Three is the first count at which the child chooses an
order, a husk comes apart twice, and the tile bar shows a tree instead of a fact.

Readable, because `MOTE_PRIMES` has always said which primes are "small enough to
be drawn as a drifting mote and read at speed" and it stops at 47 — while the old
bar happily asked for `794`, whose factorisation is `2 · 397`. Three-digit answers
are 65% factor trees and only 37% *readable* factor trees, which is the difference
between `600 = 2·2·2·3·5·5` and `804 = 2·2·3·67`.

`game/resonance.ts` holds all of it, and `resonance.test.ts` asserts exhaustively
that nothing the game will ask for needs a mote it will not draw.

### So the game asks for a floor, and then a ceiling

`game/ladder.ts` is the whole of it. The shipped ladder is 66 rungs; generating
items from every one of them puts THE LATTICE's usable band at **rungs 16 to 47**
— below 16 the answers cannot carry a tree, above 47 they are four and five
digits and do not fit on a resonator's face. The game opens at the floor, climbs
three rungs a resonator and falls four on a refusal, and never asks outside the
band.

The floor is the interesting half, and it is the opposite of what `counterweight`
needed. `raiseFloor` is deliberately *not* called: that primitive is for an
achievement (`siege`'s wave counter) and would permanently rewrite a child's
ladder for every other pack because of what this one can draw. The floor is
expressed by simply never asking below it.

A rung is a distribution and not a question, so an arming draws until it finds
something with a tree in it, walking six rungs either side of its position, and
**skips what it discards** — `host.skip` is feature-detected, because an
unanswered question reported as wrong is a MISS on a question nobody was shown.
Ten of the thirty-two rungs in the band produce nothing usable at all, so the
ladder remembers which ones never pay and tries them last: measured against the
shipped curriculum, 2.3 items a resonator instead of 2.6, and the barren rungs
stop costing anything at all.

An arming spends **six** draws and no more, which is not a taste decision: `next`
is synchronous and the refill is not, so a request that moves the ladder flushes
the host's pool down to a reserve of eight and refills asynchronously. An arming
that fired all thirteen offsets in one frame ran the pool dry and started being
handed clones of the last question *with an empty id*, whose answers the host then
drops — a child solving a resonator nothing can be reported against. Six leaves the
reserve intact; the walk is a thing that happens across armings, not inside one.

And the game learns from `question.difficulty` — the rung that *answered* — rather
than the rung it asked for, because the host serves the pooled question closest to
a request and those differ often (104 of 175 draws in one measured session, by as
much as nineteen rungs). Learning from the request would write live rungs off as
barren and snap the position onto content the child never saw.

Measured over ten minutes of perfect play, five seeds, against a host modelling
the shipped difficulty wire:

| | before | after |
|---|---|---|
| draws that named a difficulty | 0 of 270 | 1,650 of 1,650 |
| rung reached (min / median / max) | 0 / 29 / 50 | 16 / 45 / 47 |
| targets with a factor tree | 42% | 82% |
| targets under 12 ("find a 2") | 21% | 0% |
| time with no resonator at all | ~500s of every 600 | 8s in 3,000 |
| first four targets | 5, 7, 10, 16 | 36, 40, 60, 98 |

That "500s of every 600" is the half nobody had reported, because nobody had
reached it: the host's own staircase carried the game *past* rung 47, every draw
failed, and the arena stalled — permanently, because there was no retry, leaving
the previous resonator hanging with its id already spent. A child could fly into
that ring forever and the host would never hear another word.

There is one case where the arena still finds nothing, and it is the first session
of a brand new profile: the host warms its pool at *its* position, which for a new
profile is rung 0, and the first request flushes that down to a reserve of eight
`2 + 0`s. So a stall is now a wait rather than a session — it stocks the field with
husks and motes so the passive layer still works, says so on the HUD, and asks
again 2.5 seconds later, by which time the pool has refilled where it was asked to.

---

## What is reported, and what is the game's own mathematics

Following the `slice` precedent. `covers` is a request rather than an instruction
and `domain` is a cosmetic label, so the host serves whichever rung the game asks
for — and the shipped ladder interleaves `dw.add.*`, `dw.mul.*` and `dw.div.*`,
all three of them active. A sitting crosses column addition, times tables and
exact division, which is where the variety in the stream comes from. So:

* **Reported:** the product the child asserted at the resonator, as a string,
  against the question id the resonator was carrying. Exact, integer, and
  judgeable by the host with no interpretation. Once per question — a refusal
  spends the id, and the resonator then stays as a goal the child can still
  open.
* **Not reported:** everything about the factoring. Cracking 72 into 8 and 9 is
  arithmetic the child performs with a trigger, not a question anybody asked.

`pack.json` declares the seven **active** `dw.add.*` skills, each checked by hand
against `packs/shared/curriculum/src/graph/domains/add.ts`. It does not name the
`dw.mul.*` and `dw.div.*` rows the ladder now also serves inside this game's
band — `covers` is a claim about what the pack was authored against, and widening
it is a curriculum decision rather than a consequence of the ladder having grown.

Distractors are load-bearing rather than decorative. When a resonator is armed,
the field is seeded with the primes of the answer **plus** the extra primes one
of the host's mal-rule answers needs — so a child who dropped a carry can
assemble their own mistake, and the misconception routes back to the host with
no extra wiring.

---

## Controls

Twin-stick, on every input a child might have. Tablet and desktop are equal
targets.

| | Move | Aim / fire | Drop the hold |
|---|---|---|---|
| Touch | left thumb, anywhere on the left half | right thumb | tap the tile bar |
| Keyboard | `WASD` | arrow keys, or `space` to fire straight ahead | `Escape` |
| Mouse | `WASD` | the cursor aims, the button fires | tap the tile bar |

### The ship, and why it was wild on Android specifically

`render/scene.ts` says it plainly: the arena's coordinate space **is** CSS pixel
space, with no camera and no transform. So the world is exactly as big as the
viewport — and every speed in `arena.ts` was an absolute number of CSS pixels a
second, chosen against a tablet. Measured:

| | phone landscape 800×360 | phone portrait 390×740 | tablet 1180×820 |
|---|---|---|---|
| top speed, before | 597px/s = **0.68 diag/s** | 597px/s = **0.71 diag/s** | 597px/s = 0.42 diag/s |
| top speed, after | 263px/s = 0.300 diag/s | 251px/s = 0.300 diag/s | 431px/s = 0.300 diag/s |

The same ship covered **1.72× more of the screen per second on the phone than on
the tablet it was tuned on**, and no single constant can fix that — lowering it makes
the tablet sluggish. The ship's dynamics are now a fraction of the arena's own
diagonal per second, so the felt speed is the same everywhere. Everything else
that is a speed or a length in the arena moved onto the same scale with it.

Two frame-rate defects behind that, both of the class `games/balance` found when
its spring integrator reached −1.2×10²⁰⁴ at 20fps:

| | 144fps | 60fps | 45fps | 30fps | 20fps |
|---|---|---|---|---|---|
| top speed, before | 610px/s | 597px/s | 590px/s | 577px/s | 556px/s |
| coast, before | 143px | 137px | 134px | 128px | 119px |
| shots that hit, before | 80/80 | 80/80 | 80/80 | 80/80 | **71/80** |
| all three, after | identical to six decimal places, and 80/80 at every rate |

A ninth of every shot passed through the husk it was aimed at on a slow Android: a
shot steps 56px in a 50ms frame against a 58px hit window, and the arena was not
substepped. The sheet already was, at 240Hz, for exactly this reason. The arena
now runs one 60Hz world however fast the frame arrives — a slow frame is more
small steps, not one big one — and the 120ms clamp is still there for the frame
that arrives after a backgrounded minute.

Substepping alone was not enough for the *speed*, and it is worth saying why the
first attempt looked like it was. `ceil(dt / 16.67)` lands on a substep of exactly
1/60s at 60, 30 **and** 20fps — the three rates anybody measures — so an iterated
integrator agrees perfectly at all three and is still 2% fast at 45fps and 4% fast
on the 120 and 144Hz panels every current flagship ships with. So the ship is now
*solved* rather than stepped: `v' = k(V − v)` has a closed form, and using it makes
the speed exact at any frame rate and any substep count. The substepping stays,
because it is what stops a shot stepping over a husk.

And two things that are taste rather than defect:

* **The coast.** `620 / 4.2` was a 143px carry after the thumb came off, four and
  a half times the 32px reach the ship sweeps a mote at, so a child could not
  arrive at a mote — only pass over one and come back. The drag is now 7.4 and the
  carry is 34px on a phone and 58px on a tablet.
* **The stick.** `game/steer.ts` puts a tenth of the range under a dead zone —
  a resting thumb's tremor used to be full-authority thrust — and bends the rest
  so the stick reads 4 / 23 / 56 / 100% authority at a quarter, half, three
  quarters and full deflection, against a straight line's 25 / 50 / 75 / 100. That
  is where the slow, accurate part of the stick came from. The direction is never
  touched, only the magnitude.
* **The hull** eases toward the aim over about 55ms instead of snapping to it. The
  *guns* do not: a shooter whose bullets lag its stick lies.

---

## The frame this game does not own

The host paints an exit control in the top-LEFT corner and the shared
how-to-play button in the top-RIGHT, over every pack, and the pack declares
`viewport-fit=cover`, which opts the canvas into the notch and the home
indicator. A canvas cannot read `env()`.

So the world — the sheet, the husks, the motes, the ship, the resonator — still
uses every pixel, and the **chrome** is laid out by `render/hud.ts` inside the
safe rectangle from `packs/shared/game-chrome`, starting below the two 44px
corners. Chrome overlays rather than reserving a band: reserving one costs 67px,
which is 12% of a 568px phone.

How to play comes from the same shared module, so it looks and dismisses the
same way in every game. It is reachable **during** play, because the moment a
child needs the rules is never the title screen — and opening it holds the
world, on the same guards the host's sheet uses.

---

## Reduced motion is a branch, not a switch

Turning the sheet off would delete the only cue that says *where a number came
apart*. So the reduced branch keeps the whole simulation and changes its
character: the springs are stiff, the damping is at critical, the amplitude
ceiling is about a fifth, and there is no screen shake. The sheet dents and
returns in about a quarter of a second with no travelling wave and no ringing. A
strut still tears — it is drawn as a strut that has gone dark rather than as one
that has been flung.

`grid.test.ts` asserts all of it: the reduced branch must **move** (the test
fails if someone "fixes" it by switching the simulation off), must travel less
than half as far, and must turn around at most once, while the full branch rings.

---

## Layout

```
src/
  contract.ts     the Host↔game contract; mount(el, host) → { unmount, pause, resume }
  stubHost.ts     seeded, deterministic, exact-integer, mal-rule distractors
  main.ts         the dev harness entry (npm run dev); P raises a fake host sheet
  pack.ts         the pack entry; subscribes pause/resume, dispose
  mount.ts        canvas, clock, twin-stick input, event wiring
  core/rng.ts     mulberry32
  game/factor.ts     primes, splitting, husking — exact integers only
  game/resonance.ts  the rule the whole learning claim rests on, and what a
                     target has to be for the game to be a game about it
  game/ladder.ts     what the game asks the host for: the band, and the walk
  game/steer.ts      what a thumb means: a dead zone and a response curve
  game/bank.ts       the hold, and the factor tile bar
  game/arena.ts      the rules: husks, motes, the ship, the resonator
  game/best.ts       the longest chain, guarded for a pack frame
  sim/grid.ts     the mass-spring sheet that tears and re-knits
  render/         palette, scene, sparks
  render/hud.ts   where the chrome may be drawn: the safe area, minus two corners
  audio/audio.ts  asset-free Web Audio, C5–C6 pentatonic
  test/           131 tests: rules, pacing, the ship, wiring, and the chrome
```

## Tests

```
npm test        131 tests
npm run tsc     0 errors
npm run build   the library build
npm run build:pack   the pack build → dist-pack/
```

The ones that matter:

* `resonance.test.ts` — a target is cleared **only** by a genuine prime
  factorisation of it (exhaustive over every multiset of small primes to six
  tiles against every target to 200); a prime target cannot be assembled from
  smaller factors (exhaustive); an empty hold asserts nothing; and — exhaustively
  over every target to 999 — nothing the game will ask for needs a mote it will
  not draw.
* `pacing.test.ts` — **the founder's ten minutes, as a measurement.** A bot that
  does the arithmetic perfectly plays the real arena against a host modelling the
  shipped sixty-six-rung wire, and the assertions are about what it was *asked*:
  every draw names a difficulty, the first question of a session already has a
  factor tree in it, nothing under twelve is ever asked for, the stream climbs,
  and the arena is never left without a question. Each case **verified to fail**
  with the request reverted to `next({ domain: "add" })`.
* `ladder.test.ts` — the floor, the ceiling, the climb, the walk, and the memory
  of which rungs never pay.
* `ship.test.ts` — the ship covers the same fraction of the screen on a phone and
  a tablet, behaves identically at 60/30/20fps, can stop inside two sweeps of a
  mote, and hits what it shoots at every frame rate. **Verified to fail** with the
  old constants and with the substepping removed.
* `steer.test.ts` — a resting thumb moves nothing, half the stick is under a third
  of the authority, and the curve never bends the direction.
* `bank.test.ts` — the tile bar is a true factorisation of the value beside it
  after **every** operation on **every** path, over a four-thousand-step seeded
  sitting.
* `factor.test.ts` — splitting conserves the product exactly for every composite
  under 2000; grinding a husk to exhaustion yields exactly its prime
  factorisation.
* `arena.test.ts` — the field can always supply the answer's factorisation; one
  question, one report; a refusal never raises a stopping point; a released mote
  is thrown clear rather than instantly re-swept.
* `pause.test.ts` — **verified to fail with every pause guard removed**, not by
  reading them.
* `loop.test.ts` — a scripted child plays the real arena through the real
  physics and opens resonators. The failure it catches is silent and total: a
  game where nothing throws and nothing can be beaten.
* `grid.test.ts` — no NaN, always returns to rest, always knits back, and the
  reduced-motion branch is a branch.
* `chrome.test.ts` — drives the real `Scene.draw` against a recording context at
  five viewports, with and without a notch, and asserts that every word the
  child reads is inside the safe area and clear of the host's two 44px corners,
  and that the tile bar — which is a touch target, because tapping it drops the
  hold — is reachable. **Verified to fail with the layout reverted**, not by
  reading it.
* `mount.test.ts` — the shell, including the one that got away: flying into the
  resonator asserts the hold. `Arena.enter` was covered exhaustively by the
  rules tests and **never called by the shell**, so the entire reasoning layer
  was unreachable in the shipped game while every test was green. It also
  asserts that reading the manual holds the world and that closing it lets go,
  because a manual that leaves a twin-stick arena running is a manual a child
  cannot afford to open.
