import type { AdSurface } from "../../../rendering/AdSurface"
import type { EnemyDef } from "../../../core/types"
import { createEnemy, type Enemy } from "./EnemyBase"
import {
  ENEMY_LINEAR_HP,
  ENEMY_LINEAR_SPEED,
  ENEMY_LINEAR_SIZE,
  ENEMY_LINEAR_POINTS,
} from "../../../core/constants"

export const LINEAR_DEF: EnemyDef = {
  type: "linear",
  hp: ENEMY_LINEAR_HP,
  speed: ENEMY_LINEAR_SPEED,
  size: ENEMY_LINEAR_SIZE,
  points: ENEMY_LINEAR_POINTS,
  color: "#4488ff",
}

export const createLinearEnemy = (
  surface: AdSurface,
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  hpBonus: number,
  defOverrides?: Partial<EnemyDef>,
): Enemy => {
  const def = { ...LINEAR_DEF, hp: LINEAR_DEF.hp + hpBonus, ...defOverrides }
  const speed = def.speed
  const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1
  const vx = (dirX / len) * speed
  const vy = (dirY / len) * speed

  return createEnemy(def, surface, x, y, vx, vy, () => {
    // Linear: no behavior change, just flies straight
  })
}
