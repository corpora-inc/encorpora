import type { AdSurface } from "../../../rendering/AdSurface"
import type { EnemyDef } from "../../../core/types"
import { createEnemy, type Enemy } from "./EnemyBase"
import {
  ENEMY_TANK_HP,
  ENEMY_TANK_SPEED,
  ENEMY_TANK_SIZE,
  ENEMY_TANK_POINTS,
} from "../../../core/constants"

export const TANK_DEF: EnemyDef = {
  type: "tank",
  hp: ENEMY_TANK_HP,
  speed: ENEMY_TANK_SPEED,
  size: ENEMY_TANK_SIZE,
  points: ENEMY_TANK_POINTS,
  color: "#ff2222",
}

const TANK_DEFAULT_STEER = 0.5

export const createTankEnemy = (
  surface: AdSurface,
  x: number,
  y: number,
  playerX: number,
  playerY: number,
  hpBonus: number,
  defOverrides?: Partial<EnemyDef>,
): Enemy => {
  const def = { ...TANK_DEF, hp: TANK_DEF.hp + hpBonus, ...defOverrides }
  const steer = def.steer ?? TANK_DEFAULT_STEER
  const dx = playerX - x
  const dy = playerY - y
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const vx = (dx / dist) * def.speed
  const vy = (dy / dist) * def.speed

  return createEnemy(def, surface, x, y, vx, vy, (enemy, dt, pX, pY) => {
    // Tank: very slow steering toward player
    const tdx = pX - enemy.x
    const tdy = pY - enemy.y
    const tdist = Math.sqrt(tdx * tdx + tdy * tdy) || 1
    const desiredVx = (tdx / tdist) * def.speed
    const desiredVy = (tdy / tdist) * def.speed
    enemy.vx += (desiredVx - enemy.vx) * steer * dt
    enemy.vy += (desiredVy - enemy.vy) * steer * dt

    // Intense glow effect
    const glow = 0.5 + Math.sin(Date.now() * 0.003) * 0.2
    const mat = surface.mesh.material as import("@babylonjs/core").StandardMaterial
    if (enemy.hitFlashTimer <= 0) {
      mat.emissiveColor.set(glow, glow * 0.2, glow * 0.2)
    }
  })
}
