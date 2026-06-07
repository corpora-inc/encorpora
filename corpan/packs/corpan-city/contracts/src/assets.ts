import { z } from "zod"
import { WorldId } from "./ids"

/**
 * AssetRef resolves either to a bundled pack file (corpan-pack://...) or a CDN
 * URL. SHA-256 + byte size are optional integrity/size hints used by the
 * streaming installer.
 */
export const AssetRef = z.object({
  url: z.string().min(1),
  sha256: z.string().optional(),
  bytes: z.number().int().nonnegative().optional(),
})
export type AssetRef = z.infer<typeof AssetRef>

/** The three art themes share identical billboard tech; a theme is a skin. */
export const ThemeId = z.enum(["paper", "sticker", "felt"])
export type ThemeId = z.infer<typeof ThemeId>

export const ThemeManifest = z.object({
  id: ThemeId,
  name: z.string().min(1),
  atlas: AssetRef,
  palette: AssetRef,
})
export type ThemeManifest = z.infer<typeof ThemeManifest>

/** Top-level pointer to every data-driven collection the world loads. */
export const WorldManifest = z.object({
  worldId: WorldId,
  topologies: AssetRef,
  scenes: AssetRef,
  quests: AssetRef,
  paths: AssetRef,
  npcRoles: AssetRef,
  themes: z.array(ThemeManifest),
  challenges: AssetRef,
})
export type WorldManifest = z.infer<typeof WorldManifest>
