import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  type Mesh,
  type Scene,
} from "@babylonjs/core"
import {
  PROJECTILE_SPEED,
  PROJECTILE_WIDTH,
  PROJECTILE_HEIGHT,
  MAX_PROJECTILES,
  PROJECTILE_LIFESPAN,
  ARENA_HALF_WIDTH,
  ARENA_HALF_HEIGHT,
} from "../../core/constants"

type Projectile = {
  mesh: Mesh
  active: boolean
  x: number
  y: number
  dx: number
  dy: number
  life: number
}

export type ArenaProjectilePool = {
  fire: (x: number, y: number, angle: number) => void
  update: (dt: number) => void
  getActive: () => Projectile[]
  deactivate: (p: Projectile) => void
  reset: () => void
  dispose: () => void
}

export const createArenaProjectilePool = (scene: Scene): ArenaProjectilePool => {
  const mat = new StandardMaterial("projMat", scene)
  mat.diffuseColor = new Color3(0.2, 1, 0.3)
  mat.emissiveColor = new Color3(0.1, 0.8, 0.2)
  mat.specularColor = Color3.Black()
  mat.backFaceCulling = false

  const pool: Projectile[] = []
  for (let i = 0; i < MAX_PROJECTILES; i++) {
    const mesh = MeshBuilder.CreatePlane(`proj-${i}`, {
      width: PROJECTILE_WIDTH,
      height: PROJECTILE_HEIGHT,
    }, scene)
    mesh.material = mat
    mesh.setEnabled(false)
    pool.push({ mesh, active: false, x: 0, y: 0, dx: 0, dy: 0, life: 0 })
  }

  const fire = (x: number, y: number, angle: number) => {
    const p = pool.find(pr => !pr.active)
    if (!p) return

    p.active = true
    p.x = x
    p.y = y
    p.dx = Math.cos(angle) * PROJECTILE_SPEED
    p.dy = Math.sin(angle) * PROJECTILE_SPEED
    p.life = PROJECTILE_LIFESPAN
    p.mesh.setEnabled(true)
    p.mesh.position.set(x, y, 0)
    // Rotate to face direction
    p.mesh.rotation.z = angle - Math.PI / 2
  }

  const update = (dt: number) => {
    const margin = 1.0
    for (const p of pool) {
      if (!p.active) continue
      p.x += p.dx * dt
      p.y += p.dy * dt
      p.life -= dt
      p.mesh.position.set(p.x, p.y, 0)

      // Off-screen or expired: arena bounds check
      if (
        p.life <= 0 ||
        p.x < -ARENA_HALF_WIDTH - margin ||
        p.x > ARENA_HALF_WIDTH + margin ||
        p.y < -ARENA_HALF_HEIGHT - margin ||
        p.y > ARENA_HALF_HEIGHT + margin
      ) {
        deactivate(p)
      }
    }
  }

  const deactivate = (p: Projectile) => {
    p.active = false
    p.mesh.setEnabled(false)
  }

  const getActive = () => pool.filter(p => p.active)

  const reset = () => {
    for (const p of pool) {
      p.active = false
      p.mesh.setEnabled(false)
    }
  }

  const dispose = () => {
    for (const p of pool) {
      p.mesh.dispose()
    }
    mat.dispose()
  }

  return { fire, update, getActive, deactivate, reset, dispose }
}
