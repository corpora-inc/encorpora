import type { AdSurface } from "../../../rendering/AdSurface"
import type { EnemyDef } from "../../../core/types"
import { createEnemy, type Enemy } from "./EnemyBase"
import {
  ENEMY_STALKER_HP,
  ENEMY_STALKER_SPEED,
  ENEMY_STALKER_SIZE,
  ENEMY_STALKER_POINTS,
  ENEMY_STALKER_STEER,
} from "../../../core/constants"

export const STALKER_DEF: EnemyDef = {
  type: "stalker",
  hp: ENEMY_STALKER_HP,
  speed: ENEMY_STALKER_SPEED,
  size: ENEMY_STALKER_SIZE,
  points: ENEMY_STALKER_POINTS,
  color: "#ff44ff",
}

export const createStalkerEnemy = (
  surface: AdSurface,
  x: number,
  y: number,
  hpBonus: number,
  defOverrides?: Partial<EnemyDef>,
): Enemy => {
  const def = { ...STALKER_DEF, hp: STALKER_DEF.hp + hpBonus, ...defOverrides }
  const steer = def.steer ?? ENEMY_STALKER_STEER
  // Start with zero velocity, will steer toward player
  return createEnemy(def, surface, x, y, 0, 0, (enemy, dt, playerX, playerY) => {
    const dx = playerX - enemy.x
    const dy = playerY - enemy.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1

    // Desired velocity toward player
    const desiredVx = (dx / dist) * def.speed
    const desiredVy = (dy / dist) * def.speed

    // Steer gently toward desired
    enemy.vx += (desiredVx - enemy.vx) * steer * dt
    enemy.vy += (desiredVy - enemy.vy) * steer * dt

    // Pulse scale for visual effect
    const pulse = 1 + Math.sin(Date.now() * 0.005) * 0.08
    surface.mesh.scaling.set(def.size * pulse, def.size * pulse, 1)
  })
}
