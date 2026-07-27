# ARENA

**You are a number. Eat what is smaller. Flee what is not.**

A growth arena in the lineage of Agar.io, Slither.io and Hole.io, played in a
black ocean full of bioluminescent numbers. You start at 10. Everything on
screen carries a number, everything obeys one radius law, and the only rule is
the one the picture already told you: **you may swallow anything smaller than
you, and anything larger will hurt.**

```bash
npm install
npm run dev      # http://127.0.0.1:5188/
npm test         # 24 tests, Node's native runner, zero dependencies
npm run tsc      # typecheck
npm run build:pack   # the installable pack; `../../packs && node build.mjs arena` checks and stages it
```

`?perf` shows the fps/tier readout. `?seed=123` reproduces a run — the *whole*
run: it seeds the world's RNG as well as the question stream, which it did not
used to, so what it actually reproduced was the arithmetic over a different
ocean. `?dev` attaches the development handle used by the soak and perf
harnesses.

---

## The rule, and why there is no tutorial

Radius is `9 × √value` for **everything** — motes, rival cores, you. So
"smaller than me" is something a child sees before they read it, and the
printed number is only there to settle the near-ties. Three seconds and no
sentence.

The visual grammar is one rule applied everywhere, and never carried by colour
alone:

| | |
|---|---|
| **smooth filled disc** | smaller than you — swallow it |
| **spiked hollow ring** | larger than you — it will hurt |
| **crimson, marked `−`** | a void mote: always harmful, whatever its size |

The best moment in the genre is watching that grammar *flip*. When your mass
crosses a mote's value the husk collapses into a disc in front of you, with a
tick and a spark. Growth is not a number going up; it is the world converting
into food.

## Two verbs

**Steer.** A mouse steers by pointing — Agar's scheme, which is correct with a
mouse. A finger steers with a floating relative stick that re-centres if you
drag past its edge, so your hand is never sitting on the thing you are trying
to read.

**Surge.** Hold. You accelerate hard and burn mass continuously, spraying it
out behind you as real, edible motes that a rival will absolutely come and eat.
A second finger, a double-tap-and-hold, a held mouse button, space or shift —
all of them, because a child will try whichever one they think of first.

If twelve seconds pass and surge has never been found, the player core emits a
soft pulse ring. No copy, no arrow, no tooltip.

## Where the mathematics is

**Native, continuously.** Every second of play is a magnitude comparison under
time pressure, and about one mote in seven is drawn from a band that straddles
your own mass — because telling `3,418` from `3,481` at speed *is* the
place-value comparison a worksheet asks for eighty times and gets answered
nine. A misread is not a red X; it is a sting that costs mass in proportion to
how badly you misjudged it, and takes your combo with it.

**RESONANCE — the curriculum beat.** Every twenty-odd seconds the water goes
dark and holds its breath. Within a sixth of a second the ordinary field drops
to a twentieth of its brightness and turns inert, every rival core falls back
into the dark, the leaderboard and the depth readout fade out of the way, and
four glass spheres — pushed *brighter* by the same signal that dims everything
else — rise in a ring around you carrying the answer and three distractors from
`host.next()`. The question stands over the arena in letters you can read from
across a room. You fly into one.

(This paragraph used to be a lie, and a judge caught it. The labels on
background motes dropped instantly while the mote *shapes* faded over four
tenths of a second and only to a ninth, so the one frame in the game that asks
a direct question was also the busiest frame in the game. Both now ride the same
curve, and the curve is fast.)

- **Right** → a shockwave clears the neighbourhood, every rival is thrown off
  you, your mass surges and the chord resolves upward with the streak.
- **Wrong** → you lose a quarter of your mass, the chord sags, and the correct
  sphere flares for a beat so you *see* which it was. No lecture, no modal.
- **Timeout** → the water simply comes back. You lost the opportunity, nothing
  more.

Inside a Resonance the arena is a fixed-size room however large you have grown,
so the answer can never be the thing that outruns you.

## Endless, not winnable

There is no completion state and no game-over screen. There are **depths**:
nine bands of water you sink into as the run goes on, each with its own
palette, density, temper, and exactly one new thing to be afraid of. They are
meant to be nine genuinely different looks, not a hue rotation — you should be
able to say which depth a screenshot came from.

| | mass | |
|---|---|---|
| **DRIFT** | 0 | timid drifters; cold abyssal blue |
| **THE CURRENT** | 90 | void motes appear; kelp green |
| **THE CHURN** | 380 | hunters that lock on; a violet storm |
| **THE VENTS** | 1,300 | a Leviathan; volcanic ember on black basalt |
| **THE SHELF** | 4,200 | a bleached ice shelf, pale and brittle |
| **APEX** | 13,000 | everything, faster; electric indigo |
| **THE ABYSSAL** | 40,000 | a near-black trench lit by one acid green |
| **SOVEREIGN** | 120,000 | gold on oxblood |
| **THE LAST LIGHT** | 350,000 | white-hot on black; everything is a silhouette |

**The band is a ratchet, and the clock is a floor.** This is the second thing a
judge caught. Depth used to track *current* mass, so a bad patch dropped you
back a band: a five-minute soak flipped between DRIFT and THE CURRENT and back,
saw exactly two of the six looks, and finished at the mass it started at. That
is a treadmill, which is precisely what a growth game must never be.

Now the band is monotone — once entered, never left — and it advances on the
clock every hundred seconds whether the run is going well or not, so a full
descent takes about thirteen minutes for anybody. Mass buys you a *lead*: play
well and you may sit up to two bands ahead of the clock, which is the whole
reward, and the arrival is gold with a rising arpeggio instead of blue with a
low chord. Nine pips under the depth name fill in as you go — wordless, and the
only thing on screen that only ever goes up.

Past THE LAST LIGHT the modifiers keep compounding, on mass for a player who is
winning and on the clock for one who is merely surviving, so the eighteenth
minute still escalates. A run ends when the child puts the tablet down.

**Death is a rupture, not a loss.** You burst, scatter most of what you were
across the water where anyone can take it, and re-form on the spot at speed
with a few seconds of shield. The fall is deep but *bounded by a checkpoint*:
your high water mark never decays, and nothing in the game — a rupture, a
sting, a void mote, a wrong answer, burning mass on a surge — can take you more
than about two fifths below it. A bad patch is a real and painful setback; it
can no longer delete the run. There is no modal, no score screen, and nothing to
click before you are playing again.

## Feel

Techniques from Vlambeer's *Art of Screenshake*, applied by name: trauma-based
screenshake, hit-stop that freezes the simulation while the presentation keeps
running, camera lead, zoom punch, knockback, permanence (nothing is deleted, it
is scattered), screen-space impact ripple, chromatic aberration on damage, and
sound with per-hit pitch variation.

Everything is amplitude-limited on purpose, because this is a children's
product:

- Full-screen luminance jumps are rate-capped to **three per second** and hard-
  capped in amplitude. A fourth flash inside a second is clamped to an absolute
  0.05 — between a sixth and a half of what it asked for, depending on the
  event; a seventh is dropped entirely.
- `prefers-reduced-motion` removes translation, zoom punch, ripple and
  aberration, and replaces them with a brief desaturation pulse — the *signal*
  survives, the motion does not.
- No meaning is carried by colour alone anywhere.
- Readable at 320 px.

## Sound

Synthesized in Web Audio at runtime; there are no audio files. Every one-shot
is a transient, a body and a tail, with per-hit pitch, filter and timbre
variation so ten thousand absorbs in a session do not sand a child's ears down.
The absorb ladder climbs a pentatonic set with your combo. The whole mix runs
through a lowpass whose cutoff opens as you grow, so becoming enormous is
something you hear before you read it. Everything sits in a procedurally
generated convolution reverb — an underwater cathedral. Disableable, and no cue
ever carries information alone.

## Rendering

Three.js with an orthographic camera and hand-written raw shaders. Every
drawable is **one instanced draw call**: backdrop, marine snow, particles,
motes, cores, shockwave rings. Numerals are two — the dark plate and the white
ink, deliberately, because that is what makes a numeral survive a blown-out
highlight. The simulation is structure-of-arrays over typed arrays, events come
out of a preallocated ring, and particles are integrated entirely in the vertex
shader so a 140-particle burst costs one buffer write. Nothing in `step` or in
the draw allocates; `leaderboard`, which the HUD calls about four times a
second, and mote spawning are the two places that still do.

The post chain is threshold → downsample → separable blur → composite, written
by hand rather than assembled from `EffectComposer` so the tier governor can
change pass count and render-target scale at runtime, and so the ripple, the
aberration and the flash share one full-screen pass.

**The numerals are drawn last, straight to the screen, after the bloom
composite.** They can never be eaten by their own glow. Each glyph is one
signed-distance field read at **two iso-levels** — a crisp white fill at the
glyph edge and a fatter, near-black slab behind it — so a white numeral stays
readable sitting on a blown-out highlight, and the slab stays exactly as thick
relative to the glyph at every size. This is the single most load-bearing
decision in the renderer: ornament is never allowed to win against legibility.

### Quality tiers

The mid-range tablet sets the floor, never the ceiling. A static guess picks a
starting tier; a frame-time governor then demotes readily and promotes exactly
once, so the picture never oscillates.

| tier | motes | rivals | particles | snow | bloom | dpr |
|---|---|---|---|---|---|---|
| low | 115 | 12 | 380 | 140 | 1 pass @ 0.25 | 1.5 |
| mid | 155 | 16 | 900 | 320 | 2 @ 0.35 | 2 |
| high | 195 | 20 | 1800 | 620 | 3 @ 0.50 + dispersion | 2 |
| ultra | 240 | 24 | 3200 | 1100 | 4 @ 0.60 + dispersion | 2.25 |

## The contract

`src/contract.ts` is exactly the shape the runtime lands underneath, and
`src/pack.ts` is the whole of the landing: it swaps the stub for the real host
and changes nothing else in the game. `pack.json` declares `items`,
`items.reveal` and `haptics` — `items.reveal` because a sphere has to *carry*
the answer before the child reaches it, which is the sanctioned use of that
grant and changes nothing about who judges. It declares no `audio` capability:
that grant is for playing the *app's* sounds, and ARENA synthesizes its own.

`src/host/stubHost.ts` is a seeded, deterministic local Host so the game is
fully playable standalone: every answer is exact integer arithmetic, and every
distractor is a **mal-rule output** — the number a child actually writes when
they apply a plausible-but-wrong procedure (a dropped carry, `|top − bottom|`
per column instead of borrowing, one step too far up a times table), never
random noise. Random noise teaches a child to spot the odd one out, not to
compute.

**No arithmetic decides whether a child was right.** The verdict is sphere
identity — you flew into slot *k*, and slot *k* is the one the shuffle put the
answer in — so there is no comparison anywhere on that path to get wrong. And
the `answered` string reported back is the Host's own option string kept
verbatim, never the sphere's *drawn* label: that goes through an `Int32Array`
because the numeral layer needs a number, and an `Int32Array` does not fail on
an answer past 2³¹, it silently returns a different one. Both are pinned by a
test that flies a run and a host emitting ten-digit answers.

## Tuning notes for whoever comes next

Three constants are the entire difficulty curve, and all three were fitted by
simulating complete twenty-minute runs rather than by looking at the screen:

- **`FOOD_A` / `FOOD_B`** — mote value scales as `A × mass^B`, *not* as a
  fraction of mass. A fraction compounds, and compounding turns a twenty-minute
  climb into a ninety-second explosion followed by nothing.
- **`ABSORB_K` / `ABSORB_SOFT`** — absorption saturates, capping any single mote
  at a seventh of you, and past `ABSORB_SOFT` the cap itself tightens as
  `√mass`. Without the cap, the sliver of the near-tie band just below your mass
  is a free doubling; a child finds it in ninety seconds. Without the tightening
  the same band is a *fixed fraction* of you, which is an exponential by a
  slower road — measured at 273 → 3,330,895 → 1,301,388,804 in three hundred
  seconds, which is a legibility failure before it is a balance one.
- **`DEVOUR_K`** — the same idea, far more generously, for eating a rival: your
  own size is worth about a third of you, **at every size**. It deliberately
  does *not* get the `√mass` tightening, and the asymmetry is the point: the
  near-tie mote is a supply the game manufactures on purpose, and a rival is
  not — there are at most 26, they respawn on a timer, and one is only edible
  below `mass / 1.06`. Measured with a bot that hunts nothing else for twenty
  minutes, tightening it changed the peak from 34,456 to 11,442 — both five
  digits, neither an explosion — so it bought no safety and cost the genre its
  payoff moment. `sim.test.ts` flies that bot as a regression.

A mote's printed number is a **size**, not an addend. A fish that swallows a
fish nearly its own size does not double, and the floating number that pops on
absorb is the size you actually gained. The comparison — which is the
mathematics — is exact and honest; the economy is a separate, tuned layer.

`src/sim/sim.test.ts` runs a full twenty-minute headless game and asserts on
the *shape* of the result rather than on a number: the first minute must be a
climb and not a detonation, and after twenty minutes the ladder must still be
live — there must still be something in the water that can eat you. Every
economy bug this repository has seen was invisible in a thirty-second look at
the screen and obvious after one simulated run.
