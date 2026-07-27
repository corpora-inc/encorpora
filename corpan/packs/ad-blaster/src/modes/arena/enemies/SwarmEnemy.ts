import type { AdSurface } from "../../../rendering/AdSurface"
import type { EnemyDef } from "../../../core/types"
import { createEnemy, type Enemy } from "./EnemyBase"
import {
  ENEMY_SWARM_HP,
  ENEMY_SWARM_SPEED,
  ENEMY_SWARM_SIZE,
  ENEMY_SWARM_POINTS,
} from "../../../core/constants"

export const SWARM_DEF: EnemyDef = {
  type: "swarm",
  hp: ENEMY_SWARM_HP,
  speed: ENEMY_SWARM_SPEED,
  size: ENEMY_SWARM_SIZE,
  points: ENEMY_SWARM_POINTS,
  color: "#44ffaa",
}

export const createSwarmEnemy = (
  surface: AdSurface,
  x: number,
  y: number,
  playerX: number,
  playerY: number,
  hpBonus: number,
  offsetAngle: number,
  defOverrides?: Partial<EnemyDef>,
): Enemy => {
  const def = { ...SWARM_DEF, hp: SWARM_DEF.hp + hpBonus, ...defOverrides }
  // Aim generally toward player with a spread offset
  const dx = playerX - x
  const dy = playerY - y
  const baseAngle = Math.atan2(dy, dx) + offsetAngle
  const vx = Math.cos(baseAngle) * def.speed
  const vy = Math.sin(baseAngle) * def.speed

  return createEnemy(def, surface, x, y, vx, vy, (enemy, dt) => {
    // Swarm: slight sinusoidal wobble
    const wobble = Math.sin(Date.now() * 0.01 + enemy.x * 3) * 0.5
    enemy.vy += wobble * dt
  })
}
