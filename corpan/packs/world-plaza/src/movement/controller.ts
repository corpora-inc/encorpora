import type { RoomTopology, AvatarSpec } from "@world-plaza/contracts"
import type { WorldEngine } from "../world/engine"
import { type GroundedCutout } from "../render/cutout"
import { createCharacterFigure } from "../character/figure"
import { createAnimator, type Animator } from "../character/animator"
import { avatarToCharacterSpec } from "../character/characterSpec"
import type { Input } from "./input"
import type { ObstacleField } from "../world/collision"
import { Vector3 } from "@babylonjs/core/Maths/math"
import { walkSurfaceHeight } from "../world/walkSurface"

/**
 * The local player controller. The player's DRESSED AVATAR is their in-world
 * body: the onboarding AvatarSpec → CharacterSpec → the same grounded,
 * paper-doll cutout the crowd uses, with a non-drifting contact shadow and a
 * walk animation. Reads dual-stick/keyboard input, integrates movement in
 * CAMERA space, resolves collision against the topology, and drives the
 * third-person follow camera.
 */

const PLAYER_RADIUS = 0.55
const MOVE_SPEED = 6.5 // world units / sec

export interface PlayerController {
  cutout: GroundedCutout
  getPos: () => { x: number; z: number }
  /** Current heading (yaw, radians) — drives the minimap/map heading arrow. */
  getFacing: () => number
  /**
   * Teleport the player to a world point and snap the follow camera onto them —
   * exactly as if they had WALKED there. The transit vignettes (taxi/bus/subway)
   * call this on arrival to re-spawn the player at the destination anchor: the
   * point is clamped to the world bounds + pushed out of any obstacle so we never
   * land embedded in a building/prop. The camera target updates immediately so
   * there is no one-frame lerp from the old spot.
   */
  respawnAt: (x: number, z: number, faceYaw?: number) => void
  /** Normalized 0..1 locomotion speed this frame — drives footstep audio. */
  getSpeed: () => number
  update: (dt: number) => void
  dispose: () => void
}

function resolveAxis(
  v: number,
  other: number,
  axis: "x" | "z",
  blockers: RoomTopology["blockers"],
): number {
  for (const b of blockers) {
    const hx = b.w / 2 + PLAYER_RADIUS
    const hz = b.d / 2 + PLAYER_RADIUS
    const px = axis === "x" ? v : other
    const pz = axis === "x" ? other : v
    if (px > b.x - hx && px < b.x + hx && pz > b.z - hz && pz < b.z + hz) {
      if (axis === "x") return v < b.x ? b.x - hx : b.x + hx
      return v < b.z ? b.z - hz : b.z + hz
    }
  }
  return v
}

export function createPlayerController(
  world: WorldEngine,
  topology: RoomTopology,
  input: Input,
  avatar: AvatarSpec,
  /**
   * The unified obstacle field (buildings + fountain + solid props). When given,
   * the player SLIDES along ALL obstacles (props included), not just buildings.
   * Optional + last so existing callers stay source-compatible; without it the
   * player still collides with the building boxes via the legacy axis-resolve.
   */
  obstacles?: ObstacleField,
  /**
   * Walk-SURFACE height sampler (#40): given the player's (x,z), returns the world
   * Y of the ground they stand on — 0 on flat ground, the deck height when on a
   * bridge (ramp → cambered deck → ramp). The controller lifts the player + the
   * camera target to this Y each frame so you walk OVER raised structures instead
   * of under them. Optional + last; absent → flat (Y always 0), unchanged.
   */
  getGroundHeight?: (x: number, z: number) => number,
): PlayerController {
  const spec = avatarToCharacterSpec(avatar, "player-local")
  const cutout = createCharacterFigure(world.scene, spec, {
    shadowRadius: 0.62,
    pickTag: "player",
  })
  const anim: Animator = createAnimator(cutout, spec)

  const spawn = topology.spawns[0]
  let x = spawn.x
  let z = spawn.z
  // If the spawn happens to overlap a prop/obstacle, settle to the nearest free
  // point so we never START embedded.
  if (obstacles) {
    const free = obstacles.pushOut(x, z, PLAYER_RADIUS)
    x = free.x
    z = free.z
  }
  let yaw = 0
  let lastSpeed = 0 // 0..1 locomotion speed, exposed for footstep audio
  // The figure's own facing (radians), eased toward the MOVEMENT direction each
  // frame so the body turns to walk where it's going instead of moonwalking when
  // you strafe. Distinct from `yaw` (the camera/look heading): the figure faces
  // its velocity, the camera faces the look. Idle keeps the last heading.
  let figureYaw = 0
  cutout.setGroundPos(x, z)

  const update = (dt: number) => {
    const inp = input.sample()
    yaw += inp.lookDelta

    const fx = -Math.sin(yaw)
    const fz = -Math.cos(yaw)
    const rx = fz
    const rz = -fx
    let vx = fx * inp.moveY + rx * inp.moveX
    let vz = fz * inp.moveY + rz * inp.moveX
    const len = Math.hypot(vx, vz)
    if (len > 1) {
      vx /= len
      vz /= len
    }
    const speed = Math.min(len, 1)
    lastSpeed = speed

    let nx = x + vx * MOVE_SPEED * dt
    let nz = z + vz * MOVE_SPEED * dt
    const m = PLAYER_RADIUS
    nx = Math.max(topology.bounds.minX + m, Math.min(topology.bounds.maxX - m, nx))
    nz = Math.max(topology.bounds.minZ + m, Math.min(topology.bounds.maxZ - m, nz))
    if (obstacles) {
      // Unified slide against buildings + fountain + every solid prop.
      const r = obstacles.resolve(x, z, nx, nz, PLAYER_RADIUS)
      x = r.x
      z = r.z
    } else {
      // Legacy fallback: building boxes only (no prop collision).
      nx = resolveAxis(nx, z, "x", topology.blockers)
      nz = resolveAxis(nz, nx, "z", topology.blockers)
      x = nx
      z = nz
    }

    // Walk-surface height (#40): 0 on flat ground, the deck height on a bridge.
    // Lift BOTH the player figure and the camera target so you ride up + over the
    // deck (water flows under) instead of clipping through it at ground level.
    // Walk-surface height: an explicit sampler wins; else the scene's walk-surface
    // registry (a bridge self-registers there, so this is wired with ZERO game.ts
    // change — #40). Flat ground → 0.
    const groundY = getGroundHeight ? getGroundHeight(x, z) : walkSurfaceHeight(world.scene, x, z)
    cutout.setGroundPos(x, z, groundY)
    // Turn the figure to face where it's MOVING (not where the camera looks), so
    // strafing/back-pedalling no longer slides sideways. The figure's forward is
    // -Z, so the heading that points its forward along velocity (vx,vz) is
    // atan2(-vx,-vz). Ease toward it (shortest-arc) while moving; hold facing when
    // idle. cutout.setHeading is a no-op on the legacy billboard cutout.
    if (speed > 0.05) {
      const targetHeading = Math.atan2(-vx, -vz)
      let d = targetHeading - figureYaw
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      figureYaw += d * Math.min(1, dt * 12)
    }
    cutout.setHeading?.(figureYaw)
    anim.setState(speed > 0.02 ? "walk" : "idle")
    anim.setSpeed(speed)
    anim.update(dt)
    world.setCameraTarget(new Vector3(x, groundY, z), yaw)
  }

  // --- TEST-ONLY hook (pure observability for the Playwright harness) ---
  const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV
  if (typeof window !== "undefined" && isDev) {
    ;(window as unknown as { __wpPlayer?: unknown }).__wpPlayer = {
      pos: () => ({ x, z }),
    }
  }

  const respawnAt = (tx: number, tz: number, faceYaw?: number) => {
    const m = PLAYER_RADIUS
    let nx = Math.max(topology.bounds.minX + m, Math.min(topology.bounds.maxX - m, tx))
    let nz = Math.max(topology.bounds.minZ + m, Math.min(topology.bounds.maxZ - m, tz))
    if (obstacles) {
      const free = obstacles.pushOut(nx, nz, PLAYER_RADIUS)
      nx = free.x
      nz = free.z
    }
    x = nx
    z = nz
    if (faceYaw !== undefined) {
      yaw = faceYaw
      figureYaw = faceYaw
      cutout.setHeading?.(faceYaw)
    }
    cutout.setGroundPos(x, z)
    // Snap the follow camera onto the new spot at the (possibly new) heading.
    world.setCameraTarget(new Vector3(x, 0, z), yaw)
  }

  return {
    cutout,
    getPos: () => ({ x, z }),
    getFacing: () => yaw,
    getSpeed: () => lastSpeed,
    respawnAt,
    update,
    dispose: () => {
      if (typeof window !== "undefined") {
        delete (window as unknown as { __wpPlayer?: unknown }).__wpPlayer
      }
      cutout.dispose()
    },
  }
}
