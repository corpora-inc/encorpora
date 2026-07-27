import type { AdSizeCategory } from "./types"

export type EnemyAdMapping = {
  sizeCategory: AdSizeCategory
  meshWidth: number
  meshHeight: number
}

/**
 * Maps enemy types to ad sizes and mesh aspect ratios.
 *
 * | Enemy   | Ad Size        | Mesh         | Rationale                    |
 * |---------|----------------|--------------|------------------------------|
 * | Linear  | banner 320x50  | 1.6 x 0.25  | Fast junk mail — wide, thin  |
 * | Swarm   | banner 320x50  | 1.6 x 0.25  | Spam flood                   |
 * | Stalker | mrec 300x250   | 1.2 x 1.0   | Persistent tracker, square   |
 * | Bouncer | mrec 300x250   | 1.2 x 1.0   | Unavoidable rectangle        |
 * | Tank    | leaderboard    | 2.4 x 0.3   | Billboard, imposing width    |
 */
export const ENEMY_AD_SIZE_MAP: Record<string, EnemyAdMapping> = {
  linear:  { sizeCategory: "banner",      meshWidth: 1.6, meshHeight: 0.25 },
  swarm:   { sizeCategory: "banner",      meshWidth: 1.6, meshHeight: 0.25 },
  stalker: { sizeCategory: "mrec",        meshWidth: 1.2, meshHeight: 1.0 },
  bouncer: { sizeCategory: "mrec",        meshWidth: 1.2, meshHeight: 1.0 },
  tank:    { sizeCategory: "leaderboard", meshWidth: 2.4, meshHeight: 0.3 },
}

/** Default mapping when enemy type has no specific mapping */
export const DEFAULT_AD_MAPPING: EnemyAdMapping = {
  sizeCategory: "banner",
  meshWidth: 1.4,
  meshHeight: 0.9,
}
