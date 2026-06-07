import { z } from "zod"
import { RoomId, SceneId } from "./ids"
import { AssetRef, ThemeId } from "./assets"

/**
 * Scene is a per-player, data-driven SKIN of a Room. It binds the abstract
 * topology (by `topologyId`) to concrete cutout sprites + setting. Two players
 * in the same Room can carry different Scenes — same collisions, different
 * worlds. A Scene is a pack-deliverable JSON + sprite atlas.
 */

const AnchorSkin = z.object({
  spriteRef: AssetRef,
  props: z.array(AssetRef).optional(),
})

const NpcSkin = z.object({
  spriteRef: AssetRef,
  voiceHint: z.string().optional(),
})

export const Scene = z.object({
  id: SceneId,
  topologyId: RoomId,
  setting: z.object({
    place: z.string().min(1),
    era: z.string().min(1),
    mood: z.string().min(1),
  }),
  themeId: ThemeId,
  narrativeBlurb: z.string(),
  /** keyed by Anchor.id */
  anchorSkins: z.record(z.string(), AnchorSkin),
  /** keyed by NpcRole.id (or role) */
  npcSkins: z.record(z.string(), NpcSkin),
  ambientAudio: AssetRef.optional(),
  palette: z.record(z.string(), z.string()).optional(),

  /**
   * Distant-horizon look. Drives the sky gradient + distance fog so the camera
   * can see far into the distance. Read by the camera/vista layer; authored
   * per-Scene (warm Antigua day vs neon Tokyo night).
   */
  sky: z
    .object({
      horizon: z.string().optional(), // hex — lower sky / haze band at the horizon
      zenith: z.string().optional(), // hex — top of sky
      fog: z.number().min(0).max(1).optional(), // 0..1 distance-fog density scaler
      fogColor: z.string().optional(), // hex — usually ≈ horizon
      timeOfDay: z.enum(["dawn", "day", "dusk", "night"]).optional(),
    })
    .optional(),

  /**
   * A signature landmark on the far horizon (Mount Fuji, the Eiffel Tower, a
   * colonial cathedral, a neon skyline…). The vista layer renders it as a
   * distant silhouette at the map edge — the payoff of long sightlines.
   */
  landmark: z
    .object({
      kind: z.string(), // 'mount-fuji'|'eiffel'|'cathedral'|'volcano'|'skyline'|…
      tintHex: z.string().optional(),
      label: z.string().optional(),
      azimuth: z.number().optional(), // radians around the horizon (0 = +Z)
      scale: z.number().optional(), // relative size multiplier
    })
    .optional(),

  /**
   * Building-skin style token the building renderer switches on
   * ('antigua-stucco' | 'tokyo-neon' | …). Absent ⇒ the warm stucco default.
   */
  buildingStyle: z.string().optional(),
})
export type Scene = z.infer<typeof Scene>
