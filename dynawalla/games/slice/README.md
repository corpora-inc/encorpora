# THE SPLIT

**A night-market slicer. One verb: cut.**

Fruit Ninja is the most-played touchscreen arcade form in history and it is
absent from the catalogue. This is that form, on the device this ships on, with
the arithmetic welded into the gesture rather than bolted onto it.

```bash
npm install
npm run dev     # http://127.0.0.1:4317 — playable standalone, stub Host included
npm test        # 86 tests
npm run tsc
npm run build:pack # what installs on a tablet: pack.html only, no stub Host
```

---

## The loop

| you cut | it does |
|---|---|
| a **composite** gourd | splits along your blade; **its two factors burst out of the wound** as real objects you can cut again |
| a **prime** gourd | detonates gold. Primes are the payoff, not a trap |
| a **sigil** tablet | the equation on it explodes into four floating candidates |
| a **candidate** | right one → the biggest response in the game. Wrong one → the market's favour, gone |
| a **bomb** | a lamp, and you will feel it |

Three lamps, and **a bomb is the only thing that takes one.** Lose them all and
the market closes; one tap opens it again. Nothing ever completes — the only
direction is up.

**While a sum is up, the market stops.** No gourds, no bombs, no rush, no second
tablet — the whole thing holds its breath for as long as the child needs, and
comes back louder the moment they answer. That is also the stakes model: letting
a sigil expire costs every second of market it was hushing, which is how a
timeout comes to cost *more* than an honest wrong answer without ever costing a
lamp.

## Where the math lives

**Native, twice over**, which is why this design was chosen over the obvious
"slice only the multiples of 7" filter.

1. **The cut gesture *is* the factor tree.** Cut 48 and a 6 and an 8 fly out of
   it. Cut the 8 and you get 2 and 4. The cascade terminates in primes, which
   are the gold payoff, so the reward structure teaches the shape of a number
   without ever asking a question about it. Big-Ω *is* the difficulty knob: a
   144 is a five-cut tree and a 97 is one flick. A child learns to read a
   number's factor-richness at a glance because the score depends on it.
2. **Answering is a slice, not a button.** The tablet carries `7 × 8`; cutting
   it throws the answer and three mal-rule distractors into the air as lanterns.
   The whole game — flow, decision, and the arithmetic — is one gesture from top
   to bottom. There is no mode switch, no modal, no keypad.

A wrong candidate drops **favour** — the global multiplier that applies to every
gourd, every prime and every cascade — straight back to one, so guessing is real.
It does not cost a lamp, and this is deliberate: it used to, while a timeout cost
almost nothing, which made *never answering* the strictly dominant strategy. A
child unsure of the sum was better off looking away. `src/sim/economy.ts` holds
the whole ordering now and `src/test/economy.test.ts` plays bots against it —
reading beats guessing beats refusing, at every difficulty and at every value the
slicing could plausibly be worth.

**Hesitation never costs a lamp, and it is never reported to the ladder.** A
window that closed on an untouched screen is not evidence that a child does not
know the skill; it is evidence they were still working. Punishing a child for
thinking is the failure mode this whole program exists to avoid.

The window itself is `EXPERIENCE_DESIGN.md`'s **p90 for the item's own class**,
monotone non-decreasing in difficulty and clamped by nothing: 6 s for a
single-digit fact, 13 s for two-digit regrouping, 40 s for the
`5,001 − 2,798` class. It was a flat 4.2 s — 3.78 s usable after the read-lock —
against a documented 6 s p50 for the exact skills `pack.json` declares.

## The register

**A night market at the blue hour.** Indigo sky, sodium lanterns on sagging
wires, minarets in silhouette, and fruit that glows from *inside* once it is
cut open — as if the lamp light got in. Not brass, not lapis, no orrery, no
astrolabe. Every gameplay class is told apart by **silhouette and motion first,
colour second**:

* **gourd** — heavy, round, full-gravity arc
* **tablet** — flat, slow, tumbling end over end
* **lantern** — *hovers*; springs to a fixed slot and stays
* **bomb** — small, spiked, iron, live fuse

so it survives colour-blindness by construction rather than by palette luck.

**Numerals are never coloured information.** One weight, one near-white, heavy
geometric sans, pre-rendered with a wide dark keyline and a drop shadow so they
survive on top of a bright flesh colour, on top of the bloom, on top of
anything. Legibility beat ornament every time the two fought — see
"What playing it changed" below, where it fought three times and lost three
times.

## Feel

Nijman's techniques, by name: **trauma shake** (squared), **directional camera
kick**, **punch zoom**, **hitstop**, **slow-motion**, **screen flash**,
**squash-and-stretch** on every spawn, **leave a mark** (persistent juice on the
camera glass), and a **rising pentatonic ladder** on the combo — any two notes
in a minor pentatonic are consonant, so a 30-hit chain climbs without ever
sounding wrong. That ladder is the single most addictive thing in the audio.

Three rules are enforced by tests, not intentions:

* **Hitstop is spent only on success.** A freeze frame is a reward; spending one
  on a wrong answer slows the retry at the exact moment the loop must be
  fastest. Being wrong gets a directional kick instead.
* **Nothing blocks input.** `feel.advance()` returns simulation time on every
  frame that is not an explicit hitstop, and a test hammers it.
* **Escalation cannot see a streak.** `chooseTier` has no streak argument, and a
  test greps every non-test source file for the word.

Plus, for a children's product: **flashes are hard-limited to 3/second and 0.42
alpha**, asserted by a test that requests a full-strength flash on all 120
frames of two seconds and counts what got through. Under
`prefers-reduced-motion` every motion channel collapses to zero and the flash is
replaced by a static border pulse — same information, no luminance change.

## Why 2D

Three.js is the house 3D stack; this is the case the exception was written for.
The game lives or dies on **numeral legibility on fast-moving objects** and on
**real polygon cutting**, and Canvas2D gives both natively — a clipped glyph
means a cut 48 falls apart into two halves of a 48, which is most of why the
cut reads as wet rather than as a despawn.

Bloom without a shader: emissive things are drawn into a **half-resolution
buffer** and composited three times with `lighter` — once sharp and twice after
successive bilinear downsamples, a cheap two-tap Gaussian. Net cost is *lower*
than drawing the particles at full resolution, because a half-res particle is a
quarter of the fill. The bloom is effectively free and the sharp pass is where
the saving comes from.

## Performance

Measured on **Apple M-series Mac, 120Hz display, Chrome**, driven by an
automated player that actually plays (`docs/` has none of this — the harness
lives in the PR description). Frame intervals are recorded in-page for the whole
session, so these are numbers from real play under load, not from an idle
screen.

| run | median | p95 | p99 | frames > 16.7ms |
|---|---|---|---|---|
| ULTRA, 1280×800, 6 min soak | 8.3ms | 9.5 | 10.2 | **18 of 45 676** (0.04%) |
| HIGH, 1280×800 | 8.3ms | 9.1 | 9.3 | 1 of 9 044 |
| LOW, 1280×800 | 8.3ms | 9.1 | 9.3 | 7 of 8 822 |
| LOW, 320×640 @ dpr 3 | 8.3ms | 9.3 | 9.3 | 4 of 5 975 |
| LOW, **4× CPU throttle** | 8.3ms | 9.4 | 17.0 | 155 of 8 045 (1.9%) |
| LOW, **8× CPU throttle** | 8.4ms | 17.4 | 25.5 | 627 of 6 531 (9.6%) |

8.3ms is the 120Hz vsync floor — the game is presentation-bound, not CPU-bound,
at every tier on this machine. The throttled rows are the honest ones: at 4×
(a rough mid-range-tablet proxy) 98% of frames still make the 60fps budget.

**Graceful degradation is demonstrated, not asserted:** ULTRA under a sustained
6× throttle auto-degraded to LOW via `TierGovernor` and kept running.

**JS heap over a six-minute soak: 5–8 MB, flat.** Everything is pooled —
particles are a struct-of-arrays typed-array field with no object literal, no
closure and no `push` anywhere in `update` or `draw`.

**Answer-path latency**: `host.report` fires in the same frame as the cut. The
lowest observed end-to-end (candidate appears → blade lands → report) was
**425ms**, which is the 420ms read-immunity plus a frame — i.e. the mechanism
adds nothing measurable.

## What playing it changed

Every one of these was found by playing, not by reading:

1. **The stroke that opened a tablet also cut the candidates it spawned.** The
   child "answered" in 0ms having read nothing. Fixed with per-body spawn
   immunity (420ms for candidates, 140ms for cascade factors).
2. **Candidates scattered ballistically** and a normal 260px stroke aimed at the
   right answer routinely clipped a neighbour — punishing correct aim. They now
   take fixed, evenly spaced slots and are hoisted into them by a stiff
   critically-damped spring.
3. **A gourd sailing through the lantern row** put two numerals of different
   classes on top of each other. Candidates now draw last, over everything, on
   an opaque backing plate, and the market throttles (never stops) while a
   question is live.
4. **The splat layer saturated.** After sixty seconds of good play the
   accumulated glass washed out the numerals. Per-blob alpha cut by ~65%, fade
   from 14s to 6s, layer alpha 0.85 → 0.5. Ornament ate legibility and lost.
5. **The lamp strands were a wall of blobs** across the top third with a 96px
   glow radius. Two sparse strands, half the radius, 40% less alpha.
6. **At 320px the fourth candidate fell off the screen** and could never be cut.
   The row's radius is now solved from the width budget instead of clamped
   afterwards.
7. **The prime pitch ladder walked past 24kHz** on a long chain and WebAudio
   clamped every partial with a console warning. Capped at three octaves.
8. **The blade ribbon was visibly jagged** at low sample density. Catmull-Rom
   resampling doubles the point density before the ribbon is built.

## The frame this game does not own

The document declares `viewport-fit=cover` and the whole HUD is drawn on the
canvas, where `env(safe-area-inset-*)` cannot be read — so the score was being
painted at `y = 12`, which on a notched phone is not on the screen. The host
compounds it: it floats a 44px exit control in the top-LEFT corner and a 44px
how-to-play control in the top-RIGHT, over the pack rather than reserving a
band, and the score and the three lamps were underneath them.

`src/render/hud.ts` is the one place both facts are known. `hudLayout(w, h,
area)` takes the safe rect as a **required** parameter — a default would compile
at any call site that forgot it and only fail on a device with a notch in
someone's hand — and `resize()` re-derives it from `safeRect(W, H)` every time,
so rotation and Split View are handled rather than being right once at mount.

Nothing reserves a band; reserving 67px costs a twelfth of a 568px phone. The
promise is narrower: **the two 44px corners stay free of anything a child must
read or touch.** That means the score/BEST/multiplier column, the three lamps
and their relight ticks, the live-question banner, and the answer lanterns. The
lanterns get the strictest treatment of the lot, being the one thing here that
is both read *and* touched.

The sky, the ridges, the canopies, the blade ribbon, the splat layer, the
particles and the flying gourds still bleed to every edge. That is what
`viewport-fit=cover` is *for*.

`src/test/layout.test.ts` runs the same two functions the renderer runs, across
five viewports and three real inset profiles, and asserts both promises.

## The contract

`src/contract.ts` is verbatim the shape the runtime will land underneath us and
must not drift. `src/stubHost.ts` is a local, seeded, deterministic Host with
exact integer arithmetic and distractors that are **real mal-rule outputs** —
the neighbouring times-table row, addition with every carry dropped, the
smaller-from-larger subtraction bug, the reversal. Not `answer ± 1` noise: a
wrong slice costs the whole multiplier economy here, so the wrong values have to
be the ones worth learning to reject. A test asserts that >95% of multiplication items carry at
least one true mal-rule.

## Known weaknesses

* The chain window (0.75s) does not decay with heat, so a relentless player can
  hold a chain for minutes and pin the ×8 multiplier. Score inflates; the game
  does not get easier, but the number stops meaning much.
* Two gourds can overlap in flight — there is no body-body collision. Fruit
  Ninja has the same property, but it happens more often on a narrow screen.
* Only four candidate slots are laid out, in one row. A five-option question
  would need a second row and that layout does not exist.
* `dynawalla/games/` is not covered by any `ci.yml` path filter yet, so this
  package's `tsc`/`test` do not run in CI. That belongs in whichever PR lands
  the games-area filter — doing it here would collide with seven sibling
  branches editing the same workflow file.
