# SIEGE

**A river of lava runs through your forge. Things are walking up it. You buy the guns with
arithmetic.**

Tower defence, in the Kingdom Rush / Bloons line. Twenty machined sockets flank a molten
channel; obsidian shards, armoured brutes, splitters, warded wraiths and bosses walk it toward
the forge core. You place BOLT, MORTAR and CHAIN, you upgrade them five levels deep, and when
the wave is about to break through you slam the overcharge.

Embers are the only currency, and the only real source of embers is **the anvil**: a live
arithmetic problem sitting under the board with four molten answer slugs. Strike it and embers
arc up to the counter. Miss and the anvil goes cold for 1.15 seconds — which, mid-wave, is the
difference between a tower and no tower.

```
npm install
npm run dev        # http://localhost:4187
npm test           # 19 tests, node's native runner, no dependencies
node qa/playtest.mjs   # plays itself, screenshots, measures frames (needs playwright)
```

## Where the maths lives

Four touchpoints, running from "the maths *is* the economy" to "the maths is the panic button".

| | Beat | Tier |
|---|---|---|
| **The anvil** | A problem is always live. Correct → `6 + round(16 × difficulty)` embers fly to the counter, +9% overcharge. Wrong → the anvil quenches for 1.15 s: no lecture, no red ✗, just cold iron and lost income. | gating |
| **Upgrades** | Tap a tower → the world drops to 0.42× speed and one harder problem fills the screen. Solve it and the machine blooms a level. Twenty pads × four levels = **eighty problems the player wants to solve.** | empowering |
| **Overcharge** | The meter fills from correct answers. At 100% the lever goes hot. Slam it: time drops to 0.16×, one big problem, and the right answer is a shockwave that damages, stuns and throws the entire wave 150 units back down the channel. | empowering / emergency |
| **The readout** | `HP IN 4173` sits beside `DPS 931`, and the palette prints cost against damage-per-second. Deciding between three BOLTs and one CHAIN *is* a rate comparison, out loud, in the HUD. | native |

Thinking beats guessing because a wrong answer costs about one and a half problems' worth of
income, and during a wave income is survival. No health is lost, no streak is broken, nothing is
taken away — the wave just gets closer.

## The look

Hot forge on cold stone. Columnar basalt baked once into an offscreen canvas, a dark trench with
a narrow molten bed and flow striations, machined chamfered sockets bolted into the rock. Your
machines are white-hot iron that visibly cool between shots — **fire rate is legible as
brightness, with no number attached**. The enemies are the only cold thing on the board:
blue-black obsidian with rime edges, so you never mistake theirs for yours. Distinguished by
silhouette first (diamond, chevron, plated hexagon, seamed sphere, warded ring, twelve-pointed
boss) and colour second.

## Juice, with the numbers

Screen shake is a trauma model (`shake ∝ trauma²`, decay 1.75/s) with rotation, driven by wall
time so a freeze never freezes the shake.

| Event | Hitstop | Trauma | Other |
|---|---|---|---|
| mortar impact | 38 ms | 0.15 | 26 sparks, two shock rings |
| heavy kill | 70 ms | 0.24 | 16 shards + smoke, 1.8% zoom punch |
| boss down | 95 ms | 0.62 | 6% punch over 420 ms, 34 shards, 40 sparks, rate-limited flash |
| core breach | 60 ms | 0.40 | `failure` haptic, 150-unit ring |
| **overcharge** | 150 ms | 1.00 | `timeScale → 0.16` ramping back over ~1 s, 9% punch, five expanding rings, 120 sparks |

Plus: tower recoil (scale +19% over 120 ms, kicked 7 units back along the shot vector),
enemy spawn squash `easeOutBack` from (0.42, 1.6), a walking squash at 7.5 Hz, six-sample
tapered projectile ribbons, homing bolts, mortars that lead their target, damage numbers on an
arc, and embers that arc from the tapped slug to the counter on `cubic-bezier(0.5,-0.3,0.4,1)`
with a rising tick per arrival.

**Photosensitivity is a hard limit**: full-screen flashes are capped at 30% alpha and rate
limited to one per 340 ms in `Camera.flash`, which silently refuses anything faster.

`prefers-reduced-motion` is a branch, not a downgrade: shake, punch, slow-motion, hitstop, the
lava flow animation and every DOM animation collapse, while damage numbers, health bars, the
overcharge overlay and every piece of information survive untouched.

## Audio

Asset-free Web Audio, transient + body + tail on every voice, pitch jittered ±8–17% so a hundred
bolt shots never fatigue. A brown-noise lava bed rides wave intensity. The correct-answer chime
picks its pitch from a two-octave C pentatonic **by the difficulty of the problem, never by a
streak**. Voices are capped at 26 and every sound has a minimum re-trigger gap. Muting loses
nothing: every cue has a visual twin.

## Performance

Measured with `qa/playtest.mjs` on a fully built board (20 towers, level 3) at wave 20, with
Chrome DevTools CPU throttling standing in for a cheaper device.

| | median frame | p95 | at peak |
|---|---|---|---|
| 1× | 8.3 ms (120 fps) | 9.8 ms | 34 enemies, 483 particles |
| **4× throttle** | **8.4 ms (119 fps)** | **16.4 ms (61 fps)** | 34 enemies, 448 particles |
| 6× throttle | 15.2 ms (66 fps) | 24.9 ms | 34 enemies, 422 particles |

Answer-path latency (`pointerdown` → verdict, synchronous): **p50 0.2 ms, p90 0.4 ms, max
1.3 ms**. Nothing on the answer path awaits anything.

How: the basalt, trench, striations and sockets are baked once into a 1400² offscreen canvas and
blitted in one call. Every glow is a pre-rendered sprite blitted with `globalAlpha` — there is no
`createRadialGradient` in the frame loop. Particles are a fixed struct-of-arrays pool with a hard
ceiling of 1100 and no allocation after construction; enemies, shots and popups are pooled with
alive flags. The simulation runs a fixed 1/60 step with a capped accumulator.

## Shape of the code

```
src/contract.ts     the Host / Question / mount contract, verbatim
src/stubHost.ts     seeded generator, twelve families, real mal-rule distractors
src/core/           rng · easing · Clock (hitstop, slow-mo, fast-forward) · Camera (trauma, flash)
src/audio/          the whole sound palette
src/game/           constants (all balance) · path · board · waves · state + step
src/render/         bake (static board) · particles · draw
src/ui/             hud (DOM) · styles · chrome (safe area, the host's two corners)
src/mount.ts        the controller: loop, input, sim events → light and noise
```

`src/game/state.ts` is pure of the DOM: `step(state, dt, effects)` calls into an `Effects` sink,
which is why the whole simulation is unit-testable and why two of the tests play a headless siege
to victory and to defeat.

## Controls

Touch and pointer are designed separately, not ported. **Touch**: tap a pad for a radial build
menu, tap a tower to upgrade, big 2×2 answer slugs sized from the leftover screen height, a
full-width overcharge bar. **Desktop**: a live tower palette with cost against dps — click to arm,
then click pads to place, with the range previewing under the cursor. `1`–`4` answer, `Q`/`W`/`E`
arm bolt/mortar/chain, `U` upgrade, `Space` overcharges or calls the wave in early for bonus
embers, `F` fast-forwards, `Esc` closes.

## The room the host leaves us

SIEGE was one of the seven games that already read `env(safe-area-inset-*)`, and it was the
half-fix that usually is: `.sg-top` honoured `--top`, `.sg-anvil` honoured `--bottom`, and
**neither side was touched at all**. `viewport-fit=cover` opts a document into the rounded corners
on every edge, and held sideways the cutout is a *side* inset — which is where the ember count and
the sound switch were. All four edges are honoured now, on the status bar, the console, the
overlays and the banners, and the square board is fitted inside the safe box because a socket
under a rounded corner is a tower a child taps and cannot build.

The host also paints an exit control over the top-left 44px corner and a how-to-play control over
the top-right one, on top of this pack. The status bar ran the full width of exactly that row. Its
*contents* now start after the first control and stop before the second — the bar keeps its
height, the board keeps its size, and the forge still reaches the glass. Reserving the whole strip
instead was tried in a sibling game and cost 12% of a small phone's height.

Paying 108px for those two corners meant the three switches — call wave, speed, sound — had to
leave the bar. They are in the anvil's head row now. That bar was over-full on a 320px phone
anyway: `overflow: hidden` was quietly cutting those same three switches off the right-hand edge,
so nobody on a small phone could reach them at all.

`src/ui/chrome.ts` holds every number involved, derived from the shared host constants, and
`chrome.test.ts` asserts it at five viewports in both rotations. `pack.html` also gained the
`maximum-scale=1` and `touch-action: none` guards that every other pack of the twenty-seven
already had; without them a double tap inside SIEGE could scale and pan the host document.

## Swapping in the real host

`mount(el, host)` already matches the shared contract exactly. `createStubHost` adapts difficulty
from `report()` — up on fast-correct, down on wrong — which is what the real engine will do, so
the swap is one import and the game will not notice.
