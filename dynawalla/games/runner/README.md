# VOLTA — behind-the-back runner

**The lane you are in when you cross the gate is the answer you gave.**

An endless night run along a black glass causeway suspended over an ocean of
light. Swipe to change lane, jump the gaps, slide under the bars, and thread
between the pylons close enough to graze them. Every few seconds a gate array
spans the track with a number over each lane and exactly one of them is right.
There is no button to press and no menu to open — steering *is* answering.

Run it: `npm install && npm run dev` → <http://127.0.0.1:5187/>

---

## Why the format

The catalogue this pack answers stops at about 1999. A ten-year-old in 2026 does
not play Berzerk; the behind-the-back runner is the most-installed game shape on
earth and the one shape they will already know how to hold. So the goal was not
"a runner with maths bolted on" — it was to build the runner first, well enough
that a child would open it anyway, and then make the maths the steering.

## How the maths rides along

**Native.** The answer is a lane. There is no answer UI, no keypad, no
multiple-choice card. The child reads `7 × 6`, finds `42`, and goes there.

Three lanes means a guesser is right one time in three, so a guess has to be
plainly worse than reading:

| | |
|---|---|
| Correct gate | +8 voltage, +100 × surge, chain toward the next multiplier |
| Wrong gate | **−27 voltage**, surge collapses to ×1, a one-second stumble you cannot steer out of, and the world visibly slows |
| Guessing, on average | about **−15 voltage per gate** — under seven gates from full to dead |
| Reading | strictly positive |

A wrong answer is never a red cross and a lecture. It is a slam, a shockwave,
and the right number left burning in the lane you should have taken, for about a
second, while you keep running.

**Gating, where an F2P game would show an ad.** Run out of voltage and the world
goes into slow motion for a beat, then offers a **recharge**: one question, three
big lane-shaped buttons, a draining ring. Get it and you are back at full
voltage with 2.6 seconds of invulnerability — and your surge reset to
×1, which is the real price. Miss it and the run ends. Recharges are unlimited
and the question gets harder each time; nothing is bought and nothing is scarce.

`difficulty` is a hint to the host, not a demand: it climbs **one step per four
gates read correctly** — never on distance, never on how long you stayed alive —
plus a little for a hot surge, and it **drops hard when a child is actually
struggling** (below 60% over the last handful of gates buys 2.2 levels of
relief). Escalation is on achievement; surviving is not an achievement. See
`src/game/pacing.ts`.

## What makes it readable at 60 units per second

This is the part that took the most work, and it is the bug the previous
catalogue shipped: numerals on fast targets that a child gets half a second to
read.

- The **prompt lives in DOM**, at a fixed spot just above the horizon, at native
  crispness. It never moves and it is never a texture.
- **The three candidates are typeset in screen units, not world units.** This is
  the single most important thing in the game and it took two attempts. The
  camera sits 11.4 units behind a causeway whose lanes are 3.35 apart, so the
  *widest* the lane pitch ever gets on screen is about 12% of the viewport, and
  only in the last third of a second before the gate lands. Numerals placed at
  the lanes therefore ran together — a judge captured `13 | 42 | 36` rendering as
  `134236` — and a fan-out compensation big enough to fix that pushed the third
  value clean off a 390px phone. Perspective is the wrong tool for typesetting
  three values a child has half a second to compare. So `readband.ts` decides an
  explicit pitch, an explicit 30% gutter, an explicit page margin and one shared
  ink height, all in NDC, and `project.ts` converts that layout back into the
  world positions the instanced digit shader wants — so the numerals still fog,
  still bend with the causeway, still belong to the world. They lift above the
  arches, keep left-middle-right order, trail a dotted leader down to their own
  gate, and converge into it as it arrives.
- `readband.test.ts` hammers that layout across nine viewports × three fields of
  view × seven distances × three font widths × four digit counts and asserts the
  two things that actually matter: **adjacent numerals never touch** and
  **nothing leaves the viewport**. The same file covers the two other places ink
  can escape the frame — the winning numeral rushing the camera, and the score
  popups over the outer lanes.
- **Gate numerals are baked with a dark stroke *and* a soft dark shadow**, and
  the red channel separates fill from outline, so the shader can recolour a
  numeral without ever recolouring its own contrast. They stay readable over an
  aurora, over a white-out, over a shockwave.
- Apparent size does not depend on distance, so a numeral is never eleven pixels
  tall at the far end of the reading window and never a wall of ink at the near
  end.
- Numerals **never depth-test**. A roadside monolith eclipsing the one value a
  child needed is not atmosphere, it is a lost run.
- A character the atlas does not know renders as `?`, never as nothing. Silently
  skipping the glyph turns `3/4` into `34`, which is not an unreadable answer —
  it is a different and wrong one.
- The **reading window is the difficulty knob**, not the speed: 5.4s at the start,
  compressing toward a **hard floor of 3.2 seconds** that nothing can push
  through — and the floor is checked against what the *draw distance* can
  actually deliver on the smallest tier at full speed, because a gate cannot
  spawn past the far plane and the clamp used to quietly hand back less than the
  floor promised. Reduced motion adds another half-second. This pack covers
  `subtract-across-zero`, and `docs/EXPERIENCE_DESIGN.md` instruments two-digit
  regrouping at p50 6s; a gate cycle — read it, then run the corridor — is about
  5.3 seconds, which is the number that has to answer to that table.
- **The sum arrives a corridor before the gate does.** The far plane caps the time
  between a gate becoming visible and reaching the answer plane at 3.20s at p50
  however the pacing is tuned, which is half of that 6s. So the next question is
  drawn as soon as the last one resolves and its prompt goes on the HUD three
  tenths of a second later — the crossing keeps that much of the corridor, so a
  new sum is never part of the verdict on the old one. A child then has 4.80s at
  p50 with a question instead of 3.20s. Two things this deliberately is not: it is
  **not** a hazard-free window (pylons live in the corridor, and the window in
  which nothing can hit you is still the gate's own), and it is **not** 6s. The
  last second has to come from the low tier's draw distance or from terminal
  velocity, and both of those are decisions about frame rate and feel rather than
  about reading. `pacing.test.ts` pins the number as a band so neither shrinking
  the pre-read nor quietly reaching the target goes unnoticed.
- **The host's element is the only thing on screen with a size.** The canvas and
  every HUD layer are `position:absolute; inset:0` inside it, so a stage with no
  box is the whole game gone. `pack.html` gives `#app` its box with
  `position: fixed; inset: 0` and nothing else — no width, no height — and VOLTA
  shipped one line that wrote an inline `position: relative` over it. That won the
  cascade, took the insets with it, collapsed the stage to 820x0 and the canvas to
  one CSS pixel tall, and put a child in front of black glass on iOS and Android
  alike. It never showed in `npm run dev`, where `index.html` also gives `#game`
  `width/height: 100%` and a percentage height survives the overwrite. `makeStage`
  branches on the *computed* position now, and `resize()` says so out loud if the
  stage ever measures nothing again.
- **Nothing to dodge ever arrives while a gate is being read.** A hazard spawns
  at the horizon and is airborne for five to seven seconds, so keeping that
  promise means projecting the gate cycle forward to where the hazard will land,
  not comparing its spawn point to a gate's current position — which is what the
  guard used to do, and why roughly two hazards landed in every reading window.
  Everything to dodge lives in the corridor between gates, which is why the
  corridor is nearly two seconds wide.

## Endless

No completion state. Four worlds cycle forever, hue-rotated a little further on
each lap, and a crossing changes the palette, the sky, the ambient debris, the
musical mode and the tempo together over about two seconds:

**AURORA SHELF** (indigo night, curtains, stars) → **SOLAR FLATS** (molten amber,
embers) → **THE ABYSS** (bioluminescent teal and violet) → **THE BLEACH** (the
inversion: bone sky, black obsidian geometry, one hot magenta) → AURORA SHELF II…

The first crossing is deliberately the shortest — about forty-five seconds — so a
child on a five-minute free session *sees* that the world changes. Speed ramps
from 27 to 66 u/s with a 95-second time constant, so terminal velocity lands
inside that session rather than twenty minutes later.

Verified: a 5.5-minute autopilot run covered 14.3 km through nine biomes with no
degradation.

## Feel

Techniques from Nijman's *Art of Screenshake*, applied by name and testable:

`Shake` (trauma-squared, decaying, zero under reduced motion) · `HitStop`
(45ms on a correct gate, 130ms on a wrong one, never a true freeze) · camera kick
and FOV punch on springs · **near-miss graze** — thread a pylon within 2.5 units
and the camera punches harder than it does for a correct answer, because that is
the format's signature feeling · squash and stretch on take-off, landing and
impact · speed streaks · **permanence** (shards from a smashed gate land on the
deck and are still behind you) · chromatic aberration on impact · sound variety.

Input is where a homemade runner usually dies. Swipes fire the instant the finger
crosses the threshold, never on lift; the gesture origin resets after each swipe
so a long drag can chain left-left-up without lifting; intents are **buffered for
145ms** rather than dropped; a tap on either half of the screen is also a lane
change, because small hands should not have to swipe across a 12" tablet. Lane
changes complete in 125ms. Coyote time is 90ms. Measured input-to-action latency
averages **7–9ms**.

## Sound

Entirely synthesised — no files, no licences. Every one-shot is transient, body,
tail, with pitch and filter jittered on each trigger so the two-hundredth spark
does not sound like the first. The reward tone climbs the current biome's scale
with your combo, so the combo is audible; it resets when the combo breaks. There
is a real rhythm section (kick, hats, filtered bass, arpeggio) whose layers
unlock with surge and whose mode and tempo change with the biome. Mutable, and
nothing carries information on its own.

## Accessibility

- `prefers-reduced-motion`, plus an in-game toggle: **no** camera shake, roll, FOV
  punch, chromatic aberration, speed streaks or ghost trail; speed capped at 42
  u/s; extra reading time; the world still moves, because it is a runner.
- Screen flashes are rate-limited below the WCAG general-flash threshold by a
  token bucket that **attenuates rather than drops** — information survives,
  brightness does not. Each flash rises over at least 90ms. Asserted in
  `juice.test.ts`.
- No meaning by colour alone: gates are identical until they resolve and the
  numeral is the only signal; low voltage is a bar, an outline, a heartbeat and a
  banner, not just red.
- Readable at 320px (verified at 320×640 portrait). Full keyboard play.
- No ads, loot boxes, variable-ratio rewards, streak anxiety, scarcity or social
  pressure.

## Performance

Eight draw calls for the entire world, ~6,000 triangles, and no allocation in the
frame loop.

The sky, the light-ocean and the causeway never move — the deck is a static
ribbon whose chevrons scroll procedurally against `uTravel`, so the environment
costs three draws and zero CPU forever. Everything else is two instanced fields
(solids with barycentric neon edges; additive glows) plus one instanced digit
atlas. Particles are struct-of-arrays with a free list.

The causeway's snake and roll is a **quadratic world bend in the vertex shader**
(`voltaBend`). Gameplay stays on a straight 1D track — lane is an integer,
distance is a float — so collision and scheduling stay debuggable, while
geometry enters from behind the curve instead of fading up out of fog.

Four tiers (`low`/`mid`/`high`/`ultra`) plus a `TierController` that demotes on a
sustained stall — render scale first, then tier — and promotes back at most once.

## Verifying it

```
npm run tsc && npm test              # 57 assertions, no DOM and no GPU required
npm run build                        # production bundle
npm run dev                          # play it
```

The suites are deliberately about rules rather than rendering: the read band and
the payoff sizing (`readband.test.ts`), the atlas and its fallbacks
(`glyphs.test.ts`), the three-lane option builder (`options.test.ts`), the
escalation curves and their floors (`pacing.test.ts`), the flash rate limit and
reduced-motion guarantees (`juice.test.ts`), and the question stream itself
(`stubHost.test.ts`).

Query parameters, for verification rather than for players:

| | |
|---|---|
| `?tier=low\|mid\|high\|ultra` | pin the quality tier |
| `?stats=1` | fps, worst frame, input latency, draw calls, triangles, seed |
| `?seed=12345` | replay an exact run — gates, hazards and spark rows all |
| `?log=1` | print every `host.report()` |

`?stats=1` also publishes `window.__volta.state()`, a read-only snapshot (phase,
travel, speed, voltage, the active gate's correct lane, nearby hazards). It
exists because "does a five-minute run hold 60fps" and "is the reading window
still fair at 3 km" are questions that need a machine that can play. A harness
steers with real `KeyboardEvent`s, so it exercises the same path a child does.

## Installing it

VOLTA is a real pack, not just a directory in the repo: `pack.json` is what
`packs/build.mjs` globs for, and without it the game would be in the tree and
invisible to the pack build, the catalogue and the app's game browser.

```
npm run build:pack                   # this pack alone, into dist-pack/
cd ../../packs && node build.mjs runner   # build + `dw-pack check` + stage
```

`src/pack.ts` is the whole seam — it swaps the stub host for the real one and
hands the same synchronous `Host` surface to the same `mount()`. Nothing about
the causeway, the read band or the recharge gate knows which host it has.

Declared capabilities are `items`, `items.reveal` and `haptics`, and no more.
**`items.reveal` is load-bearing**: without it the adapter has no canonical
answer to place, so there is no right lane to steer into and the question pool
never fills. `audio` and `storage` are deliberately *not* declared — the sound
is synthesised inside the pack rather than asked of the host, and the personal
best is the frame's own `localStorage`, which is why it is wrapped in a
`try`/`catch` and simply does not persist on an opaque origin.

`covers.skills` lists the seven `dw.add.*` skills that are `status: "active"` in
`packs/shared/curriculum` today — column addition and subtraction with and
without regrouping, which is exactly the short-answer shape the read band is
built for. Everything else in the graph is still `draft`, so claiming it would
be claiming coverage no host can serve. Note that `dw-pack check` does **not**
validate skill ids: a fictional one passes silently, so this list was checked by
hand against the graph.

## Contract

`src/contract.ts` is the agreed shape, unchanged. `src/stubHost.ts` is a local
stub so the game is fully playable standalone: exact integer arithmetic, seeded
and deterministic, and **distractors that are real mal-rule outputs** — `7 × 6 →
13` is a child who added, `52 − 27 → 35` is smaller-from-larger, `3 + 4 × 5 → 35`
is left-to-right. A distractor that is merely "answer + 1" is a coin flip dressed
as a question, and `stubHost.test.ts` asserts the real ones are on offer.

The contract does not promise integers, though, so `options.ts` — the one place
a question becomes three lanes, shared by the gates on the causeway and by the
recharge gate — treats the answer as a string. When a host offers fewer than two
usable distractors it nudges the answer's own trailing number with exact decimal
arithmetic: `42` gives `43` and `41`, `3/4` gives `3/5` and `3/3`. Never a float,
never a `NaN`, never the same value in two lanes.

The only thing imported from `dynawalla/packs/shared` is `game-chrome`, and the
reason is in `src/game/chrome.ts`. `pack.html` declares `viewport-fit=cover`,
which opts the document *into* the display cutout and the home indicator; a DOM
rule can claw that back with `env(safe-area-inset-*)`, but the candidates are
drawn by a shader in NDC and a shader has never heard of `env()`. Held sideways
a phone's cutout is about 47 CSS pixels of an 844-wide viewport — five and a
half per cent — against a page margin of three, so the outer candidate reached
underneath it, and in this game the outer candidate is an answer. The host also
paints an exit control in the top-left 44px corner and a how-to-play control in
the top-right one, over the pack: the score used to sit under the first and the
surge meter under the second.

So `ndcFrame(w, h, insets)` builds the read band's frame from the measured safe
area — a *required* argument to `readBand`, because a default is a game that
forgets the insets, compiles clean, and is found out on a device — and the two
corner readouts drop clear of the controls. Nothing else moves: the causeway,
the sky and the ocean still bleed to all four edges, which is the entire point
of `cover`. `chrome.test.ts` asserts both at five viewports in both rotations,
and how to remove each fix and watch it fail is written at the top of that file.
