import type { AdSurface } from "../../../rendering/AdSurface"
import type { EnemyDef } from "../../../core/types"
import { ARENA_HALF_WIDTH, ARENA_HALF_HEIGHT } from "../../../core/constants"

export type Enemy = {
  id: string
  def: EnemyDef
  surface: AdSurface
  x: number
  y: number
  vx: number
  vy: number
  hp: number
  alive: boolean
  hitFlashTimer: number
  adCreativeId?: string
  update: (dt: number, playerX: number, playerY: number) => void
  takeDamage: (amount: number) => boolean // returns true if killed
  isOffScreen: () => boolean
}

let nextEnemyId = 0

export const createEnemy = (
  def: EnemyDef,
  surface: AdSurface,
  x: number,
  y: number,
  vx: number,
  vy: number,
  updateBehavior: (enemy: Enemy, dt: number, playerX: number, playerY: number) => void,
): Enemy => {
  const id = `enemy-${nextEnemyId++}`

  // Scale mesh to enemy size
  const scale = def.size
  surface.mesh.scaling.set(scale, scale, 1)
  surface.mesh.position.set(x, y, 0)
  surface.mesh.setEnabled(true)

  const enemy: Enemy = {
    id,
    def,
    surface,
    x,
    y,
    vx,
    vy,
    hp: def.hp,
    alive: true,
    hitFlashTimer: 0,
    update: () => {},
    takeDamage: () => false,
    isOffScreen: () => false,
  }

  enemy.update = (dt: number, playerX: number, playerY: number) => {
    if (!enemy.alive) return

    updateBehavior(enemy, dt, playerX, playerY)

    // Apply velocity
    enemy.x += enemy.vx * dt
    enemy.y += enemy.vy * dt

    // Update mesh position
    surface.mesh.position.set(enemy.x, enemy.y, 0)

    // Hit flash decay
    if (enemy.hitFlashTimer > 0) {
      enemy.hitFlashTimer -= dt
      const mat = surface.mesh.material as import("@babylonjs/core").StandardMaterial
      if (enemy.hitFlashTimer > 0) {
        mat.emissiveColor.set(1, 1, 1)
      } else {
        // Reset to normal emissive
        mat.emissiveColor.set(0.3, 0.3, 0.3)
      }
    }
  }

  enemy.takeDamage = (amount: number): boolean => {
    enemy.hp -= amount
    enemy.hitFlashTimer = 0.1

    if (enemy.hp <= 0) {
      enemy.alive = false
      surface.mesh.setEnabled(false)
      return true
    }
    return false
  }

  enemy.isOffScreen = () => {
    const margin = def.size + 2
    return (
      enemy.x < -ARENA_HALF_WIDTH - margin ||
      enemy.x > ARENA_HALF_WIDTH + margin ||
      enemy.y < -ARENA_HALF_HEIGHT - margin ||
      enemy.y > ARENA_HALF_HEIGHT + margin
    )
  }

  return enemy
}
