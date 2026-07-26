# `@dynawalla/feel` — the game-feel foundation

The systematic layer every Dynawalla prototype sits on. A prototype author
writes three lines and gets a tuned, coherent, seven-system response that is
correct at 60 and 120 Hz, degrades gracefully on a weak device, and that a fast
child can always interrupt.

```ts
import { feel } from "@dynawalla/feel"

feel.attach({ camera, invoke })                        // once, at boot
feel.start()                                           // once
feel.answer({ correct, difficulty, repaired, milestone }, { subject: tile })
```

That third line fires haptics, hitstop, slow-motion, trauma shake, directional
kick, punch-zoom, screen flash, squash-and-stretch, a pentatonic tone and a
particle burst — at the tier the outcome earns, at the quality the device can
hold. **75 tests, all green. Zero runtime dependencies in the core** (Three.js
is used only by the demo).

---

## 1. The tiers and their budgets

Three separate clocks, and only one of them may ever block.

| | tier | verdict | **blocking** | tail | hitstop | trauma | kick | flash | time scale | particles | haptic |
|---|---|---|---|---|---|---|---|---|---|---|---|
| −1 | `nudge` wrong | 1 frame | **0** | 300 ms | 0 | 0.16 | 0.045 | 0.10 | 1.0 | 0 | warning |
| 0 | `tick` a digit landed | 1 frame | **0** | 90 ms | 0 | 0.05 | 0.012 | — | 1.0 | 0 | light |
| 1 | `snap` ordinary correct | 1 frame | **0** | 220 ms | 0 | 0.14 | 0.035 | 0.12 | 1.0 | 8 | light |
| 2 | `pop` hard item correct | 1 frame | **0** | 400 ms | 40 ms | 0.30 | 0.075 | 0.24 | 1.0 | 22 | medium |
| 3 | `slam` repaired a misconception | 1 frame | **0** | 700 ms | 75 ms | 0.46 | 0.13 | 0.36 | 0.72 → 1 over 180 ms | 48 | heavy |
| 4 | `bloom` something completed | 1 frame | **0** | 1500 ms | 110 ms | 0.62 | 0.20 | 0.50 | 0.50 → 1 over 260 ms | 110 | success |
| 5 | `ascend` once a session | 1 frame | 350 ms | 2800 ms | 160 ms | 0.85 | 0.30 | 0.70 | 0.32 → 1 over 420 ms | 200 | success |

**`blockingMs` is the whole argument.** A *tail* is not a wait — it draws over
the next problem, which presents concurrently. Only `ascend` refuses input at
all, for 350 ms, and a tap skips even that. `tiers.test.ts` asserts
`blockingMs === 0` for every other row, so the standard failure — gating the
input handler on the celebration finishing, and thereby punishing the child who
knows 7×8 — cannot be introduced without a test going red.

Three rules that are asserted, not merely intended:

- **Hitstop is only ever spent on success.** A freeze frame is a reward.
  Spending one on a wrong answer slows the retry at the moment the loop must be
  fastest. `nudge` gets a directional kick instead.
- **`energy(nudge) < energy(snap)`** — being wrong is never the interesting
  moment. Measured: 178 vs 1 484. The energy formula includes *kick*, because
  without it a designer can satisfy the rule on every other axis and still make
  failure the physically emphatic one.
- **Escalation cannot see a streak.** `chooseTier` keys on difficulty, repair
  and milestone. There is no `streak` field to smuggle one into, and a test
  greps every non-test source file for the words. This is inherited from
  MISSION.md and deliberately survives the visual-direction change: the juice
  got much louder, the thing it is loud *about* did not move.

Escalation is legible because the ladder is monotonic in every column, and each
step is a real step: `bloom` is 636× `snap`'s energy, `ascend` is 6.3× `bloom`'s.

---

## 2. Measured — on this machine, by me, today

**Node micro-bench** (`npm run bench`, M2 Max, Node 22.17):

| | |
|---|---|
| whole feel layer, one frame (clock + 24 live tweens + rig + squash + camera write) | **849 ns** = 0.0051% of a 16.67 ms budget |
| same, derated 8× for a mid-range tablet | **0.041%** of budget |
| allocation per frame | **2.3 bytes** (noise; the design target is zero) |
| allocation per tween start | **2.7 bytes** |
| `interrupt()` with a **full 512-tween pool**, including refilling it | **23.6 µs**; 0.19 ms derated 8× — budget is 1 ms |
| `Tweens.to2` + `settle` | **32.5 ns** (was 870 ns before the fix in §4) |
| `Spring1D.update` | 25.7 ns critical / 42.1 ns under-damped |
| `ease.outCubic` / `outBack` / `outElastic` | 8.2 / 9.2 / 66.5 ns |
| coherent `noise1` vs `Math.random` | 14.8 vs 12.9 ns — **the correct one costs 1.9 ns more** |

**Browser bench** (`npm run bench:frames`, headless Chrome on a real GPU —
ANGLE Metal, *not* SwiftShader; 1024×768 @ dpr 2 = 2.05 MP):

CPU time spent producing a frame, including the full Three.js render:

| CPU throttle | idle | a reaction every 120 ms | 40-reaction storm |
|---|---|---|---|
| 1× | 0.30 ms p50 / 0.40 p95 | 0.30 / 0.40 | 0.30 / 0.40 |
| 4× | 1.30 / 1.90 | 1.30 / 1.90 | 1.30 / 1.90 |
| 6× | 1.35 / 2.05 | 1.30 / 2.05 | 1.30 / 2.00 |

**Nothing ever exceeded the budget, and the storm costs the same as idle.**
That is the pool doing its job: 40 simultaneous reactions do not allocate, do
not grow the work set beyond the live-tween list, and do not trigger a GC.

**Honesty about these numbers.** `Emulation.setCPUThrottlingRate` throttles the
main thread only — the GPU stays an M2 Max. So the CPU column is meaningful and
the *fill-rate* column does not exist. The DPR cap in §5 is justified by pixel
count, not by a measurement I made. **The only thing that closes this gap is
running `bench:frames` on a physical mid-range tablet**, which I did not have.

**Screenshots** at `docs/shots/` — tablet and phone, at rest and mid-`snap`,
`bloom` and `ascend`, captured at device pixel ratio.

---

## 3. The API

```ts
feel.answer(outcome, opts)    // choose the tier from the outcome, fire it
feel.react("bloom", opts)     // fire a named tier
feel.tap()                    // sugar for "tick"
feel.press(payload)           // TOP OF EVERY INPUT HANDLER. interrupts, returns
                              // false if it buffered instead of applying
feel.takeBuffered<T>()        // the buffered input, once the gate opens
feel.interrupt()              // everything to its END state, synchronously
feel.hit(targets, x, y)       // fat-finger correction, nearest-centre
feel.onEmit(fn)               // the kit decides particle count + timing,
                              // the prototype owns the particle shape
feel.onFrame(fn)              // one rAF loop for the whole app
```

`opts` is `{ dir?, at?, subject?, gain? }` — impact direction, normalised screen
position, the thing to squash, and a per-call multiplier.

Everything underneath is public and separately usable — `feel.rig`,
`feel.tweens`, `feel.clock`, `feel.governor`, plus `Shake`, `Kick`, `Spring1D`,
`Squash`, `Coyote`, `InputBuffer`, `ScreenFlash`, `FeelAudio`, `Haptics`, and
the whole named easing library. A prototype that wants one specific thing should
not have to fight the facade for it.

### Input forgiveness, from the platformer canon

Verified from Celeste's own source (`Source/Player/Player.cs`), not remembered:

```cs
private const float JumpGraceTime = 0.1f;      // coyote time, 100 ms
private const int UpwardCornerCorrection = 4;  // 4 px of nudge
private const int DashCornerCorrection = 4;
```

- **Coyote time → the deadline that just passed.** `Coyote(100)`. A tap 99 ms
  after a timer expires was committed before the deadline; refusing it punishes
  reaction time, which is not the skill under test.
- **Input buffering → the tap during the flourish.** `InputBuffer(180)`. Longer
  than a platformer's five frames because a child's follow-up tap is a
  considered action, not a rhythm input. One slot, not a queue: mashing means
  *go*, not *go three times*.
- **Corner correction → fat-finger hit slop.** `nearestTarget(targets, x, y, 12)`.
  The highest-value one here. A six-year-old's contact patch is ~10 mm and the
  reported centroid sits low; a tap the child aimed at a button routinely lands
  6–10 px below it. Implemented as *nearest centre within the slop radius*,
  never as an enlarged hit box — enlarged boxes overlap and then two adjacent
  answers both claim the tap.

### Three time channels

`real` (input, audio, shake — never stops) · `world` (hitstop zeroes it,
slow-motion scales it) · `ui` (unscaled but pausable — the next problem
presenting). A one-channel clock forces a choice between "the freeze frame feels
good" and "the child never waits". This product needs both.

---

## 4. Traps — found by hitting them

The most valuable thing in this document.

**T-01 · Hitstop must be milliseconds, not frames.** The canon is written for
fixed-60 engines (`Celeste.Freeze(.05f)` = 3 frames). We ship on 120 Hz iPad
ProMotion and 90 Hz Androids, where a frame-counted hitstop is *half* the
intended duration and reads as a dropped frame. Asserted: the same 50 ms
hitstop is 3 frames at 60 Hz and 6 at 120, and identical in wall-clock.

**T-02 · Spring impulses were wrong by ~250× and nothing could see it.** A tier
asking for a 16% scale punch produced 3%; a tier asking for a 0.3-unit camera
recoil produced 0.00125. An 18 Hz spring converts a unit of velocity impulse
into ~0.004 units of displacement, so every hand-picked multiplier in the table
was meaningless — and code review, types and unit tests all passed. Fixed with
`Spring1D.impulseForPeak()`, derived from the analytic peak of the impulse
response, so tier numbers are now **peak displacement in real units** and a
designer can reason about them. This is the single most important bug I found.

**T-03 · A pooled tween runtime can still be O(capacity).** Allocating with a
rotating cursor and iterating to the high-water mark means that within a second
of play every frame walks all 512 slots to find the two that are live. Measured
870 ns → **32.5 ns** after switching to a dense active list with swap-removal.
"We use a pool" sounds like it settles the performance question. It does not.

**T-04 · `Math.random()` per frame is vibration, not shake.** Successive frames
are uncorrelated so the camera teleports and the eye reads a rendering fault.
Coherent value noise costs 1.9 ns more per sample. Asserted by comparing mean
frame-to-frame delta.

**T-05 · An overshoot ease over a small range does not overshoot.** `outBack`
from 0.9 → 1.0 overshoots by 10% of 0.1 — invisible. The peak must be inside a
tween's *range*, which is why the scripted `pop()` is three beats and not two.
This is why hand-built scripted pops look limp.

**T-06 · `camera.lookAt()` rebuilds rotation and erases roll.** Roll applied
before `lookAt` silently vanishes. `applyTo` fixes the order so a prototype
cannot get it wrong. (Same family as the repo's `setTarget()`-resets-radius
note in the Babylon playbook.)

**T-07 · Shake accumulated into `camera.position` drifts.** The follow logic
reads back the shaken position and follows *that*. The fix is structural: the
game writes `rig.base`, the rig owns the camera, nothing ever reads the camera
transform back. There is no path by which an offset can accumulate.

**T-08 · `navigator.vibrate` — two separate traps.** It does not exist at all in
iOS WKWebView (so a WebView-only haptics implementation works on desktop Chrome
and ships silent on every iPhone — use `tauri-plugin-haptics`); and in Chrome it
is **blocked until the frame has been tapped**, logging a console error on every
call before then. Found by reading the screenshot run's console. Both gated now.

**T-09 · Headless Chrome's rAF delta is not frame time.** My first browser bench
reported `p50 8.30 ms` — identical to two decimals across 27 configurations,
idle and under a 40-reaction storm, at 1× and 6× CPU throttle. It is a virtual
cadence. Measure the *work* done inside the frame callback instead; that number
responds to throttling and can carry a budget.

**T-10 · `renderer.setSize(w, h, false)` breaks the canvas layout.** With
`updateStyle: false` the canvas keeps its intrinsic size — `width × dpr` CSS
pixels — so at dpr 2 it lays out at twice the viewport and the page shows the
top-left quadrant of the render. It looks exactly like a broken camera. Cost
this build one screenshot round.

**T-11 · `performance.now()` is coarsened to 100 µs.** Every browser number
above is a multiple of 0.1 ms because Chrome clamps the timer for Spectre
mitigation unless the page is cross-origin isolated (COOP/COEP). Sub-100 µs
work is not measurable in a WebView; measure in aggregate over many frames.

**T-12 · Headless WebGL is SwiftShader unless you ask for a GPU.** Without
`--enable-gpu --use-angle=metal`, every fill-rate number is software-rasterised
fiction. `bench/frames.mjs` reads `WEBGL_debug_renderer_info` and says so.

**T-13 · `gl_PointSize` is in device pixels.** A first pass used a `300.0`
distance divisor and every particle rendered ~400 px across; the burst was one
white disc covering a third of the screen and read as a bug rather than as
juice. Visible only in a screenshot — no test would have caught it.

**T-14 · `AudioContext` starts suspended and iOS never auto-resumes it.**
`resume()` only succeeds inside a user-gesture task, and after a phone call or
backgrounding the context stays suspended — audio dies permanently and the bug
report is "sound stopped working yesterday". Gated on first gesture plus a
`visibilitychange` re-resume. Never `await` audio on the answer path.

**T-15 · Haptics cross the IPC bridge, so they land late.** Touch is more
latency-sensitive than vision; a haptic 40 ms after the flash reads as a second
unrelated event. `react()` dispatches haptics as its *first* statement, before
any visual work is queued, and never awaits. iOS also coalesces generators
firing under ~40 ms apart into mush, so a minimum interval is enforced in the
kit rather than in every prototype.

---

## 5. The budget the kit enforces, and the degradation path

**Budget: the feel layer gets ≤ 1.0 ms of a 16.67 ms frame on the reference
device.** Measured 0.0008 ms on an M2 Max, 0.041% of budget derated 8×. The
headroom is deliberate — it belongs to the renderer and to whatever the
prototype is actually doing.

Sub-budgets the kit holds itself to:

- `interrupt()` ≤ **1 ms** worst case with a full pool. Measured 0.19 ms derated.
- **0 bytes** allocated per frame and per reaction.
- Verdict visible in **1 frame**, always, on every tier.
- Blocking input: **0 ms** on every tier but `ascend`.

**Four quality tiers, chosen twice** — once at boot from device signals, then
continuously by a governor watching p95 frame time.

| | dpr cap | particles | motion | post FX | bloom | shadows | tween pool |
|---|---|---|---|---|---|---|---|
| `low` | 1.0 | ×0.3 | ×0.8 | off | off | none | 96 |
| `medium` | 1.5 | ×0.6 | ×1.0 | on | off | 512 | 192 |
| `high` | 2.0 | ×1.0 | ×1.0 | on | on | 1024 | 320 |
| `ultra` | 2.5 | ×1.6 | ×1.1 | on | on | 2048 | 512 |

- **Boot detection is pessimistic.** `deviceMemory` is Chromium-only and clamped
  to 8; `hardwareConcurrency` on an iPad counts efficiency cores; the GPU string
  is masked in Safari. Every signal is missing, lying, or both — so the
  *minimum* suggested tier wins and the governor promotes upward once frames
  prove it. Starting low and promoting is invisible; starting high and demoting
  is a visible stutter in the first ten seconds, which is exactly when a child
  decides what they think.
- **The governor has hysteresis** — 2 s of sustained overrun to demote, 8 s of
  headroom to promote — or it oscillates at the boundary, and tier changes are
  visible. A single stutter never demotes; a clamped stall frame (tab switch,
  notification) is discarded rather than blamed on the renderer.
- **Every tier draws every effect.** A `low` device gets the same *language* at
  a smaller budget. Turning effects off by tier is how you ship two products.
- **`prefers-reduced-motion` is a branch, not a degradation.** Motion goes to
  zero; the flash stays (light is not motion) as a slower, gentler wash; audio
  and haptics are untouched. A child who needs reduced motion still gets the
  whole response.

The **DPR cap is the biggest single lever** — an uncapped dpr 3 is 9× the
fragment work of dpr 1, for a difference nobody can see at arm's length on a
60 px glyph.

---

## 6. A note the founder should see

The program docs already in `dynawalla/docs/` describe a *different* product
from the one my brief describes, and the difference is not cosmetic:

- `ADR-0004` — "no 3D renderer in V1"; `EXPERIENCE_DESIGN.md` — "2D throughout".
  My brief says **Three.js, founder decision**, "take the cap off the quality".
- `EXPERIENCE_DESIGN.md` — "Juice dose is a hard ceiling", "feedback must be
  contingent, not loud". My brief says **"juice first"**, "warmth and spectacle
  over restraint", and names the restrained build's review: *"as fun as a public
  school teacher crashing out."*
- The existing `dynawalla-app/src/reactions/` implements the restrained
  direction well — it is the "beautifully made instrument" that got that review.

I built to the brief, on the assumption the pivot is real and the docs are
stale. **Those two documents need updating or this kit contradicts them.** What
I deliberately *kept* from the old direction, because it is ethics rather than
art direction and is recorded in MISSION.md: no escalation on streaks, and
being wrong is never more interesting than being right. Both are asserted.

---

## 7. Running it

```bash
npm install
npm test                  # 75 tests
npm run tsc               # typecheck
npm run bench             # CPU + allocation (add --expose-gc for memory)
npm run dev               # the demo at 127.0.0.1:5177
npm run build && npx vite preview
node bench/frames.mjs     # browser frame-work bench at 1x/4x/6x CPU
node bench/shot.mjs       # regenerate docs/shots/
```

## 8. Files

| | |
|---|---|
| `src/feel.ts` | the facade — the three lines a prototype writes |
| `src/tiers.ts` | **the table**: tiers, budgets, the escalation rule |
| `src/clock.ts` | one rAF loop, three time channels, hitstop, slow-motion |
| `src/spring.ts` | exact exponential integrator; `impulseForPeak` (T-02) |
| `src/shake.ts` | trauma shake (Eiserloh) + directional `Kick` |
| `src/tween.ts` | pooled, zero-alloc, fast-forwardable, generation-checked |
| `src/ease.ts` | every Penner curve by name + `spike`, `cubicBezier`, `spring` |
| `src/camera.ts` | compose-never-accumulate rig; 3D and CSS output |
| `src/squash.ts` | volume-conserving squash, anticipation, follow-through |
| `src/input.ts` | coyote time, input buffer, hit slop, the touch CSS |
| `src/quality.ts` | tiers + the hysteretic governor |
| `src/flash.ts` | DOM-composited screen flash (cheaper than a GL pass) |
| `src/audio.ts` | asset-free Web Audio, gesture-gated, pentatonic |
| `src/haptics.ts` | plugin → vibrate → noop, coalesced, fired first |
| `demo/main.ts` | the reference prototype **and** the measurement probe |
