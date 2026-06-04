import type { Scene as BabylonScene } from "@babylonjs/core/scene"
import type { RoomTopology, Scene as WorldScene } from "@world-plaza/contracts"
import type { Billboard } from "../world/billboard"
import { selectLook } from "../render/worldLook"

/**
 * sceneRenderer — composes the static WORLD over a RoomTopology by delegating to
 * a pluggable LOOK (`src/render/worldLook.ts`). The Look owns ground/roads/
 * buildings + their materials + surface lighting tone; the rest of the game is
 * unchanged regardless of which Look is active. Today there is one Look
 * (`stylized` — the upgraded PBR 2.5D world); a fuller-3D look slots in behind
 * the same interface without touching this file or game.ts.
 *
 * The public API (`renderScene`) is intentionally STABLE — game.ts calls it
 * exactly as before. Only the implementation moved behind the Look seam.
 *
 * NOTE (Wave 1): characters are NOT placed here. People become autonomous
 * wandering agents (the separate cutout/crowd system).
 */

export interface Interactable {
  anchorId: string
  kind: "npc" | "prop"
  billboard: Billboard
}

export interface RenderedScene {
  /** Reserved for wandering NPCs (Wave 2). Empty for the static world. */
  interactables: Interactable[]
  byTag: Map<string, Interactable>
  dispose: () => void
}

type OnFrame = (cb: (dt: number) => void) => () => void

export function renderScene(
  babylon: BabylonScene,
  topology: RoomTopology,
  scene: WorldScene,
  onFrame?: OnFrame,
): RenderedScene {
  // Pick the world Look. A future Scene could carry a `lookId`; default stylized.
  const lookId = (scene as { lookId?: "stylized" | "full3d" }).lookId ?? "stylized"
  const look = selectLook(lookId)
  const handle = look.build(babylon, topology, scene, onFrame)

  return {
    interactables: [],
    byTag: new Map(),
    dispose: () => handle.dispose(),
  }
}
