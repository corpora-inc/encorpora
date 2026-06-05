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
  // sky + atmosphere + the distant vista silhouette.
  "wp-atmo",
  "wp-dome-",
  "wp-sky",
  "wp-vista",
  // HUD-ish overlays that already render depth-write-off above the world.
  "wp-roadarrow",
  "wp-beacon",
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
    if (dy < 0.25) return false
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
