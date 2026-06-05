import type { Scene as BabylonScene } from "@babylonjs/core/scene"
import type { AvatarSpec } from "@world-plaza/contracts"
import { type GroundedCutout } from "../render/cutout"
import { createCharacterFigure } from "../character/figure"
import { createAnimator, type Animator } from "../character/animator"
import {
  generateCharacter,
  ANTIGUA_1770,
  type WardrobeTheme,
} from "../character/characterGen"
import { avatarToCharacterSpec } from "../character/characterSpec"
import type { CharacterSpec } from "../character/characterSpec"

/**
 * remoteAvatar — a single OTHER player rendered into the LOCAL world.
 *
 * Reuses the EXACT same look as the local player + crowd (grounded paper-doll
 * cutout, owned contact shadow, state-driven animator), so a remote human is
 * visually indistinguishable from a local NPC — they're just people walking the
 * plaza. Their AvatarSpec is re-skinned into OUR scene at render time (divergent
 * worlds, shared collision space — PREMIUM_FOUNDATIONS §8).
 *
 * The position is SERVER-AUTHORITATIVE but arrives as discrete deltas at the
 * patch rate (~20Hz) over a lossy link. We never snap to it. Instead the net
 * client pushes timestamped samples into a small buffer and this avatar renders
 * an INTERPOLATED point ~100-150ms in the past — so motion is buttery even with
 * packet jitter. Facing + walk/idle animation are derived from interpolated
 * velocity, so a remote walker bobs and a remote stander breathes, automatically.
 */

export interface RemoteAvatar {
  /** push the latest authoritative sample (server time is the caller's clock). */
  setTarget: (x: number, z: number, facing: number) => void
  /** advance interpolation + animation by dt (called each frame). */
  update: (dt: number, renderTimeMs: number) => void
  /** record the time a sample was received (render clock), for interpolation. */
  stamp: (renderTimeMs: number) => void
  getPos: () => { x: number; z: number }
  dispose: () => void
}

interface Sample {
  x: number
  z: number
  facing: number
  /** local render-clock time this sample is valid at. */
  t: number
}

/** How far in the past we render remote avatars (interpolation buffer). */
const INTERP_DELAY_MS = 120
/** Max samples retained (a couple seconds at the patch rate). */
const MAX_SAMPLES = 24
/** Speed (world u/s) above which we consider the avatar "walking". */
const WALK_THRESHOLD = 0.25

export interface RemoteAvatarOptions {
  /** the other player's broadcast avatar (re-skinned locally). */
  avatar: AvatarSpec
  /** stable id used only to seed deterministic fallback art + pick tag. */
  playerId: string
  /** wardrobe theme of the LOCAL scene (re-skin remote into our world). */
  theme?: WardrobeTheme
}

export function createRemoteAvatar(
  scene: BabylonScene,
  opts: RemoteAvatarOptions,
): RemoteAvatar {
  // Resolve the broadcast AvatarSpec into our render-ready CharacterSpec. If the
  // spec is empty/garbage (e.g. legacy client), fall back to a deterministic
  // generated character keyed on playerId so they still look like a real person.
  let spec: CharacterSpec
  const hasLayers = opts.avatar && Array.isArray(opts.avatar.layers) && opts.avatar.layers.length > 0
  if (hasLayers) {
    spec = avatarToCharacterSpec(opts.avatar, `remote:${opts.playerId}`)
  } else {
    spec = generateCharacter("crowd", `remote:${opts.playerId}`, opts.theme ?? ANTIGUA_1770)
  }

  const cutout: GroundedCutout = createCharacterFigure(scene, spec, {
    shadowRadius: spec.build === "stocky" ? 0.66 : spec.build === "child" ? 0.5 : 0.6,
    pickTag: `remote:${opts.playerId}`,
    look: "bubble3d", // a real human player — always 3D.
  })
  const anim: Animator = createAnimator(cutout, spec)

  // Interpolation buffer (ring of timestamped authoritative samples).
  const buf: Sample[] = []
  let lastStampT = 0
  let cur = { x: 0, z: 0 }
  let started = false

  const setTarget = (x: number, z: number, facing: number) => {
    buf.push({ x, z, facing, t: lastStampT })
    if (buf.length > MAX_SAMPLES) buf.shift()
    if (!started) {
      // First sample: place immediately so the avatar pops in at the right spot.
      cur.x = x
      cur.z = z
      cutout.setGroundPos(x, z)
      started = true
    }
  }

  const stamp = (renderTimeMs: number) => {
    lastStampT = renderTimeMs
  }

  const update = (dt: number, renderTimeMs: number) => {
    // Render a point INTERP_DELAY_MS in the past — between the two samples that
    // straddle it. This is the classic entity-interpolation that hides jitter.
    const renderAt = renderTimeMs - INTERP_DELAY_MS

    let nx = cur.x
    let nz = cur.z
    let facing = 0

    if (buf.length >= 2) {
      // find the pair [a,b] with a.t <= renderAt <= b.t
      let a = buf[0]
      let b = buf[buf.length - 1]
      for (let i = 0; i < buf.length - 1; i++) {
        if (buf[i].t <= renderAt && buf[i + 1].t >= renderAt) {
          a = buf[i]
          b = buf[i + 1]
          break
        }
      }
      const span = b.t - a.t
      const alpha = span > 0 ? Math.max(0, Math.min(1, (renderAt - a.t) / span)) : 1
      nx = a.x + (b.x - a.x) * alpha
      nz = a.z + (b.z - a.z) * alpha
      facing = b.facing
    } else if (buf.length === 1) {
      nx = buf[0].x
      nz = buf[0].z
      facing = buf[0].facing
    }

    // Derive locomotion speed from how far the interpolated point moved → drives
    // the walk/idle animation + bob, exactly like a local character.
    const moved = Math.hypot(nx - cur.x, nz - cur.z)
    const speed = dt > 0 ? moved / dt : 0
    cur.x = nx
    cur.z = nz
    cutout.setGroundPos(nx, nz)

    const walking = speed > WALK_THRESHOLD
    anim.setState(walking ? "walk" : "idle")
    // normalize to the 0..1 the animator expects (local walk speed ≈ 6.5 u/s)
    anim.setSpeed(walking ? Math.min(1, speed / 6.5) : 0)
    anim.update(dt)
    void facing // facing is implicit via yaw-billboard; retained for future turn anim
  }

  return {
    setTarget,
    update,
    stamp,
    getPos: () => ({ x: cur.x, z: cur.z }),
    dispose: () => {
      buf.length = 0
      cutout.dispose()
    },
  }
}
