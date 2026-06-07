import { z } from "zod"
import { RoomId } from "./ids"

/**
 * Room is the abstract, authoritative, shared collision/position/socket space.
 * Its topology (bounds, blockers, anchors) is identical for everyone in the
 * room — the per-player Scene only re-skins it. Positions are ground-plane
 * (x, z); the world is effectively 2.5D.
 */

export const AnchorRole = z.enum([
  "npc_station",
  "vendor",
  "bench",
  "portal",
  "decor",
  "spawn",
])
export type AnchorRole = z.infer<typeof AnchorRole>

/**
 * Typed anchor KIND/role (the gameplay-semantic role, distinct from the coarse
 * render `role` above). The topology GENERATOR (CONTENT_SCALE §4), the special
 * quest NPCs (COHESION M2), and the map (COHESION M3) all agree on this union so
 * quests/personas/markers bind to anchors BY TYPE. ADDITIVE: today's untyped
 * anchors carry only `role`; generated anchors also carry a typed `kind`.
 * Open-ended on purpose for new eras — the enum is the curated common set.
 */
export const AnchorKind = z.enum([
  "vendor", // a market stall / merchant the player buys from
  "npc_station", // a persona's home post (baker's counter, scribe's desk)
  "docks", // boat crossing (es-guadalajara-route step `docks`)
  "city_gate", // walled-town gate (route step `gate`)
  "fountain", // plaza centerpiece
  "merchant", // a money-changer / trade-floor venue
  "portal", // scene/level transition
  "bench", // idle/sit spot
  "spawn", // player spawn
  "decor", // purely cosmetic dressing
  "landmark", // a signature POI for the map legend
])
export type AnchorKind = z.infer<typeof AnchorKind>

/** An abstract location in the room. The Scene decides what it looks like. */
export const Anchor = z.object({
  id: z.string().min(1),
  role: AnchorRole,
  /**
   * Typed gameplay role for quest/special-NPC/map binding (ADDITIVE; optional so
   * existing hand-authored topologies stay valid). The generator emits it; the
   * map + special NPCs + quests prefer `kind` when present, else fall back to
   * mapping the coarse `role`.
   */
  kind: AnchorKind.optional(),
  x: z.number(),
  z: z.number(),
  facing: z.number().optional(),
})
export type Anchor = z.infer<typeof Anchor>

/** Axis-aligned collision footprint (a blocker the player can't walk through). */
export const Blocker = z.object({
  x: z.number(),
  z: z.number(),
  w: z.number().positive(),
  d: z.number().positive(),
})
export type Blocker = z.infer<typeof Blocker>

export const RoomTopology = z.object({
  id: RoomId,
  bounds: z.object({
    minX: z.number(),
    maxX: z.number(),
    minZ: z.number(),
    maxZ: z.number(),
  }),
  spawns: z.array(z.object({ x: z.number(), z: z.number() })).min(1),
  blockers: z.array(Blocker),
  anchors: z.array(Anchor),
})
export type RoomTopology = z.infer<typeof RoomTopology>
