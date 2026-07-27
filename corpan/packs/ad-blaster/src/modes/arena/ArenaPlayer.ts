import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  type Mesh,
  type Scene,
} from "@babylonjs/core"
import type { InputSnapshot } from "../../core/types"
import {
  PLAYER_SPEED,
  PLAYER_SIZE,
  PLAYER_DECEL,
  PLAYER_INVULN_TIME,
  PLAYER_ROTATE_SPEED,
  FIRE_INTERVAL,
  ARENA_HALF_WIDTH,
  ARENA_HALF_HEIGHT,
} from "../../core/constants"

export type ArenaPlayer = {
  mesh: Mesh
  x: number
  y: number
  angle: number
  vx: number
  vy: number
  invulnTimer: number
  alive: boolean
  update: (dt: number, input: InputSnapshot) => void
  shouldFire: () => boolean
  takeDamage: () => void
  reset: () => void
  dispose: () => void
}

export const createArenaPlayer = (scene: Scene): ArenaPlayer => {
  // Triangle ship mesh
  const mesh = MeshBuilder.CreateDisc("player", {
    radius: PLAYER_SIZE,
    tessellation: 3,
  }, scene)
  mesh.rotation.x = 0
  mesh.rotation.y = 0
  mesh.rotation.z = Math.PI / 2 // Point right by default

  const mat = new StandardMaterial("playerMat", scene)
  mat.diffuseColor = new Color3(0, 0.9, 0.9)
  mat.emissiveColor = new Color3(0, 0.5, 0.6)
  mat.specularColor = Color3.Black()
  mat.backFaceCulling = false
  mesh.material = mat

  const player: ArenaPlayer = {
    mesh,
    x: 0,
    y: 0,
    angle: Math.PI / 2, // Facing up
    vx: 0,
    vy: 0,
    invulnTimer: 0,
    alive: true,
    update: () => {},
    shouldFire: () => false,
    takeDamage: () => {},
    reset: () => {},
    dispose: () => {},
  }

  let fireTimer = 0
  let fireReady = false
  let blinkTimer = 0

  player.update = (dt: number, input: InputSnapshot) => {
    if (!player.alive) return

    // Movement: fly toward tap target
    if (input.hasTarget) {
      const dx = input.targetX - player.x
      const dy = input.targetY - player.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist > 0.5) {
        // Target angle
        const targetAngle = Math.atan2(dy, dx)

        // Smooth rotation toward target
        let angleDiff = targetAngle - player.angle
        // Normalize to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
        player.angle += angleDiff * Math.min(1, PLAYER_ROTATE_SPEED * dt)

        // Accelerate toward target
        const ax = Math.cos(player.angle) * PLAYER_SPEED
        const ay = Math.sin(player.angle) * PLAYER_SPEED
        player.vx += (ax - player.vx) * Math.min(1, 6 * dt)
        player.vy += (ay - player.vy) * Math.min(1, 6 * dt)
      } else {
        // Near waypoint — decelerate
        player.vx *= Math.max(0, 1 - PLAYER_DECEL * dt)
        player.vy *= Math.max(0, 1 - PLAYER_DECEL * dt)
      }
    } else {
      // No target — decelerate
      player.vx *= Math.max(0, 1 - PLAYER_DECEL * dt)
      player.vy *= Math.max(0, 1 - PLAYER_DECEL * dt)
    }

    // Apply velocity
    player.x += player.vx * dt
    player.y += player.vy * dt

    // Soft wall clamping — slide along walls, don't bounce
    const margin = PLAYER_SIZE * 0.5
    if (player.x < -ARENA_HALF_WIDTH + margin) {
      player.x = -ARENA_HALF_WIDTH + margin
      player.vx = 0
    } else if (player.x > ARENA_HALF_WIDTH - margin) {
      player.x = ARENA_HALF_WIDTH - margin
      player.vx = 0
    }
    if (player.y < -ARENA_HALF_HEIGHT + margin) {
      player.y = -ARENA_HALF_HEIGHT + margin
      player.vy = 0
    } else if (player.y > ARENA_HALF_HEIGHT - margin) {
      player.y = ARENA_HALF_HEIGHT - margin
      player.vy = 0
    }

    // Update mesh
    mesh.position.set(player.x, player.y, 0)
    mesh.rotation.z = player.angle - Math.PI / 2

    // Fire timer (auto-fire)
    fireTimer -= dt
    fireReady = false
    if (fireTimer <= 0) {
      fireReady = true
      fireTimer = FIRE_INTERVAL
    }

    // Invulnerability
    if (player.invulnTimer > 0) {
      player.invulnTimer -= dt
      blinkTimer += dt
      // Blink effect
      mesh.visibility = Math.sin(blinkTimer * 20) > 0 ? 1 : 0.2
    } else {
      mesh.visibility = 1
      blinkTimer = 0
    }
  }

  player.shouldFire = () => fireReady && player.alive

  player.takeDamage = () => {
    player.invulnTimer = PLAYER_INVULN_TIME
    blinkTimer = 0
  }

  player.reset = () => {
    player.x = 0
    player.y = 0
    player.vx = 0
    player.vy = 0
    player.angle = Math.PI / 2
    player.invulnTimer = 0
    player.alive = true
    fireTimer = 0
    blinkTimer = 0
    mesh.position.set(0, 0, 0)
    mesh.rotation.z = 0
    mesh.visibility = 1
    mesh.setEnabled(true)
  }

  player.dispose = () => {
    mesh.dispose()
    mat.dispose()
  }

  return player
}
