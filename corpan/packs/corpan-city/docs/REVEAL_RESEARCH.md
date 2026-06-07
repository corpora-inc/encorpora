# Premium Building Reveal — R&D

**Status:** research + plan, then SPIKED. Author: `reveal-rd`. Date: 2026-06-04.

> **SPIKE UPDATE (2026-06-04).** Option A was greenlit and implemented as a spike.
> See [§ Spike results](#spike-results-option-a-implemented) at the bottom — the
> effect works, the de-risk gate (billboards riding the curve) PASSED, and the
> screenshots prove the over-the-hill crest. New code: `src/world/curvature.ts`
> (the global material plugin) + `qa/curvature.{html,mjs}` + `qa/curvature-mount.ts`
> (before/after WebKit harness). No world-fix-owned files touched.

## The problem (owner's words)

> The way buildings POP IN as you walk is "doing OK for performance but it's not
> best-game-ever level, it's oh-ok-not-so-bad demo level." I want something
> REVOLUTIONARY — buildings "sort of get made over the horizon and then come into
> view," a "zany earth-curvature thing where things come into view like they were
> just over the hill," an "illusion of topology" to make it premium.

So the deliverable is not "stream faster." It's **hide the streaming boundary
behind a beautiful, intentional reveal** — ideally one that lets us stream LESS
aggressively (fewer chunks resident, smaller `visibilityRadius`) because the far
edge is *supposed* to be hidden.

## How our world is built today (the constraints any reveal must respect)

Read of the live code (`src/city/stream.ts`, `chunkMesh.ts`, `cityGround.ts`,
`world/engine.ts`, `world/atmosphere.ts`, `world/vista.ts`, `render/cutout.ts`,
`map/minimap.ts`, `render/materials.ts`):

- **Streaming = build-once + proximity visibility.** Every chunk of the whole
  city is built in the background under a ~5ms/frame budget and kept for the
  session. A coarse pass every `passInterval` (0.12s) toggles each built chunk's
  root `setEnabled(true/false)` by a hard `visibilityRadius` (~150u). **That hard
  on/off toggle is exactly what "pops."** A chunk crosses the radius and its whole
  subtree appears in one frame.
- **The "pop" is a visibility snap, not a build hitch.** The build hitch was
  already engineered away (per-building time-slicing, shared caches, 123MB no-hitch
  baseline). What remains is the *binary enable* of an already-built chunk. Good
  news: that means the reveal layer is **cosmetic** — we are dressing the moment a
  resident chunk turns on, not racing the GPU.
- **Two material families, all shared.** Buildings + ground use a shared
  `PBRMaterial` library (`render/materials.ts`, ~6 world materials total).
  Characters, props, vista use `StandardMaterial`. **There is no per-mesh material
  churn** — which is the single most important fact for the curvature option: a
  *global* shader injection touches all of them at once.
- **Camera** (`world/engine.ts`): scripted third-person cruise cam, low + flat,
  looking out toward the horizon. `minZ=0.8`, `maxZ=380`. There IS already
  exponential fog (`world/atmosphere.ts`, `FOGMODE_EXP2`, density ~0.009) tinted to
  the horizon haze band, plus a painted sky dome and a far billboard `vista`.
- **Billboards everywhere.** Characters/props/vista are yaw-billboard planes
  (`BILLBOARDMODE_Y`) grounded at `y=0` via `render/cutout.ts`. Contact shadows are
  flat ground decals welded to the feet. **This is the #1 gotcha for curvature** —
  see §1.
- **Collision + minimap are pure 2D/XZ.** `StreamingCollision` rebuilds an
  `ObstacleField` from NEAR chunks; the minimap projects world XZ to a 2D card.
  Neither knows or cares about vertex Y. **This is the saving grace for curvature:**
  a curvature shader that only bends Y *at render time* leaves collision + the
  minimap correct for free (they already operate on flat XZ).

---

## The options (ranked)

### Option A — World-curvature vertex shader (the owner's exact idea) ⭐ TOP PICK

**The illusion.** The ground curves away from you in every direction like the
surface of a small planet. Distant buildings sit *below* the horizon line — you
literally cannot see them — and as you walk toward them they **rise up over the
hill** into view. The streaming radius is hidden because anything past the bend is
geometrically under the horizon; it doesn't need to "fade in," it *crests*.

This is the Animal Crossing / The Witness / endless-runner "curved world" effect.
It is the single technique that delivers the owner's three asks at once:
"made over the horizon," "just over the hill," "illusion of topology."

**How it works (math).** A vertex shader offsets every vertex's world Y downward
as a function of its squared horizontal distance from the camera. Canonical form
(Aitchison, the reference implementation):

```glsl
// world-space, camera-relative
vec3 cv = worldPos.xyz - cameraWorldPos.xyz;
// spherical roll-off (bends away in X AND Z — a dome, not a cylinder)
float drop = (cv.x*cv.x + cv.z*cv.z) * curvature;   // curvature < 0 → sinks down
worldPos.y -= drop;
```

`curvature` around **0.0008–0.0025** for our scale (the Unity/Godot ports use
"Amount" 0.005–0.1 but on smaller object-space worlds; ours is metric world units
over a ~150–300u view, so it's smaller — tune live). At 150u the drop is
`150² × 0.0015 ≈ 34u`, more than enough to sink a 12u building fully below the
horizon. The roll-off is quadratic, so near you it's nearly flat (gameplay reads
normal) and it accelerates with distance (the dramatic crest).

Use the **squared** form (no `sqrt`) — it's cheaper and gives the parabolic
"falling away" curve. The `(x² + z²)` spherical variant bends in all directions so
it works regardless of which way the cruise cam faces; the cheaper `z²`-only
cylindrical variant assumes a forward axis and would look wrong as you turn — **we
want spherical.**

**Babylon implementation approach — `MaterialPluginBase` + `RegisterMaterialPlugin`
(global).** This is the clean, stack-correct path and the reason this option is
*lower effort than it looks*:

- Babylon 5+ (we're on 6.48) ships the **Material Plugin** system. A
  `MaterialPluginBase` subclass can inject GLSL into ANY material's shader at named
  hook points via `getCustomCode(shaderType)`, returning
  `{ CUSTOM_VERTEX_DEFINITIONS: "...", CUSTOM_VERTEX_UPDATE_POSITION: "..." }`.
  `CUSTOM_VERTEX_UPDATE_POSITION` runs in the vertex shader right where the world
  position is computed — exactly where we bend Y.
- **`RegisterMaterialPlugin("WorldCurve", mat => new WorldCurvePlugin(mat))`
  attaches the plugin to EVERY material as it's instantiated** — PBR *and*
  Standard, buildings *and* ground *and* billboards — with zero per-mesh wiring.
  One registration, whole world bends. (This is why our "all materials shared, no
  churn" architecture matters: we don't have to find and touch each material.)
- Uniforms: declare `curvature` + `cameraPos` via the plugin's `getUniforms()`;
  push the live camera ground position each frame in `bindForSubMesh()` (or, even
  simpler, use Babylon's built-in `vEyePosition` uniform that materials already
  have, avoiding a per-frame bind entirely — verify it's available at the PBR +
  Standard vertex stage; if so, the plugin needs *no* JS per-frame work at all).

This avoids forking `materials.ts` or writing `ShaderMaterial` clones of PBR (the
forum's naive route, which loses PBR lighting). The plugin is **purely additive
vertex math** layered on the existing materials.

**Perf cost.** Negligible. A handful of extra ALU ops per vertex in shaders that
already run. No new draw calls, no new passes, no new textures. It can *reduce*
total cost by letting us shrink `visibilityRadius` (fewer enabled chunks) since the
far ones are hidden under the horizon anyway.

**Effort: M.** The shader + plugin is small (a day). The effort is in the
**gotchas**, which are real but all have known fixes:

1. **Billboards must curve too, or they "float."** Characters/props/vista are
   billboard planes anchored at `y=0`. If the ground under a distant NPC sinks 30u
   but the NPC plane stays at `y=0`, it floats in the sky. **Fix:** the global
   material plugin already bends their material's vertices by the same world-Y
   formula, so the *whole plane* (including its grounded base) sinks with the
   terrain — they ride the curve for free. The one subtlety: a billboard rotates to
   face camera, so apply the curve to the **post-billboard world position** (which
   `CUSTOM_VERTEX_UPDATE_POSITION` already operates on). Verify the contact-shadow
   decals (also `y≈0.02` ground planes, same material path) sink identically — they
   should, since they're on the same plugin. **This is the make-or-break test.**
2. **Collision stays FLAT — and that's correct.** The bend is render-only (vertex
   shader); `StreamingCollision` works on XZ AABBs and never sees Y. The player
   walks a flat plane while the *picture* curves. This is the standard curved-world
   contract and it's exactly what we want (no gameplay change). No work needed —
   it's already decoupled.
3. **Minimap stays FLAT — also correct.** `map/minimap.ts` projects world XZ; it's
   unaffected and *should* be (a top-down schematic isn't curved). No work needed.
4. **Frustum culling vs. displaced verts.** Babylon culls on the CPU using
   un-displaced bounding boxes. A chunk bent 30u down could be culled while still
   visibly cresting, or vice-versa. **Fix:** our chunks are visibility-gated by
   *proximity*, not frustum, and the dramatic displacement only happens far away
   where we either (a) keep them enabled a bit longer, or (b) set
   `mesh.alwaysSelectAsActiveMesh = true` / inflate bounding info on the near ring.
   Lower-risk than the Unity case because we already don't frustum-gate chunk
   lifetime. Budget a small pass to extend the enable radius so a chunk is resident
   *before* it crests.
5. **Sky dome + fog interplay.** The dome is `infiniteDistance` + `applyFog=false`
   and should NOT curve (exclude it from the plugin, or it already won't matter
   since it's camera-locked at the far plane). The existing fog actually *helps* —
   it softens the exact horizon line where geometry crests, so the bend reads as
   atmospheric distance, not a hard math edge. Keep fog; retune density to sit the
   haze right at the crest line.
6. **The vista billboard** (`world/vista.ts`) is parked at radius 360 with its base
   on `y=0`. Under curvature it would sink below the horizon and vanish. **Fix:**
   exclude the vista from the plugin (it's meant to be the *one* thing always
   visible on the far horizon — the hero peak you walk toward), OR lift it so its
   base rides the curve. Excluding it is cleaner and on-theme: the curved world
   makes the town crest into view while Mt. Fuji stands eternal behind it.

**Risk:** the billboard-grounding test (gotcha #1) is the gate. If billboards ride
the curve cleanly (high confidence, since they're on the same material path), this
is a slam dunk. Build a 1-hour spike that registers the plugin and walks the city
before committing.

---

### Option B — Atmospheric horizon reveal (fog + low haze band) — KEEP, as the partner layer

**The illusion.** Chunks fade in *through* a band of haze at the horizon instead of
popping. We already have most of this: EXP2 fog tinted to the horizon, a painted
sky dome with a haze band, a baked-haze vista.

**What's missing for "premium":** the current fog reveals geometry as a soft
gradient, but a chunk still *enables* binarily — fog only masks it if the chunk
turns on while still deep in the haze. **Fix:** widen the gap between
"chunk-enabled distance" and "fog-fully-opaque distance" so every chunk switches on
while it's still ~90% dissolved in haze, then resolves as you approach. This is a
pure tuning change (raise `visibilityRadius` slightly OR raise `fogDensity` so the
fog wall sits inside the enable radius) plus optionally a **per-chunk alpha
fade-in** over ~0.4s when it enables (Option C).

**Babylon approach.** Tuning only for the fog half. Already implemented in
`atmosphere.ts`. No new systems.

**Perf cost.** Zero (retune existing fog).

**Effort: S.** This is the cheap safety net and the **natural partner to A**: fog at
the crest line is what makes the curvature read as *distance* rather than a visible
math bend. Recommend shipping B's retune **with** A.

**Risk.** On its own, fog alone is "nicer pop-in," not "revolutionary." It doesn't
deliver the over-the-hill topology. It's a multiplier on A, not a replacement.

---

### Option C — Dithered / alpha LOD fade-in per chunk

**The illusion.** When a chunk enables, it fades in (alpha ramp 0→1 over ~0.3–0.5s)
or screen-door dithers in, instead of snapping. Removes the *hard* edge of the
visibility toggle.

**Babylon approach.** On `setVisible(true)`, ramp `material.alpha` or `mesh.
visibility` 0→1 over time. **Problem:** our chunk materials are *shared across all
chunks* (the whole point of the cache). Animating `material.alpha` would fade every
chunk at once. To fade per-chunk you'd need either (a) per-chunk material clones
(kills the shared-material memory win — regression), or (b) a **screen-door /
dither** alpha in the same global material plugin keyed by a *per-chunk* uniform or
per-vertex "fade" attribute, discarding pixels below a moving threshold (no extra
materials, no transparency sort cost). Dither is the right call here because it
needs no alpha blending and composes with the curvature plugin (same injection).

**Perf cost.** Dither: ~free (one compare + discard in the fragment shader).
Alpha-blend fade: adds transparency sorting for fading chunks (transient).

**Effort: M** (must thread a per-chunk fade value through the shared material via
the plugin or a vertex attribute; can't just animate `material.alpha`).

**Risk.** Without curvature, a fade-in is still "stuff appearing in front of you" —
better than a hard pop but not topological. **Best used as polish on A** for the
near ring (chunks that enter the enable radius before fully cresting can dither up
the last 10%). Not a standalone answer.

---

### Option D — "Grow from the ground" build-up animation

**The illusion.** A chunk's buildings rise/scale up out of the ground when it
activates (SimCity / Clash-of-Clans plop).

**Assessment.** Charming but **wrong for this game.** It draws attention TO the
streaming boundary instead of hiding it (the opposite of the goal), reads as
stylized/cartoony rather than "premium real world," and animating per-building
scale fights our build-once + shared-instance model. **Reject** as the primary
mechanic. (A *very* subtle version could be a fallback for the rare chunk that
enables in full view, but Option A makes that case nearly impossible.)

---

### Option E — Terrain undulation / gentle real hills

**The illusion.** Real low-frequency height on the ground so the streaming boundary
hides behind actual rises — genuine topology, not a shader trick.

**Assessment.** This is the "real" version of A's illusion, and the most expensive:

- Our ground is **deliberately flat merged quads at y=0** baked per chunk
  (`cityGround.ts`), and the §2 z-fight rule + road-baking all assume a flat plane.
- Collision, prop placement, building footings, the minimap, and pathing all assume
  `y=0`. Real hills mean a heightfield that *everything* must sample — a deep change
  to collision (`world/collision.ts`), placement (`stationing.ts`), and the cutout
  grounding contract (feet at `y=0`).
- It does NOT compose with the cruise camera's flat look-out rig without rework.

**Effort: L (maybe XL).** High value for "feels like a real place," but it's a
world-systems project, not a reveal effect. **Defer.** Option A delivers ~80% of the
*visual* payoff (the horizon crest) with ~10% of the cost, because it fakes the
topology in the vertex shader while keeping the world flat for every gameplay
system. Revisit E only if we later want walkable verticality.

---

### Option F — Distant impostors (cheap far billboards → resolve to 3D)

**The illusion.** Far buildings render as flat silhouette billboards (1 draw each,
or one merged atlas), swapping to full 3D as you approach.

**Assessment.** This is a **streaming/perf** technique, not a reveal aesthetic — it
hides pop-in by making the far thing already present but cheap. Real value, but:

- We already keep the whole city **built and resident** (build-once); impostors
  would be a *parallel* far representation, adding complexity and memory, not
  removing it. The perf problem this solves (too much far geometry) isn't our
  current bottleneck (123MB, no hitch).
- The swap from impostor→3D is itself a pop that needs hiding — so you'd *still*
  want A's curvature or C's dither to mask the swap.

**Effort: L.** **Defer.** If a much bigger city later blows the resident-geometry
budget, impostors become the answer for the far field — and they compose beautifully
*under* curvature (the impostor is what you see cresting the hill, swapping to 3D as
it rises). Note it as the natural "phase 2" once curvature ships.

---

## Recommendation

**Ship Option A (world-curvature vertex plugin) as the hero, with Option B
(fog/haze retune) as its built-in partner, and Option C (dither) reserved as
near-ring polish.**

This is the **premium stack**: *curvature + horizon fog*. Curvature delivers the
owner's literal vision (buildings made over the horizon, cresting the hill,
illusion of topology); fog makes the crest read as atmospheric distance rather than
a visible bend; dither cleans up the rare in-view enable. It's **M-effort**, **near-
zero perf cost**, *reduces* streaming pressure, and — critically — leaves
collision, the minimap, prop placement, and the build-once streaming model
**completely untouched** because the bend is render-only on a world that stays flat
for gameplay. D and E and F are explicitly deferred (D wrong-goal; E/F are
world-systems/perf projects, not reveal effects, and both compose *under* A later).

The whole bet rides on one spike (gotcha #1): do billboards + contact shadows ride
the curve cleanly via the same global plugin? High confidence yes. Validate before
committing.

---

## Implementation sketch (top pick — enough to start)

**New file: `src/world/curvature.ts`** — a self-contained, disposable system that
registers ONE global material plugin and feeds it the camera position. Mirrors the
shape of `applyAtmosphere()` (apply to a finished scene, return `dispose()`).

```ts
import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase"
import { RegisterMaterialPlugin, UnregisterMaterialPlugin } from "@babylonjs/core/Materials/materialPluginManager"
// (verify exact import paths against 6.48 tree-shaking entry points)

const NAME = "WorldCurve"

// Per-material plugin instance. Enabled for every material; injects the bend.
class WorldCurvePlugin extends MaterialPluginBase {
  constructor(material) {
    // priority 200 = after most built-ins; enabled=true; isEnabled toggleable
    super(material, NAME, 200, { WORLD_CURVE: false })
  }
  // turn the #define on
  prepareDefines(defines) { defines.WORLD_CURVE = true }

  getUniforms() {
    return {
      ubo: [{ name: "wcCurvature", size: 1, type: "float" },
            { name: "wcCenter", size: 3, type: "vec3" }],
      vertex:
        "uniform float wcCurvature;\nuniform vec3 wcCenter;\n",
    }
  }

  bindForSubMesh(ubo /*, scene, engine, subMesh */) {
    ubo.updateFloat("wcCurvature", CURVATURE)     // ~ -0.0015, tune live
    ubo.updateVector3("wcCenter", CENTER)         // camera ground pos, set per frame
  }

  getCustomCode(shaderType) {
    if (shaderType !== "vertex") return null
    return {
      // runs where worldPos is known; bend Y by squared XZ distance from camera
      CUSTOM_VERTEX_UPDATE_POSITION: `
        #ifdef WORLD_CURVE
          vec3 wcRel = (finalWorld * vec4(positionUpdated, 1.0)).xyz - wcCenter;
          float wcDrop = (wcRel.x*wcRel.x + wcRel.z*wcRel.z) * wcCurvature;
          positionUpdated.y += wcDrop; // wcCurvature negative → sinks with distance
        #endif
      `,
      // NOTE: exact injectable symbol names (positionUpdated / finalWorld) must be
      // confirmed against Babylon 6.48 shader source for BOTH PBR and Standard —
      // the vertex hook variables differ slightly. If finalWorld isn't in scope at
      // the chosen hook, use CUSTOM_VERTEX_MAIN_BEGIN with the world matrix uniform.
    }
  }
}

export function applyWorldCurvature(scene, getCameraGroundPos) {
  // ONE registration → attaches to every PBR + Standard material on creation.
  RegisterMaterialPlugin(NAME, (material) => new WorldCurvePlugin(material))
  // feed the live camera center each frame (cheap; or use built-in vEyePosition
  // and drop this loop entirely if it's in vertex scope for both materials).
  const obs = scene.onBeforeRenderObservable.add(() => {
    const p = getCameraGroundPos(); CENTER.set(p.x, 0, p.z)
  })
  return {
    dispose() {
      scene.onBeforeRenderObservable.remove(obs)
      UnregisterMaterialPlugin(NAME)
    },
  }
}
```

**Wiring (in `game.ts`, next to `applyAtmosphere`):**

```ts
const curve = applyWorldCurvature(scene, () => playerGroundPos)
// exclude the camera-locked sky dome + the hero vista from bending:
//   set plugin.isEnabled = false on those two materials after they're built,
//   or skip them in the RegisterMaterialPlugin factory by name.
```

**Then, with curvature live:**

1. **Spike first (gotcha #1):** register the plugin, walk the city, confirm distant
   billboard NPCs/props + their contact shadows **sink with the ground** and crest
   correctly. This is the go/no-go.
2. **Exclude** sky dome (`wp-atmo-*-dome`) and vista (`wp-vista-*`) from the plugin.
3. **Tune `CURVATURE`** (~-0.0008 to -0.0025) so a building ~150u out is just below
   the horizon from the cruise cam and crests smoothly as you close.
4. **Retune fog** (`atmosphere.ts`): sit the haze band at the crest distance so
   chunks resolve out of atmosphere as they rise (Option B, free).
5. **Extend the enable radius** slightly past the crest distance (gotcha #4) so a
   chunk is resident *before* it should appear over the hill — then optionally
   **shrink** the effective visual radius via curvature, netting fewer visible
   chunks for the same or better perf.
6. **(Optional polish, Option C)** add a per-chunk dither-up in the same plugin for
   any chunk that enables while already above the horizon (rare once curvature is
   on).

---

## References

- Animal Crossing curved-world shader (canonical math, verbatim GLSL) — Alastair
  Aitchison: https://alastaira.wordpress.com/2013/10/25/animal-crossing-curved-world-shader/
- World Bending Effect tutorial (curvature + the culling-matrix gotcha) — NotSlot:
  https://notslot.com/tutorials/2020/04/world-bending-effect
- Curved/rolling horizon shader discussion (spherical vs cylindrical, theta form) —
  Bevy #10062: https://github.com/bevyengine/bevy/discussions/10062
- Babylon.js curved-world vertex shader thread (our exact stack) — Babylon forum:
  https://forum.babylonjs.com/t/implementing-a-curved-world-vertex-shader/5856
- Babylon Material Plugins (RegisterMaterialPlugin, getCustomCode, vertex hooks):
  https://doc.babylonjs.com/features/featuresDeepDive/materials/using/materialPlugins
- `RegisterMaterialPlugin` API:
  https://doc.babylonjs.com/typedoc/functions/BABYLON.RegisterMaterialPlugin
- Screen-door / dither transparency (Option C):
  https://digitalrune.github.io/DigitalRune-Documentation/html/fa431d48-b457-4c70-a590-d44b0840ab1e.htm
- Reference Unity recreation (shader-graph, distance² roll-off) — skylarbeaty:
  https://github.com/skylarbeaty/curved-world
- HD-2D depth/fog aesthetic context (Octopath II) — Unreal dev interview:
  https://www.unrealengine.com/en-US/developer-interviews/octopath-traveler-ii-builds-a-bigger-bolder-world-in-its-stunning-hd-2d-style

---

## Spike results (Option A implemented)

**What was built (minimal, additive, no world-fix-owned files touched):**

- `src/world/curvature.ts` — the global world-curvature material plugin. ONE
  `RegisterMaterialPlugin("WorldCurve", …)` attaches a `MaterialPluginBase` to
  every PBR + Standard material; it injects at **`CUSTOM_VERTEX_UPDATE_WORLDPOS`**
  (where Babylon has `worldPos = finalWorld*vec4(positionUpdated,1.0)`, right
  before `gl_Position = viewProjection*worldPos`) and bends:
  `worldPos.y += (dx²+dz²)*curvature` with the roll-off centre = the player
  ground pos (fed per-frame). It also nudges `vPositionW.y` (under `#ifdef NORMAL`)
  so lighting/fog agree. Sky dome + hero vista are auto-excluded by name.
  `DEFAULT_CURVATURE = -0.0016`; live `setCurvature()` dial.
- `qa/curvature-mount.ts` + `qa/curvature.html` + `qa/curvature.mjs` — boots the
  REAL streaming city + atmosphere + vista + ambient billboard paper-people with
  the plugin on, and shoots matched **flat (0) vs bent (default)** pairs in WebKit
  (the macOS WKWebView the app ships in), plus a curvature strength sweep and the
  de-risk gate readout. Run: `node qa/curvature.mjs`.

**Injection-point finding (load-bearing).** `CUSTOM_VERTEX_UPDATE_POSITION`
(named in the original sketch) runs BEFORE `finalWorld` exists, so it can't see
world space. The correct hook is `CUSTOM_VERTEX_UPDATE_WORLDPOS` — verified
present + identical in BOTH `pbr.vertex` and `default.vertex` (Standard). Bending
`worldPos` there drives `gl_Position` directly. (Sketch in §A's code corrected.)

**DE-RISK GATE — PASSED.** The make-or-break question (do yaw-billboard
paper-people + contact shadows ride the curve, or float?) is answered YES, both
analytically and visually. Because the plugin bends FINAL world position
(post-billboard, post-instancing), a cutout's feet at (x,0,z) get the **exact same
drop** as the ground quad at (x,0,z). The harness confirms
`billboardFeetDrop === groundDropUnderBillboard` (e.g. both -1.37u at 29u out),
and the screenshots show NPCs planted on the slope, not hovering.

**Look (the owner's call to make).** Screenshots `/tmp/wp-curve-*`:
- `wp-curve-{avenue,deep,cross}-{flat,bent}.png` — before/after. Flat = today's
  flat plane with a high horizon + hard far edge. Bent = the ground **crests like
  a hill**, the horizon drops, and buildings sit ON the crest cresting into view.
  The cross (yaw 90°) pair proves the spherical bend works in every facing.
- `wp-curve-sweep-*.png` — strength ladder. **-0.0016 (default) is the sweet
  spot:** a clear, premium hill crest, dramatic but not dizzying. Below ~-0.0008
  it's a subtle hint; above ~-0.0026 it goes "tiny-planet," and by **-0.004 the
  over-bend makes a billboard BEYOND the crest visibly float** (its feet are on
  ground curved away below the horizon, so it peeks too high). Recommended usable
  range: **-0.0008 … -0.0026**, ship at -0.0016.

**Perf.** No measurable curvature penalty. Headless software-GL WebKit fps was
noisy (31–45) with the bent-vs-flat variance SMALLER than run-to-run variance of
identical configs — i.e. lost in the noise, exactly as predicted for a few
ALU-ops/vertex with no new passes/draws/textures. On a real GPU this is free.
(Caveat to confirm on-device: bending verts can defeat CPU frustum culling on the
near ring — gotcha #4 — so the full build should extend the enable radius slightly
and/or `alwaysSelectAsActiveMesh` the near chunks. Deferred from the spike.)

**Remaining for the full build (not in the spike):**
1. Wire `applyWorldCurvature` into `game.ts` next to `applyAtmosphere` (world-fix
   owns game.ts — coordinate). Centre = the live player ground pos.
2. Frustum-cull robustness on the near ring (gotcha #4) + retune fog to sit the
   haze at the crest line (Option B, free).
3. Shrink `visibilityRadius` to bank the perf the hidden-horizon allows.
4. Optional: per-chunk dither for any chunk that enables above the horizon (rare).
