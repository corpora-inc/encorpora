# Physics foundation

**Recommendation: Rapier 2D, pinned at `@dimforge/rapier2d-compat` 0.19.3.**

Everything below is measured. Every table was produced by a script in `bench/`, on this
machine, on the dates given, and every one of them can be re-run. Where something was
not measured — an actual Galaxy Tab A9, an x86 device — it says so.

- Machine: Apple Silicon macOS 26.3 (arm64), Node 24.18.0, Chrome 150.0.7871.187,
  WebKit 26.5 (Playwright build).
- Date: 2026-07-26.
- Versions confirmed live against the npm registry the same day.

---

## 1. The bake-off

Four engines, five scenes, identical worlds. The scenes are plain data in
`bench/scenes.mjs` and each engine has an adapter that builds them; nothing is expressed
in any engine's own vocabulary, so this measures the engines rather than how well three
of them imitate the fourth.

| candidate | version | published | why it was in the running |
|---|---|---|---|
| Rapier 2D | 0.19.3 | 2025-11-05 | Rust/WASM, TGS-Soft solver, an explicit determinism story |
| Box2D v3 | `box2d3-wasm` 5.2.0 | 2026-02-16 | Erin Catto's rewrite; soft-step solver, SIMD, smallest WASM |
| Planck.js | 1.5.0 | 2026-04-07 | pure JS port of Box2D 2.4 — no WASM at all |
| Matter.js | 0.20.0 | **2024-06-23** | the default answer on the web; note the date |

Not benchmarked, and why: **Havok** (`@babylonjs/havok`) and **Jolt** (`jolt-physics`,
46 MB unpacked) are 3D engines whose shipped JS surface is a Babylon plugin API; we are
on Three.js and the games are 2D-simulated. Using either would mean adopting a 3D solver
for a side-on world and writing the binding ourselves.

### Step cost — `node bench/run-node.mjs --repeat 3`

Milliseconds per step, V8. `snap` is the cost of reading every body's transform out for
the renderer, which most physics benchmarks quietly omit and which is not free.

| engine | scene | p50 | p95 | p99 | max | snap |
|---|---|---:|---:|---:|---:|---:|
| **rapier** | pyramid-topple (120 bodies) | 0.120 | 0.178 | 0.314 | 0.456 | 0.049 |
| **rapier** | debris-500 | 0.476 | 0.573 | 0.650 | 0.777 | 0.171 |
| **rapier** | dominoes-300 | 0.152 | 0.256 | 0.363 | 0.692 | 0.101 |
| **rapier** | rope-60 | 0.104 | 0.119 | 0.131 | 0.154 | 0.019 |
| **rapier** | balance-scale | 0.014 | 0.018 | 0.023 | 0.030 | 0.004 |
| box2d3 | pyramid-topple | 0.019 | 0.135 | 0.188 | 0.764 | 0.121 |
| box2d3 | debris-500 | 0.301 | 0.397 | 0.433 | 0.494 | **0.454** |
| box2d3 | dominoes-300 | 0.091 | 0.167 | 0.181 | 0.226 | 0.273 |
| box2d3 | rope-60 | 0.031 | 0.044 | 0.052 | 0.059 | 0.057 |
| planck | pyramid-topple | 0.716 | 0.964 | 1.633 | 2.264 | 0.001 |
| planck | debris-500 | **4.182** | 5.545 | 6.156 | **9.935** | 0.004 |
| planck | dominoes-300 | 0.802 | 1.654 | 1.897 | 2.184 | 0.003 |
| matter | pyramid-topple | 0.203 | 0.305 | 0.370 | 0.581 | 0.001 |
| matter | debris-500 | 2.476 | 3.154 | 3.391 | 3.919 | 0.003 |
| matter | dominoes-300 | 0.237 | 0.306 | 0.360 | 0.439 | 0.001 |

**Box2D v3 is the fastest solver** — 6x Rapier's p50 on the pyramid. But its Embind
binding allocates a heap handle per getter call, so reading 500 transforms costs
**0.454 ms against Rapier's 0.171 ms**, and on the scene that matters most the total is
0.755 ms versus Rapier's 0.647 ms. The solver win is spent at the boundary.

**Planck is 8.8x slower than Rapier on `debris-500`** with a 9.9 ms worst frame — on a
Mac. That is most of a mid-range tablet's entire frame budget for 500 boxes.

### Quality, which is not optional

Speed is necessary and not sufficient. A fast engine whose rope stretches or whose
dominoes wedge is not usable for a product where the physics *is* the explanation.

| engine | rope stretch @150:1 | dominoes fallen /300 | balance @ equality |
|---|---:|---:|---|
| **rapier** | **3.3%** | 202 | **-0.001°, 0.000° jitter** |
| box2d3 | 4.0% | 204 | 46-70° (broken) |
| planck | **92.1%** | 204 | -0.44° |
| matter | 6.1% | **0** | +4.1°, wrong-signed response |

Three failures worth naming.

**Matter.js cannot propagate a chain reaction.** `bench/run-node.mjs --engine matter`
drops **0 of 300** dominoes; the wave dies at domino three and the scene is frozen from
step 180 to step 900. It is not my friction choice — `bench/probe-dominoes.mjs`, fallen
out of 300:

| friction | 0.10 | 0.20 | 0.30 | 0.45 | 0.70 |
|---|---:|---:|---:|---:|---:|
| rapier | 289 | 258 | 229 | 195 | 158 |
| box2d3 | 291 | 261 | 230 | 196 | 159 |
| planck | 276 | 256 | 228 | 197 | 159 |
| matter | 73 | 70 | 64 | **0** | **0** |

Three engines agree to within 2 dominoes and degrade smoothly. Matter starts at a
quarter of the others and falls off a cliff above 0.3 — and a game will want high
friction, because that is what makes blocks feel heavy and stay where they are put.
"Dominoes and chain reactions" is on the required list, so this alone disqualifies it.

**Planck cannot hold a chain.** `bench/probe-rope.mjs`, stretch by load:link mass ratio:

| ratio | 10:1 | 50:1 | 150:1 | 500:1 | 2000:1 |
|---|---:|---:|---:|---:|---:|
| **rapier** | **0.7%** | 1.1% | 3.3% | 11.2% | 17.5% |
| box2d3 | 3.0% | 1.4% | 4.0% | 4.0% | 35.6% |
| planck | **64.1%** | 77.3% | 92.1% | 108.7% | 104.8% |
| matter | 5.3% | 6.2% | 6.1% | 7.1% | 16.8% |

Planck's chain is elastic at *every* ratio, and its own quality dial barely helps
(105% → 96% going from 8/3 to 32/12 iterations). Rapier's does: 16 solver iterations
takes 2000:1 from 18% to 7% for 3.4x the solve. Matter's dial goes the **wrong way**
(17% → 62% as iterations rise), which means it is not a convergence knob at all.

**Box2D v3 cannot hold a balance scale.** With equal weight in both pans it settles at
46-70° of tilt, and more sub-steps do not help — at 32 sub-steps it tips the *wrong way*
under an imbalance. I am reporting what I measured; this may be the `box2d3-wasm`
wrapper rather than upstream Box2D, and I did not chase it further because it does not
change the recommendation.

### Bundle cost — measured, not quoted

| artifact | raw | gzip | brotli |
|---|---:|---:|---:|
| `rapier_wasm2d_bg.wasm` | 1,175,792 | 434,688 | 326,730 |
| Box2D v3 `deluxe` (SIMD) `.wasm` | 427,805 | 157,574 | 125,920 |
| **this kit bundled** (`-compat`, all recipes) | 1,705,215 | 636,491 | 478,423 |
| Three.js, minimal scene, for scale | 523,580 | 131,109 | 108,755 |

Rapier's WASM is **2.75x Box2D v3's**. That is a real cost and it is the strongest
argument the other way.

Two things make it acceptable here. First, in a Tauri app the WASM is bundled into the
binary and served over a custom protocol — there is no network transfer, so the number
that matters is app size, where 1.1 MB sits next to Three.js's 0.5 MB and the app's own
assets. Second, **most of the gap above is the `-compat` packaging, not the engine**:
`-compat` base64-inlines the WASM into the JS, which costs ~200 KB gzip over shipping
the raw `.wasm` because base64 compresses badly. Production should switch the dependency
to `@dimforge/rapier2d` (separate `.wasm`, same engine); `-compat` is the default here
because it makes a prototype a single file with no asset plumbing.

### Startup — measured in both browsers

| engine | WASM init | build 200 bodies | step |
|---|---:|---:|---:|
| Chrome / V8 | 10.0 ms | 1.10 ms | 0.0393 ms |
| WebKit / JavaScriptCore | 9.0 ms | 3.00 ms | 0.0600 ms |
| Node 24 / V8 | 29.4 ms | — | — |

**The same WASM steps ~1.5x slower under JavaScriptCore than V8, and crosses the JS↔WASM
boundary ~2.7x slower.** iOS is JavaScriptCore. Budget for it.

---

## 2. Determinism, honestly

The claim a maths product needs is not "Rapier is deterministic". It is "a replay taken
on one child's device reproduces on another", and that has to survive two different JS
engines.

**Measured — `bench/determinism.mjs`.** One seeded scene (a toppling stack, a jointed
chain under load, 120 liquid particles and a fired projectile — contacts, islands and
constraints at once), 900 steps:

| runtime | quantised state hash |
|---|---|
| Node 24.18.0 / V8 | `cad4460c` |
| Chrome 150 / V8 | `cad4460c` |
| WebKit 26.5 / JavaScriptCore | `cad4460c` |

Identical. And it is **structural, not lucky**: inspecting the module's imports,

```
rapier2d wasm — total imports: 32
  math/libm imports from JS: NONE
  random/time imports:        performance.now (profiling counters only)
```

Rapier links no libm out to JavaScript. Every floating-point operation happens inside
the WASM module, where the spec fully determines f32/f64 arithmetic — no FMA
contraction, no x87 excess precision, no engine-specific `Math.sin`. The JS engine
*cannot* influence the result. All 20 bake-off cells were also bit-identical across three
repeated runs in one process.

**What is NOT established.** Everything above ran on arm64. The WASM spec makes
cross-architecture determinism expected for scalar f32/f64, but x86 Android and CI were
not tested, and NaN bit patterns and SIMD are the spec's known exceptions. Rapier
publishes `@dimforge/rapier2d-deterministic` (0.19.3, +33 KB) whose difference is a
portable libm inside Rust for exactly this; if a cross-device replay ever desyncs, that
is the first switch to throw, and it is a one-line dependency change.

**So the kit stores commands, not positions** (`src/replay.ts`). A tape is a list of
`{step, op, args}` addressed by *step index*, never by wall clock. It replays by
re-deriving the physics, so it survives an engine upgrade with a version warning rather
than silent corruption, and it is tiny — the test asserts a three-command tape stays
under 800 bytes. `world.hash()` is quantised to 0.1 mm rather than bit-exact, because a
bit-exact hash of f32 state is too brittle to be a useful assertion.

---

## 3. The traps — found by hitting them

Every one of these cost real time and every one is now gated by a test.

**1. Rapier joints collide the bodies they connect, and there is no `collideConnected`.**
Box2D, Planck and Matter all default a joint to *not* colliding its two bodies. Rapier
does the opposite and its JS API does not expose the flag at all (grep confirms: zero
hits in the type definitions). Since a joint by construction holds two colliders
overlapping at the anchor, the contact and the constraint fight and the joint **jams
solid**. Measured, on a simple pendulum:

| anchor body | arm rotation after 5 s |
|---|---|
| no collider on the anchor | -33.0° (swings) |
| a collider on the anchor | **0.0° — frozen horizontal in mid-air** |
| collider + one collision-group bit | -33.0° (swings) |

Every articulated recipe in this kit would have been silently dead. `World.add` takes an
`assembly` id and clears that bit from the assembly's own filter.

**2. `JointData.limitsEnabled` / `.limits` are silently ignored.** They exist, they
type-check, they run — and `joint.limitsEnabled()` reads back `false` and an arm with a
±22° stop swings to **-174°**. The limit must be applied to the *created* joint via
`joint.setLimits()`. Both spellings are in the API and only one works.

**3. A beam pivoted through its own centre of mass is neutrally stable.** No restoring
torque at any angle, so where it settles is decided by solver noise. Identical scene,
four engines: Rapier +0.05°, Matter +1.5°, Box2D v3 **-70.0°**, Planck **+72.4°**. Not
four bugs — one under-determined scene. See §4.

**4. A load on a lipless pan slides off the moment the pan tilts,** which removes the
imbalance the scale exists to show. The first version of the scale probe concluded
"Rapier settles level under a 25% overload" because the overload had slid onto the floor
and out of the world.

**5. `box2d3-wasm` silently ships you the scalar build.** Its entry point picks the SIMD
"deluxe" WASM only when `WebAssembly.validate(<simd probe>)` passes **and, in a browser,
`window.crossOriginIsolated === true`**. A Tauri WebView is not cross-origin-isolated
unless you add COOP/COEP to the custom-protocol response, so the default path takes the
slower build and says nothing. Its `b2CreateThreadedWorld` needs SharedArrayBuffer, so
the same gate applies.

**6. Embind getters allocate.** `b2Body_GetPosition()` returns a heap handle the caller
must `.delete()`. In a render loop that is one allocation per body per frame; it is why
Box2D v3's transform readback is 2.7x Rapier's. Related: nested value getters need
copy-mutate-assign — `shapeDef.material.friction = x` compiles, runs, and does nothing.

**7. Node's `--experimental-strip-types` is strip-ONLY.** Parameter properties
(`constructor(private w: World)`), enums, namespaces and decorators are hard load errors.
The whole repo tests this way, so it constrains every file here.

**8. A demo clock driven by the display runs at the wrong speed.** On a 120 Hz screen a
fixed-60 Hz `advance()` steps every *other* frame, so scene logic fed the display delta
runs at 2x. This looked exactly like a physics failure and was not.

**9. `advance()` must clamp.** A backgrounded WebView — iOS app switch, Android doze,
Tauri minimise — resumes with a delta of whole seconds. Without a clamp the world
simulates every missed step in one frame, which on a tablet is a multi-second freeze
indistinguishable from a crash.

**10. Author a gap between stacked boxes.** Boxes placed exactly touching start already
penetrating by the solver's linear slop, so frame 0 is spent pushing the pile apart —
which reads as the stack "breathing" before anyone touches it, and differs per engine.

**11. Pixel-space physics.** Matter is a screen-space engine (+y is **down**, the unit is
the pixel, `gravity.scale` is 1e-3). Every Box2D-family tolerance — linear slop 0.005,
sleep thresholds, speculative margins — is absolute and tuned for metres. A world built
at 1 unit = 1 pixel is a world 100x too big with invisible slop.

---

## 4. The balance scale — the equals sign

The brief singled this out. It took four rounds to get right and the last two changed the
design.

Building it the obvious way — a beam on a revolute pivot with two hanging pans — produces
a scale whose resting angle is decided by solver noise, because such a beam has no
restoring torque (trap 3). Raising the pivot above the beam's centre of mass supplies
one, and doubles as the legibility dial. Measured on Rapier, tilt under one extra unit in
four:

| `pivotRaise` | 0.00 | 0.05 | **0.15** | 0.30 | 0.60 |
|---|---:|---:|---:|---:|---:|
| tilt under +1 in 4 | -66.5° | -31.6° | **-17.8°** | -18.3° | -3.2° |
| tilt at true equality | -0.001° | 0.004° | **-0.015°** | -0.017° | 0.017° |
| jitter at equality | 0.000° | 0.000° | **0.000°** | 0.000° | 0.055° |

`bench/probe-kit-scale.mjs` then re-tuned against the **shipping recipe** — loose cubes
that are dropped in, bounce and slide, rather than an idealised contained slab. All 16
sampled combinations now meet both criteria (equality within 1°, imbalance past 6°), and
the default settles at **0.01° with 0.000° of jitter** and tips to its stop under one
extra unit.

A real balance has mechanical stops, and so does this one (`maxTiltDeg`, default 22).
Without them an imbalance runs the beam to vertical and puts the low pan through the
floor.

**And the rule that is not about physics.** `scale.compare()` returns `-1 | 0 | 1` from
an **integer comparison of what was put in the pans**. It never reads the beam angle, and
it is correct before a single step has run — there is a test that asserts exactly that,
including after the beam is forcibly rotated. The beam is how a child *sees* the
comparison; it is never how the app *knows* it. A curriculum claim must not depend on
contact ordering. This mirrors [ADR-0009](../../docs/DECISIONS/ADR-0009-stakes-without-loss.md)'s
"true by construction".

---

## 5. Aiming — the arc is the shot

Three ways to draw a predicted trajectory, each compared against where the ball actually
went over 2 s of free flight:

| method | max error |
|---|---:|
| symplectic Euler (`v += g·dt; p += v·dt`) | 125.01 mm |
| explicit Euler | 208.33 mm |
| the continuous parabola | 41.66 mm |

None is right, because none is what Rapier does — and all three become meaningless the
moment the shot touches anything. So the kit predicts by **stepping a real Rapier world**
containing the projectile and a mirror of the static scenery. Over 150 steps including a
bounce off the ground *and* a ricochet off a ramp:

**0.000000 mm divergence.** The dotted arc is the shot, by construction, bounces
included. A test asserts it every run.

It costs **0.70 ms** per 150-step prediction with the shadow world reused, so the kit
caches on the aim, caps steps at the tier's `predictSteps`, and stops the path at first
impact. Known limit, stated because it is silent: the shadow world holds **static**
geometry only, so an arc aimed through the player's own tower diverges when it gets
there. Games should stop drawing at `impact`.

`assist()` searches launch angles inside a caller-supplied window, returns the best with
its **own miss distance** so the caller decides whether to apply it, and returns `null`
rather than a wild guess when nothing gets close.

---

## 6. The budget the kit enforces

Measured in real Chrome on the actual demo, with CDP `Emulation.setCPUThrottlingRate`
standing in for slower silicon — `node bench/run-browser.mjs`.

At the **`mid` tier** (241 bodies, all awake — the heaviest scene, `pour`):

| CPU throttle | 1x | 4x | 8x | 10x | 12x | 16x |
|---|---:|---:|---:|---:|---:|---:|
| step p99 (ms) | 1.0 | 2.4 | 4.3 | 5.1 | 7.3 | 10.5 |
| frame p50 (ms) | 8.3 | 8.3 | 8.3 | 8.3 | 8.6 | 14.4 |
| fps | 120 | 120 | 120 | 120 | 116 | **69** |

Every other scene — 120 dominoes, a 24-link chain, a gear train, the siege — holds
120 fps at **8x** throttle with step p99 under 3.4 ms.

**The budget: physics gets 4 ms of a 16.67 ms frame, measured as step p99.**

That number is where `autoTune` drops a tier, and it leaves 12 ms for the renderer. At
the reference tier the heaviest scene stays inside it through 12x CPU throttling, which
is roughly 2-3x more headroom than the Galaxy Tab A9 should need — its Helio G99 is
around 4-6x slower single-threaded than this machine.

**Stated plainly: I did not run this on a Galaxy Tab A9.** CDP throttling inserts pauses;
it does not model a smaller cache or slower memory. The honest claim is "large measured
headroom against a proxy", and
[ADR-0004](../../docs/DECISIONS/ADR-0004-no-mic-no-llm-no-3d.md)'s revisit condition —
a measured frame budget on the actual device — is still owed. The rig to do it is here:
`?bench=<scene>&tier=<tier>` publishes `globalThis.__bench` from any browser pointed at
the demo, including one on a tablet.

### Degradation path

`src/tiers.ts`. Three knobs, because only three things cost frame time in a 2D scene.

| tier | bodies | solver iters | particles | predict steps | catch-up cap |
|---|---:|---:|---:|---:|---:|
| low | 120 | 4 | 90 | 60 | 3 |
| **mid** (the floor) | 260 | 4 | 200 | 90 | 4 |
| high | 500 | 8 | 400 | 120 | 5 |
| ultra | 900 | 12 | 800 | 180 | 6 |

`guessTier()` starts from `deviceMemory` and `hardwareConcurrency` — and deliberately
does not require `deviceMemory`, which Safari has never shipped, so an iPad falls through
to the concurrency path instead of landing on `low`. `autoTune()` then moves one tier at
a time from measured p99, dropping fast (a child is already seeing jank) and climbing
slowly (a momentary lull is not evidence).

---

## 7. The API

One line to a world that is already correct.

```ts
import { createWorld } from "@dynawalla/foundation-physics"

const w = await createWorld({ seed: 7 })        // tier auto-detected, WASM loaded once

w.ground()
const scale = w.balanceScale({ at: [0, 0] })    // pivot, stops and pan lips already right
scale.put("left", 4)
scale.put("right", 5)

function frame(dt: number) {
  const steps = w.advance(dt)                   // fixed step + interpolation + clamp
  draw(w.transforms, w.count)                   // [x, y, cos, sin] per body, no allocation
}

scale.compare()   // -1 | 0 | 1 — integer arithmetic, never the beam angle
```

Every recipe is one call and returns a small handle:

```ts
w.stack({ at: [4, 0], rows: 9 })
w.dominoes({ from: [-6, 0], to: [6, 0], count: 40 })
w.chain({ from: [0, 8], links: 24, load: 100 })          // load in link-masses
w.gearTrain({ at: [0, 4], teeth: [16, 32, 12], driveSpeed: 1.4 })
w.lever({ at: [0, 0], fulcrum: -0.3 })
w.softBlob({ at: [2, 6], radius: 0.8, firmness: 0.6 })
w.liquid({ at: [0, 9], count: 300 })                      // capped by the tier
const gun = w.launcher({ at: [-9, 5] })

gun.predict({ angle: 0.5, speed: 14 })   // { path, impact, impactStep } — exact
gun.assist(target, { from: playerAngle, window: 0.3 })    // or null
w.pin(a, b, anchorA, anchorB, [-limit, limit])            // local anchors, real stops

const rec = w.record();  rec.do("drop", x, y);  const tape = rec.stop()
replay(freshWorld, tape)                                   // bit-identical
```

Design rules the surface enforces rather than documents:

- **The tier caps you, not your optimism.** `liquid({count: 5000})` on `low` returns 90.
- **Truth is separate from spectacle.** `compare()`, `momentOf()`, `volumeIn()` and
  `fallenFraction()` are exact quantities; `tilt()` and `outline()` are explicitly view
  only.
- **Assemblies default to not self-colliding**, so trap 1 cannot be re-hit.
- **`advance()` takes the raw rAF delta** and returns the step count, so scene logic can
  run on simulation time rather than display time (trap 8).
- **`initPhysics()` is idempotent** — StrictMode double-mount cannot instantiate the WASM
  twice.

### Rendering

`src/view/three.ts` is a deliberately thin Three.js binding: 2D physics, **3D
presentation**. Bodies are extruded in Z and lit by a real key/rim/bounce rig, which is
where the production value comes from and costs the physics budget nothing.
`InstancedLayer` is one draw call per shape class, fed straight from the same
`Float32Array` the world already fills. `frameCamera()` fits a scene's world-space
rectangle to any aspect ratio, so a phone in portrait pulls back rather than cropping.
`SoftMesh` fills a soft body from its `outline()` — drawn as ring beads a pressurised
ring reads as a *donut*, because the hole is what the ring is holding open.

Three rendering traps were hit building the demo and are fixed in the binding, because
every prototype would otherwise hit all three:

- **`metalness` near 1 with no environment map renders black.** A metal has no diffuse
  term; its colour is entirely what it reflects. Brass gear teeth and a copper pan came
  out charcoal under four lights. Adding lights cannot fix it — only an environment can.
  `bazaarEnvironment()` pre-filters a procedurally generated `RoomEnvironment` once at
  startup (no texture to ship, CSP-safe) and it transformed the scene.
- **The two unit geometries do not share a convention.** `BoxGeometry(1,1,1)` spans
  -0.5..0.5 so a box scales by its *full* extents; `CylinderGeometry(1,1,1)` has *radius*
  1, so a disc scales by its radius. Scaling a disc by `r * 2` draws it at double size,
  silently — it put the camera inside the gear train.
- **Coplanar overlays z-fight.** Teeth exactly as deep as the gear blank stipple around
  the rim and read as a texture bug. Inset the overlay, matching the repo's existing
  "bake, do not overlay" lesson from `GAME_DEV_PLAYBOOK.md`.

---

## 8. Running it

```bash
npm install
npm test                     # 17 gates — every claim above that can be gated, is
npm run tsc
npm run demo                 # http://localhost:1425 — six scenes, live perf HUD

node bench/run-node.mjs --repeat 3     # the bake-off
node bench/probe-scale.mjs             # four engines x five pivot heights
node bench/probe-kit-scale.mjs         # tune the shipping recipe
node bench/probe-rope.mjs              # the chain mass-ratio cliff
node bench/probe-dominoes.mjs          # chain-reaction propagation vs friction
node bench/run-browser.mjs             # real Chrome, CPU-throttled  (needs npm run demo)
node bench/determinism.mjs             # V8 vs JavaScriptCore        (needs npm run demo)
```

`bench/run-browser.mjs --webkit` runs the same measurement in WebKit/JavaScriptCore, the
closest available proxy for iOS WKWebView.

## 9. What is still owed

1. **A real Galaxy Tab A9 run.** The rig exists; the device does not. This is
   ADR-0004's stated revisit condition and it is not satisfied by a proxy.
2. **Cross-architecture determinism.** Verified across three JS engines on arm64 only.
3. **Inside a Tauri WebView**, rather than a browser — in particular whether the custom
   protocol serves `.wasm` with a MIME type that allows
   `WebAssembly.instantiateStreaming`, which is worth an early check because the fallback
   path is slower and silent.
4. **The `-compat` → separate-`.wasm` switch** before shipping, worth ~200 KB gzip.
5. **Soft bodies and liquid are approximations** and say so: the liquid has no pressure
   term, so it pours and splits convincingly but will not self-level. If a game needs a
   true flat surface, draw the surface from the particle count and use particles only for
   the pour.
