# FORGE

**A furnace you feed with arithmetic. Six stations, each one building the station
below it, and a number in the corner that will not stop climbing.**

```
npm install
npm run dev      # http://127.0.0.1:1431  — fully playable, local stub host
npm test         # 49 tests, node's runner, no framework
npm run tsc
npm run build
open /bench.html # frame-budget measurement (see "Performance")
```

---

## The game in one screen

The furnace runs down the left. Six bays: **BELLOWS · CRUCIBLE · HAMMER · ANVIL ·
FOUNDRY · REACTOR**. Bellows make sparks. Crucibles make bellows. Hammers make
crucibles. All the way up. Buying a REACTOR does not make you a single spark — it
makes the thing that makes the thing that makes the thing that makes sparks, and
about ninety seconds later the curve you are watching is visibly steeper than the
one you were watching before.

The workbench is on the right. A bar of hot iron on the anvil with `15 − 8` burned
into it, four cast ingots below it, and a hammer. Hit the right one.

There are no instructions because none are needed. Everything else appears when
it becomes relevant, and nothing ever appears with a tutorial attached.

---

## The maths is the throttle, not a toll

Five surfaces, all of them native to the genre rather than bolted onto it.

**1 · THE STRIKE — the answer IS the payout.**
A correct hit pays `answer + one second of your entire production`, times the
combo. `12 × 11` pays 132. `4 + 5` pays 9. Within about a minute a child starts
preferring the big ones, which is the first time most of them voluntarily compare
two arithmetic expressions. It also pours **heat**, and heat is the global
multiplier.

**2 · HEAT — a square root you can feel.**
`multiplier = 1 + √heat / 10`. 100 heat is ×2.00, 2 500 heat is ×6.00, 10 000 is
×11.00. Quadrupling the heat only doubles the bonus, and after twenty minutes of
watching the gauge most players have worked that out without being told. Heat
bleeds away at 1/16 per second, so the multiplier is visibly draining while you
decide what to do — and a wrong strike costs a quarter of whatever you were
sitting on. **The better you are doing, the more a guess costs.**

**3 · THE SEAL — maths instead of an ad.**
Stations 3–6 arrive chained shut. Crack the seal by answering. Wrong just
re-heats the seal and asks again; unlocking is never a wall, it is the place a
free-to-play game would have shown a video.

**4 · THE FORGE MARK — the best maths in the game, and it has no question.**
Two ingots rise out of the crucible. One says `+14 HAMMER`. The other says
`×2 HAMMER`. The HAMMER row, three centimetres away, says you own **9**.

You keep whichever you take. There is no wrong answer to punish and no red X
anywhere — but one of them makes your numbers grow faster than the other, for the
rest of the run, and taking it stamps a permanent mark on the forge.

> `C + N > 2C ⟺ N > C`

That is a comparison of two expressions in one variable, which is pre-algebra,
and **the crossover moves as you play**. When C is 3, `+14` is obvious. An hour
later, when C is 400, the same `+14` is laughable. Nobody memorises an answer.
You have to look at the row.

**5 · THE QUENCH — the reward screen IS the lesson.**
Prestige pays `carbon = ⌊√(lifetime / 10¹²)⌋`, and the confirm screen shows the
radical being evaluated, in figures, with no words:

```
√( 4.10×10¹⁴ / 10¹² )
√ 410
= 20            CARBON
```

Then the forge is plunged, the screen fills with steam, everything resets, and
the permanent multiplier makes the next four minutes take ninety seconds.

**Plus** the offline haul, claimed with one strike, at full value for a right
answer and half for a wrong one — generous, and never a lecture.

### Milestones fire on the number you are watching

The order-of-magnitude punch triggers on the **highest the spark counter has ever
read**, not on lifetime production. A `10⁹` stamp landing while the counter says
`5.2×10⁷` is a lie about which number just did something. It also produces the
only genuinely tense decision in the early game: spend now, or hold ten more
seconds and watch the exponent tick over.

---

## Exact arithmetic, everywhere it can be seen

Every quantity a player can see, spend, compare or brag about is a **BigInt** in
micro-units. No floats in a cost, a threshold, a comparison, or a displayed digit.
Growth is unbounded and the readout switches to `4.271 ×10⁹` at a million — with
the exponent set in ordinary large figures, raised, because from that point on
**the exponent is the score**.

Floats live in exactly one place: the renderer, where a pixel is a pixel.

`src/core/economy.test.ts` covers determinism, the carry that stops a slow station
rounding itself to a standstill, the exactness of the cost curve, the doubling,
and the prestige root. `src/scene/header.test.ts` exists because the printed heat
multiplier and the applied heat multiplier drifted apart once already, when heat
went from linear to square-root and only the economy was updated — **a maths game
that displays a multiplier it is not applying is the one bug this cannot ship.**

---

## The look

A working smithy at two in the morning. Everything is either cold iron or it is
glowing, and the only light in the room comes from metal too hot to touch.

Stamped plate with 45° chamfers, never radii. Rivets. Hammered-iron pattern
generated once at startup. Labels in heavy tracked-out uppercase; every figure in
tabular monospace so digits never dance as they tick. Amber through white-hot for
everything that works, **cyan reserved exclusively for the quench**, gold
exclusively for forge marks. One canvas, no DOM, no layout thrash.

The furnace is drawn at full height from the very first frame, with five empty
mounting bays and bolt holes, so the column reads as a machine you have not
finished building rather than as a screen that failed to load. Every station that
arrives later visibly fills one of them.

Colour never carries meaning alone: affordable rows also gain a filled chevron and
a raised bevel, sealed rows also carry chain links, and every multiplier is
printed as well as drawn.

### Juice, by name

- **Hitstop** 58–140 ms, scaled by combo — the tenth hit in a row lands harder
  than the first, which is most of why a run feels like it is accelerating.
- **Screenshake** as an impulse with a ~200 ms half-life and per-frame random
  direction, plus a directional **camera punch** that eases back separately.
- **Squash** on the billet (area-conserving), **outElastic** on a struck ingot,
  **outBack** overshoot on a station slamming into its bay.
- **Slow-motion** to 0.28–0.32× for 300–380 ms, on white-hot combos, cracked
  seals and perfect marks only — rare enough that it still means something.
- Pooled particles in `Float32Array` columns, pre-tinted radial sprites blitted
  additively. Never `shadowBlur`.
- **Procedural WebAudio**, three layers per hit: a 3–8 ms filtered-noise
  transient, an *inharmonic* body at 1 : 2.76 : 5.40 : 8.93 (that ratio is why it
  reads as steel and not as a xylophone), and a long bandpassed tail. Pitch walks
  a minor pentatonic with the combo, every sound is detuned a few cents, and the
  forge bed audibly roars louder as the heat climbs. Mutable, and never the only
  channel for anything.
- **Haptics** through the host on every beat; silent where unavailable.

### Children's-product constraints, enforced in code

`prefers-reduced-motion` removes shake, punch, slow-motion, drifting ingots,
heat haze and ambient particles, keeps hitstop (timing, not movement), and drops
nothing informational. Full-screen flashes are **rate-limited to 3 per second and
amplitude-capped** (0.55, or 0.15 under reduced motion) by construction —
`src/render/juice.test.ts` fires a flash request every frame for a second and
asserts at most three land, which keeps it below the 3 Hz photosensitivity band.

No streaks, no loss, no timers, no ads, no loot boxes, no variable-ratio rewards,
no artificial scarcity. Stopping costs nothing: heat is a bonus that fades, never
a debt.

---

## Touch and desktop, both designed

**Portrait** stacks the furnace — readout, station column, workbench in the bottom
third where a thumb reaches. Every target clears 56 px, rows use a compact layout
where the multiplier moves up beside the name and the doubling pips become a
hairline along the bottom edge, and keyboard hints are not drawn at all.

**Landscape / desktop** puts the furnace down the left and the workbench on the
right, so the two things you alternate between are one saccade apart and neither
ever moves. Keycaps appear on every row (`A S D F G H`), answers are `1`–`4`,
`Space` quenches, `M` mutes.

**Press and hold** a station to keep buying, faster the longer you hold, with the
plate filling to show the acceleration. That is why there is no ×1/×10/×100
selector: one gesture, identical on thumb and mouse, zero screen space.

---

## Performance

Measured with `/bench.html`, which calls the real `drawScene` synchronously in a
tight loop (an fps counter can be throttled behind your back; a millisecond
cannot). 1280×900 at dpr 2 — 4.6 megapixels, more than any phone this ships to:

| load | median | p95 | share of a 60 fps frame |
| --- | --- | --- | --- |
| at rest | 0.60 ms | 1.20 ms | 4 % |
| 320 particles | 0.70 ms | 1.40 ms | 4 % |
| 720 particles | 0.90 ms | 5.30 ms | 5 % |
| 1100 (pool full) | 1.00 ms | 5.20 ms | 6 % |

Economy tick, BigInt, at 60 Hz: **1.5 µs** at ordinary magnitudes, **4.9 µs** even
at 10⁴⁰⁰ — under 0.3 ms per second of play at the extreme.

Headroom is ~16× on this machine. A mid-range tablet is roughly 4–6× slower at
canvas fill, which still lands around 6 ms. The safety net is an **adaptive
particle budget**: below 52 fps the burst multiplier drops (floor 0.35) and
recovers above 58, so the game sheds particles rather than frames. Device-pixel
ratio is capped at 2 for the same reason — a 3× display triples fill cost for a
difference nobody can see on a glowing particle.

---

## Balance

`node --experimental-strip-types tools/balance.ts [minutes] [secPerAnswer] [buysPerSec]`
runs a full session against the real economy. Target is roughly one order of
magnitude per 45–90 s through the middle. At 3 s per answer and 0.7 buys per
second (an efficient, tireless bot — a real child is slower):

```
1:10 HAMMER   1:46 ANVIL   2:43 FOUNDRY   3:36 REACTOR   4:54 first QUENCH
20 min: 13 orders of magnitude crossed, mean gap 58 s, 12 marks, 9 quenches
```

The free tier is five to ten minutes a day. In five minutes a player meets four
stations, crosses six or seven powers of ten, takes four or five forge marks —
and can see the quench plate light up, cyan, just out of reach.

---

## The host seam

`src/contract.ts` holds `Question`, `Host` and `mount(el, host)` verbatim as
specified; the shared package replaces that file and nothing else moves.
`src/stub/` is the local, seeded, exact question generator that makes this
playable today — one question stream, three presentations (anvil, seal, haul),
adapting difficulty from `report()`. Distractors are real mal-rule outputs (the
column-wise `52 − 27 = 35` bug, the exponent-multiplication `10⁴ × 10³ = 10¹²`
bug) and anything more than an order of magnitude from the answer is dropped and
backfilled — a wrong answer that can be spotted by size alone is not a distractor,
it is a free pass.

Nothing here imports `dynawalla/curriculum` or `dynawalla/engine`.

## Layout

```
src/contract.ts        the host seam, verbatim
src/core/              bigmath · rng · economy      — BigInt only, no DOM
src/stub/              seeded exact question generator + local host
src/game/              loop, input, layout, save, forge marks
src/scene/draw.ts      the renderer
src/render/            gfx primitives · particles · juice
src/audio/audio.ts     procedural WebAudio
tools/balance.ts       session simulator
tools/bench.ts         frame-budget measurement
```
