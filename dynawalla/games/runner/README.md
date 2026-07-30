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
- **The three candidates are typeset in screen units, and placed from the gate.**
  This is the single most important thing in the game and it took three attempts.
  The camera sits 11.4 units behind a causeway whose lanes are 3.35 apart, so the
  *widest* the lane pitch ever gets on screen is about 12% of the viewport, and
  only in the last third of a second before the gate lands. Numerals placed at
  the lanes therefore ran together — a judge captured `13 | 42 | 36` rendering as
  `134236` — and a fan-out compensation big enough to fix that pushed the third
  value clean off a 390px phone. So `readband.ts` decides an explicit pitch, an
  explicit 30% gutter, an explicit page margin and one shared ink height, all in
  NDC, and `project.ts` converts that layout back into the world positions the
  instanced digit shader wants — the numerals still fog, still bend with the
  causeway, still belong to the world.
- **The row belongs to its gate, and the second attempt did not.** Measured on a
  360x780 phone at 78°, against the version the founder played: the outer
  candidate was drawn at x = 305px for the *entire* approach while the arch it
  names travelled from 198px to 286px; it was 98px tall from the moment it
  appeared to the moment it was crossed, while the arch grew from 27px to 158px;
  and it floated a flat 27px above the lintel throughout. Steering made it worse —
  the chase camera follows the player at 0.6x, so with the child in the left lane
  the outer answer ended up 44px on the *wrong side* of its own arch. Three
  numbers, none of them a function of the gate: that is a HUD element drawn in the
  world, and "the answers would be better if they sat with the windows" was the
  right note. The row is now derived from the gate's own projected geometry — its
  centre, its lane pitch, the height of its arch — and falls back on the
  legibility floors only where the geometry cannot honour them. Same measurement
  after: 52px at a hundred units, 28px at thirty, 3px at ten, 0px at six, with the
  numeral growing 46px → 80px and sitting *inside* the window from about forty
  units in. Where the answer is too wide for the window — three readable
  three-digit numerals need 315 of a phone's 360 pixels — the row converges as far
  as legibility allows and no further, and that limit is written down in
  `gatelayout.test.ts` with the numbers rather than smoothed over.
- Two test files, deliberately split. `readband.test.ts` is pure arithmetic and
  hammers the layout across nine viewports × three fields of view × seven
  distances × three font widths × four digit counts × four gate positions,
  asserting the two things that always matter — **adjacent numerals never touch**
  and **nothing leaves the viewport** — plus the two other places ink can escape
  the frame, the winning numeral rushing the camera and the score popups over the
  outer lanes. `gatelayout.test.ts` builds the *real* `THREE.PerspectiveCamera`,
  poses it exactly as `render()` does, runs the real `Projector` and measures in
  CSS pixels, because "do the answers sit with the windows" is a question about a
  pitched, lane-following camera and a hand-rolled pinhole model would answer it
  about a camera the game does not have.
- **Gate numerals are baked with a dark stroke *and* a soft dark shadow**, and
  the red channel separates fill from outline, so the shader can recolour a
  numeral without ever recolouring its own contrast. They stay readable over an
  aurora, over a white-out, over a shockwave.
- Apparent size **tracks the gate**, floored at a 46px cap height. It used to be
  flat — identical at 240 units and at 4 — which is precisely what made the row
  read as chrome rather than as something on the causeway. A numeral is still
  never eleven pixels tall at the far end of the reading window, because the floor
  is in pixels and not in NDC: 0.1 NDC is 39px on a 780-tall phone and 108px on a
  desktop.
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
- **A harder question gets more time, not less — and it gets it as road.** VOLTA
  had the fleet's root pacing defect: the comprehension window was derived from a
  motion constant, and the motion constant was also the escalation knob, so every
  step that made the run more exciting took thinking time away. Measured through
  the real scheduler: 8.00s with the question on the opening gate, where the
  content is `5 − 2`, falling to 4.78s at terminal velocity on the smallest
  quality tier, where it is four- and five-digit column arithmetic. The founder,
  exactly: *"you have 5 seconds to do 2x1 and then 2 seconds to do 84302+4186."*
  `docs/PACING_AUDIT_2026-07.md` names it across seventeen games and sets the
  invariant — **`window(d)` must be monotone non-decreasing in item difficulty.**

  The obvious fix is to slow down as the arithmetic hardens. The founder offered
  that and then offered the better one: *"the vehicle could still be racing but ...
  we maybe need some miles to figure out the answer."* So nothing about the speed
  changes. `comprehension.ts` reads the *item* — operand width, whether a column
  carries or borrows, which operation — and returns the seconds
  `docs/EXPERIENCE_DESIGN.md` instruments for that shape: 2.8s for a single-digit
  fact, 6s for a two-digit regroup, 16s for the `5,001 − 2,798` class. It imports
  nothing at all, so there is no speed, no travel, no draw distance and no tier in
  scope for it to be derived from, and `comprehension.test.ts` asserts that by
  reading the module's own source. `pacing.ts` then buys those seconds as
  **runway**: the dodge corridor in front of a hard gate gets longer, the prompt
  sits on the HUD across the whole of it, and hazards and sparks keep arriving
  through it at their own cadence. At terminal velocity a 16s question is about
  900 units of road. After: 8.00s, 6.91s, 10.10s, 16.08s across that same ladder,
  and every rung is asserted through the scheduler, not from the formula.

  Two honest edges. The floor is generous, so an easy question early in a run still
  gets 8.00s — more than its 2.8s target, and more than a two-digit regroup gets
  mid-run; the invariant is an ordering at a given state of the world, and nothing
  ever gets *less* than its own target. And the hazard guard's projection knows the
  live corridor exactly but cannot know how hard the *next* item will be, so it
  models later cycles at the shortest corridor a run can have — wrong in the safe
  direction, and written down where it happens.
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
- **The HUD is laid out from the insets the host measured, never from `env()`.**
  `env(safe-area-inset-*)` belongs to the top-level browsing context, and a pack
  frame is sandboxed `allow-scripts` with no `allow-same-origin` — so all four
  resolve to **zero** inside it, on every device, for ever. `hud.ts` read them
  directly, so on the founder's phone the score painted at y = 63 instead of y = 87
  and sat eighteen pixels under the host's exit chevron, the surge meter did the
  same under the how-to-play control, and the tests passed because they handed the
  arithmetic a 24px inset the stylesheet never saw. The fix is not a better test:
  the stylesheet no longer computes any position at all. Every in-run HUD box comes
  from `hudBoxes` in `chrome.ts` and is written on as a custom property, and
  `chrome.test.ts` fails the build if `env(safe-area-inset` appears in the sheet or
  if any positional declaration on those five selectors is not a `var()`.
- **Android's gesture strip is not the reported bottom inset.** The value the
  WebView reports describes the display *cutout*; the thing that eats the pixels
  and the tap is the gesture-navigation handle, and plenty of devices report a
  bottom inset of zero while it is there. The voltage bar sat 12px off the bottom
  edge, so all 13px of it were inside the strip — which is what the founder's
  screenshot shows. `GESTURE_STRIP` is 24 CSS px, taken off the raw bottom edge as
  well as the reported inset, whichever binds harder; `games/pulse` met this first
  and this is its constant. Every readable and tappable box is asserted clear of it
  at seven viewports including **a zero bottom inset**, which is the case that
  broke.
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

## Motion control, and why it is not here

It was asked for — *"Volta could ask for motion control on a mobile device .. or
the user could toggle it optionally"* — and the toggle is deliberately absent,
because an opt-in that silently does nothing is worse than not offering one.

`DeviceOrientationEvent` and `DeviceMotionEvent` are gated by the
Permissions-Policy features `gyroscope`, `accelerometer` and `magnetometer`, whose
default allowlist is `self`. A pack is mounted by `dynawalla-app`'s
`packs/frame.ts` with `sandbox="allow-scripts"` — no `allow-same-origin`, so the
pack's origin is *opaque* — and with `allow=""`, which disables every
policy-controlled feature explicitly. So the events cannot reach a pack twice
over: the default allowlist already excludes a cross-origin child, and the empty
container policy would exclude it anyway. On iOS there is a third barrier:
`DeviceOrientationEvent.requestPermission()` grants **per origin**, and an opaque
origin is not an origin a grant can be remembered against.

Nothing in the fleet uses either API — the grep across all 27 games, the shared
modules and the app is empty — so there is no precedent to copy and no evidence
this works anywhere in the product today.

**What a host change would have to be.** Not `allow="gyroscope; accelerometer"`
on the pack frame: that hands motion sensors to all 27 packs at once to serve one
of them, and `frame.ts` says out loud what it is protecting — *"Nothing in the
permissions policy: no camera, no microphone, no geolocation, no autoplay grant. A
pack asks the host for feedback, it does not take it."* The shape that fits the
boundary already exists in this repository: the **host** reads the orientation and
posts it, exactly as it already measures the safe-area insets a pack cannot see
and sends them over the `settings` channel. One number crossing a message port,
one permission prompt owned by the app, one place to turn it off. That is a host
decision and a host PR, and it is the founder's to make.

None of the above has been checked on a device by this change. It is read off the
Permissions Policy and DeviceOrientation Event specifications and off the host's
own source; what would settle it is a build with the grant added, on hardware.

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
