# MONUMENT

A one-tap precision stacker. A stone sweeps back and forth above a tower; one
tap sets it. The overhang shears off and the tower narrows — Ketchapp's *Stack*,
Tower Bloxx, Holedown.

**The stone carries a number, and the number changes at every turnaround.** So a
single tap has to satisfy two things at once: the value showing must be the
answer to the prompt, and the stone must be aligned. You get a whole pass to
read a value and decide whether to commit or let it go round again.

```
                 3 + ? = 10
                                     ← the prompt, on a plate, never moving

              ┌────────┐
              │   7    │             ← the stone, sweeping. Wrong value: wait.
              └────────┘
                 ▓▓▓▓▓▓
                 ▓▓▓▓▓▓              ← the monument, as wide as your skill
```

## The one variable

The whole game is a tug-of-war over **the width of the tower**, and nothing
about it is hidden — a player can always see how close to death they are,
because the tower is literally thin.

| what you did | what happens to the width |
| --- | --- |
| right value, dead true | **grows**, and grows more the longer the run of them |
| right value, wide | keeps exactly the overlap, as in every stacker |
| wrong value | keeps the overlap, then the stone **cracks** and loses another quarter |
| missed the tower entirely | the stone bursts, the tower takes a hard bite, the run lives |
| width below the death line | it topples |

A wrong answer is never marked wrong. The equation simply **completes itself**
in the accent colour for three quarters of a second, and the sweep is held for
the same beat so you are never reading one thing while aiming at another. The
punishment is already in the building.

Skill is expressive in a second way: a true placement **calms the sway** and a
mistake **whips it**, so playing well makes the tower easier to hit and playing
badly makes it harder. Past floor twelve the monument breathes, and the target
you are aiming at moves.

## Escalation, forever

There is no completion state. Every eight floors the sky changes band — BASALT,
VERDIGRIS, EMBER, AZURE, VIOLET, AURORA, VACUUM, SOLAR — with a flash, a chord,
a shockwave and a name. After the eighth the cycle repeats with a 37° hue
rotation, so a long run never lands on the same sky twice. **Each course keeps
the colour of the stratum it was built in**, so the tower becomes a record of
the climb; the strata you passed are still under you.

Meanwhile the sweep accelerates, the turnaround hold shortens, the perfect
window narrows from ±0.062 to ±0.030, the stone cycles through more candidate
values, and the sway grows. If you sit through three full cycles without
committing, the sweep starts leaning on you and the stone goes hot — visible
before it is felt.

## Shoring it up

Where a free-to-play game would show an advertisement, this asks for one
correct answer and rebuilds the tower. It is always available and always costs
the same thing, but it restores less every time and bottoms out just above the
death line, so a chain of revives ends by itself rather than by a rule.

## Running it

```sh
npm install
npm run dev            # http://127.0.0.1:4310
npm test               # 36 tests, no browser needed
npm run tsc
npm run build:pack     # what installs on a tablet: pack.html only, no stub host
```

`?perf=1` shows fps, frame cost, tier and input latency. `?dev=1` exposes
`window.__monument` (the sim, a tier switch and a GPU-drained benchmark).

### Playtest harness

```sh
npx playwright install chromium         # once
node tools/playtest.mjs --seconds 120 --quality 0.88 --tier ultra
```

A bot plays with the same information a player has — the value on the stone and
its offset from true — and `--quality` is how often it plays well, so `0.74`
produces a run with real mistakes in it. It reports measured fps, worst frame,
GPU-drained frame cost per tier, answer-path latency and heap drift, and it
saves screenshots at the moments worth looking at.

## Shape

```
src/contract.ts        the host↔game contract, verbatim
src/host/mathgen.ts    exact-arithmetic questions, mal-rule decoys
src/host/stub.ts       a local Host so this runs standalone
src/game/sim.ts        every rule that decides whether a run lives (no THREE, no DOM)
src/game/tuning.ts     every number that decides how it feels
src/game/strata.ts     the eight bands of sky
src/game/mount.ts      assembly and the frame loop
src/view/*             sky, post chain, slabs, plaques, particles, rings, tiers
src/feel/feel.ts       trauma shake, springs, hit-stop, rate-limited flash
src/audio/audio.ts     procedural WebAudio, no assets
src/ui/hud.ts          DOM chrome
src/ui/place.ts        where the chrome may sit: safe area, and the host's two corners
```

`sim.ts` is deliberately free of THREE, the DOM and time-of-day, so the rules
can be tested at ten thousand floors a second without a GPU. That is where the
width arithmetic, the death condition, the revive decay and the determinism
guarantees are proven.

## Things that are true and were expensive to learn

- **Full per-channel ACES skews saturated blues toward purple.** An authored
  blue-grey basalt rendered as lavender. The tone curve now runs on luminance
  only and rescales the colour, so the palette survives.
- **The HUD picks light-on-dark from the measured luminance of the sky it sits
  in front of.** A hand-maintained `invert` flag will always eventually be wrong
  on one stratum, and a run reaches all of them; AZURE shipped unreadable.
- **An AudioContext built inside the first tap cost 206 ms.** It is built at
  mount now, suspended, and the gesture only resumes it.
- **`renderer.dispose()` does not release the WebGL context.** Twenty-four
  mount/unmount cycles exhausted the browser's context pool and started killing
  live games. `forceContextLoss()` on unmount, and a `webglcontextlost` handler
  that stops the loop instead of throwing sixty times a second.
- **A decoy can be secretly correct.** `2/4 + ? = 1` offered `2/4`, because the
  "copied the fraction" mal-rule *is* the answer when the numerator is half the
  denominator. Decoys are now filtered by exact value, not by string.
- **The host paints over the pack, in the two top corners.** An exit control
  top-left and how-to-play top-right, 44px each. The floor count was at
  `left:14px` and the best at `right:14px`, flush to the top, so both sat under
  them. The readouts now step in past the corners onto the same row, and
  `place.ts` holds those offsets in both dialects at once — the `calc(env(…))`
  the stylesheet is built from, and the numbers `place.test.ts` proves at five
  viewports. Reserving a top band instead was tried across the arcade and
  rejected: it costs 12% of a 568px phone.
- **Plaques are sized so they are a constant number of screen pixels.** The
  camera solves its own distance every frame; a number a child has half a second
  to read cannot be allowed to shrink when the shot pulls back.

## Accessibility and posture

- `prefers-reduced-motion` removes shake, chromatic aberration, hit-stop,
  slow-motion and the bright frames, and cuts particle counts — without losing
  any information: every value, every width and every outcome still reads.
- Flashes are hard-capped at 0.24 alpha with a 260 ms minimum gap, and are an
  exposure event rather than a sheet of white, so they never strobe.
- Nothing is carried by colour alone; sound is disableable and always has a
  visual twin.
- The rules are one tap away at any moment, from the shared how-to-play panel —
  a child needs them when they are stuck, which is never the title screen.
- Readable at 320 px. Touch is primary, keyboard (`Space` / `R`) is first class.
- No ads, no loot boxes, no variable-ratio rewards, no daily streak, no
  scarcity, no social pressure, no timer.
