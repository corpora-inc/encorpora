# FUSE

**Touching chips that add up to the KEY fuse.** That is the whole game and the
only sentence anyone needs.

A number drops into a magnetic containment well. If it lands touching chips that
sum to the KEY — 10 at first, 100 by the end — they slam together, detonate, and
the sum flies out of the well as a glowing core. Everything above falls, which
makes new pairs, which fuse, which makes more pairs. The well rises underneath
you the whole time.

```bash
npm install
npm run dev      # http://127.0.0.1:5183
npm test         # 73 tests, no framework
npm run tsc      # strict, noUncheckedIndexedAccess
npm run build
```

`?seed=<text>` for a reproducible run. `?debug=1` for fps / particle / phase.

---

## The math is the mechanic

Merging **is** addition. Not "addition unlocks a merge" — the merge is the sum.

- **Complements.** The single most valuable fact family in primary arithmetic is
  "what makes ten". This game is nothing but that, for eleven values of ten.
- **Repeated addition and chains.** A cascade is the same sum happening again
  from the pieces that fell, at a rising multiplier and a rising pitch.
- **Place value emerges.** The KEY ladder runs 10 → 12 → 15 → 20 → 24 → 25 → 30
  → 40 → 50 → 60 → 75 → 100. By level 10 you are finding what makes 50 out of
  two-digit chips, in about three seconds.
- **Expression faces.** From level 3 a chip stops showing `7` and starts showing
  `15 − 8`. It is still worth 7 and it still fuses with a 3. Now you have to
  evaluate it to aim. Same game, deeper arithmetic, no new rules and no new UI.
- **RESONANCE.** Every fuse charges the reactor. Full, it goes white and you can
  tap it — time drops to a crawl, one big question appears, and every chip on
  the board is an answer button. Get it right and every chip of that value plus
  its neighbours erupts. This is also the rescue: when the well breaches, you
  get exactly one of these to save the run. **Math instead of an ad**, once per
  run, no scarcity games.

Wrong answers cost the only thing a puzzle game can honestly charge: space. A
chip you cannot place is a chip that fills the well. Guessing is available and
guessing loses, because the well rises whether or not you were sure.

Every value, every comparison and every score is an integer. There is not a
floating-point number anywhere in `core/` or in an answer.

## Why it looks like this

A fusion reactor, because that is literally what the mechanic is: light nuclei
combining into a heavier one and releasing energy. Near-black indigo, thin
bright vector rims, additive plasma, no cards and no gradients-with-rounded-
corners anywhere.

The 3D is real, not a drop shadow. Every chip is an extruded octagonal prism,
swept toward a vanishing point above the well, so chips at the edges show their
sides and chips in the middle stand straight up. The well's walls are built the
same way. It costs two extra fills per chip and it is the single thing that
stops this reading as a flat puzzle grid.

Chip colour encodes size *relative to the KEY*, so a 7 at KEY 10 and a 70 at KEY
100 look the same and the palette never runs out. Colour is decorative: the
number is always printed, so nothing is ever carried by hue alone.

## The juice, with numbers

| Channel | What it does |
|---|---|
| Screen shake | Trauma model (Eiserloh): store trauma, shake by trauma², decay 1.85/s. A land is 0.09–0.22, a chain-5 fuse is 0.61, a resonance hit is 0.85. |
| Hitstop | 28–50 ms on a land, `34 + 16×chain` ms on a fuse. Logic freezes, rendering does not. |
| Camera punch | Spring-damped additive zoom, k=190 c=17, so it overshoots once. 0.7 on a land, up to 3.4 on a resonance hit. |
| Slow motion | Chain ≥ 3 drops the time scale to 0.42 for 200 + 30×chain ms; a resonance hit to 0.32 for 420 ms. |
| Squash & stretch | Every chip is a spring (k=380, c=23, hard-clamped to ±0.55). A landing chip squashes to 1.34×0.66 and rings back; the chips under it ripple by 0.2/depth. |
| Particles | 1100-slot pool in flat typed arrays, zero allocation after construction. Streaks, additive dots, spinning shards, ambient embers. Budget drops to 0.65 under 52 fps and 0.35 under 42. |
| Shockwaves | Expanding fronts whose alpha falls as (1−t)^2.6 — a thinning front, not an outline. |
| Trails | The falling chip leaves four fading afterimages. |
| Easing | `outBack` on chip pop-in and panel entry, `outQuint`+`inQuad` on the fuse bloom, `outCubic` on ring growth, `inOutCubic` on core flight. |
| Audio | Every sound is transient + body + tail, detuned ±30 cents per trigger. Chains climb a pentatonic ladder so a nine-chain is a melody. All procedural, no assets, fully mutable. |
| Haptics | light on land, medium on fuse, heavy on chain ≥ 3, success on level-up and resonance hit, failure on breach. |

## Safety, because children play this

- `prefers-reduced-motion` zeroes shake, punch, rotation, slow-motion and **all**
  flashes. Hitstop survives, capped at 40 ms — it is timing, not motion, and it
  moves nothing on screen. Nothing informational is lost. Asserted in
  `fx/camera.test.ts`.
- Full-screen flashes are hard-limited to **3 per second** and **alpha 0.34**,
  regardless of what the game asks for. Asserted in the same file.
- No streaks, no loss aversion, no variable-ratio rewards, no loot, no ads, no
  social pressure, no artificial scarcity. One rescue per run, fixed.
- Colour never carries meaning alone: the danger band is red *and* hatched, the
  fuse preview is a glow *and* a rim, the chip is a colour *and* a numeral.

## Performance

Measured on the dense board at level 7, 2502×1822 device pixels (DPR 2):

- **0.50 ms/frame** idle, **1.63 ms/frame** at saturation — 1100 live particles,
  the ring and pop pools full, camera thrashing every frame. That is 10% of a
  16.7 ms budget, leaving roughly 6–10 ms of headroom on a mid-range tablet.
- One canvas, one RAF loop, no DOM work per frame, no `shadowBlur` and no
  `filter` in the hot path. Glows, chips and numerals are rasterised once into
  cached bitmaps and blitted; the background plasma is rendered at 1/7 scale and
  upscaled, which is where the softness comes from for free.
- The frame budget is measured continuously and the particle budget follows it,
  so a slow device loses sparks rather than frames.

## Input — two designs, not one ported

**Touch.** Press anywhere, the chip follows your thumb across columns with a
live landing ghost, lift to slam. Your hand is at the bottom and the chip is at
the top, so you never cover what you are aiming.

**Desktop.** The chip tracks the mouse with no button held; click to slam.
`←`/`→` or `A`/`D` to move, `Space`/`↓`/`Enter` to drop, `1`–`6` to drop
straight into a column, `E`/`Shift` for resonance, `M` mute, `R` restart. During
resonance, `1`–`6` picks the top chip in that column. A fast player never
touches the mouse.

## Layout

Portrait puts the instruments in a band above the well; landscape puts them in
rails either side. Two designs, not one stretched. `layout.test.ts` asserts on
twelve viewports from a 320-wide phone to a 1920 desktop that the well fits, the
held chip has headroom, and nothing overlaps the well.

`computeLayout` takes the safe rectangle as a **required** argument —
`safeRect(w, h)` from `packs/shared/game-chrome`. The pack declares
`viewport-fit=cover`, so without it the score is drawn under the notch, and a
canvas cannot read `env(safe-area-inset-*)` for itself. Required rather than
optional, because a game that forgets it should not compile.

The host paints its exit chevron over the top-left 44px and the how-to-play
button over the top-right 44px. Those overlay the pack rather than reserving a
band — a band costs a twelfth of a small phone's height — so the layout moves
the score, the LV readout, the next-chip strip, the mute toggle and the
tappable reactor out from under them, and `hitsHostChrome` asserts it on every
viewport. The plasma, the well walls and the sparks still bleed to the edges.

How to play is the shared `createInstructions` panel, reachable during a run,
not just before it.

### The stage belongs to the host

The canvas is `position: absolute; inset: 0`, so the element the host hands to
`mount()` is the only node with a size of its own — and the host *document*
decides what that size is. `makeStage` therefore branches on the **computed**
position and writes one only when nobody has positioned the element at all.

It used to read `el.style.position`, which is the *inline* declaration and is
empty for an element positioned from a stylesheet. `pack.html` gives `#root` its
entire box with `position: fixed; inset: 0` and nothing else, so the fallback
always fired, the inline `relative` won the cascade, and the insets stopped
meaning anything. Measured in a framed pack: `#root` **820x0**. `games/runner`
shipped that same line to two app stores as a black screen; FUSE survived it on
two accidents — no `overflow: hidden` on the stage, so the canvas painted
outside the collapsed box instead of being clipped, and an
`el.clientHeight || window.innerHeight` whose `||` swallowed the zero. Neither
was a decision, and either is one ordinary edit from being removed.

The measurement is now honest and `resize()` says so out loud, once, when the
stage comes back under two pixels on either axis. `layout.test.ts` reads the real
`#root` rule out of `pack.html` and resolves the two-declaration cascade the bug
lived in, so the fix cannot be undone quietly.

## Structure

```
src/
  contract.ts        Host / Question — kept EXACTLY the shared shape
  core/              pure, integer-exact, fully tested
    rules.ts         the board, group finding, cascade, gravity, the rise
    deck.ts          complement bag randomiser — you are never dealt a dead chip
    levels.ts        the escalation curve
    rng.ts           seeded uint32 stream
  host/
    questions.ts     exact generation for a chosen answer, with real mal-rules
    stubHost.ts      the local host, so this is playable standalone today
  fx/                camera, particles, sprite cache, palette
  audio/audio.ts     procedural, three-layer, no assets
  game.ts            the state machine
  render.ts          the draw
  layout.ts input.ts mount.ts
```

`core/` and `host/` have no DOM dependency and are tested directly with the Node
test runner — no framework, no jsdom.

The engine *solves* a drop completely (`planDrop`) and the renderer plays that
plan back with timing. That split is the reason the rules are testable at all,
and the reason a cascade animates identically to how it was computed.

## Swapping in the real host

`mount(el, host)` already takes the shared `Host`. The stub is only referenced by
`main.ts`. A host may optionally implement `focus({ key, wanted })` to bias its
question stream toward the chip values that are about to spawn; without it the
game simply shows fewer expression faces and everything else is unchanged.

Correctness is reported when it is genuinely known: an expression chip that
fuses is correct with the time it took, one that is buried by a breach is not,
and a resonance answer is reported exactly as tapped.
