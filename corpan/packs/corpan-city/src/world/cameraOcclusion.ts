import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh"
import type { Mesh } from "@babylonjs/core/Meshes/mesh"

/**
 * world/cameraOcclusion.ts — the SINGLE predicate deciding which meshes the
 * follow-camera must treat as SOLID OCCLUDERS (#59).
 *
 * The old camera fade + boom-collision used a hard-coded ALLOW list
 * (`wp-building-*` / `wp-r-*`). That missed market STALLS/AWNINGS, the BRIDGE,
 * boundary WALLS, and the fountain — so the camera jammed inside a market roof and
 * the player vanished behind opaque brown geometry. A whitelist can never keep up
 * with new world meshes.
 *
 * So instead we use a small DENY list: a mesh occludes the camera UNLESS it's a
 * known non-occluder — flat ground/water you look ACROSS, thin character
 * billboards, the sky/atmosphere, contact shadows, and the depth-write-off HUD
 * overlays (road arrow / objective beacon / glows). EVERYTHING ELSE with real
 * volume (buildings, roofs, props, stalls, the bridge, walls, fountain — present
 * AND future) is an occluder. New solid geometry is covered automatically.
 */

/**
 * The slimmest SOLID occluder we must still treat as real geometry: the streamed
 * city collapses every flat roof to a 0.2u CAP (`buildings.ts`). Anything shorter
 * than this is a flat ground decal / road-paint stamp the camera looks across.
 * BOTH the occluder predicate AND the fade-eligibility predicate key off this one
 * value — they drifted apart once (occluder lowered to catch the cap, fade left at
 * 0.25), which silently stranded the 0.2u caps un-fadeable so roofs the camera
 * looked over never went transparent (#87). Keep them ON THE SAME constant.
 */
const MIN_OCCLUDER_HEIGHT = 0.12

/** name prefixes that must NEVER count as camera occluders. */
const NON_OCCLUDER_PREFIXES = [
  // flat ground + water surfaces — the camera looks across them, never into them.
  "wp-city-ground-",
  "wp-ground",
  "wp-harbor",
  "wp-water",
  "wp-riverwalk-water",
  // CHARACTER billboards (player + crowd + ambient) — thin paper cutouts; fading
  // or "hitting" them would shove the camera around for nothing, and they don't
  // hide the player (they ARE characters). The contact shadows likewise.
  "wp-cut-", // createGroundedCutout planes/roots/shadows
  "wp-fig-", // 3D character figures (player + NPCs) — they ARE characters, never
  // occlude/pull the camera. Without this every walking figure registered as a
  // solid wall and its swinging limbs yanked the boom in → camera pulsed with the
  // walk. (The old paper billboards were excluded via wp-cut-; the 3D figures need
  // the same.)
  // sky + atmosphere + the distant vista silhouette.
  "wp-atmo",
  "wp-dome-",
  "wp-sky",
  "wp-vista",
  // HUD-ish overlays that already render depth-write-off above the world.
  "wp-roadarrow",
  "wp-beacon",
  "wp-obj-", // objective beacon (halo/pin/glow) — a floating HUD marker, never a
  // wall. Its bounding box clipped the boom ray as you walked → the camera pulsed.
  "wp-glow",
  // perf HUD / misc non-geometry.
  "wp-perf",
]

/**
 * Does this mesh block / hide the player from the camera? True for any solid,
 * visible, real-volume world mesh; false for ground/water/billboards/sky/overlays.
 */
export function isCameraOccluder(mesh: AbstractMesh): boolean {
  if (!mesh) return false
  // must be actually rendering + have geometry to occlude with.
  if (!mesh.isEnabled() || mesh.visibility <= 0.02) return false
  if (mesh.getTotalVertices?.() === 0) return false
  const name = mesh.name
  for (const p of NON_OCCLUDER_PREFIXES) if (name.startsWith(p)) return false
  // a flat, near-zero-height mesh (a decal/plane lying on the ground) can't trap
  // the camera — skip it so road paint / ground stamps never count.
  const bb = mesh.getBoundingInfo?.()?.boundingBox
  if (bb) {
    const dy = bb.maximumWorld.y - bb.minimumWorld.y
    // Real ground decals/road paint are ~0u tall; the slimmest SOLID occluder is
    // the simplified building roof cap (0.2u) — it MUST count, or roofs never fade
    // when the camera sits behind/inside them. `MIN_OCCLUDER_HEIGHT` guards decals
    // without dropping the cap.
    if (dy < MIN_OCCLUDER_HEIGHT) return false
  }
  return true
}

/**
 * Should the BOOM (camera-pull-in collision) treat this mesh as a solid wall to
 * keep the eye OUTSIDE of? A stricter subset of `isCameraOccluder`.
 *
 * THIN-INSTANCED props (market stalls, lamps, planters — one mesh = a whole
 * species, scattered across a chunk) carry a SINGLE UNION bounding box spanning
 * EVERY instance. A boom ray test against that union sees a giant phantom slab
 * filling the gaps between stalls, so the camera collapses onto the player the
 * instant it nears a market row (the player drops off the bottom of the frame) —
 * even though the actual canopies are mostly open air. So the boom SKIPS thin-
 * instanced meshes; their visibility is instead guaranteed by the per-OBJECT
 * FADE (`isCameraOccluder`), which dissolves the whole canopy species cleanly
 * when it stands between the camera and the player. Solid one-off geometry
 * (building bodies, roofs, the bridge, walls) still blocks the boom normally.
 */
export function isBoomBlocker(mesh: AbstractMesh): boolean {
  if (!isCameraOccluder(mesh)) return false
  const tc = (mesh as Mesh).thinInstanceCount
  if (typeof tc === "number" && tc > 0) return false
  return true
}

/**
 * Is this mesh a candidate for the camera-occlusion FADE? Same structural test as
 * `isBoomBlocker` (solid one-off occluder, not a thin-instanced species) — BUT
 * deliberately INDEPENDENT of the mesh's current `visibility`. The fade ITSELF
 * lowers `visibility` toward 0; if eligibility were gated on visibility (as
 * `isCameraOccluder` is, for the boom's benefit), a fully-faded building would stop
 * matching, get dropped from the fade's tracked set, and be stranded ghost-
 * transparent forever (its box collision still blocks you). So fade-eligibility is
 * about WHAT a mesh is, never its momentary opacity.
 */
export function isFadeEligible(mesh: AbstractMesh): boolean {
  if (!mesh) return false
  if (!mesh.isEnabled()) return false // NOTE: NOT gated on visibility — the fade owns it
  if (mesh.getTotalVertices?.() === 0) return false
  const name = mesh.name
  // The BRIDGE is a structure you TRAVERSE, not a building that hides you — and it
  // merged into ~4 big meshes, so fading it dissolves the WHOLE span the instant a
  // railing/arch passes between camera and player while you cross. Never fade it.
  if (name.startsWith("wp-bridge")) return false
  for (const p of NON_OCCLUDER_PREFIXES) if (name.startsWith(p)) return false
  const bb = mesh.getBoundingInfo?.()?.boundingBox
  if (bb) {
    const dy = bb.maximumWorld.y - bb.minimumWorld.y
    // SAME floor as `isCameraOccluder` (#87): the 0.2u flat roof cap MUST be
    // fadeable, or a roof the camera looks over never goes transparent and the
    // player stays hidden under it. (Was 0.25 — that stale gate WAS the regression:
    // the merge collapses roofs to 0.2u caps that 0.25 silently excluded.)
    if (dy < MIN_OCCLUDER_HEIGHT) return false
  }
  const tc = (mesh as Mesh).thinInstanceCount
  if (typeof tc === "number" && tc > 0) return false
  return true
}
