# World Plaza — Render Look Foundation

This is the **pluggable Look layer** for the World Plaza WORLD (ground, roads,
buildings, their materials and surface lighting tone). It is the seam the owner
asked for: the current 2.5D town is now *one* implementation of a small
interface, so the art direction can grow into fuller 3D by **adding an
implementation, not rewriting**.

> Scope. A "Look" owns the *static world's visuals* only. It does NOT own the
> engine/camera/render-loop (`src/world/engine.ts`), the characters (the cutout
> system — `src/render/cutout.ts`, `src/world/crowd.ts`, `src/character/*`),
> atmosphere (`src/world/atmosphere.ts`), shell, or gameplay. Those layer on top
> unchanged regardless of which Look is active.

---

## The interface

`src/render/worldLook.ts`

```ts
interface WorldLook {
  readonly id: LookId                       // "stylized" | "full3d" | …
  build(
    scene: BabylonScene,
    topology: RoomTopology,
    worldScene: WorldScene,
    onFrame?: (cb: (dt: number) => void) => () => void,
  ): { dispose(): void }
}
```

`build()` constructs the world and returns a handle whose `dispose()` tears down
**exactly** what it created. That's the whole contract — the renderer only ever
sees `{ dispose }`, so swapping looks never ripples outward.

### How the renderer uses it (API stayed stable)

`src/scene/sceneRenderer.ts` still exposes the same
`renderScene(babylon, topology, scene, onFrame)` that **`game.ts` already calls
— game.ts was not touched.** Internally it now just:

```ts
const look = selectLook(scene.lookId ?? "stylized")
const handle = look.build(babylon, topology, scene, onFrame)
return { interactables: [], byTag: new Map(), dispose: () => handle.dispose() }
```

`selectLook(id)` is the single registry seam. A Scene can carry a `lookId` to
pick its look as data; today everything resolves to the stylized look.

---

## Today's implementation: `createStylizedLook()`

The shipping 2.5D town, upgraded:

- **PBR surfaces** from `src/render/materials.ts` (`MaterialLibrary`): procedural
  normal-mapped **cobblestone** roads, **flagstone** plaza, **terracotta tile**
  roofs, **stucco** walls, **ashlar stone** parapets/steps. One shared material
  per surface for the whole town (~6 world materials total).
- **Depth-tiered ground** (`src/world/roads.ts`) so road strips never co-plane
  with the dirt — z-fighting killed by construction (see below).
- **Sloped / embedded roofs** (`src/world/buildings.ts`) so no roof face is ever
  coplanar with the body top or a parapet.
- Lit by the engine's existing `hemi`/`sun` rig (atmosphere tunes it warm); the
  PBR materials are dimmed (`directIntensity ≈ 0.62`, no IBL) so they sit in the
  warm Antigua-1770 diorama range instead of blowing out.

It is deliberately **one** implementation of `WorldLook`, not the interface.

---

## Growing into fuller 3D: `create3DLook()` (future)

A fuller-3D look slots in by implementing the **same** `WorldLook` interface —
no caller changes anywhere. Inside its own `build()` it would:

1. Load **glTF** building/prop meshes (or richer procedural 3D) instead of the
   box + facade-decal buildings, still keyed off `topology.blockers` / `anchors`
   (so the same map data drives it).
2. Reuse `MaterialLibrary` for untextured surfaces, **or** extend it with
   image-based albedo/normal/roughness/AO maps behind the *same* `PBRMaterial`
   — surfaces stay coherent across looks.
3. Optionally raise fidelity (shadow maps, an environment texture / IBL, SSAO),
   all **self-contained in the Look** and gated by `pickTier()` so phones stay
   at 60fps.
4. Return a `dispose()` that frees exactly what it created.

Register it in `selectLook()`:

```ts
export function selectLook(id) {
  switch (id) {
    case "full3d":  return create3DLook()      // ← add this line; nothing else changes
    default:        return createStylizedLook()
  }
}
```

The "bubble-people scenes / full glTF/PBR" direction is therefore additive: the
2.5D look becomes *just one option*, selectable per-Scene by data.

---

## How the z-fighting was killed at the root

The flicker was **coplanar faces fighting for the depth buffer**, not a tuning
problem. Two offenders, both fixed by construction (no nudge-patches):

### 1. Road strips coplanar with the ground — `src/world/roads.ts`

The old code stacked dirt, road strips, plaza disc and ring all at `y ≈ 0.012`.
Equal depth values → the GPU picks a winner per-frame arbitrarily → shimmer.

Fix: a strict **DEPTH TIER**. Each ground layer gets BOTH a distinct,
monotonically increasing world `Y` *and* a more-negative polygon `zOffset`:

| layer    | world Y | zOffset |
|----------|---------|---------|
| dirt     | 0.00    |  0      |
| road     | 0.03    | −2      |
| apron    | 0.045   | −3      |
| plaza    | 0.06    | −4      |
| ring     | 0.09    | (torus, true volume) |

No two ground meshes share a `(Y, zOffset)` pair, so no fight is possible. The
`Y` gap resolves oblique/top-down angles; the `zOffset` resolves the grazing
angles where the `Y` gap projects to sub-pixel depth. The plaza ring is a real
**torus** (a tube standing proud), not a coplanar strip, so it physically can't
fight the disc. `zOffset` is set only on materials used *solely* by the ground
(cobble/flagstone/dirt) so it never leaks into buildings.

### 2. Flat roof slabs coplanar with parapets / body top — `src/world/buildings.ts`

The old flat roof was a single slab whose top was coplanar with the parapet
boxes, and every roof's base sat exactly at `y = bodyH`, coplanar with the body
box top face. Fixes:

- **Embed every roof.** A roof's base is dropped `EMBED = 0.22` units *below*
  `bodyH`, so no roof face is ever coplanar with the body top (the overhang
  hides the seam; the body top ends up *inside* the roof volume).
- **Tier the flat roof.** It is no longer a bare slab: a lower wide slab + a
  smaller raised centre step (a real tiered terrace). The parapet sits **on top
  of** the lower slab (base above the slab top), never coplanar with the body.
- **Don't merge roofs into the body.** Roof/stone meshes are separate from the
  merged body mesh, so they carry their own real UVs (for terracotta/stone PBR
  tiling) and keep independent depth — boxes/prisms/cylinders with their own
  faces, no shared planes.

### Verification

`qa/flicker.mjs` holds a fixed grazing camera on the building street (worst case
for coplanar faces), grabs consecutive frames off the canvas, and counts pixels
that **hard-flip** frame-to-frame in a static roof crop. Result: **~0.001% (1 of
165,600 px)** — the residual is a drifting dust mote, not a depth fight. PASS.

---

## Materials — `src/render/materials.ts`

`MaterialLibrary` is a per-scene cache of shared `PBRMaterial`s, one per semantic
surface (`cobble`, `flagstone`, `dirt`, `terracotta`, `stucco`, `stone`). Each is
baked the easy way — **no asset dependencies**:

- An **albedo** canvas + a matching **normal-map** canvas are painted in
  lock-step (a stone painted on albedo gets its bump on normal at the same spot).
  Normal maps use the standard tangent encoding (flat = `rgb(128,128,255)`);
  domes/grooves push the R/G channels to carve relief that the sun then lights.
- Textures are small (256 lean / 512 full, `pickTier()`), MIP-mapped, and tile
  in **world space** — consumers rewrite mesh UVs (`tileUVs` in roads, the roof
  UV helpers in buildings) so a long street and a short apron show the *same*
  stone size from one shared texture.
- `metallic = 0`, roughness per surface, no IBL, dimmed direct response, a
  whisper of emissive so deep shadow stays warm — tuned to the cutout-lit rig.

A future image-based pipeline swaps the procedural bake for loaded maps behind
the identical `PBRMaterial` — Looks never assume procedural sourcing, only that
the library hands them a ready material by name.

---

## Perf

Full grand town (28 buildings + dressing + 28 wandering cutout characters),
1280×800 webkit: **sustained 58–60 fps** while walking + orbiting
(`qa/perf.mjs`), ~86 active meshes, ~9.4k verts. The PBR materials add no
draw-call growth (shared) and the normal maps are cheap per-pixel; the budget is
unchanged from the flat-paper baseline.

## QA scripts

- `qa/look.mjs` — walks a cobblestone street, orbits to oblique angles, shoots
  `/tmp/wp-look-*.png`.
- `qa/flicker.mjs` — fixed grazing-angle z-fight proof (roof crop, hard-flip %).
- `qa/perf.mjs` — sustained-fps sample while walking + orbiting the grand town.
- `qa/buildings.html` + `qa/buildings-mount.ts` — standalone building street with
  the `MaterialLibrary` wired in (orbit harness, `window.__wpBuildings`).
