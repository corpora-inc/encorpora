import { z } from "zod"
import { PlayerId, QuestId, RoomId, SceneId } from "./ids"
import { AvatarSpec } from "./identity"

/**
 * Presence + movement is the Colyseus-synced state. The server is authoritative
 * over positions; clients predict locally and interpolate remote avatars. Each
 * player carries their sceneId/questId so others' clients can place + skin them
 * into the LOCAL scene (divergent worlds, shared collision space).
 */

export const PlayerPosition = z.object({
  x: z.number(),
  z: z.number(),
  facing: z.number(),
})
export type PlayerPosition = z.infer<typeof PlayerPosition>

/** Client → server. `seq` lets the server drop stale/duplicate updates. */
export const MovementUpdate = z.object({
  seq: z.number().int().nonnegative(),
  pos: PlayerPosition,
  t: z.number(),
})
export type MovementUpdate = z.infer<typeof MovementUpdate>

export const PresencePlayer = z.object({
  playerId: PlayerId,
  name: z.string(),
  avatar: AvatarSpec,
  pos: PlayerPosition,
  sceneId: SceneId,
  questId: QuestId,
})
export type PresencePlayer = z.infer<typeof PresencePlayer>

/** Server → clients (sent as binary deltas in practice). */
export const PresenceSnapshot = z.object({
  roomId: RoomId,
  players: z.array(PresencePlayer),
})
export type PresenceSnapshot = z.infer<typeof PresenceSnapshot>
