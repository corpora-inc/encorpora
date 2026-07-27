import type { AdSurface } from "../../../rendering/AdSurface"
import type { EnemyDef } from "../../../core/types"
import { createEnemy, type Enemy } from "./EnemyBase"
import {
  ENEMY_BOUNCER_HP,
  ENEMY_BOUNCER_SPEED,
  ENEMY_BOUNCER_SIZE,
  ENEMY_BOUNCER_POINTS,
  ARENA_HALF_WIDTH,
  ARENA_HALF_HEIGHT,
} from "../../../core/constants"

export const BOUNCER_DEF: EnemyDef = {
  type: "bouncer",
  hp: ENEMY_BOUNCER_HP,
  speed: ENEMY_BOUNCER_SPEED,
  size: ENEMY_BOUNCER_SIZE,
  points: ENEMY_BOUNCER_POINTS,
  color: "#ffaa00",
}

export const createBouncerEnemy = (
  surface: AdSurface,
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  hpBonus: number,
  defOverrides?: Partial<EnemyDef>,
): Enemy => {
  const def = { ...BOUNCER_DEF, hp: BOUNCER_DEF.hp + hpBonus, ...defOverrides }
  const speed = def.speed
  const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1
  const vx = (dirX / len) * speed
  const vy = (dirY / len) * speed

  let spinAngle = 0

  return createEnemy(def, surface, x, y, vx, vy, (enemy, dt) => {
    // Bounce off fixed arena edges
    const margin = def.size * 0.5
    const left = -ARENA_HALF_WIDTH + margin
    const right = ARENA_HALF_WIDTH - margin
    const bottom = -ARENA_HALF_HEIGHT + margin
    const top = ARENA_HALF_HEIGHT - margin

    if (enemy.x <= left && enemy.vx < 0) {
      enemy.vx = Math.abs(enemy.vx)
      spinAngle += Math.PI * 0.5
    }
    if (enemy.x >= right && enemy.vx > 0) {
      enemy.vx = -Math.abs(enemy.vx)
      spinAngle += Math.PI * 0.5
    }
    if (enemy.y <= bottom && enemy.vy < 0) {
      enemy.vy = Math.abs(enemy.vy)
      spinAngle += Math.PI * 0.5
    }
    if (enemy.y >= top && enemy.vy > 0) {
      enemy.vy = -Math.abs(enemy.vy)
      spinAngle += Math.PI * 0.5
    }

    // Spin on bounce (smooth decay)
    if (spinAngle > 0) {
      surface.mesh.rotation.z += spinAngle * dt * 3
      spinAngle *= Math.max(0, 1 - 2 * dt)
      if (spinAngle < 0.01) spinAngle = 0
    }
  })
}
