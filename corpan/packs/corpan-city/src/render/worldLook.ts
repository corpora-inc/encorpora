import type { Scene as BabylonScene } from "@babylonjs/core/scene"
import type { RoomTopology, Scene as WorldScene } from "@corpan-city/contracts"
import { buildRoads } from "../world/roads"
import { createBuildings } from "../world/buildings"
import { dressWorld } from "../world/dressing"
import { createGround } from "../world/billboard"
import { MaterialLibrary } from "./materials"

/**
 * worldLook.ts — the PLUGGABLE LOOK LAYER for Corpan City's WORLD.
 *
 * WHY THIS EXISTS
 * ---------------
 * The owner wants to keep growing the art direction toward fuller 3D WITHOUT
 * rewriting the renderer each time. So "how the world is rendered" is now a
 * swappable strategy behind one small interface. The scene renderer composes a
 * world by asking a `WorldLook` to build it; the rest of the game (movement,
 * cutout characters, atmosphere, shell) is unchanged regardless of which Look
 * is active.
 *
 * THE CONTRACT (intentionally tiny)
 * ---------------------------------
 *   build(scene, topology, worldScene, onFrame) -> { dispose }
 *
 * A Look OWNS exactly the WORLD's static visuals: ground / roads / buildings,
 * their materials, and the surface-level lighting *tone* (it MAY retune the
 * engine's named "hemi"/"sun" lights for its surfaces; atmosphere.ts owns sky/
 * fog/vignette and is layered on top). A Look does NOT own:
 *   • the engine / camera / render loop (engine.ts),
 *   • characters (the cutout system: cutout.ts / crowd.ts / character/*),
 *   • atmosphere (atmosphere.ts), shell, gameplay.
 * This keeps Looks orthogonal to everything else.
 *
 * CURRENT IMPLEMENTATION: `createStylizedLook()`
 * ----------------------------------------------
 * The shipping 2.5D look, upgraded: PBR cobblestone / terracotta / stucco /
 * flagstone surfaces (procedural normal-mapped materials from materials.ts) on
 * the existing box-and-prism buildings, with the ground depth-tiered to kill
 * z-fighting. It is deliberately ONE implementation of the interface, not the
 * interface itself.
 *
 * GROWING INTO FULLER 3D: `create3DLook()` (future)
 * -------------------------------------------------
 * A future fuller-3D look slots in by implementing the SAME interface — no
 * caller changes. It would, inside its own `build()`:
 *   • load glTF building/prop meshes (or richer procedural 3D) instead of the
 *     box+facade-decal buildings, still keyed off `topology.blockers`/`anchors`;
 *   • reuse `MaterialLibrary` (or extend it with image-based albedo/normal/
 *     roughness maps behind the same `PBRMaterial`) so surfaces stay coherent;
 *   • optionally raise rendering fidelity (shadow maps, an env texture / IBL,
 *     SSAO) — all SELF-CONTAINED in the Look, gated by `pickTier()`;
 *   • return a `dispose()` that tears down exactly what it created.
 * Because the renderer only ever sees `{ dispose }`, swapping looks is a
 * one-line change (which factory to call) — or a data-driven choice keyed off
 * the Scene (e.g. `worldScene.lookId`). The 2.5D look becomes "just one option."
 *
 * The renderer can pick a Look by id; today there is one. `selectLook()` is the
 * single seam a future look is registered behind.
 */

export type LookId = "stylized" | "full3d"

export interface WorldLookHandle {
  dispose: () => void
}

export interface WorldLook {
  readonly id: LookId
  /**
   * Build the static world over a topology + scene skin. `onFrame` is the
   * engine's per-frame bus (some looks animate water/flags/etc.).
   */
  build(
    scene: BabylonScene,
    topology: RoomTopology,
    worldScene: WorldScene,
    onFrame?: (cb: (dt: number) => void) => () => void,
  ): WorldLookHandle
}

type OnFrame = (cb: (dt: number) => void) => () => void

const isDecorBlocker = (topology: RoomTopology, b: { x: number; z: number; w: number; d: number }) =>
  topology.anchors.some(
    (a) => a.role === "decor" && Math.abs(a.x - b.x) <= b.w / 2 && Math.abs(a.z - b.z) <= b.d / 2,
  )

/* ---------------------------------------------------------- stylized look */

/**
 * createStylizedLook — the current 2.5D world, upgraded to PBR surfaces with a
 * depth-tiered ground (no z-fight) and normal-mapped cobble/tile/stucco/stone.
 */
export function createStylizedLook(): WorldLook {
  return {
    id: "stylized",
    build(scene, topology, worldScene, onFrame?: OnFrame) {
      // Shared PBR surface library — one set of materials for the whole town.
      const lib = new MaterialLibrary(scene, worldScene.palette)

      // ---- ground / roads (own depth tier; PBR cobble/flagstone/dirt/stone) ----
      let disposeGround: () => void
      if (topology.id === "plaza-grand") {
        const roads = buildRoads(scene, topology, lib, worldScene.palette)
        disposeGround = () => roads.dispose()
      } else {
        const worldSize =
          Math.max(topology.bounds.maxX - topology.bounds.minX, topology.bounds.maxZ - topology.bounds.minZ) + 8
        const g = createGround(scene, worldScene.palette, worldSize)
        disposeGround = () => g.dispose()
      }

      // ---- premium buildings (PBR stucco/terracotta/stone, sloped roofs) ----
      const buildingBlockers = topology.blockers.filter((b) => !isDecorBlocker(topology, b))
      const buildings = createBuildings(scene, buildingBlockers, {
        palette: worldScene.palette,
        doors: topology.anchors.filter((a) => a.role === "portal"),
        materials: lib,
        buildingStyle: worldScene.buildingStyle,
      })

      // ---- lived-in set dressing (lamps, trees, stalls, bunting, fountain…) ----
      const dressing = dressWorld(
        scene,
        topology,
        { palette: worldScene.palette, onFrame, lean: false },
        worldScene,
      )

      return {
        dispose: () => {
          dressing.dispose()
          buildings.dispose()
          disposeGround()
          lib.dispose()
        },
      }
    },
  }
}

/* ----------------------------------------------------------- look registry */

/**
 * selectLook — the single seam where a future look is registered. Today it maps
 * everything to the stylized look; a `create3DLook()` would register here and
 * be selectable by id (e.g. from `worldScene` data) with zero caller changes.
 */
export function selectLook(id: LookId = "stylized"): WorldLook {
  switch (id) {
    // case "full3d": return create3DLook()  // ← future: same interface, no caller change
    case "stylized":
    case "full3d":
    default:
      return createStylizedLook()
  }
}
