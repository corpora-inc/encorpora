import { z } from "zod"
import { PlayerId } from "./ids"
import { AssetRef } from "./assets"

/**
 * Safe-by-construction identity: names are composed from curated fixed lists
 * (never freeform); avatars are layered paper-doll sprites (no uploads, no
 * bios, no links). AvatarSpec is deterministic + tiny so it can be broadcast to
 * other players and re-skinned by the local Scene/theme at render time.
 */

export const GeneratedIdentity = z.object({
  playerId: PlayerId,
  displayName: z.string().min(1),
  nameSeed: z.object({
    adjId: z.string().min(1),
    nounId: z.string().min(1),
    numId: z.string().optional(),
  }),
  title: z.string().optional(),
})
export type GeneratedIdentity = z.infer<typeof GeneratedIdentity>

export const CosmeticSlot = z.enum([
  "face",
  "hair",
  "hat",
  "top",
  "bottom",
  "shoes",
  "accessory",
  "aura",
])
export type CosmeticSlot = z.infer<typeof CosmeticSlot>

export const AvatarLayer = z.object({
  slot: CosmeticSlot,
  itemId: z.string().min(1),
  tint: z.string().optional(),
})
export type AvatarLayer = z.infer<typeof AvatarLayer>

export const AvatarSpec = z.object({
  base: z.string().min(1),
  layers: z.array(AvatarLayer),
  palette: z.record(z.string(), z.string()).optional(),
})
export type AvatarSpec = z.infer<typeof AvatarSpec>

export const Rarity = z.enum(["common", "rare", "epic", "seasonal"])
export type Rarity = z.infer<typeof Rarity>

export const CosmeticUnlock = z.object({
  kind: z.enum(["xp", "coins", "achievement", "premium"]),
  value: z.number().optional(),
  ref: z.string().optional(),
})
export type CosmeticUnlock = z.infer<typeof CosmeticUnlock>

export const CosmeticItem = z.object({
  id: z.string().min(1),
  slot: CosmeticSlot,
  name: z.string().min(1),
  rarity: Rarity,
  /** theme/scene-resolved at render */
  spriteRef: AssetRef,
  unlock: CosmeticUnlock,
})
export type CosmeticItem = z.infer<typeof CosmeticItem>
